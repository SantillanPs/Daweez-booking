-- A RECEIPT ON EVERY ROOM THE PAYMENT COVERED (the owner's ruling, 2026-09-30).
--
-- His words, which are the whole specification: *"the only problem I had with the rooms sharing a receipt is
-- that if there are more than one rooms booked at the same time, the staff would need to find the room that
-- holds the payment receipt."* So the receipt is **stored on every room it paid for** — stored many times,
-- **printed once** — and each room keeps **its own share** in `downpayment_paid`, because that is what settles
-- its own bill.
--
-- WHY THIS EXISTS. Until today `recordBookingPayment` wrote the receipt onto the FIRST booking of a set and left
-- every other room holding money with nothing to show: on this hotel's own bookings a ₱1,900 payment for two
-- rooms and a ₱9,200 payment for seven produced two receipts, eight rooms with none, and — the fault the owner
-- spotted first — `PR-202609-001` stamped on TWO different payments, because the number was derived from the
-- booking's own records and a fresh booking always starts at `001`.
--
-- WHAT IT CHANGES, and nothing else:
--   1. Copies each payment's receipt onto every room of its own set.
--   2. Moves a duplicated receipt number onto the month's next free number, so one number means one payment.
--   3. **`downpayment_paid`, `balance_due` and `payment_status` are never touched.** Not one peso moves; only
--      what the rooms know about the receipt changes.
--
-- HOW IT FINDS A SET, without guessing: a booking holds a receipt larger than its own share, and the other rooms
-- of that booking are the same guest's bookings written within a minute that carry no receipt — **and they are
-- only accepted when their shares plus the holder's add up to exactly the receipt's amount.** If the sums do not
-- match, nothing is written. That rule was dry-run against the live rows before this file was applied: all three
-- sets present matched to the peso (₱1,900 and ₱9,200 sharing one number, and one older ₱2,700 with no number).

-- ── 1. Spread each payment's receipt onto the rest of its set ─────────────────────────────────────────────
with holders as (
  select b.id, b.guest_name, b.created_at, coalesce(b.downpayment_paid, 0) as share,
         (r->>'receipt_number') as receipt_number,
         (r->>'amount')::numeric as amount,
         r as record
  from bookings b
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(b.payment_records) = 'array' then b.payment_records else '[]'::jsonb end) r
  -- only a receipt that is bigger than the room's own share can have covered other rooms
  where (r->>'amount')::numeric > coalesce(b.downpayment_paid, 0)
),
proposed as (
  select h.id as holder_id, h.receipt_number, h.amount, h.share, h.record,
         c.id as member_id, coalesce(c.downpayment_paid, 0) as member_share,
         sum(coalesce(c.downpayment_paid, 0)) over (partition by h.id) + h.share as adds_up_to
  from holders h
  join bookings c
    on c.guest_name = h.guest_name
   and c.id <> h.id
   and coalesce(c.downpayment_paid, 0) > 0
   and c.created_at between h.created_at - interval '1 minute' and h.created_at + interval '1 minute'
   -- a room that already carries this payment is not a candidate again
   and not exists (
     select 1 from jsonb_array_elements(
       case when jsonb_typeof(c.payment_records) = 'array' then c.payment_records else '[]'::jsonb end) x
     where h.receipt_number is not null and x->>'receipt_number' = h.receipt_number)
),
accepted as (
  select member_id, record from proposed where adds_up_to = amount
)
update bookings b
set payment_records = coalesce(b.payment_records, '[]'::jsonb) || jsonb_build_array(a.record)
from accepted a
where b.id = a.member_id
  and jsonb_typeof(coalesce(b.payment_records, '[]'::jsonb)) = 'array';

