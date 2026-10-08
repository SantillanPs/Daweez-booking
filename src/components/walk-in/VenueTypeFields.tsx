import { Venue } from '../../types/booking'
import { SegmentedControl, SegmentOption } from '../SegmentedControl'
import { getEffectiveNightlyPrice } from '../../utils/promoMode'
import { venueTypes } from '../../utils/venueTypes'
import { Field } from './Field'

const peso = (n: number) => '₱' + Math.round(n).toLocaleString()

/**
 * What the guest is taking when they book a venue that comes in kinds — for the Vacation
 * House: **the Vacation House** (₱7,500), **the Vacation House & Ground** (₱10,000), or
 * **Exclusive** (₱15,000), which is all of it with everything that comes with it
 * (Sebastian, 2026-10-06). The ground is an addition to the house, not a different house, and
 * Exclusive includes the rest — so each choice is named for what it contains, with its price
 * under it for the desk to read out.
 *
 * It is not an add-on and is not charged on top of the day: the choice **is** the day's price,
 * so it sits above the Stay extras, with the things that decide the price. The plain venue is
 * chosen when the form opens, because that is the venue's own price; the form's Total moves the
 * moment another is picked. A venue that has no kinds shows nothing here.
 */
export function VenueTypeFields({ venues, chosen, onChoose }: {
  /** The venues being booked that have kinds to choose between. */
  venues: Venue[]
  /** The kind chosen for each venue, by venue id — missing means the plain venue. */
  chosen: Record<string, string>
  onChoose: (venueId: string, key: string) => void
}) {
  return (
    <div className="space-y-3">
      {venues.map(venue => {
        const options: SegmentOption<string>[] = [
          { key: '', label: venue.name, sub: peso(getEffectiveNightlyPrice(venue.base_price, venue.promo_price)) },
          ...venueTypes(venue).map(t => ({
            key: t.key,
            label: t.label,
            sub: peso(t.price) + (t.note ? ' · ' + t.note : ''),
          })),
        ]
        return (
          <Field key={venue.id} group label={venue.name + ' type'}>
            <SegmentedControl options={options} value={chosen[venue.id] || ''} onChange={key => onChoose(venue.id, key)} label={venue.name + ' type'} />
          </Field>
        )
      })}
    </div>
  )
}
