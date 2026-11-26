-- The website's reserve flow (Sebastian, 2026-11-26): guests only checked prices, because the site made them
-- pay online first, took one room per request and asked every companion's name. Now a website request can
-- hold several rooms, says roughly when the guest arrives, and is either paid now or names a day (up to a
-- month from today, and before the stay) when the guest comes to the front desk to pay the half.
-- A request still holds nothing: until it is paid, someone else can take the room.

alter table public.booking_requests
  add column if not exists more_rooms text[] not null default '{}',
  add column if not exists arrival text,
  add column if not exists pay_on date;

drop function if exists public.request_booking(text, text, date, date, text, text, integer, text, numeric, text, text[], numeric, text, text, text, text, jsonb);

create function public.request_booking(
  p_source text, p_room_id text, p_check_in date, p_check_out date, p_guest_name text, p_phone text,
  p_guests integer default null, p_note text default null, p_quoted_total numeric default null, p_language text default null,
  p_companions text[] default '{}', p_pay_amount numeric default null, p_pay_method text default null,
  p_pay_account text default null, p_pay_reference text default null, p_pay_shot text default null, p_pay_read jsonb default null,
  p_more_rooms text[] default '{}', p_arrival text default null, p_pay_on date default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_span int4range := public.booking_halves(p_check_in, p_check_out, null, null, null, null, null);
  v_names text[] := array(select trim(n) from unnest(coalesce(p_companions, '{}')) n where length(trim(n)) > 0);
  v_more text[] := array(select distinct m from unnest(coalesce(p_more_rooms, '{}')) m where m is not null and m <> p_room_id);
  v_paid boolean := coalesce(p_pay_amount, 0) > 0;
  v_id uuid;
begin
  if p_check_in < v_today or p_check_out <= p_check_in or p_check_out > p_check_in + 60 then
    raise exception 'BAD_DATES';
  end if;
  if length(trim(coalesce(p_guest_name, ''))) = 0 or length(p_guest_name) > 120
     or length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 7 or length(p_phone) > 40
     or length(coalesce(p_note, '')) > 1000 or length(coalesce(p_arrival, '')) > 30
     or coalesce(array_length(v_names, 1), 0) > 30 or exists (select 1 from unnest(v_names) n where length(n) > 120)
     or coalesce(array_length(v_more, 1), 0) > 9 then
    raise exception 'BAD_DETAILS';
  end if;
  -- A website request is paid now, or names the day the guest comes to pay: today at the earliest,
  -- a month from today at the latest, and before the stay begins.
  if p_source = 'website' and v_paid and (p_pay_method not in ('GCash', 'Bank transfer')
     or p_pay_account not in ('gcash', 'bank', 'bank2') or coalesce(p_pay_shot, '') !~ '^[0-9a-f-]{36}\.[a-z]{3,4}$'
     or length(regexp_replace(coalesce(p_pay_reference, ''), '\D', '', 'g')) < 6 or length(p_pay_reference) > 60) then
    raise exception 'NEED_PAYMENT';
  end if;
  if p_source = 'website' and not v_paid
     and (p_pay_on is null or p_pay_on < v_today or p_pay_on > least(v_today + 30, p_check_in - 1)) then
    raise exception 'NEED_PAYMENT';
  end if;
  -- The website no longer asks for companions; the bot still does.
  if p_source <> 'website' and exists (select 1 from rooms where id = p_room_id)
     and coalesce(p_guests, 1) > 1 and coalesce(array_length(v_names, 1), 0) < p_guests - 1 then
    raise exception 'NEED_COMPANIONS';
  end if;
  if exists (select 1 from unnest(array_prepend(p_room_id, v_more)) u
             where not exists (select 1 from rooms where id = u) and not exists (select 1 from venues where id = u)) then
    raise exception 'NO_SUCH_ROOM';
  end if;
  if exists (select 1 from bookings b
             where (b.room_id = any(array_prepend(p_room_id, v_more)) or b.venue_id = any(array_prepend(p_room_id, v_more))
                    or b.venue_id = 'venue-exclusive') and b.status <> 'cancelled'
               and public.booking_halves(b.check_in, b.check_out, b.stay_hours, b.stay_half,
                     b.actual_check_in, b.late_check_out_hours, b.actual_check_out) && v_span) then
    raise exception 'ROOM_UNAVAILABLE';
  end if;
  if (select count(*) from booking_requests where status = 'open' and phone = p_phone) >= 3
     or (select count(*) from booking_requests where status = 'open') >= 100 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;
  insert into booking_requests (source, room_id, check_in, check_out, guests, guest_name, phone, note, quoted_total, language, companions,
                                pay_amount, pay_method, pay_account, pay_reference, pay_shot, pay_read, more_rooms, arrival, pay_on)
  values (p_source, p_room_id, p_check_in, p_check_out, p_guests, trim(p_guest_name), trim(p_phone), p_note, p_quoted_total, p_language, v_names,
          case when v_paid then p_pay_amount end, case when v_paid then p_pay_method end, case when v_paid then p_pay_account end,
          case when v_paid then nullif(trim(p_pay_reference), '') end, case when v_paid then p_pay_shot end,
          case when v_paid and jsonb_typeof(p_pay_read) = 'object' and length(p_pay_read::text) < 2000 then p_pay_read end,
          v_more, nullif(trim(coalesce(p_arrival, '')), ''), case when not v_paid then p_pay_on end)
  returning id into v_id;
  return v_id;
end;
$function$;

grant execute on function public.request_booking(text, text, date, date, text, text, integer, text, numeric, text, text[], numeric, text, text, text, text, jsonb, text[], text, date)
  to anon, authenticated, service_role;
revoke execute on function public.request_booking(text, text, date, date, text, text, integer, text, numeric, text, text[], numeric, text, text, text, text, jsonb, text[], text, date)
  from public;

-- The guest's own page names every room of the request, and the day they said they would come to pay.
create or replace function public.request_status(p_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'status', r.status,
    'place', coalesce(
      case when cardinality(r.more_rooms) > 0
        then 'Rooms ' || (select string_agg(m.room_number::text, ', ' order by m.room_number) from rooms m where m.id = any(array_prepend(r.room_id, r.more_rooms)))
      end,
      'Room ' || rm.room_number, v.name, r.room_id),
    'check_in', r.check_in,
    'check_out', r.check_out,
    'pay_amount', r.pay_amount,
    'pay_method', r.pay_method,
    'pay_reference', r.pay_reference,
    'pay_on', r.pay_on,
    'quoted_total', r.quoted_total,
    'created_at', r.created_at)
  from booking_requests r
  left join rooms rm on rm.id = r.room_id
  left join venues v on v.id = r.room_id
  where r.id = p_id;
$$;

revoke all on function public.request_status(uuid) from public;
grant execute on function public.request_status(uuid) to anon, authenticated;
