-- Cancelled bookings, part 1 (2026-10-03). Development database first.
--
-- A cancelled booking used to be DELETED, taking its payments and receipts with it.
-- It now stays as a row with status 'cancelled'. A new enum value cannot be used in
-- the same transaction that adds it, so the rest is in part 2 — run this one first.

alter type public.booking_status add value if not exists 'cancelled';
alter table public.bookings add column if not exists cancelled_at timestamptz;