-- ── 2. One receipt number means one payment ──────────────────────────────────────────────────────────────
-- A number used by two different payments (told apart by their amount and the moment they were taken): the
-- earliest keeps it, and every later one moves to a number **above every number in use**, so a moved receipt
-- can never land on one that is already taken.
--
-- **Read this before writing another pass like it.** The first version of this step placed each moved number
-- at `max + row_number()`, computed in the same statement — and it put two receipts on numbers that were
-- already in use, twice. After the two passes below, exactly one number was still shared, and it was split
-- **literally** (step 3) rather than by a third rule. Numbers on paper are quoted to guests; a rule that is
-- merely probably right is not good enough for them.
with used as (
  select distinct (x->>'receipt_number') as rn,
         (x->>'amount')::numeric as amount,
         (x->>'paid_at')::timestamptz as paid_at
  from bookings b
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(b.payment_records) = 'array' then b.payment_records else '[]'::jsonb end) x
  where x->>'receipt_number' is not null
),
ranked as (
  select rn, amount, paid_at, left(rn, 10) as stem,
         row_number() over (partition by rn order by paid_at, amount) as seq
  from used
),
ceiling as (
  select coalesce(max(nullif(regexp_replace(rn, '^.*-', ''), '')::int), 0) as top from used
),
plan as (
  select r.rn as old_rn, r.amount as old_amount,
         r.stem || lpad(((select top from ceiling)
           + row_number() over (order by r.paid_at, r.amount))::text, 3, '0') as new_rn
  from ranked r
  where r.seq > 1
)
update bookings b
set payment_records = (
  select jsonb_agg(
    case when x->>'receipt_number' = p.old_rn and (x->>'amount')::numeric = p.old_amount
         then jsonb_set(x, '{receipt_number}', to_jsonb(p.new_rn))
         else x end
    order by ord)
  from jsonb_array_elements(
    case when jsonb_typeof(b.payment_records) = 'array' then b.payment_records else '[]'::jsonb end)
    with ordinality as t(x, ord)
)
from plan p
where exists (
  select 1 from jsonb_array_elements(
    case when jsonb_typeof(b.payment_records) = 'array' then b.payment_records else '[]'::jsonb end) x
  where x->>'receipt_number' = p.old_rn
    and (x->>'amount')::numeric = p.old_amount
);

-- ── 3. The last number shared by two payments, split literally ───────────────────────────────────────────
-- `PR-202609-012` was on two payments taken weeks apart:
--   CAAP,     room 5, ₱600,   28 Sep 09:12  — keeps 012
--   ROSE ANN, room 4, ₱1,400, 19 Sep 07:37  — becomes 013
-- Written against the payment itself (its number, amount and exact moment) rather than by a rule, because
-- the rule had already mis-placed a number twice. 003 is left unused on purpose: it belonged to BRIAN LUCHE
-- before this repair, and re-using it would only make the office's paper trail harder to follow.
update bookings
set payment_records = (
  select jsonb_agg(
    case when x->>'receipt_number' = 'PR-202609-012'
              and x->>'amount' = '1400'
              and x->>'paid_at' = '2026-09-19T07:37:02.275Z'
         then jsonb_set(x, '{receipt_number}', to_jsonb('PR-202609-013'::text))
         else x end
    order by ord)
  from jsonb_array_elements(
    case when jsonb_typeof(payment_records) = 'array' then payment_records else '[]'::jsonb end)
    with ordinality as t(x, ord)
)
where id = (select b.id from bookings b where b.invoice_number = 'GRF-2026-09-0007' limit 1)
  and exists (
    select 1 from jsonb_array_elements(
      case when jsonb_typeof(payment_records) = 'array' then payment_records else '[]'::jsonb end) x
    where x->>'receipt_number' = 'PR-202609-012'
      and x->>'paid_at' = '2026-09-19T07:37:02.275Z');

-- Verified after: 10 numbers in use · **0 shared by two payments** · every room holds its own share · the one
-- booking still holding money with no receipt is the July backfill (`GRF-2026-07-0005`, ₱900), which has no
-- dated payment to attach — the case `dailyReport.ts` reports rather than hides.

