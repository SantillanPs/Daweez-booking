-- ONE PRICE PER UNIT: the promo figure becomes the price, permanently — without disturbing a single
-- booking that was already sold at the older figure.
--
-- The owner's ruling (2026-09-29): *"the use promo should be gone permanently. because the promo price
-- should be the new original price."*
--
-- Why it matters: the app has always treated `promo_price` as the real price (card k128 — one price, no
-- sale mode), but the DATA kept two columns and they had drifted apart on 9 of the 10 rooms (Room 4 read
-- 1,250 against 950). Any code path that read the wrong column quoted the wrong figure, and the desk had
-- no way to see that two prices existed. This collapse ends that, and `usePromo` leaves the code so
-- nothing can pick between them again (`src/utils/pricing.ts`, `src/utils/promoMode.ts`).
--
-- THE TRAP THIS MIGRATION AVOIDS — and the reason it has two steps in this order:
-- ten bookings carry `promo_applied = false`, which is how the app records *"this one was sold at the old
-- regular figure, not the promo one"* (the **Log old booking** Regular/Promo choice, and the Getz Pharma
-- agency stays). Collapsing `base_price` alone would have re-priced all ten the next time anything read
-- them — ₱300 to ₱700 **per night lower**, on bills that have already been given to guests and to an
-- agency. `pricing.ts` already has exactly the right home for a figure like that: `contract_rate_override`,
-- which wins outright over the rate card (its first branch). So each of those bookings is **pinned to the
-- price it was actually sold at**, and *then* the columns collapse underneath them.
--
-- Result: one price on the rate card (the promo figure, now the real one), and every past booking still
-- printing exactly what the guest paid. Re-running this file changes nothing.

-- ── Step 1: pin every booking that was sold at the older regular figure ────────────────────────────────
-- Pinned to the room's / venue's CURRENT base_price, which at this moment still holds that older figure.
update public.bookings b
set contract_rate_override = u.base_price
from (
  select r.id as unit_id, r.base_price
  from public.rooms r
  where r.promo_price is not null and r.promo_price > 0 and r.base_price is distinct from r.promo_price
  union all
  select v.id, v.base_price
  from public.venues v
  where v.promo_price is not null and v.promo_price > 0 and v.base_price is distinct from v.promo_price
) u
where coalesce(b.room_id, b.venue_id) = u.unit_id
  and coalesce(b.promo_applied, true) = false
  and b.contract_rate_override is null;

-- ── Step 2: collapse the two columns into one price ────────────────────────────────────────────────────
-- `base_price` is kept, not dropped: the RPCs, the room editor and the printed statements all still carry
-- it as *the* figure, and dropping a column the deploy depends on is a bigger change than this fault
-- needs. It simply stops being a second price.
update public.rooms
set base_price = promo_price
where promo_price is not null
  and promo_price > 0
  and base_price is distinct from promo_price;

update public.venues
set base_price = promo_price
where promo_price is not null
  and promo_price > 0
  and base_price is distinct from promo_price;
