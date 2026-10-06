import { Room, Venue } from '../../types/booking'
import { roomDisplayName } from '../calendar/bookingStyles'

type UnitSelections = Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>

// Built from LOCAL parts, never `new Date(iso)` — the hotel is UTC+8.
const dayOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const short = (iso: string) => dayOf(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/** `Bunk Bed 3` · `Double, Bunk Bed 3 and Gazebo` — the units' own names, read in a line. */
const listOf = (parts: string[]) =>
  parts.length <= 1 ? parts.join('') : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]

/**
 * What is being booked, in the words the desk reads back to the guest:
 * `Bunk Bed 3 · Oct 4 → Oct 5 · 1 night`, or `Bunk Bed 3 · Oct 4 · 3-hour stay`.
 *
 * **A room is named, not numbered** (Sebastian, 2026-10-06: *"I prefer you use the Room
 * name instead of number here"*). A room with no name falls back to `Room 7`.
 *
 * The form's title bar carries this (the design review, 2026-10-04). The form used to
 * say nowhere which room or which dates it was for — only the breakfast chip named the
 * room — and it covers the calendar the dates were picked on.
 *
 * Units that share their dates share a line; a group picked with different dates gets
 * one line per set of dates.
 */
export function stayLines(selections: UnitSelections, rooms: Room[], venues: Venue[], shortStayHours: number | null): string[] {
  const byDates = new Map<string, { rooms: Room[]; venueNames: string[]; checkIn: string; checkOut: string }>()
  Object.entries(selections).forEach(([id, sel]) => {
    if (!sel.checkIn || !sel.checkOut) return
    const key = sel.checkIn + '|' + sel.checkOut
    const group = byDates.get(key) || { rooms: [], venueNames: [], checkIn: sel.checkIn, checkOut: sel.checkOut }
    if (sel.type === 'room') {
      const room = rooms.find(r => r.id === id)
      if (room) group.rooms.push(room)
    } else {
      const venue = venues.find(v => v.id === id)
      if (venue) group.venueNames.push(venue.name)
    }
    byDates.set(key, group)
  })

  return Array.from(byDates.values())
    .filter(g => g.rooms.length + g.venueNames.length > 0)
    .map(g => {
      // In the order of the calendar's rows, so a group reads the way it is laid out.
      const names = [...g.rooms].sort((a, b) => a.room_number - b.room_number).map(roomDisplayName)
      const units = listOf([...names, ...g.venueNames])
      if (shortStayHours) return units + ' · ' + short(g.checkIn) + ' · ' + shortStayHours + '-hour stay'
      const nights = Math.max(1, Math.round((dayOf(g.checkOut).getTime() - dayOf(g.checkIn).getTime()) / 86400000))
      return units + ' · ' + short(g.checkIn) + ' → ' + short(g.checkOut) + ' · ' + nights + (nights === 1 ? ' night' : ' nights')
    })
}
