-- How many beds a room has (board card k140).
--
-- The owner's rule: breakfast is ₱150 × the number of beds in the room, charged
-- ONCE for the stay and folded into the room rate — not per person, and not per
-- day. Room 10's 3 bunk beds are 6 beds, so its breakfast is ₱900; a room for 2
-- is ₱300 even if one guest sleeps there.
--
-- "Beds" is deliberately its own number rather than the existing `capacity`:
-- capacity is how many the room sleeps, and the owner counts beds (bunk beds are
-- two), so the front desk must be able to write down what the room actually has.
--
-- Written through a small SECURITY DEFINER function for the same reason as the
-- rates next to it: RLS gives the app SELECT only on `rooms`.

ALTER TABLE public.rooms
    ADD COLUMN IF NOT EXISTS beds integer;

COMMENT ON COLUMN public.rooms.beds IS
    'How many beds the room has. Breakfast is charged as ₱150 × this number, once per stay (k140). NULL falls back to the old per-person, per-day breakfast until the desk fills it in.';

CREATE OR REPLACE FUNCTION public.set_room_beds(
    p_room_id text,
    p_beds integer
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.rooms
       SET beds = NULLIF(p_beds, 0)
     WHERE id = p_room_id;
$$;

REVOKE ALL ON FUNCTION public.set_room_beds(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.set_room_beds(text, integer) TO anon, authenticated;
