import { Room, SyncFeed } from '../types/booking'

/**
 * Every room's two link rows — Airbnb's and Booking.com's — whether or not one is stored
 * yet, so each room always has both boxes.
 */
export function feedRows(rooms: Room[], feeds: SyncFeed[]): SyncFeed[] {
  const out: SyncFeed[] = []
  rooms.forEach(room => {
    const mine = feeds.filter(f => f.room_id === room.id)
    const air = mine.find(f => f.channel === 'airbnb')
    const bk = mine.find(f => f.channel === 'booking_com')
    out.push(air || { id: 'feed-ab-' + room.id, room_id: room.id, channel: 'airbnb', url: '', last_synced: null })
    out.push(bk || { id: 'feed-bc-' + room.id, room_id: room.id, channel: 'booking_com', url: '', last_synced: null })
  })
  return out
}

/**
 * **One address, one room.**
 *
 * A channel feed is a calendar the hotel subscribes to, and a calendar belongs to a listing. Putting one
 * address on several rooms makes the sync fetch that calendar once per room and import every reservation in it
 * **once per room** — so one Airbnb stay blocked nine rooms for the same night, downloaded the same file nine
 * times on every run, and made the two screens that wait on the shared load feel broken (found on the owner's
 * own hotel, 2026-09-30: nine feed rows, all one URL).
 *
 * It happened because nothing said no. This module is that "no": the Channels screen asks it before saving and
 * refuses, naming the room that already holds the address, so the mistake cannot be typed twice.
 *
 * A blank address is not a clash — every room starts with two empty boxes, and an unfilled one syncs nothing.
 */
export interface FeedUrlClash {
  url: string
  /** Every room carrying this address, in the order the feeds were given. */
  roomIds: string[]
}

export function findFeedUrlClashes(feeds: SyncFeed[]): FeedUrlClash[] {
  const byUrl = new Map<string, string[]>()
  feeds.forEach(feed => {
    const url = (feed.url || '').trim()
    if (!url || !feed.room_id) return
    const rooms = byUrl.get(url) || []
    if (!rooms.includes(feed.room_id)) rooms.push(feed.room_id)
    byUrl.set(url, rooms)
  })
  return Array.from(byUrl.entries())
    .filter(([, roomIds]) => roomIds.length > 1)
    .map(([url, roomIds]) => ({ url, roomIds }))
}

/**
 * The message the desk sees. It names the rooms rather than the address: the address is 60 characters of
 * characters nobody reads, and what the desk has to do is decide which room it belongs to.
 */
export function feedUrlClashMessage(clash: FeedUrlClash, roomLabel: (roomId: string) => string): string {
  const rooms = clash.roomIds.map(roomLabel)
  return 'One link is on ' + rooms.length + ' rooms (' + rooms.join(', ') + '). ' +
    'Each room needs its own calendar link — give this one to ' + rooms[0] + ', or paste a different link into the others.'
}
