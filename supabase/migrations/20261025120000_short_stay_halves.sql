-- A short stay takes HALF a day, so the other half can be sold (Sebastian, 2026-10-25, the
-- free-half mock: "make the free half of a short stay's day bookable"). Rooms were kept apart
-- by whole days (`daterange(check_in, check_out)`), and a short stay is stored as leaving the
-- next day, so it held the whole day. They are now kept apart by HALF-DAYS: day d is halves
-- 2d (morning) and 2d + 1 (afternoon), counted from 2000-01-01.
--
--   * An overnight stay holds the afternoon of its check-in day to the morning of its
--     check-out day — the same as the calendar draws it, so out at 12 PM and in at 2 PM
--     on one day still fit.
--   * A short stay holds the half it was booked for (`stay_half`: 0 morning, 1 afternoon);
--     12 hours hold that half and the next one, 22 from a morning three.
--   * A guest who checks in late keeps their hours (the clock starts at check-in, the
--     owner's ruling of 2026-09): once the check-in is noted, the stay also holds every
--     half up to the time it should leave. A 12-hour morning stay checked in at 4 PM holds
--     the next morning too, and noting that check-in is refused when the next morning is
--     already booked — the desk sorts it out with the guest, the app never moves the other
--     booking.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS stay_half smallint CHECK (stay_half IN (0, 1));

-- Short stays made before this: the morning when their check-in was noted before 12 PM (how
-- the calendar drew them since earlier today), otherwise the afternoon.
UPDATE public.bookings
   SET stay_half = CASE WHEN actual_check_in IS NOT NULL
                         AND extract(hour FROM actual_check_in AT TIME ZONE 'Asia/Manila') < 12 THEN 0 ELSE 1 END
 WHERE stay_hours IS NOT NULL AND stay_half IS NULL;

-- The halves a booking holds, as [first, last + 1). Mirrored by `bookingHalves` in
-- src/utils/halfDays.ts — change both together.
CREATE OR REPLACE FUNCTION public.booking_halves(p_check_in date, p_check_out date, p_hours numeric, p_half smallint, p_in timestamptz, p_late integer)
RETURNS int4range LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN COALESCE(p_hours, 0) = 0
    THEN int4range((p_check_in - date '2000-01-01') * 2 + 1, (p_check_out - date '2000-01-01') * 2 + 1)
    ELSE int4range(s, greatest(s + n, COALESCE(e, 0)))
  END
  FROM (
    SELECT (p_check_in - date '2000-01-01') * 2 + COALESCE(p_half, 1) AS s,
           CASE WHEN p_hours < 12 THEN 1 WHEN p_hours > 12 AND COALESCE(p_half, 1) = 0 THEN 3 ELSE 2 END AS n,
           -- The half the leave time falls in, plus one; a second is taken off so leaving at
           -- exactly 12 PM ends in the morning.
           (SELECT (l::date - date '2000-01-01') * 2 + (extract(hour FROM l) >= 12)::int + 1
              FROM (SELECT (p_in AT TIME ZONE 'Asia/Manila')
                           + make_interval(secs => ((p_hours + COALESCE(p_late, 0)) * 3600 - 1)::double precision) AS l) x
             WHERE p_in IS NOT NULL) AS e
  ) t
$$;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS no_overlap_room;
ALTER TABLE public.bookings ADD CONSTRAINT no_overlap_room EXCLUDE USING gist (
  room_id WITH =,
  public.booking_halves(check_in, check_out, stay_hours, stay_half, actual_check_in, late_check_out_hours) WITH &&
) WHERE (room_id IS NOT NULL AND status <> 'cancelled'::booking_status);

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS no_overlap_venue;
ALTER TABLE public.bookings ADD CONSTRAINT no_overlap_venue EXCLUDE USING gist (
  venue_key WITH =,
  public.booking_halves(check_in, check_out, stay_hours, stay_half, actual_check_in, late_check_out_hours) WITH &&
) WHERE (venue_key IS NOT NULL AND status <> 'cancelled'::booking_status);

-- The two booking writers, rebuilt from the definitions the database held on 2026-10-25
-- (pg_get_functiondef). Their own early checks count half-days as well, and they now write
-- the short stay's hours and half themselves: written afterwards by `set_booking_stay_hours`,
-- the row was first saved as a whole night and could clash with a stay it does not touch.
CREATE OR REPLACE FUNCTION public.book_booking(p_booking jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id text := NULLIF(p_booking->>'id', '');
  v_room_id text := NULLIF(p_booking->>'room_id', '');
  v_venue_id text := NULLIF(p_booking->>'venue_id', '');
  v_check_in date := (p_booking->>'check_in')::date;
  v_check_out date := (p_booking->>'check_out')::date;
  v_hours numeric := NULLIF((p_booking->>'stay_hours')::numeric, 0);
  v_half smallint := CASE WHEN NULLIF((p_booking->>'stay_hours')::numeric, 0) IS NULL THEN NULL ELSE COALESCE((p_booking->>'stay_half')::smallint, 1) END;
  v_span int4range;
  v_row jsonb;
BEGIN
  IF v_check_in IS NULL OR v_check_out IS NULL OR v_check_in >= v_check_out THEN
    RAISE EXCEPTION 'Check-in must be earlier than check-out.';
  END IF;
  v_span := public.booking_halves(v_check_in, v_check_out, v_hours, v_half, (p_booking->>'actual_check_in')::timestamptz, (p_booking->>'late_check_out_hours')::integer);
  IF v_room_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.room_id = v_room_id AND b.status <> 'cancelled' AND public.booking_halves(b.check_in, b.check_out, b.stay_hours, b.stay_half, b.actual_check_in, b.late_check_out_hours) && v_span) THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
  IF v_venue_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.bookings b WHERE public.booking_venue_key(b.venue_id) = public.booking_venue_key(v_venue_id) AND b.status <> 'cancelled' AND public.booking_halves(b.check_in, b.check_out, b.stay_hours, b.stay_half, b.actual_check_in, b.late_check_out_hours) && v_span) THEN RAISE EXCEPTION 'VENUE_UNAVAILABLE'; END IF;
  IF v_id IS NULL OR v_id = '' THEN v_id := gen_random_uuid()::text; END IF;
  INSERT INTO public.bookings (id, room_id, venue_id, guest_name, guest_email, guest_phone, guest_gender, guest_nationality, guest_address, birthdate, check_in, check_out, source, status, payment_status, payment_method, payment_reference, payment_plan, downpayment_paid, balance_due, security_deposit, breakfast_orders, equipment_rentals, event_addons, companions, venue_excess_hours, expires_at, partner_deal_id, company_name, institution, vehicle_plate, invoice_number, invoice_type, breakfast_included, contract_rate_override, promo_applied, applied_discount, early_check_in_hours, late_check_out_hours, actual_check_in, actual_check_out, notes, prepared_by, payment_records, venue_day_blocks, breakfast_days, breakfast_records, reference_number, registered_on, stay_hours, stay_half)
  VALUES (v_id, v_room_id, v_venue_id, p_booking->>'guest_name', p_booking->>'guest_email', p_booking->>'guest_phone', p_booking->>'guest_gender', p_booking->>'guest_nationality', p_booking->>'guest_address', NULLIF(p_booking->>'birthdate', '')::date, v_check_in, v_check_out, COALESCE((p_booking->>'source')::public.booking_source, 'website'), COALESCE((p_booking->>'status')::public.booking_status, 'pending'), NULLIF(p_booking->>'payment_status', '')::public.payment_status, p_booking->>'payment_method', p_booking->>'payment_reference', p_booking->>'payment_plan', COALESCE((p_booking->>'downpayment_paid')::numeric, 0), COALESCE((p_booking->>'balance_due')::numeric, 0), COALESCE((p_booking->>'security_deposit')::numeric, 0), (p_booking->'breakfast_orders')::jsonb, (p_booking->'equipment_rentals')::jsonb, (p_booking->'event_addons')::jsonb, (p_booking->'companions')::jsonb, COALESCE((p_booking->>'venue_excess_hours')::integer, 0), (p_booking->>'expires_at')::timestamptz, NULLIF(p_booking->>'partner_deal_id', ''), p_booking->>'company_name', NULLIF(p_booking->>'institution', ''), p_booking->>'vehicle_plate', p_booking->>'invoice_number', p_booking->>'invoice_type', COALESCE((p_booking->>'breakfast_included')::boolean, false), (p_booking->>'contract_rate_override')::numeric, (p_booking->>'promo_applied')::boolean, (p_booking->'applied_discount')::jsonb, COALESCE((p_booking->>'early_check_in_hours')::integer, NULL), COALESCE((p_booking->>'late_check_out_hours')::integer, NULL), (p_booking->>'actual_check_in')::timestamptz, (p_booking->>'actual_check_out')::timestamptz, p_booking->>'notes', p_booking->>'prepared_by', (p_booking->'payment_records')::jsonb, COALESCE((p_booking->>'venue_day_blocks')::integer, NULL), (p_booking->'breakfast_days')::jsonb, (p_booking->'breakfast_records')::jsonb, p_booking->>'reference_number', (p_booking->>'registered_on')::date, v_hours, v_half)
  RETURNING to_jsonb(bookings.*) INTO v_row; RETURN v_row;
