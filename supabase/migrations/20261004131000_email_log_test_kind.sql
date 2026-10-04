-- A test email from Settings → Email is counted like any other (2026-10-04). Development first.
--
-- Whoever connects the hotel's Gmail sends themselves a test to see it work. It leaves the
-- hotel's address like a receipt does, so it is logged and held to the same daily limit —
-- which needs `email_log.kind` to allow it.

alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check
  check (kind in ('receipt', 'statement', 'test'));
