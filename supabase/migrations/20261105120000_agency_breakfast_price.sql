-- An agency's own breakfast price, and where each of its prices was last changed from
-- (Sebastian, 2026-11-05, the "Agency prices" mock: prices are changed on the bill while
-- booking and kept on the agency, instead of a trip to Settings each time).
--
-- breakfast_price: one price a breakfast for every room the agency books. NULL is the
--   room's own breakfast price, as before.
-- price_from: { "<room or venue id>" | "breakfast": { "bill": "INV-…" | null, "on": "YYYY-MM-DD" } },
--   written when a price is changed on a bill, so Settings can show where it came from.
--   A price typed in Settings takes its entry off.
--
-- A booking keeps the breakfast price it was sold at in event_addons.breakfast_price,
-- the way its room price is kept in contract_rate_override.

alter table public.partner_deals
  add column if not exists breakfast_price numeric,
  add column if not exists price_from jsonb not null default '{}'::jsonb;
