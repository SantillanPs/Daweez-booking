-- Staff only (2026-11-15). Until now the anon key that ships in every page could read every guest and
-- write almost every table — the staff passcode was only checked in the browser. Sebastian: "there's
-- basically no way of preventing the guests or anyone at all from accessing the system once we go live".
-- From here the staff screens need the one hotel login (Supabase Auth), and anon keeps only what the
-- public website needs: rooms, venues, the rates and where guests pay, which days are taken, and
-- `request_booking`. The edge functions use the service role and are not touched by this.

-- 1. One hotel login, so one account. Sign-ups are also switched off in the dashboard; this holds even
--    if that switch is ever left on, since a signed-in account can do everything a staff member can.
create or replace function public.one_hotel_login() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'This system has one hotel login; no more accounts can be made.';
  end if;
  return new;
end $$;

drop trigger if exists one_hotel_login on auth.users;
create trigger one_hotel_login before insert on auth.users
  for each row execute function public.one_hotel_login();

-- 2. Every rule that let anyone in now lets only the hotel login in. Each policy keeps what it allowed
--    (read only stays read only); only who it is for changes.
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('alter policy %I on public.%I to authenticated', p.policyname, p.tablename);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- 3. What the public website reads.
grant select on public.rooms, public.venues, public.app_settings to anon;
create policy "website reads rooms" on public.rooms for select to anon using (true);
create policy "website reads venues" on public.venues for select to anon using (true);
-- The rates price a stay and the accounts are printed on every bill; nothing else in app_settings.
create policy "website reads rates and accounts" on public.app_settings for select to anon
  using (key in ('rate_config', 'payment_accounts'));

-- Which days are taken, without who: the website only has to know a room is not free.
create or replace function public.taken_stays()
returns table (id text, room_id text, venue_id text, status text, check_in date, check_out date,
  stay_hours numeric, stay_half smallint, actual_check_in timestamptz, actual_check_out timestamptz,
  late_check_out_hours numeric, venue_type text)
language sql stable security definer set search_path = '' as $$
  select b.id, b.room_id, b.venue_id, b.status, b.check_in, b.check_out,
    b.stay_hours, b.stay_half, b.actual_check_in, b.actual_check_out,
    b.late_check_out_hours, b.event_addons->>'venue_type'
  from public.bookings b
  where b.status <> 'cancelled'
    and (b.status <> 'pending' or b.expires_at is null or b.expires_at > now())
    and b.check_out >= current_date - 1
$$;

-- 4. Functions: only the hotel login runs them, except the two the website calls. Functions that
--    belong to an extension (btree_gist, behind the no-double-booking rule) are left alone.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;
-- A function made later is not open to everyone by default.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

grant execute on function public.request_booking(text, text, date, date, text, text, integer, text, numeric, text, text[]) to anon;
grant execute on function public.taken_stays() to anon;
