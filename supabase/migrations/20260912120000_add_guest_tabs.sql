-- Guest tabs (board card k69): a running bill for a stay, and for walk-in diners
-- who have no room. Food and bar lines live in their OWN tables so that adding a
-- charge never writes a booking row at all — bookings, and therefore the
-- book_booking / update_booking functions, stay untouched.
--
-- Lines are append-only: a line can be added but never changed or deleted. A
-- mistake is fixed by adding a negative "correction" line that names the line it
-- corrects and says why.

-- 1. Tabs --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tabs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    -- bookings.id is TEXT (it holds legacy ids like 'manual-…'), never uuid.
    booking_id text,
    label text,          -- the walk-in's name, when there is no booking
    table_label text,    -- optional table / seating, for the restaurant
    status text DEFAULT 'open' NOT NULL,
    opened_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    closed_at timestamptz,
    opened_by text,      -- staff name, once staff identity lands (k74)
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT tabs_status_check CHECK (status IN ('open', 'closed'))
);

-- One open tab per booking: a group booking is several bookings, so several tabs.
CREATE UNIQUE INDEX IF NOT EXISTS tabs_one_open_per_booking
    ON public.tabs (booking_id) WHERE status = 'open' AND booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tabs_booking_idx ON public.tabs (booking_id);
CREATE INDEX IF NOT EXISTS tabs_status_idx ON public.tabs (status);

-- 2. Tab lines ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tab_lines (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tab_id uuid NOT NULL REFERENCES public.tabs(id) ON DELETE RESTRICT,
    description text NOT NULL,
    qty numeric DEFAULT 1 NOT NULL,
    unit_price numeric DEFAULT 0 NOT NULL,
    -- signed: a charge is positive, a correction is negative.
    amount numeric NOT NULL,
    kind text DEFAULT 'charge' NOT NULL,
    corrects_line_id uuid REFERENCES public.tab_lines(id) ON DELETE RESTRICT,
    reason text,
    created_by text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT tab_lines_kind_check CHECK (kind IN ('charge', 'correction')),
    -- a correction must point at the line it fixes, be negative, and say why
    CONSTRAINT tab_lines_correction_check CHECK (
        kind <> 'correction'
        OR (corrects_line_id IS NOT NULL AND amount < 0 AND reason IS NOT NULL)
    ),
    CONSTRAINT tab_lines_description_check CHECK (length(btrim(description)) > 0)
);
CREATE INDEX IF NOT EXISTS tab_lines_tab_idx ON public.tab_lines (tab_id);
CREATE INDEX IF NOT EXISTS tab_lines_created_idx ON public.tab_lines (created_at);

-- 3. Access ------------------------------------------------------------------
ALTER TABLE public.tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tab_lines ENABLE ROW LEVEL SECURITY;

-- Tabs can be opened and closed, but never deleted.
DROP POLICY IF EXISTS "public read tabs" ON public.tabs;
CREATE POLICY "public read tabs" ON public.tabs FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "public add tabs" ON public.tabs;
CREATE POLICY "public add tabs" ON public.tabs FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "public update tabs" ON public.tabs;
CREATE POLICY "public update tabs" ON public.tabs FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Lines are append-only. There is deliberately no UPDATE and no DELETE policy,
-- so the database itself refuses to alter or remove a line — the append-only
-- rule staff agreed to is enforced here, not only in the app.
DROP POLICY IF EXISTS "public read tab_lines" ON public.tab_lines;
CREATE POLICY "public read tab_lines" ON public.tab_lines FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "public add tab_lines" ON public.tab_lines;
CREATE POLICY "public add tab_lines" ON public.tab_lines FOR INSERT TO public
    WITH CHECK (kind = 'charge' OR (corrects_line_id IS NOT NULL AND amount < 0));

-- 4. Live updates ------------------------------------------------------------
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tabs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tab_lines;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
