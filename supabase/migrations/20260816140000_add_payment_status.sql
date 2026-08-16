-- ==========================================
-- Persist Payment Status
-- Supabase PostgreSQL Migration
--
-- The frontend Booking type already carries a client-only payment_status
-- ('unpaid' | 'downpayment' | 'paid') that was never saved to the DB, so it
-- didn't survive across tabs/refreshes. This migration:
--   1. Adds a nullable payment_status enum column (blocked/admin rows may be
--      NULL, mirroring the frontend contract in useBookings.ts), and
--   2. Extends book_booking/update_booking RPCs so payment_status is
--      persisted atomically with the rest of the booking.
-- ==========================================

-- 1. Enum + column (nullable: admin date blocks have no payment state).
CREATE TYPE payment_status AS ENUM ('unpaid', 'downpayment', 'paid');
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT NULL;

-- ==========================================
-- 2. book_booking — add payment_status to insert
-- ==========================================
CREATE OR REPLACE FUNCTION public.book_booking(p_booking jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := NULLIF(p_booking->>'id', '')::uuid;
  v_room_id uuid := NULLIF(p_booking->>'room_id', '')::uuid;
  v_venue_id text := NULLIF(p_booking->>'venue_id', '');
  v_check_in date := (p_booking->>'check_in')::date;
  v_check_out date := (p_booking->>'check_out')::date;
  v_row jsonb;
BEGIN
  IF v_check_in IS NULL OR v_check_out IS NULL OR v_check_in >= v_check_out THEN
    RAISE EXCEPTION 'Check-in must be earlier than check-out.';
  END IF;

  -- Friendly overlap checks (the exclusion constraint is the hard backstop).
  IF v_room_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.room_id = v_room_id
      AND daterange(b.check_in, b.check_out) && daterange(v_check_in, v_check_out)
  ) THEN
    RAISE EXCEPTION 'ROOM_UNAVAILABLE';
  END IF;

  IF v_venue_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE public.booking_venue_key(b.venue_id) = public.booking_venue_key(v_venue_id)
      AND daterange(b.check_in, b.check_out) && daterange(v_check_in, v_check_out)
  ) THEN
    RAISE EXCEPTION 'VENUE_UNAVAILABLE';
  END IF;

  -- If the client id is missing/invalid, let the DB generate a real UUID.
  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
  END IF;

  INSERT INTO public.bookings (
    id, room_id, venue_id, guest_name, guest_email, guest_phone,
    guest_gender, guest_nationality, guest_address,
    check_in, check_out, source, status, payment_status,
    payment_method, payment_reference,
    downpayment_paid, balance_due, security_deposit,
    breakfast_orders, equipment_rentals, event_addons, companions,
    venue_excess_hours, expires_at,
    partner_deal_id, company_name, vehicle_plate,
    invoice_number, invoice_type, breakfast_included, contract_rate_override
  )
  VALUES (
    v_id,
    v_room_id,
    v_venue_id,
    p_booking->>'guest_name',
    p_booking->>'guest_email',
    p_booking->>'guest_phone',
    p_booking->>'guest_gender',
    p_booking->>'guest_nationality',
    p_booking->>'guest_address',
    v_check_in, v_check_out,
    COALESCE((p_booking->>'source')::public.booking_source, 'website'),
    COALESCE((p_booking->>'status')::public.booking_status, 'pending'),
    NULLIF(p_booking->>'payment_status', '')::public.payment_status,
    p_booking->>'payment_method',
    p_booking->>'payment_reference',
    COALESCE((p_booking->>'downpayment_paid')::numeric, 0),
    COALESCE((p_booking->>'balance_due')::numeric, 0),
    COALESCE((p_booking->>'security_deposit')::numeric, 0),
    (p_booking->'breakfast_orders')::jsonb,
    (p_booking->'equipment_rentals')::jsonb,
    (p_booking->'event_addons')::jsonb,
    (p_booking->'companions')::jsonb,
    COALESCE((p_booking->>'venue_excess_hours')::integer, 0),
    (p_booking->>'expires_at')::timestamptz,
    NULLIF(p_booking->>'partner_deal_id', '')::uuid,
    p_booking->>'company_name',
    p_booking->>'vehicle_plate',
    p_booking->>'invoice_number',
    p_booking->>'invoice_type',
    COALESCE((p_booking->>'breakfast_included')::boolean, false),
    (p_booking->>'contract_rate_override')::numeric
  )
  RETURNING to_jsonb(bookings.*) INTO v_row;

  RETURN v_row;
