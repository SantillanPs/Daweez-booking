-- The dates a booking was first booked for, once it has been rescheduled (Sebastian,
-- 2026-10-29: Bills & receipts' Show menu needs "Rescheduled"). Development first.
--
-- `{ "check_in": "2026-11-02", "check_out": "2026-11-04", "at": "<when it last moved>" }`,
-- empty while the booking is on the days it was booked for. Its own column and its own small
-- writer, like `set_booking_breakfast_choices`: `update_booking` never touches it, so saving
-- the bill cannot blank it.

alter table public.bookings add column if not exists moved_from jsonb;

create or replace function public.set_booking_moved_from(p_booking_id text, p_moved jsonb)
 returns void language sql security definer set search_path to 'public'
as $function$
    update public.bookings
       set moved_from = p_moved
     where id = p_booking_id;
$function$;

grant execute on function public.set_booking_moved_from(text, jsonb) to anon, authenticated, service_role;
