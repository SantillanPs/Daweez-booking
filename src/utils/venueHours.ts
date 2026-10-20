// The hours the Gazebo and the Garden are sold for, like a room's 3h · 6h · 12h
// (Sebastian, 2026-10-20: the Gazebo is 6 hours, or 4 hours w/ aircon; the Garden is
// 6 hours). They used to be booked in "day blocks" of 6 hours with a counter on the form.
// The staff set the prices in Settings → Venues ("as always, let the staff decide").
import { RateConfig, Venue } from '../types/booking'
import { normalizeVenueId } from './helpers'

export interface VenueHour {
  hours: number
  aircon?: boolean
  /** 0 = no price yet: the calendar bar asks for one. */
  price: number
  /** The Settings field this price is kept in. */
  key: 'gazebo6Price' | 'gazeboAirconPrice' | 'garden6Price'
}

/** What a venue can be sold for by the hour — none for a venue sold by the day. */
export function venueHoursOf(venue: Pick<Venue, 'id' | 'base_price'> | undefined, rates: RateConfig): VenueHour[] {
  if (!venue) return []
  // A 6-hour stay is what the old day block was, so it keeps that block's price until
  // the staff type one of their own.
  const six = (own: number) => own > 0 ? own : rates.dayBlockRate > 0 ? rates.dayBlockRate : Number(venue.base_price || 0)
  switch (normalizeVenueId(venue.id)) {
    case 'venue-gazebo': return [
      { hours: 6, price: six(rates.gazebo6Price), key: 'gazebo6Price' },
      { hours: 4, aircon: true, price: rates.gazeboAirconPrice || 0, key: 'gazeboAirconPrice' },
    ]
    case 'venue-garden': return [{ hours: 6, price: six(rates.garden6Price), key: 'garden6Price' }]
    default: return []
  }
}

/** ' w/ aircon' when these hours of this venue are the aircon stay, else ''. */
export function airconWords(venueId: string | undefined, hours: number | undefined): string {
  return venueId && normalizeVenueId(venueId) === 'venue-gazebo' && hours === 4 ? ' w/ aircon' : ''
}
