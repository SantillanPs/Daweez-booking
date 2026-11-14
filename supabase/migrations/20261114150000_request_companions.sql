-- A request for more than one person carries the companions' names (Sebastian, 2026-11-14: "if the guest says
-- that they want to book for more than 1 person, they should require to ask for the names of the companions").
-- They go onto the bill's companions when the desk books it.
alter table public.booking_requests add column if not exists companions text[] not null default '{}';

drop function if exists public.request_booking(text, text, date, date, text, text, integer, text, numeric, text);
create or replace function public.request_booking(
  p_source text, p_room_id text, p_check_in date, p_check_out date, p_guest_name text, p_phone text,
  p_guests integer default null, p_note text default null, p_quoted_total numeric default null, p_language text default null,
  p_companions text[] default '{}')
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_span int4range := public.booking_halves(p_check_in, p_check_out, null, null, null, null, null);
  v_names text[] := array(select trim(n) from unnest(coalesce(p_companions, '{}')) n where length(trim(n)) > 0);
  v_id uuid;
begin
  if p_check_in < (now() at time zone 'Asia/Manila')::date or p_check_out <= p_check_in
     or p_check_out > p_check_in + 60 then
    raise exception 'BAD_DATES';
  end if;
  if length(trim(coalesce(p_guest_name, ''))) = 0 or length(p_guest_name) > 120
     or length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 7 or length(p_phone) > 40
     or length(coalesce(p_note, '')) > 1000
     or coalesce(array_length(v_names, 1), 0) > 30 or exists (select 1 from unnest(v_names) n where length(n) > 120) then
    raise exception 'BAD_DETAILS';
  end if;
  -- Everyone but the guest is named: two people means one companion.
  if coalesce(p_guests, 1) > 1 and coalesce(array_length(v_names, 1), 0) < p_guests - 1 then
    raise exception 'NEED_COMPANIONS';
  end if;
  if not exists (select 1 from rooms where id = p_room_id) and not exists (select 1 from venues where id = p_room_id) then
    raise exception 'NO_SUCH_ROOM';
  end if;
  -- ponytail: any Exclusive day refuses every room and venue; refine with exclusiveCovers if the grounds kind matters.
  if exists (select 1 from bookings b
             where (b.room_id = p_room_id or b.venue_id = p_room_id or b.venue_id = 'venue-exclusive') and b.status <> 'cancelled'
               and public.booking_halves(b.check_in, b.check_out, b.stay_hours, b.stay_half,
                     b.actual_check_in, b.late_check_out_hours, b.actual_check_out) && v_span) then
    raise exception 'ROOM_UNAVAILABLE';
  end if;
  -- A flood guard: the public key can call this.
  if (select count(*) from booking_requests where status = 'open' and phone = p_phone) >= 3
     or (select count(*) from booking_requests where status = 'open') >= 100 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;
  insert into booking_requests (source, room_id, check_in, check_out, guests, guest_name, phone, note, quoted_total, language, companions)
  values (p_source, p_room_id, p_check_in, p_check_out, p_guests, trim(p_guest_name), trim(p_phone), p_note, p_quoted_total, p_language, v_names)
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.request_booking(text, text, date, date, text, text, integer, text, numeric, text, text[]) to anon, authenticated;
