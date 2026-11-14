-- An expense paid with money from somewhere else, not the hotel (Sebastian, 2026-11-14): still a cost,
-- but it never comes off the cash on hand (`buildDailyReport`).
alter table public.expenses add column if not exists not_from_cash boolean not null default false;
