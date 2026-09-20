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
