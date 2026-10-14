-- CASH ADDED TO THE HOTEL (Sebastian, 2026-10-14).
--
-- When the staff began using the system for real they already held cash in the hotel, and Today's
-- money had no way to take it in. Cash put into the hotel is the hand-over the other way round: it is
-- not money earned, so it stays out of the earnings report, and it adds to the money in the hotel.
-- So a hand-over row now has a direction: 'out' (handed to the owner) or 'in' (cash added).
--
-- Safe to run again.

alter table public.money_handovers
  add column if not exists kind text not null default 'out';

alter table public.money_handovers drop constraint if exists money_handovers_kind_check;
alter table public.money_handovers add constraint money_handovers_kind_check check (kind in ('out', 'in'));
