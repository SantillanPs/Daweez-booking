-- VACATION HOUSE: ₱7,500, WITH TWO KINDS (Sebastian, 2026-10-06).
--
-- The Vacation House's price a day goes from ₱15,000 to ₱7,500. When it is booked the desk also
-- chooses what the guest is taking:
--   · the Vacation House ............................. ₱7,500  (the plain venue, `base_price`)
--   · the Vacation House & Ground .................... ₱10,000 (the house AND the ground — the
--                                                     ground is an addition to the house)
--   · Exclusive ...................................... ₱15,000 (all of it, with everything that
--                                                     comes with it — which is why it is the dearest)
-- A kind is not charged on top of the day: it IS the day's price, replacing `base_price`.
--
-- The kinds live on the venue's own row, in `details.types` (read by `utils/venueTypes.ts`), so a
-- venue without them shows no choice and is booked at `base_price`. `label` is what the choice, the
-- bill and the booking panel call it; `note` is the short fact under its price. The kind a booking
-- was made with rides in that booking's `event_addons.venue_type` — no new column, no function change.
--
-- Changing a venue's price re-prices any Vacation House booking the next time the app works its
-- bill out again (extending the stay, moving it, correcting it). A booking already saved keeps the
-- amount it was saved with until then.
--
-- Safe to run again.

UPDATE public.venues
SET base_price = 7500,
    details = COALESCE(details, '{}'::jsonb)
      || '{"types": [{"key": "ground", "label": "Vacation House & Ground", "price": 10000}, {"key": "exclusive", "label": "Exclusive", "price": 15000, "note": "all included"}]}'::jsonb
WHERE id = 'venue-vacation';
