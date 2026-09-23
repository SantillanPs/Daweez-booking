-- Short stays: a room sold for 3, 6 or 12 hours instead of a night.
--
-- The hotel's printed rate board prices every room four ways — 3, 6, 12 and 22
-- hours — and short-time bookings are coming back, so the desk needs to take
-- them in the system instead of on paper. The 22-hour column IS the price the app
-- already charges (each room's single price), so only the three short columns are
-- new: three optional prices per room.
--
-- Two small writers, following the pattern the app already uses for
-- `set_room_breakfast_price` and `set_booking_agreed_deposit`: RLS gives the app
-- SELECT only on `rooms`, and `book_booking`/`update_booking` are the drifted
-- jsonb functions that must not be re-created casually (see supabase/AGENTS.md).
-- Both writers are safe to lose: a failed write only means the desk retypes a
-- price, or a booking loses its "this was a short stay" label.

-- ── the three short-stay prices, per room ────────────────────────────────────
ALTER TABLE public.rooms
    ADD COLUMN IF NOT EXISTS hour3_price  numeric,
    ADD COLUMN IF NOT EXISTS hour6_price  numeric,
    ADD COLUMN IF NOT EXISTS hour12_price numeric;

COMMENT ON COLUMN public.rooms.hour3_price IS
    'Price for a 3-hour short stay, in pesos. NULL means this room is not sold short (the dash on the printed rate board).';
COMMENT ON COLUMN public.rooms.hour6_price IS
    'Price for a 6-hour short stay, in pesos. NULL means this room is not sold short.';
COMMENT ON COLUMN public.rooms.hour12_price IS
    'Price for a 12-hour short stay, in pesos. NULL means this room is not sold short.';

CREATE OR REPLACE FUNCTION public.set_room_hour_prices(
    p_room_id text,
    p_hour3   numeric,
    p_hour6   numeric,
    p_hour12  numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid := NULLIF(p_room_id, '')::uuid;
BEGIN
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'ROOM_NOT_FOUND';
    END IF;

    UPDATE public.rooms SET
        hour3_price  = NULLIF(p_hour3, 0),
        hour6_price  = NULLIF(p_hour6, 0),
        hour12_price = NULLIF(p_hour12, 0)
    WHERE id = v_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ROOM_NOT_FOUND';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_room_hour_prices(text, numeric, numeric, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.set_room_hour_prices(text, numeric, numeric, numeric) TO anon, authenticated;

-- ── the label on the booking ─────────────────────────────────────────────────
-- How many hours the room was taken for (3, 6, 12 or 22). NULL is an ordinary
-- overnight stay, which is every booking made before this existed.
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS stay_hours numeric;

COMMENT ON COLUMN public.bookings.stay_hours IS
    'Short stay: the hours the room was taken for (3/6/12/22). NULL is an ordinary overnight booking. A short stay still blocks the whole day, because housekeeping cleans the room afterwards.';

CREATE OR REPLACE FUNCTION public.set_booking_stay_hours(
    p_booking_id text,
    p_hours      numeric
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.bookings
       SET stay_hours = NULLIF(p_hours, 0)
     WHERE id = p_booking_id;
$$;

REVOKE ALL ON FUNCTION public.set_booking_stay_hours(text, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.set_booking_stay_hours(text, numeric) TO anon, authenticated;
