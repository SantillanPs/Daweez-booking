-- Repair the two room-price writers: `rooms.id` is TEXT, never a uuid.
--
-- WHAT WAS WRONG (found 2026-09-28, the owner's report: "the 3,6,12 hour room
-- prices save in the website and yet it's not even saving in the database"):
--
--   1. `set_room_hour_prices` declared `v_id uuid := NULLIF(p_room_id,'')::uuid`
--      and compared `WHERE id = v_id`. `rooms.id` is VARCHAR and holds legacy
--      ids like `room-3`, so every call died on 22P02 —
--      `invalid input syntax for type uuid: "room-3"`. The app caught it,
--      logged it to the console and kept the typed prices in the browser
--      store, so every screen showed the new figures and the database kept
--      NULL.
--   2. `update_room_rate` was never created in this project at all
--      (`20260826120000_update_room_rate_rpc.sql` was written but never
--      applied), so every board-price save answered PGRST202 / 404 and fell
--      back to the browser the same way. All ten rooms still carried their
--      original seed prices.
--
-- This is the SAME fault the booking RPCs had, repaired for them by
-- `20260816150000_fix_booking_rpc_room_id_type` and
-- `20260816160000_fix_booking_rpc_id_type`. It came back in the short-stay
-- function written afterwards. Both writers now compare the id directly as
-- text, which is what `set_room_breakfast_price` and `set_room_beds` always
-- did — that is why the breakfast price saved correctly all along.
--
-- The app no longer keeps a browser copy of a room price (see src/utils/db.ts),
-- so a rejection here is now visible to staff instead of being swallowed.
--
-- Safe to run twice.

create or replace function public.set_room_hour_prices(
    p_room_id text,
    p_hour3   numeric,
    p_hour6   numeric,
    p_hour12  numeric
) returns void
language sql
security definer
set search_path = public
as $$
    update public.rooms
       set hour3_price  = nullif(p_hour3, 0),
           hour6_price  = nullif(p_hour6, 0),
           hour12_price = nullif(p_hour12, 0)
     where id = p_room_id;
$$;

revoke all on function public.set_room_hour_prices(text, numeric, numeric, numeric) from public;
grant execute on function public.set_room_hour_prices(text, numeric, numeric, numeric) to anon, authenticated;

-- One price per room (card k128): the app sends the same figure for base and
-- promo, so both columns land on the single board price.
create or replace function public.update_room_rate(
    p_room_id     text,
    p_base_price  numeric,
    p_promo_price numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row jsonb;
begin
    update public.rooms
       set base_price  = coalesce(nullif(p_base_price, 0), base_price),
           promo_price = nullif(p_promo_price, 0)
     where id = p_room_id
    returning to_jsonb(rooms.*) into v_row;

    if v_row is null then
        raise exception 'ROOM_NOT_FOUND';
    end if;

    return v_row;
end;
$$;

revoke all on function public.update_room_rate(text, numeric, numeric) from public;
grant execute on function public.update_room_rate(text, numeric, numeric) to anon, authenticated;
