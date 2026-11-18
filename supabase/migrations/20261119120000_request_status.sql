-- The guest's own page after paying on the website (Sebastian, 2026-11-19: "a link to show the status of the
-- booking instead of waiting for the text message"). The request's uuid is the key: only whoever holds the link
-- can read it, and only what the guest already wrote or paid, never their name or number.
create or replace function public.request_status(p_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'status', r.status,
    'place', coalesce('Room ' || rm.room_number, v.name, r.room_id),
    'check_in', r.check_in,
    'check_out', r.check_out,
    'pay_amount', r.pay_amount,
    'pay_method', r.pay_method,
    'pay_reference', r.pay_reference,
    'created_at', r.created_at)
  from booking_requests r
  left join rooms rm on rm.id = r.room_id
  left join venues v on v.id = r.room_id
  where r.id = p_id;
$$;

revoke all on function public.request_status(uuid) from public;
grant execute on function public.request_status(uuid) to anon, authenticated;
