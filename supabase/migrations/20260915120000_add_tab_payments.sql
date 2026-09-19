-- Guest tabs (board card k69, part C): a walk-in tab can be SETTLED at the counter.
--
-- A walk-in diner has no booking, and the money fields today live on `bookings`
-- (`payment_records`, `downpayment_paid`, `balance_due`). So a tab needs its own
-- place to keep the payments taken for it — the same numbered PaymentRecord shape
-- the rest of the app already uses, so receipts stay one kind of thing.

ALTER TABLE public.tabs
    ADD COLUMN IF NOT EXISTS payment_records jsonb;

COMMENT ON COLUMN public.tabs.payment_records IS
    'One numbered receipt per payment taken for this tab (k69). Same shape as bookings.payment_records.';
