-- Cancelled bookings, part 2 (2026-10-03). Run after part 1.

-- 1. A cancelled booking frees its room: the two "no double booking" rules skip it.
alter table public.bookings drop constraint no_overlap_room;
alter table public.bookings add constraint no_overlap_room
  exclude using gist (room_id with =, daterange(check_in, check_out) with &&)
  where (room_id is not null and status <> 'cancelled');

alter table public.bookings drop constraint no_overlap_venue;
alter table public.bookings add constraint no_overlap_venue
  exclude using gist (venue_key with =, daterange(check_in, check_out) with &&)
  where (venue_key is not null and status <> 'cancelled');

-- 2. The friendly overlap check inside book_booking / update_booking skips it too.
--    Rebuilt from whatever definition the database holds right now (the rule in
--    docs/why/database.md), by adding one condition in front of each date test.
do $$
declare
  f record;
  def text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('book_booking', 'update_booking')
  loop
    def := pg_get_functiondef(f.oid);
    if position('b.status <> ''cancelled''' in def) = 0 then
      def := replace(def,
        'daterange(b.check_in, b.check_out) && daterange(v_check_in, v_check_out)',
        'b.status <> ''cancelled'' AND daterange(b.check_in, b.check_out) && daterange(v_check_in, v_check_out)');
      execute def;
    end if;
  end loop;
end $$;

-- 3. Cancelling: the row stays, with the time it was cancelled.
create or replace function public.cancel_booking(p_booking_id text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_row jsonb;
begin
  update public.bookings
     set status = 'cancelled', cancelled_at = now(), expires_at = null
   where id = p_booking_id
  returning to_jsonb(bookings.*) into v_row;

  if v_row is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  return v_row;
end;
$function$;

grant execute on function public.cancel_booking(text) to anon, authenticated, service_role;
