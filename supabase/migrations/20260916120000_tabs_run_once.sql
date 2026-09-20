-- Guest tab (k69) — ONE FILE TO RUN, for a project that is not sure which of the
-- three tab migrations were applied.
--
-- The live project's migration history drifted before (see the note in
-- supabase/AGENTS.md), and the owner asked, plainly, "do I need to paste some SQL
-- into Supabase?". The answer has to be one block, not three. So this file is the
-- first two tab migrations and the payment column merged into a single idempotent
-- script: every statement is safe to run again, and safe to run on a database
-- where some of it is already in place. It changes nothing that already exists.
--
--   20260912120000_add_guest_tabs.sql        -> the two tables, access, realtime
--   20260913120000_allow_tab_line_delete.sql -> a wrong line may be removed
--   20260915120000_add_tab_payments.sql      -> a settled tab keeps its receipts
--
-- The three original migrations remain the record of what changed and why; this
-- file exists so nobody has to work out which of them already ran.

-- 1. Tabs and their lines -----------------------------------------------------
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

CREATE TABLE IF NOT EXISTS public.tab_lines (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tab_id uuid NOT NULL REFERENCES public.tabs(id) ON DELETE RESTRICT,
    description text NOT NULL,
    qty numeric DEFAULT 1 NOT NULL,
    unit_price numeric DEFAULT 0 NOT NULL,
    amount numeric NOT NULL,
    kind text DEFAULT 'charge' NOT NULL,
    corrects_line_id uuid REFERENCES public.tab_lines(id) ON DELETE CASCADE,
    reason text,
    created_by text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT tab_lines_kind_check CHECK (kind IN ('charge', 'correction')),
    CONSTRAINT tab_lines_correction_check CHECK (
        kind <> 'correction'
        OR (corrects_line_id IS NOT NULL AND amount < 0 AND reason IS NOT NULL)
    ),
    CONSTRAINT tab_lines_description_check CHECK (length(btrim(description)) > 0)
);
CREATE INDEX IF NOT EXISTS tab_lines_tab_idx ON public.tab_lines (tab_id);
CREATE INDEX IF NOT EXISTS tab_lines_created_idx ON public.tab_lines (created_at);

-- 2. A settled walk-in tab keeps its own numbered receipts (k69, part C) -------
ALTER TABLE public.tabs ADD COLUMN IF NOT EXISTS payment_records jsonb;

-- 3. Access: the dashboard runs on the public (anon) key ----------------------
ALTER TABLE public.tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tab_lines ENABLE ROW LEVEL SECURITY;

-- A tab is opened and closed, never deleted.
DROP POLICY IF EXISTS "public read tabs" ON public.tabs;
CREATE POLICY "public read tabs" ON public.tabs FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "public add tabs" ON public.tabs;
CREATE POLICY "public add tabs" ON public.tabs FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "public update tabs" ON public.tabs;
CREATE POLICY "public update tabs" ON public.tabs FOR UPDATE TO public USING (true) WITH CHECK (true);

-- A line is never rewritten in place: staff remove it and add the right one.
DROP POLICY IF EXISTS "public read tab_lines" ON public.tab_lines;
CREATE POLICY "public read tab_lines" ON public.tab_lines FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "public add tab_lines" ON public.tab_lines;
CREATE POLICY "public add tab_lines" ON public.tab_lines FOR INSERT TO public
    WITH CHECK (kind = 'charge' OR (corrects_line_id IS NOT NULL AND amount < 0));
DROP POLICY IF EXISTS "public delete tab_lines" ON public.tab_lines;
CREATE POLICY "public delete tab_lines" ON public.tab_lines FOR DELETE TO public USING (true);

-- 4. Binning a charge takes any correction that answered it with it -----------
DO $$
DECLARE c text;
BEGIN
    SELECT conname INTO c FROM pg_constraint
     WHERE conrelid = 'public.tab_lines'::regclass
       AND contype = 'f'
       AND conkey = ARRAY[(
             SELECT attnum::smallint FROM pg_attribute
              WHERE attrelid = 'public.tab_lines'::regclass AND attname = 'corrects_line_id'
           )];
    IF c IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.tab_lines DROP CONSTRAINT %I', c);
    END IF;
    ALTER TABLE public.tab_lines
        ADD CONSTRAINT tab_lines_corrects_line_id_fkey
        FOREIGN KEY (corrects_line_id) REFERENCES public.tab_lines(id) ON DELETE CASCADE;
END $$;

-- 5. Live updates, so a second tablet sees a new order ------------------------
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tabs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tab_lines;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
