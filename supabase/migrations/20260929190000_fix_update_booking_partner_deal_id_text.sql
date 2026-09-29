-- update_booking has been failing on EVERY call since `bookings.partner_deal_id` became TEXT.
--
-- The owner's report (2026-09-29): "Overlap collision — room already reserved" on every
-- booking that took money, while a Reservation saved fine; the console showed
-- `POST /rest/v1/rpc/update_booking 400 (Bad Request)`; the Postgres log carried
--
--     COALESCE types uuid and text cannot be matched
--
-- `20260928162102_widen_text_id_columns.sql` widened `bookings.partner_deal_id` from uuid to
-- TEXT (the agency-save repair) but this RPC still cast the payload key to uuid:
--
--     partner_deal_id = COALESCE(NULLIF(p_booking->>'partner_deal_id', '')::uuid, partner_deal_id)
--
-- `COALESCE` needs ONE common type for both arms, and uuid and text have none — so the
-- mismatch is resolved when the statement is PLANNED, not per row. Every call therefore
-- failed, whatever the payload: recording a payment, checking a guest in or out, extending a
-- stay, correcting a booking. `book_booking` escaped it because its cast lands in an INSERT
-- VALUES list, where a uuid→text assignment cast exists.
--
-- The fix follows the rule this project already wrote down for `rooms.id`, `bookings.id` and
-- `partner_deals.id`: **an id that reaches an RPC is TEXT, never a uuid.** The column is TEXT
-- and the app's agency ids are readable (`partner-…`), so the cast is simply dropped — text
-- compared with text, exactly as `book_booking` and `set_room_breakfast_price` always did.
--
-- Rebuilt from the LIVE definition (`pg_get_functiondef`), per the drift note in
-- supabase/AGENTS.md, so every column the deployed function carried is still carried: an
-- older migration file would silently drop `payment_plan`, `breakfast_records`,
-- `reference_number` and `registered_on`.

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
  v_row jsonb;
BEGIN
  IF v_id IS NULL OR v_id = '' THEN RAISE EXCEPTION 'Missing booking id.'; END IF;
  IF v_check_in IS NULL OR v_check_out IS NULL OR v_check_in >= v_check_out THEN RAISE EXCEPTION 'Check-in must be earlier than check-out.'; END IF;
  IF v_room_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.room_id = v_room_id AND b.id <> v_id AND daterange(b.check_in, b.check_out) && daterange(v_check_in, v_check_out)) THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
  IF v_venue_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.bookings b WHERE public.booking_venue_key(b.venue_id) = public.booking_venue_key(v_venue_id) AND b.id <> v_id AND daterange(b.check_in, b.check_out) && daterange(v_check_in, v_check_out)) THEN RAISE EXCEPTION 'VENUE_UNAVAILABLE'; END IF;
  UPDATE public.bookings SET room_id = v_room_id, venue_id = v_venue_id, guest_name = p_booking->>'guest_name', guest_email = p_booking->>'guest_email', guest_phone = p_booking->>'guest_phone', guest_gender = p_booking->>'guest_gender', guest_nationality = p_booking->>'guest_nationality', guest_address = p_booking->>'guest_address', check_in = v_check_in, check_out = v_check_out, source = COALESCE((p_booking->>'source')::public.booking_source, source), status = COALESCE((p_booking->>'status')::public.booking_status, status), payment_status = NULLIF(p_booking->>'payment_status', '')::public.payment_status, payment_method = p_booking->>'payment_method', payment_reference = p_booking->>'payment_reference', payment_plan = p_booking->>'payment_plan', downpayment_paid = COALESCE((p_booking->>'downpayment_paid')::numeric, downpayment_paid), balance_due = COALESCE((p_booking->>'balance_due')::numeric, balance_due), security_deposit = COALESCE((p_booking->>'security_deposit')::numeric, security_deposit), breakfast_orders = COALESCE((p_booking->'breakfast_orders')::jsonb, breakfast_orders), equipment_rentals = COALESCE((p_booking->'equipment_rentals')::jsonb, equipment_rentals), event_addons = COALESCE((p_booking->'event_addons')::jsonb, event_addons), companions = COALESCE((p_booking->'companions')::jsonb, companions), venue_excess_hours = COALESCE((p_booking->>'venue_excess_hours')::integer, venue_excess_hours), expires_at = (p_booking->>'expires_at')::timestamptz, partner_deal_id = COALESCE(NULLIF(p_booking->>'partner_deal_id', ''), partner_deal_id), company_name = p_booking->>'company_name', vehicle_plate = p_booking->>'vehicle_plate', invoice_number = COALESCE(p_booking->>'invoice_number', invoice_number), invoice_type = p_booking->>'invoice_type', breakfast_included = COALESCE((p_booking->>'breakfast_included')::boolean, breakfast_included), contract_rate_override = COALESCE((p_booking->>'contract_rate_override')::numeric, contract_rate_override), promo_applied = COALESCE((p_booking->>'promo_applied')::boolean, promo_applied), applied_discount = COALESCE((p_booking->'applied_discount')::jsonb, applied_discount), early_check_in_hours = COALESCE((p_booking->>'early_check_in_hours')::integer, early_check_in_hours), late_check_out_hours = COALESCE((p_booking->>'late_check_out_hours')::integer, late_check_out_hours), actual_check_in = COALESCE((p_booking->>'actual_check_in')::timestamptz, actual_check_in), actual_check_out = COALESCE((p_booking->>'actual_check_out')::timestamptz, actual_check_out), notes = p_booking->>'notes', prepared_by = p_booking->>'prepared_by', payment_records = COALESCE((p_booking->'payment_records')::jsonb, payment_records), venue_day_blocks = COALESCE((p_booking->>'venue_day_blocks')::integer, venue_day_blocks), breakfast_days = COALESCE((p_booking->'breakfast_days')::jsonb, breakfast_days), breakfast_records = COALESCE((p_booking->'breakfast_records')::jsonb, breakfast_records), reference_number = COALESCE(p_booking->>'reference_number', reference_number), registered_on = COALESCE((p_booking->>'registered_on')::date, registered_on)
  WHERE id = v_id RETURNING to_jsonb(bookings.*) INTO v_row; IF v_row IS NULL THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF; RETURN v_row;
END; $function$;
