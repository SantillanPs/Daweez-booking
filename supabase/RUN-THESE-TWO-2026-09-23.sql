-- Daweez · the two migrations that are still missing from the live database.
-- Paste this WHOLE file into Supabase → SQL Editor → New query → Run. It is safe to
-- run twice (every statement is CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS).
--
-- 1) rooms.breakfast_price   → card k140: a breakfast price per room, typed in
--                              Settings → Room Rates. Until this runs, that box saves
--                              in the browser only and looks like it worked.
-- 2) bookings.agreed_deposit → card k130: the deposit the desk agreed with the guest.
--                              Until this runs, the deposit you type is not stored.
--
-- Check it worked: type a breakfast price on Room 3 in Settings → Room Rates, reload
-- the page, and see if the number is still there. Same test with a deposit on a booking.

-- ═══ 1/2 · rooms.breakfast_price ═══

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


-- ═══ 2/2 · bookings.agreed_deposit ═══

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

