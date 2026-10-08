import { Venue, VenueType } from '../types/booking'

// THE KINDS OF A VENUE (Sebastian, 2026-10-06). The Vacation House is ₱7,500 a day. Taken
// with the ground as well — **Vacation House & Ground** — it is ₱10,000, and **Exclusive**,
// which is all of it with everything that comes with it, is ₱15,000. Ground is the house
// *and* the ground, not a different house, and Exclusive already includes the rest, which is
// why it is the dearest. Neither is charged on top of the day: the kind chosen sets the day's
// price, replacing `base_price`. The kinds live on the venue's own row (`details.types`), so a
// venue without them shows no choice and nothing about it changes.

/** The kinds the desk can choose for a venue (empty for a venue that has none). */
export function venueTypes(venue?: Venue): VenueType[] {
  const types = venue?.details?.types
  return Array.isArray(types) ? types.filter(t => t && t.key && Number(t.price) > 0) : []
}

/** The chosen kind of a venue, when the key is one of its own. */
export function venueTypeOf(venue: Venue | undefined, key?: string): VenueType | undefined {
  return key ? venueTypes(venue).find(t => t.key === key) : undefined
}

/** The price a day of the chosen kind, or `undefined` for the plain venue. */
export function venueTypePrice(venue: Venue | undefined, key?: string): number | undefined {
  const type = venueTypeOf(venue, key)
  return type ? Number(type.price) : undefined
}

/**
 * What the booking is called on paper: `Vacation House & Ground`, `Vacation House · Exclusive`.
 * A kind whose label already starts with the venue's name stands as it is; one that does not
 * (`Exclusive`) follows the name.
 */
export function venueTypeTitle(venue: Venue, type: VenueType): string {
  return type.label.startsWith(venue.name) ? type.label : venue.name + ' · ' + type.label
}
