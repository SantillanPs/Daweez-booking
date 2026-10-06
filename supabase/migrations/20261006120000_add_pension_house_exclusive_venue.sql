-- PENSION HOUSE EXCLUSIVE — a fourth event venue (Sebastian, 2026-10-06), ₱20,000 a day.
--
-- A venue is a row, nothing more: the calendar draws a row for it, the booking form lists
-- it, and `calculatePricing` prices it at `base_price` a day the way it prices the Vacation
-- House (only the Gazebo and the Garden Area are sold in day blocks).
--
-- `capacity` and `image_url` are placeholders the owner has not given: 50 is what the other
-- three venues carry, and the picture is the Vacation House's. Both are shown on the public
-- reservation page, so correct them with an UPDATE when the real ones are known.
--
-- Applied to development and, on the owner's go-ahead, to live — both on 2026-10-06.
-- Safe to run again.

INSERT INTO public.venues (id, name, base_price, capacity, description, image_url, details)
VALUES (
  'venue-exclusive',
  'Pension House Exclusive',
  20000,
  50,
  'Exclusive use of Daweez Pension House for your event.',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
  '{"chairs": 0, "tables": 0, "extras": []}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
