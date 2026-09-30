// ONE PRICE — and since 2026-09-29 there is no switch to pick between two.
//
// The owner's ruling: *"the use promo should be gone permanently. because the promo price should be the
// new original price."* So there is ONE price per room and per venue. `promo_price` holds it, `base_price`
// duplicates it (the data was collapsed by `20260929200000_one_price_promo_becomes_base.sql`), and the old
// `promoOn` argument went with the sale mode it belonged to — nothing can choose the "regular" figure any
// more, because the regular figure no longer exists as a separate number.
//
// This is the single place the price is picked. Every screen, the booking form, the printed bill and the
// earnings report read it, so they cannot drift apart again.
export function getEffectiveNightlyPrice(
  /** The unit's `base_price` — now only a fallback for a unit that has never been given a price. */
  base: number,
  /** The unit's `promo_price`, which IS the price. */
  price: number | null | undefined,
): number {
  return price != null && price > 0 ? price : base
}
