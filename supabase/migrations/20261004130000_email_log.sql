-- Emails the system sends (the staff, 2026-10-04: they want to email payment receipts and
-- guest billing statements, which could only be printed). Development first.
--
-- One row per email the `send-email` function posts or fails to post. It is what the
-- function counts to hold the day's limit: the app has no staff logins yet (card k74), so
-- anyone holding the site's public key could call the function, and the limit bounds what
-- could ever leave the hotel's address in a day.
--
-- Only the function touches it, with the service key. Row security is on and there is no
-- policy, so the public key can neither read who was emailed nor clear the count.

create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  sent_at timestamptz not null default now(),
  kind text not null check (kind in ('receipt', 'statement')),
  document_number text not null,
  to_address text not null,
  booking_id text,
  status text not null check (status in ('sent', 'failed')),
  error text
);

create index if not exists email_log_sent_at_idx on public.email_log (sent_at);

alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;
