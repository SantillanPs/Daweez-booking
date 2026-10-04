-- Undo a check-in or a check-out pressed by mistake (the staff's feedback, 2026-10-04:
-- "prevent accidental check in and check out").
--
-- The app now asks before it checks a guest in or out, and a wrong one can be taken
-- back. `update_booking` cannot do that: it keeps the stored time whenever the app sends
-- none (`COALESCE(new, old)`), which is what stops a stale copy of a booking wiping a
-- check-in — and also means the time can never be cleared through it. So clearing is its
-- own small writer, like the other single-column writers.
--
-- Undoing a check-in also clears the check-out and both sets of hours: a guest who was
-- never in cannot have left.

CREATE OR REPLACE FUNCTION public.undo_booking_check(p_booking_id text, p_which text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_which = 'check_out' then
    update public.bookings
       set actual_check_out = null, late_check_out_hours = 0
     where id = p_booking_id;
  elsif p_which = 'check_in' then
    update public.bookings
       set actual_check_in = null, actual_check_out = null,
           early_check_in_hours = 0, late_check_out_hours = 0
     where id = p_booking_id;
  else
    raise exception 'UNDO_WHICH: say check_in or check_out.';
  end if;
end $function$;

GRANT EXECUTE ON FUNCTION public.undo_booking_check(text, text) TO anon, authenticated, service_role;
