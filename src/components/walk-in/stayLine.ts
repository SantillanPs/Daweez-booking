import { Room, Venue } from '../../types/booking'

type UnitSelections = Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>

// Built from LOCAL parts, never `new Date(iso)` — the hotel is UTC+8.
const dayOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const short = (iso: string) => dayOf(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/** `4` · `4, 5 and 7` · `4 and Gazebo` — the caller puts `Room` or `Rooms` in front. */
const listOf = (parts: string[]) =>
  parts.length <= 1 ? parts.join('') : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]

/**
 * What is being booked, in the words the desk reads back to the guest:
 * `Room 4 · Oct 4 → Oct 5 · 1 night`, or `Room 4 · Oct 4 · 3-hour stay` — the same
 * shapes the quick view's own title uses.
 *
 * The form's title bar carries this (the design review, 2026-10-04). The form used to
 * say nowhere which room or which dates it was for — only the breakfast chip named the
 * room — and it covers the calendar the dates were picked on.
 *
 * Units that share their dates share a line; a group picked with different dates gets
 * one line per set of dates.
 */
export function stayLines(selections: UnitSelections, rooms: Room[], venues: Venue[], shortStayHours: number | null): string[] {
  const byDates = new Map<string, { roomNumbers: number[]; venueNames: string[]; checkIn: string; checkOut: string }>()
  Object.entries(selections).forEach(([id, sel]) => {
    if (!sel.checkIn || !sel.checkOut) return
    const key = sel.checkIn + '|' + sel.checkOut
    const group = byDates.get(key) || { roomNumbers: [], venueNames: [], checkIn: sel.checkIn, checkOut: sel.checkOut }
    if (sel.type === 'room') {
      const room = rooms.find(r => r.id === id)
      if (room) group.roomNumbers.push(room.room_number)
    } else {
      const venue = venues.find(v => v.id === id)
      if (venue) group.venueNames.push(venue.name)
    }
    byDates.set(key, group)
  })

  return Array.from(byDates.values())
    .filter(g => g.roomNumbers.length + g.venueNames.length > 0)
    .map(g => {
      const numbers = [...g.roomNumbers].sort((a, b) => a - b)
      const units = (numbers.length > 1 ? 'Rooms ' : numbers.length === 1 ? 'Room ' : '')
        + listOf([...numbers.map(String), ...g.venueNames])
      if (shortStayHours) return units + ' · ' + short(g.checkIn) + ' · ' + shortStayHours + '-hour stay'
      const nights = Math.max(1, Math.round((dayOf(g.checkOut).getTime() - dayOf(g.checkIn).getTime()) / 86400000))
      return units + ' · ' + short(g.checkIn) + ' → ' + short(g.checkOut) + ' · ' + nights + (nights === 1 ? ' night' : ' nights')
    })
}