END;
$$;

-- ==========================================
-- 3. update_booking — add payment_status to update
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_booking(p_booking jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := NULLIF(p_booking->>'id', '')::uuid;
  v_room_id uuid := NULLIF(p_booking->>'room_id', '')::uuid;
  v_venue_id text := NULLIF(p_booking->>'venue_id', '');
  v_check_in date := (p_booking->>'check_in')::date;
  v_check_out date := (p_booking->>'check_out')::date;
  v_row jsonb;
BEGIN
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Missing booking id.';
  END IF;

  IF v_check_in IS NULL OR v_check_out IS NULL OR v_check_in >= v_check_out THEN
    RAISE EXCEPTION 'Check-in must be earlier than check-out.';
  END IF;

  IF v_room_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.room_id = v_room_id
      AND b.id <> v_id
      AND daterange(b.check_in, b.check_out) && daterange(v_check_in, v_check_out)
  ) THEN
    RAISE EXCEPTION 'ROOM_UNAVAILABLE';
  END IF;

  IF v_venue_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE public.booking_venue_key(b.venue_id) = public.booking_venue_key(v_venue_id)
      AND b.id <> v_id
      AND daterange(b.check_in, b.check_out) && daterange(v_check_in, v_check_out)
  ) THEN
    RAISE EXCEPTION 'VENUE_UNAVAILABLE';
  END IF;

  UPDATE public.bookings SET
    room_id = v_room_id,
    venue_id = v_venue_id,
    guest_name = p_booking->>'guest_name',
    guest_email = p_booking->>'guest_email',
    guest_phone = p_booking->>'guest_phone',
    guest_gender = p_booking->>'guest_gender',
    guest_nationality = p_booking->>'guest_nationality',
    guest_address = p_booking->>'guest_address',
    check_in = v_check_in,
    check_out = v_check_out,
    source = COALESCE((p_booking->>'source')::public.booking_source, source),
    status = COALESCE((p_booking->>'status')::public.booking_status, status),
    payment_status = NULLIF(p_booking->>'payment_status', '')::public.payment_status,
    payment_method = p_booking->>'payment_method',
    payment_reference = p_booking->>'payment_reference',
    downpayment_paid = COALESCE((p_booking->>'downpayment_paid')::numeric, downpayment_paid),
    balance_due = COALESCE((p_booking->>'balance_due')::numeric, balance_due),
    security_deposit = COALESCE((p_booking->>'security_deposit')::numeric, security_deposit),
    breakfast_orders = COALESCE((p_booking->'breakfast_orders')::jsonb, breakfast_orders),
    equipment_rentals = COALESCE((p_booking->'equipment_rentals')::jsonb, equipment_rentals),
    event_addons = COALESCE((p_booking->'event_addons')::jsonb, event_addons),
    companions = COALESCE((p_booking->'companions')::jsonb, companions),
    venue_excess_hours = COALESCE((p_booking->>'venue_excess_hours')::integer, venue_excess_hours),
    expires_at = (p_booking->>'expires_at')::timestamptz,
    partner_deal_id = COALESCE(NULLIF(p_booking->>'partner_deal_id', '')::uuid, partner_deal_id),
    company_name = p_booking->>'company_name',
    vehicle_plate = p_booking->>'vehicle_plate',
    invoice_number = COALESCE(p_booking->>'invoice_number', invoice_number),
    invoice_type = p_booking->>'invoice_type',
    breakfast_included = COALESCE((p_booking->>'breakfast_included')::boolean, breakfast_included),
    contract_rate_override = COALESCE((p_booking->>'contract_rate_override')::numeric, contract_rate_override)
  WHERE id = v_id
  RETURNING to_jsonb(bookings.*) INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND';
  END IF;

  RETURN v_row;
END;
$$;

-- ==========================================
-- 4. Grants (unchanged — re-assert for safety)
-- ==========================================
GRANT EXECUTE ON FUNCTION public.book_booking(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_booking(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_booking(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_booking(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_pending() TO anon, authenticated;
