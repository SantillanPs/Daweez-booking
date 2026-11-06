import { Booking } from '../types/booking'
import { supabase } from './supabaseClient'

// **A stay from a calendar link** (Sebastian, 2026-10-31: Booking.com by calendar links "for now").
// A link says only which dates are taken, so the stay lands with a stand-in for a name and the desk
// types the rest from Booking.com's own message. The sync adds stays and never changes one: what it
// cannot decide is a `ChannelAlert` for the desk, read by the bell on the calendar.

export type Channel = 'airbnb' | 'booking_com'

export const CHANNEL_NAME: Record<Channel, string> = { airbnb: 'Airbnb', booking_com: 'Booking.com' }

/** Where the desk goes to deal with a stay on the site itself. */
export const CHANNEL_ADMIN: Record<Channel, string> = { airbnb: 'https://www.airbnb.com/hosting', booking_com: 'https://admin.booking.com' }

export interface ChannelAlert {
  id: string
  /** `clash`: sold on the site while the room is taken here. `gone`: the stay left the site's calendar. */
  kind: 'clash' | 'gone'
  channel: Channel
  ref: string
  room_id: string
  check_in: string
  check_out: string
  /** `clash`: the stay in the way. `gone`: the stay that left. */
  booking_id: string | null
}

/** Which site a booking came from, or nothing for one the desk made. */
export function channelOf(b: Pick<Booking, 'channel_ref'>): Channel | null {
  if (!b.channel_ref) return null
  return b.channel_ref.startsWith('airbnb|') ? 'airbnb' : 'booking_com'
}

/** The site's stay nobody has put a name on yet. The stand-in is what `insert_channel_stay` writes. */
export function needsDetails(b: Pick<Booking, 'channel_ref' | 'guest_name'>): boolean {
  const channel = channelOf(b)
  return !!channel && b.guest_name === CHANNEL_NAME[channel] + ' guest'
}

export async function readChannelAlerts(): Promise<ChannelAlert[]> {
  const { data, error } = await supabase.from('channel_alerts').select('*').eq('status', 'open').order('created_at')
  // A database without this table yet (live, until it is promoted) simply has nothing to ask.
  if (error) return []
  return (data || []) as ChannelAlert[]
}

/** Puts a guest sold twice in another room; gives back the new booking's id. */
export async function placeChannelStay(alertId: string, roomId: string): Promise<string> {
  const { data, error } = await supabase.rpc('place_channel_stay', { p_alert_id: alertId, p_room_id: roomId })
  if (error) throw error
  return data as string
}

export async function closeChannelAlert(alertId: string): Promise<void> {
  const { error } = await supabase.rpc('close_channel_alert', { p_alert_id: alertId })
  if (error) throw error
}

/** A room swapped on the bill is a new row, and the stay's link has to go with it. */
export async function moveChannelRef(fromId: string, toId: string): Promise<void> {
  const { error } = await supabase.rpc('move_channel_ref', { p_from: fromId, p_to: toId })
  if (error) throw error
}
