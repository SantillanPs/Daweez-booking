// ONE PRICE (card k128): there is a single price per room and per venue, so the
// old sale-mode switch is gone — nothing here writes or reads a "promo is on"
// flag any more. What survives is the one function that picks the figure:
// `promo_price` holds the real price whenever a unit has one, and `base_price`
// is only the fallback for a unit that has never been given one.
export function getEffectiveNightlyPrice(
  regular: number,
  promo: number | null | undefined,
  promoOn: boolean,
): number {
  if (promoOn && promo != null && promo > 0) return promo
  return regular
}