END; $function$;

-- `update_booking` keeps the stored hours and half when it is sent none (as it keeps the door
-- times); `set_booking_stay_hours` with 0 is still the one way to take the hours off.
CREATE OR REPLACE FUNCTION public.update_booking(p_booking jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id text := NULLIF(p_booking->>'id', '');
  v_room_id text := NULLIF(p_booking->>'room_id', '');
  v_venue_id text := NULLIF(p_booking->>'venue_id', '');
  v_check_in date := (p_booking->>'check_in')::date;
  v_check_out date := (p_booking->>'check_out')::date;
  v_old public.bookings;
  v_hours numeric;
  v_half smallint;
  v_span int4range;
  v_row jsonb;
BEGIN
  IF v_id IS NULL OR v_id = '' THEN RAISE EXCEPTION 'Missing booking id.'; END IF;
  IF v_check_in IS NULL OR v_check_out IS NULL OR v_check_in >= v_check_out THEN RAISE EXCEPTION 'Check-in must be earlier than check-out.'; END IF;
  SELECT * INTO v_old FROM public.bookings WHERE id = v_id;
  v_hours := COALESCE(NULLIF((p_booking->>'stay_hours')::numeric, 0), v_old.stay_hours);
  v_half := CASE WHEN v_hours IS NULL THEN NULL ELSE COALESCE((p_booking->>'stay_half')::smallint, v_old.stay_half, 1) END;
  v_span := public.booking_halves(v_check_in, v_check_out, v_hours, v_half,
    COALESCE((p_booking->>'actual_check_in')::timestamptz, v_old.actual_check_in),
    COALESCE((p_booking->>'late_check_out_hours')::integer, v_old.late_check_out_hours));
  IF v_room_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.room_id = v_room_id AND b.id <> v_id AND b.status <> 'cancelled' AND public.booking_halves(b.check_in, b.check_out, b.stay_hours, b.stay_half, b.actual_check_in, b.late_check_out_hours) && v_span) THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
  IF v_venue_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.bookings b WHERE public.booking_venue_key(b.venue_id) = public.booking_venue_key(v_venue_id) AND b.id <> v_id AND b.status <> 'cancelled' AND public.booking_halves(b.check_in, b.check_out, b.stay_hours, b.stay_half, b.actual_check_in, b.late_check_out_hours) && v_span) THEN RAISE EXCEPTION 'VENUE_UNAVAILABLE'; END IF;
  UPDATE public.bookings SET room_id = v_room_id, venue_id = v_venue_id, guest_name = p_booking->>'guest_name', guest_email = p_booking->>'guest_email', guest_phone = p_booking->>'guest_phone', guest_gender = p_booking->>'guest_gender', guest_nationality = p_booking->>'guest_nationality', guest_address = p_booking->>'guest_address', birthdate = NULLIF(p_booking->>'birthdate', '')::date, check_in = v_check_in, check_out = v_check_out, source = COALESCE((p_booking->>'source')::public.booking_source, source), status = COALESCE((p_booking->>'status')::public.booking_status, status), payment_status = NULLIF(p_booking->>'payment_status', '')::public.payment_status, payment_method = p_booking->>'payment_method', payment_reference = p_booking->>'payment_reference', payment_plan = p_booking->>'payment_plan', downpayment_paid = COALESCE((p_booking->>'downpayment_paid')::numeric, downpayment_paid), balance_due = COALESCE((p_booking->>'balance_due')::numeric, balance_due), security_deposit = COALESCE((p_booking->>'security_deposit')::numeric, security_deposit), breakfast_orders = COALESCE((p_booking->'breakfast_orders')::jsonb, breakfast_orders), equipment_rentals = COALESCE((p_booking->'equipment_rentals')::jsonb, equipment_rentals), event_addons = COALESCE((p_booking->'event_addons')::jsonb, event_addons), companions = COALESCE((p_booking->'companions')::jsonb, companions), venue_excess_hours = COALESCE((p_booking->>'venue_excess_hours')::integer, venue_excess_hours), expires_at = (p_booking->>'expires_at')::timestamptz, partner_deal_id = NULLIF(p_booking->>'partner_deal_id', ''), company_name = p_booking->>'company_name', institution = NULLIF(p_booking->>'institution', ''), vehicle_plate = p_booking->>'vehicle_plate', invoice_number = COALESCE(p_booking->>'invoice_number', invoice_number), invoice_type = p_booking->>'invoice_type', breakfast_included = COALESCE((p_booking->>'breakfast_included')::boolean, breakfast_included), contract_rate_override = (p_booking->>'contract_rate_override')::numeric, promo_applied = COALESCE((p_booking->>'promo_applied')::boolean, promo_applied), applied_discount = COALESCE((p_booking->'applied_discount')::jsonb, applied_discount), early_check_in_hours = COALESCE((p_booking->>'early_check_in_hours')::integer, early_check_in_hours), late_check_out_hours = COALESCE((p_booking->>'late_check_out_hours')::integer, late_check_out_hours), actual_check_in = COALESCE((p_booking->>'actual_check_in')::timestamptz, actual_check_in), actual_check_out = COALESCE((p_booking->>'actual_check_out')::timestamptz, actual_check_out), notes = p_booking->>'notes', prepared_by = p_booking->>'prepared_by', payment_records = COALESCE((p_booking->'payment_records')::jsonb, payment_records), venue_day_blocks = COALESCE((p_booking->>'venue_day_blocks')::integer, venue_day_blocks), breakfast_days = COALESCE((p_booking->'breakfast_days')::jsonb, breakfast_days), breakfast_records = COALESCE((p_booking->'breakfast_records')::jsonb, breakfast_records), reference_number = COALESCE(p_booking->>'reference_number', reference_number), registered_on = COALESCE((p_booking->>'registered_on')::date, registered_on), stay_hours = v_hours, stay_half = v_half
  WHERE id = v_id RETURNING to_jsonb(bookings.*) INTO v_row; IF v_row IS NULL THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF; RETURN v_row;
END; $function$;

-- Taking the hours off leaves no half behind.
CREATE OR REPLACE FUNCTION public.set_booking_stay_hours(p_booking_id text, p_hours numeric)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    UPDATE public.bookings
       SET stay_hours = NULLIF(p_hours, 0),
           stay_half = CASE WHEN NULLIF(p_hours, 0) IS NULL THEN NULL ELSE COALESCE(stay_half, 1) END
     WHERE id = p_booking_id;
$function$;
