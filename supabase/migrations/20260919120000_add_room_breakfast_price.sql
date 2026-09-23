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
