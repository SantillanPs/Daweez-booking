-- PENSION HOUSE EXCLUSIVE TAKES THE WHOLE HOUSE (Sebastian, 2026-11-07: "that usually means
-- everything will be reserved and occupied. as in EVERYTHING. all rooms and venues").
--
-- It was a venue row like any other, so a room or the Gazebo could still be sold on its days.
-- Now an Exclusive and any other booking that is not cancelled may not share a half-day, both
-- ways round. Two Exclusives are already kept apart by `no_overlap_venue`.
--
-- One constraint does it: the "is it the Exclusive" flag must DIFFER (`<>`) for two rows whose
-- half-days overlap to be refused, so an Exclusive clashes with everything that is not one.
-- `venue_key` is the normalized venue id (a generated column).
--
-- Applied to development on 2026-11-07. On live the same day, the constraint only: live has none
-- of the calendar-link functions yet, so the two below go with that migration when it is promoted.

ALTER TABLE public.bookings
  ADD CONSTRAINT no_overlap_exclusive EXCLUDE USING gist (
    (CASE WHEN venue_key = 'venue-exclusive' THEN 1 ELSE 0 END) WITH <>,
    booking_halves(check_in, check_out, stay_hours, stay_half, actual_check_in, late_check_out_hours, actual_check_out) WITH &&
  ) WHERE (status <> 'cancelled'::booking_status);

-- A booking site that sells a room under an Exclusive gets the same "sold twice" alert as one
-- that sells it under a guest, and the alert names the Exclusive as what is in the way.
CREATE OR REPLACE FUNCTION public.add_channel_stay(p_channel text, p_ref text, p_room_id text, p_check_in date, p_check_out date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     where (b.room_id = p_room_id or b.venue_key = 'venue-exclusive') and b.status <> 'cancelled'
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
$function$;

-- The calendar each room sends to the booking sites shows the Exclusive's nights as taken.
CREATE OR REPLACE FUNCTION public.channel_export(p_room_id text, p_for text DEFAULT NULL::text)
 RETURNS TABLE(id text, first_night date, last_night date, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.id::text,
         date '2000-01-01' + ceil((lower(h.r) - 2) / 2.0)::int,
         date '2000-01-01' + floor((upper(h.r) - 2) / 2.0)::int,
         b.created_at
    from bookings b
    cross join lateral (
      select booking_halves(b.check_in, b.check_out, b.stay_hours, b.stay_half, b.actual_check_in, b.late_check_out_hours, b.actual_check_out) as r
    ) h
   where (b.room_id = p_room_id or b.venue_key = 'venue-exclusive')
     and b.status in ('pending', 'confirmed', 'blocked')
     and upper(h.r) >= ((now() at time zone 'Asia/Manila')::date - date '2000-01-01') * 2
     and (p_for is null or b.channel_ref is null or b.channel_ref not like p_for || '|' || p_room_id || '|%');
$function$;
