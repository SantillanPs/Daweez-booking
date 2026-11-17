-- Pay later (Sebastian, 2026-11-17): diners who eat and do not pay at once left their order slips
-- sitting on the restaurant's tables or under "Diners to pay", taking up space and attention
-- (live, that day: six served slips never billed, the oldest from 22 Oct). "Send bill" can now put a
-- slip on the front desk's Pay later list under the name of who pays: the slip is billed and closed
-- like any bill sent over, and this stamp keeps it out of "Diners to pay". Its payments go on
-- `payment_records` as before, a bit at a time if need be; `paid_at` is set once it is all paid.
ALTER TABLE public.tabs ADD COLUMN IF NOT EXISTS pay_later_at timestamptz;
