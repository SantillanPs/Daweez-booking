-- What each room chose for breakfast, morning by morning (2026-10-04). Development first.
--
-- The staff ask a guest who booked breakfast what they want EVERY morning. This records
-- the answer — `[{ "date": "2026-10-04", "items": [{ "name": "Bangsilog", "qty": 2 }] }]` —
-- for the kitchen and for the record. It is NOT a charge: breakfast stays one price for
-- the stay, the room's own breakfast price. (`breakfast_records` is the old billed-per-day
-- column and must not be reused for this — the pricing rule bills whatever is in it.)
--
-- Its own column and its own small writer, like `set_booking_stay_hours`: `update_booking`
-- never touches it, so an ordinary save of the booking cannot blank it.

alter table public.bookings add column if not exists breakfast_choices jsonb;

create or replace function public.set_booking_breakfast_choices(p_booking_id text, p_choices jsonb)
 returns void language sql security definer set search_path to 'public'
as $function$
    update public.bookings
       set breakfast_choices = p_choices
     where id = p_booking_id;
$function$;

grant execute on function public.set_booking_breakfast_choices(text, jsonb) to anon, authenticated, service_role;
