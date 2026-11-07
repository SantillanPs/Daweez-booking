-- THE EXCLUSIVE'S HOUSE RULES (Sebastian, 2026-11-07, on the "Exclusive: booking it" mock).
--
-- `no_overlap_exclusive` (20261107120000) made the Exclusive and every other booking refuse each
-- other both ways. The hotel does not work like that:
--   * "sometimes they allow pension house exclusive even with other rooms that are occupied" —
--     a guest already in a room stays, side by side, and the room comes off the ₱20,000
--     (`event_addons.exclusive_less`, worked out on the bill);
--   * it is the rooms and the Gazebo; the Vacation House and the Garden only when the desk picks
--     "Vacation House & Garden", a kind of the Exclusive at ₱35,000 a day ("adds 15k");
--   * once it is booked, nothing it covers can be sold on its days ("No, never").
-- One-way, so a constraint cannot say it: a trigger refuses a booking that would START sharing a
-- half-day with an Exclusive covering its room or venue. A row that was already there keeps
-- being saved as long as it does not reach further in (its new half-days inside its old ones).
-- It raises `exclusion_violation`, so `add_channel_stay` still turns it into a "sold twice" alert.
--
-- Applied to development and to live on 2026-11-07.

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS no_overlap_exclusive;

UPDATE public.venues
   SET details = details || '{"types": [{"key": "grounds", "label": "Vacation House & Garden", "price": 35000}]}'::jsonb
 WHERE id = 'venue-exclusive';

-- What an Exclusive of that kind covers. Mirrored by `exclusiveCovers` in `utils/availability.ts`.
CREATE OR REPLACE FUNCTION public.exclusive_covers(p_kind text, p_room_id text, p_venue_key text)
 RETURNS boolean
 LANGUAGE sql IMMUTABLE
AS $$
  select p_room_id is not null
      or p_venue_key = 'venue-gazebo'
      or (p_kind = 'grounds' and p_venue_key in ('venue-vacation', 'venue-garden'))
$$;

CREATE OR REPLACE FUNCTION public.refuse_under_exclusive()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
declare
  v_key text := booking_venue_key(NEW.venue_id::text);  -- the generated column is not filled yet
  v_new int4range;
  v_in_way text;
begin
  if NEW.status = 'cancelled' or v_key = 'venue-exclusive' then return NEW; end if;
  v_new := booking_halves(NEW.check_in, NEW.check_out, NEW.stay_hours, NEW.stay_half, NEW.actual_check_in, NEW.late_check_out_hours, NEW.actual_check_out);
  if TG_OP = 'UPDATE' and OLD.status <> 'cancelled'
     and OLD.room_id is not distinct from NEW.room_id
     and booking_venue_key(OLD.venue_id::text) is not distinct from v_key
     and v_new <@ booking_halves(OLD.check_in, OLD.check_out, OLD.stay_hours, OLD.stay_half, OLD.actual_check_in, OLD.late_check_out_hours, OLD.actual_check_out)
  then return NEW; end if;
  -- ponytail: no lock, so two desks saving at the same instant could both get through; lock the Exclusive's rows if that ever happens.
  select e.id into v_in_way from bookings e
   where e.venue_key = 'venue-exclusive' and e.status <> 'cancelled' and e.id <> NEW.id
     and exclusive_covers(e.event_addons->>'venue_type', NEW.room_id::text, v_key)
     and booking_halves(e.check_in, e.check_out, e.stay_hours, e.stay_half, e.actual_check_in, e.late_check_out_hours, e.actual_check_out) && v_new
   limit 1;
  if v_in_way is not null then
    raise exception 'Pension House Exclusive (%) has the whole house on those days', v_in_way using errcode = 'exclusion_violation';
  end if;
  return NEW;
end;
$$;

DROP TRIGGER IF EXISTS refuse_under_exclusive ON public.bookings;
CREATE TRIGGER refuse_under_exclusive BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.refuse_under_exclusive();
