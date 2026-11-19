import { createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Booking } from '../types/booking'
import { supabase } from './supabaseClient'
import { channelOf } from './channelStay'

// **Where a booking came from** (Sebastian, 2026-11-19: "I want to track where it came from", for the owner's
// count each month, and on the calendar pill). Nothing is stored on the booking: a request the desk confirmed keeps
// the booking it became (`booking_requests.booking_id`, the bill's first room), and a booking site's stay has its
// `channel_ref`. The desk never picks one; a booking with neither was made at the desk. WhatsApp is not used
// (Sebastian, 2026-11-19), so it is never shown.

export type BookingSource = 'website' | 'messenger' | 'airbnb' | 'booking_com'

/** The booked requests: booking id → where the guest asked. */
export function useRequestSources() {
  return useQuery({
    queryKey: ['request-sources'],
    queryFn: async () => {
      const { data, error } = await supabase.from('booking_requests').select('booking_id, source').eq('status', 'booked').not('booking_id', 'is', null)
      if (error) throw error
      const map = new Map<string, 'website' | 'messenger'>()
      for (const r of data || []) if (r.source === 'website' || r.source === 'messenger') map.set(r.booking_id as string, r.source)
      return map
    },
    staleTime: 60_000,
  })
}

/** Every booking of a confirmed request's bill takes its source, so all its rooms wear the mark. */
export function sourcesOf(requests: Map<string, 'website' | 'messenger'> | undefined, bookings: Booking[]): Map<string, BookingSource> {
  const out = new Map<string, BookingSource>()
  if (!requests?.size) return out
  const byGroup = new Map<string, 'website' | 'messenger'>()
  for (const b of bookings) {
    const s = requests.get(b.id)
    if (s && b.group_id) byGroup.set(b.group_id, s)
  }
  for (const b of bookings) {
    const s = requests.get(b.id) || (b.group_id ? byGroup.get(b.group_id) : undefined)
    if (s) out.set(b.id, s)
  }
  return out
}

export function sourceOf(b: Booking, sources: Map<string, BookingSource>): BookingSource | null {
  return channelOf(b) || sources.get(b.id) || null
}

/** The calendar's sources, handed to every pill without passing them through the grid. */
export const SourceContext = createContext<Map<string, BookingSource>>(new Map())
export const useSources = () => useContext(SourceContext)

export type SourceCount = { source: BookingSource | 'desk'; count: number }

/** How many bookings came from each place, for the month or year report: one count a bill (its rooms together),
 *  by the day it checks in; blocks and cancelled bills are not bookings. Largest first, the desk last. */
export function countSources(bookings: Booking[], sources: Map<string, BookingSource>, from: string, to: string): SourceCount[] {
  const bills = new Map<string, BookingSource | 'desk'>()
  for (const b of bookings) {
    if (b.status === 'blocked' || b.status === 'cancelled' || b.check_in < from || b.check_in > to) continue
    const key = b.group_id || b.id
    const s = sourceOf(b, sources)
    if (!bills.has(key) || (s && bills.get(key) === 'desk')) bills.set(key, s || 'desk')
  }
  const n = new Map<BookingSource | 'desk', number>()
  for (const s of bills.values()) n.set(s, (n.get(s) || 0) + 1)
  return [...n].map(([source, count]) => ({ source, count }))
    .sort((a, b) => (a.source === 'desk' ? 1 : 0) - (b.source === 'desk' ? 1 : 0) || b.count - a.count)
}
