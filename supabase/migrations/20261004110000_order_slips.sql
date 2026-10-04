-- Order slips (the staff's feedback, 2026-10-04).
--
-- The staff call the running food bill an ORDER SLIP — the paper they write an order
-- on and hand to the kitchen. The tab could not do four things they asked for:
--
--   1. every slip carries its own number (OS-0001, counting up, never restarting);
--   2. a slip stays open until it is paid, and the next order after that starts a NEW
--      slip — so a stay holds several slips, not one tab for the whole stay. A paid
--      slip used to stay on the Restaurant screen for the rest of the stay;
--   3. the same dish tapped twice reads `2 ×` on one row, not two rows;
--   4. the kitchen's printed copy marks what is new since the last print.
--
-- Every statement is safe to run again.

-- 1. The slip's number ---------------------------------------------------------
-- Given when the FIRST order lands on the slip, not when the slip is opened: a slip
-- opened for a diner who then orders nothing never takes a number, so the numbers the
-- kitchen sees do not skip.
CREATE SEQUENCE IF NOT EXISTS public.order_slip_number_seq;
ALTER TABLE public.tabs ADD COLUMN IF NOT EXISTS os_number bigint;
CREATE UNIQUE INDEX IF NOT EXISTS tabs_os_number_key ON public.tabs (os_number);

CREATE OR REPLACE FUNCTION public.number_order_slip()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update tabs
     set os_number = nextval('order_slip_number_seq')
   where id = new.tab_id and os_number is null;
  return new;
end $function$;

DROP TRIGGER IF EXISTS tab_lines_number_slip ON public.tab_lines;
CREATE TRIGGER tab_lines_number_slip
    AFTER INSERT ON public.tab_lines
    FOR EACH ROW EXECUTE FUNCTION public.number_order_slip();

-- Slips that already hold orders are numbered in the order they were opened.
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT t.id FROM public.tabs t
         WHERE t.os_number IS NULL
           AND EXISTS (SELECT 1 FROM public.tab_lines l WHERE l.tab_id = t.id)
         ORDER BY t.created_at, t.id
    LOOP
        UPDATE public.tabs SET os_number = nextval('public.order_slip_number_seq') WHERE id = r.id;
    END LOOP;
END $$;

-- 2. Paid, and by which receipt ------------------------------------------------
-- A room guest's slip is paid from the booking at the front desk, so the money is on
-- the booking — the slip only needs to know THAT it was paid and by which receipt
-- (taking that payment back makes the slip unpaid again).
ALTER TABLE public.tabs ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE public.tabs ADD COLUMN IF NOT EXISTS paid_receipt_number text;

-- A walk-in slip settled at the counter is already paid.
UPDATE public.tabs t
   SET paid_at = COALESCE((t.payment_records -> -1 ->> 'paid_at')::timestamptz, t.closed_at, now()),
       paid_receipt_number = t.payment_records -> -1 ->> 'receipt_number'
 WHERE t.paid_at IS NULL
   AND jsonb_typeof(t.payment_records) = 'array'
   AND jsonb_array_length(t.payment_records) > 0;

-- A stay with nothing left to pay has paid for its food: its slips are paid, and one
-- still open is closed so the next order starts a new slip.
UPDATE public.tabs t
   SET paid_at = COALESCE(t.closed_at, now()),
       status = 'closed',
       closed_at = COALESCE(t.closed_at, now())
  FROM public.bookings b
 WHERE t.booking_id = b.id
   AND t.paid_at IS NULL
   AND b.payment_status = 'paid'
   AND COALESCE(b.balance_due, 0) <= 0
   AND EXISTS (SELECT 1 FROM public.tab_lines l WHERE l.tab_id = t.id);

-- 3. One row per dish, and what the kitchen has already been given ---------------
-- `sent_qty` is how many of the line the kitchen's last printed slip carried; anything
-- above it is new on the next print. Lines that already exist were served long ago.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'tab_lines' AND column_name = 'sent_qty'
    ) THEN
        ALTER TABLE public.tab_lines ADD COLUMN sent_qty numeric DEFAULT 0 NOT NULL;
        UPDATE public.tab_lines SET sent_qty = qty;
    END IF;
END $$;

-- A line's count can now be changed (2 × instead of a second row). It is still never
-- turned into anything but a charge.
DROP POLICY IF EXISTS "public update tab_lines" ON public.tab_lines;
CREATE POLICY "public update tab_lines" ON public.tab_lines FOR UPDATE TO public
    USING (true) WITH CHECK (kind = 'charge');
