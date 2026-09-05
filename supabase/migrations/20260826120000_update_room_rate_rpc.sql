-- ==========================================
-- Editable Room Rates via Postgres RPC
-- Supabase PostgreSQL Migration
--
-- The staff dashboard runs on the public/anon key, and RLS currently grants
-- anon only SELECT on public.rooms (managers get ALL). To let staff edit a
-- room's Regular (base_price) and Promo (promo_price) rates from the UI
-- without granting direct table writes to anon, we route the write through a
-- SECURITY DEFINER RPC — the same pattern used by the booking RPCs.
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_room_rate(
  p_room_id text,
  p_base_price numeric,
  p_promo_price numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := NULLIF(p_room_id, '')::uuid;
  v_row jsonb;
BEGIN
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'ROOM_NOT_FOUND';
  END IF;

  UPDATE public.rooms SET
    base_price = COALESCE(NULLIF(p_base_price, 0), base_price),
    promo_price = NULLIF(p_promo_price, 0)
  WHERE id = v_id
  RETURNING to_jsonb(rooms.*) INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'ROOM_NOT_FOUND';
  END IF;

  RETURN v_row;
END;
$$;

-- Allow both the guest portal (shouldn't call this) and the staff dashboard
-- (anon key) to execute it; managers may too.
GRANT EXECUTE ON FUNCTION public.update_room_rate(text, numeric, numeric) TO anon, authenticated;
