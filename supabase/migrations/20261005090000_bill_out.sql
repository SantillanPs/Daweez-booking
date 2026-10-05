-- The bill goes to the front desk (Sebastian, 2026-10-05).
--
-- He did not want "Guest copy" and "Receive … at the front desk" on the order slip: the
-- restaurant has no printer, and nobody pays there. His words: "send bill to front desk
-- maybe after the guests finish eating or asks for a bill."
--
-- That is how restaurant tills work everywhere he asked me to look (Toast and Square in
-- the US, Lightspeed and LS Central in Europe, Oracle's hotel till, pay-at-the-register in
-- Japan): between "eating" and "paid" a bill has a third state of its own — the bill has
-- been asked for — which the whole house can see, and where guests pay at a cashier the
-- table is freed the moment the bill goes out. In a hotel a room guest's bill is closed
-- onto their room and settled at check-out.
--
-- So a slip is now BILLED OUT: stamped with when, closed to more orders, and handed to
-- the front desk — which already lists a diner under "Diners to pay" and a room guest's
-- slip in their booking. The slip itself is written by the tablet, as slips always were.
--
-- Every statement is safe to run again.

-- 1. When the bill was sent to the front desk --------------------------------------
ALTER TABLE public.tabs ADD COLUMN IF NOT EXISTS billed_at timestamptz;

-- 2. A closed slip is no longer always a paid one -----------------------------------
-- An order that lands on a diner's closed slip was refused with "already paid". The slip
-- may now be closed because its bill is out, so the refusal says only what is true.
-- The function is read from the database and one sentence in it is replaced.
DO $$
DECLARE
  d text;
BEGIN
  SELECT pg_get_functiondef('public.apply_order_changes(uuid, jsonb, text, text, text)'::regprocedure) INTO d;
  IF position('That order slip is already paid.' in d) > 0 THEN
    d := replace(d, 'That order slip is already paid.', 'That order slip is closed: its bill is at the front desk.');
    EXECUTE d;
  END IF;
END $$;
