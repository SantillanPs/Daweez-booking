-- A website request confirmed at the desk (Sebastian, 2026-11-27). The first website guest called the
-- hotel, the staff booked her by hand and never saw the request, so the request needs confirming onto
-- the booking already made (close_booking_request with that booking's id, no new booking).
--  · "Confirm only": the payment was found in the app, the guest is told, but nothing is booked yet.
--    The request stays open in the bell until someone books it, so it is never lost.
--  · The guest's page reads the booking it became, so a booking made on other dates or rooms says so.

alter table public.booking_requests add column if not exists pay_confirmed_at timestamptz;

create or replace function public.confirm_request_payment(p_id uuid)
returns void language sql security definer set search_path to 'public' as $$
  update public.booking_requests set pay_confirmed_at = coalesce(pay_confirmed_at, now())
   where id = p_id and status = 'open';
$$;
revoke all on function public.confirm_request_payment(uuid) from public, anon;
grant execute on function public.confirm_request_payment(uuid) to authenticated;

create or replace function public.request_status(p_id uuid)
returns json language sql stable security definer set search_path to 'public' as $$
  select json_build_object(
    'status', r.status,
    'pay_confirmed', r.pay_confirmed_at is not null,
    'place', coalesce(
      -- booked: the rooms of the bill it became
      (select case when count(*) > 1 then 'Rooms ' || string_agg(m.room_number::text, ', ' order by m.room_number)
                   else coalesce('Room ' || min(m.room_number::text), min(v2.name)) end
         from bookings g left join rooms m on m.id = g.room_id left join venues v2 on v2.id = g.venue_id
        where b.id is not null and g.status <> 'cancelled'
          and (g.id = b.id or (b.group_id is not null and g.group_id = b.group_id))
       having count(*) > 0),
      case when cardinality(r.more_rooms) > 0
        then 'Rooms ' || (select string_agg(m.room_number::text, ', ' order by m.room_number) from rooms m where m.id = any(array_prepend(r.room_id, r.more_rooms)))
      end,
      'Room ' || rm.room_number, v.name, r.room_id),
    'check_in', coalesce(b.check_in, r.check_in),
    'check_out', coalesce(b.check_out, r.check_out),
    'pay_amount', r.pay_amount,
    'pay_method', r.pay_method,
    'pay_reference', r.pay_reference,
    'pay_on', r.pay_on,
    'quoted_total', r.quoted_total,
    'created_at', r.created_at)
  from booking_requests r
  left join bookings b on b.id = r.booking_id and r.status = 'booked'
  left join rooms rm on rm.id = r.room_id
  left join venues v on v.id = r.room_id
  where r.id = p_id;
$$;
