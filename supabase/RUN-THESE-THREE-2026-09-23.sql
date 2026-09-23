-- EVERYTHING STILL PENDING — paste this whole file into Supabase → SQL Editor and run it once.
-- It is safe to run twice: every statement below is guarded.
--
-- 1. rooms.breakfast_price   (breakfast is one charge per room)
-- 2. bookings.agreed_deposit (the deposit the desk agreed)
-- 3. rooms.hour3/6/12_price + bookings.stay_hours  (SHORT STAYS — new)

-- ============================================================
-- from supabase/migrations/20260919120000_add_room_breakfast_price.sql
-- ============================================================
-- What one room's breakfast costs (board card k140, owner's decision).
--
-- The rule went through two steps: first breakfast was ₱150 × the room's beds,
-- then the owner pointed out the obvious — the staff already know what each room
-- charges for breakfast, so the system should not be doing arithmetic at all.
--
-- So each room carries its own breakfast price, typed by the desk in
-- Settings → Room Rates. It is deliberately blank (NULL) until somebody writes
-- it: a room with no breakfast price simply has no breakfast to sell, and the
-- booking form says so rather than charging ₱0.
--
-- Written through a small SECURITY DEFINER function for the same reason as the
-- room rate and bed count next to it: RLS gives the app SELECT only on `rooms`.

ALTER TABLE public.rooms
    ADD COLUMN IF NOT EXISTS breakfast_price numeric;

COMMENT ON COLUMN public.rooms.breakfast_price IS
    'What this room charges for breakfast: one charge for the stay, set by the desk (k140). NULL means the room does not sell breakfast yet.';

CREATE OR REPLACE FUNCTION public.set_room_breakfast_price(
    p_room_id text,
    p_price numeric
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.rooms
       SET breakfast_price = NULLIF(p_price, 0)
     WHERE id = p_room_id;
$$;

REVOKE ALL ON FUNCTION public.set_room_breakfast_price(text, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.set_room_breakfast_price(text, numeric) TO anon, authenticated;

-- ============================================================
-- from supabase/migrations/20260917120000_add_agreed_deposit.sql
-- ============================================================
-- The deposit the guest and the desk agreed on (board card k130).
--
-- Until now a booking carried only the PLAN — half the stay, or everything
-- ("payment_plan") — so the amount was always worked out from the pricing engine.
-- The owner asked for a deposit that is half by default but can be *typed*: a
-- guest may agree to put down ₱1,500 on a ₱4,000 stay, and the desk must be able
-- to write that down and have the bill, the arrival step and the receipt all ask
-- for the agreed figure rather than a recomputed one.
--
-- A dedicated writer is used instead of re-creating `book_booking` /
-- `update_booking`: their live bodies are the drifted ones (see the note in
-- supabase/AGENTS.md) and are a jsonb hand-off, so adding a column to them means
-- rebuilding them from the live definition. One small SECURITY DEFINER function
-- keeps this change honest and reversible — the same shape the app already uses
-- for `update_room_rate`.

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS agreed_deposit numeric;

COMMENT ON COLUMN public.bookings.agreed_deposit IS
    'The deposit the desk and the guest agreed on, in pesos. NULL means "work it out" (half the stay), which is the default the booking form offers.';

-- Writes just that one figure, for one booking.
CREATE OR REPLACE FUNCTION public.set_booking_agreed_deposit(
    p_booking_id text,
    p_amount numeric
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.bookings
       SET agreed_deposit = NULLIF(p_amount, 0)
     WHERE id = p_booking_id;
$$;

REVOKE ALL ON FUNCTION public.set_booking_agreed_deposit(text, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.set_booking_agreed_deposit(text, numeric) TO anon, authenticated;

-- ============================================================
-- from supabase/migrations/20260920120000_add_short_stays.sql
-- ============================================================
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
