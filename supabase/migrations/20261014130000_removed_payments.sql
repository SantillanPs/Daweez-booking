-- PAYMENTS TAKEN BACK (Sebastian, 2026-10-14).
--
-- The Front desk's History lists everything that happened at the desk, and a payment logged by mistake
-- can be removed from it. Removing one takes the receipt off every booking it paid for, so nothing would
-- be left to say it ever happened. This table keeps that trace: the History shows the payment struck
-- through as "Removed". It is a record only; no money is counted from it.
--
-- Written directly by the app, like `money_handovers`, with the same open policy (no staff accounts
-- yet, card k74).
--
-- Safe to run again.

create table if not exists public.removed_payments (
  id text primary key default (gen_random_uuid())::text,
  receipt_number text,
  amount numeric not null,
  method text,
  paid_at timestamptz,
  prepared_by text,
  guest_name text,
  rooms text,
  booking_ids text[] not null default '{}',
  removed_at timestamptz not null default now()
);
alter table public.removed_payments enable row level security;
drop policy if exists "Allow public full access to removed_payments" on public.removed_payments;
create policy "Allow public full access to removed_payments" on public.removed_payments for all using (true) with check (true);
grant select, insert, update, delete on public.removed_payments to anon, authenticated;
