-- THE VACATION HOUSE ON AIRBNB (Sebastian, 2026-11-19: it takes overnight guests, ₱7,500 a night, up to 10).
--
-- The calendar links were written for rooms. A venue's booking keeps its venue in `venue_id` (`venue_key`)
-- and has no `room_id`, so a link for `venue-vacation` exported none of its events and would have added
-- an Airbnb stay as a "room" nobody's calendar row shows. The link's id may now be a venue's.

-- What a link's id covers: a room by `room_id`, a venue by `venue_key`, and Pension House Exclusive on
-- the days it has what that id is (`exclusive_covers`: every room and the Gazebo, the Vacation House and
-- the Garden only when it is the grounds kind).
create or replace function public.channel_covers(p_id text, b bookings)
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select case when p_id like 'venue-%'
    then b.venue_key = p_id
      or (b.venue_key = 'venue-exclusive' and exclusive_covers(b.event_addons->>'venue_type', null, p_id))
    else b.room_id = p_id or b.venue_key = 'venue-exclusive'
  end;
$$;

create or replace function public.insert_channel_stay(p_channel text, p_ref text, p_room_id text, p_check_in date, p_check_out date)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id text;
  v_venue boolean := p_room_id like 'venue-%';
begin
  for attempt in 1..5 loop
    begin
      insert into bookings (room_id, venue_id, guest_name, guest_email, guest_phone, check_in, check_out, source, status,
                            payment_status, payment_plan, balance_due, invoice_number, channel_ref)
      values (case when v_venue then null else p_room_id end, case when v_venue then p_room_id end,
              case when p_channel = 'airbnb' then 'Airbnb guest' else 'Booking.com guest' end, '', '',
              p_check_in, p_check_out, p_channel::booking_source, 'confirmed',
              'unpaid', 'reservation', 0, next_bill_number(), p_ref)
      returning id into v_id;
      return v_id;
    exception when unique_violation then
      -- Another booking took that number, or another sync already added this stay.
      if exists (select 1 from bookings where channel_ref = p_ref and status <> 'cancelled') then
        return null;
      end if;
    end;
  end loop;
  raise exception 'NO_BILL_NUMBER';
end;
$$;

create or replace function public.add_channel_stay(p_channel text, p_ref text, p_room_id text, p_check_in date, p_check_out date)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id text;
  v_in_way text;
begin
  begin
    v_id := insert_channel_stay(p_channel, p_ref, p_room_id, p_check_in, p_check_out);
    delete from channel_alerts where ref = p_ref and kind = 'clash';
    return jsonb_build_object('added', v_id is not null);
  exception when exclusion_violation then
    select b.id into v_in_way
      from bookings b
     where channel_covers(p_room_id, b) and b.status <> 'cancelled'
       and booking_halves(b.check_in, b.check_out, b.stay_hours, b.stay_half, b.actual_check_in, b.late_check_out_hours, b.actual_check_out)
           && booking_halves(p_check_in, p_check_out, null, null, null, null, null)
     order by b.check_in
     limit 1;
    insert into channel_alerts (kind, channel, ref, room_id, check_in, check_out, booking_id)
    values ('clash', p_channel, p_ref, p_room_id, p_check_in, p_check_out, v_in_way)
    on conflict (ref, kind) do update set booking_id = excluded.booking_id;
    return jsonb_build_object('added', false, 'clash_with', v_in_way);
  end;
end;
$$;
revoke all on function public.insert_channel_stay(text, text, text, date, date) from public, anon, authenticated;
revoke all on function public.add_channel_stay(text, text, text, date, date) from public, anon, authenticated;

create or replace function public.channel_export(p_room_id text, p_for text default null)
returns table (id text, first_night date, last_night date, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.id::text,
         date '2000-01-01' + ceil((lower(h.r) - 2) / 2.0)::int,
         date '2000-01-01' + floor((upper(h.r) - 2) / 2.0)::int,
         b.created_at
    from bookings b
    cross join lateral (
      select booking_halves(b.check_in, b.check_out, b.stay_hours, b.stay_half, b.actual_check_in, b.late_check_out_hours, b.actual_check_out) as r
    ) h
   where channel_covers(p_room_id, b)
     and b.status in ('pending', 'confirmed', 'blocked')
     and upper(h.r) >= ((now() at time zone 'Asia/Manila')::date - date '2000-01-01') * 2
     and (p_for is null or b.channel_ref is null or b.channel_ref not like p_for || '|' || p_room_id || '|%');
$$;
grant execute on function public.channel_export(text, text) to anon, authenticated;
