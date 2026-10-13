-- MONEY HANDED OVER TO THE OWNER (Sebastian, 2026-10-13).
--
-- The staff hand the money they collected to the owner (a "remittance"). It leaves the hotel, so
-- Today's money takes it off "Money in the hotel" — but it is not an expense: the hotel earned it,
-- so it has its own table and the earnings report never reads it.
--
-- Written directly by the app, like `expenses`, with the same open policy (there are no staff
-- accounts yet, card k74).
--
-- Safe to run again.

create table if not exists public.money_handovers (
  id text primary key default (gen_random_uuid())::text,
  amount numeric not null check (amount > 0),
  handover_date date not null,
  handed_by text,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.money_handovers enable row level security;
drop policy if exists "Allow public full access to money_handovers" on public.money_handovers;
create policy "Allow public full access to money_handovers" on public.money_handovers for all using (true) with check (true);
grant select, insert, update, delete on public.money_handovers to anon, authenticated;
