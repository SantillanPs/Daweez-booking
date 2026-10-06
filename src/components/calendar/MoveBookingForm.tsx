import React, { useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'
import { isRoomAvailable, isVenueRangeAvailable } from '../../utils/availability'
import { moveBooking, stayTotalAfterMove } from '../../utils/bookingMove'
import { normalizeVenueId } from '../../utils/helpers'
import { useDashboardData } from '../DashboardContext'
import { roomOptionLabel } from './bookingStyles'

const fmtPeso = (n: number) => '₱' + Math.round(n).toLocaleString()

interface MoveBookingFormProps {
  booking: Booking
  rooms: Room[]
  venues: Venue[]
  /** Every active booking — what the new room and dates are checked against. */
  bookings: Booking[]
  /** The guest's food tab, which stays on the bill wherever the stay goes. */
  tabTotal: number
  /** Saves the moved booking. Throws, with the reason, when the room is not free. */
  onMove: (moved: Booking) => Promise<void>
}

/**
 * **Change room or dates** — the form in the booking panel (Sebastian, 2026-10-06).
 *
 * One room (or venue) and the two dates, nothing else: the guest, the agency, the payments
 * and the receipts stay on the booking (see `moveBooking`). A room that is taken on the
 * chosen dates says so in the list rather than being left out of it, so the desk can see why
 * it cannot be picked. What the move does to the bill is shown before it is saved.
 *
 * A booking moves as its own room: a stay booked together with other rooms keeps them where
 * they are.
 */
export function MoveBookingForm({ booking, rooms, venues, bookings, tabTotal, onMove }: MoveBookingFormProps) {
  const { partnerDeals } = useDashboardData()
  const isRoom = !!booking.room_id
  const currentUnit = booking.room_id || normalizeVenueId(booking.venue_id) || ''
  const [unitId, setUnitId] = useState(currentUnit)
  const [checkIn, setCheckIn] = useState(booking.check_in)
  const [checkOut, setCheckOut] = useState(booking.check_out)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const freeOn = (id: string) => !checkIn || !checkOut || checkOut <= checkIn || (isRoom
    ? isRoomAvailable(id, checkIn, checkOut, bookings, booking.id)
    : isVenueRangeAvailable(id, checkIn, checkOut, bookings, booking.id))

  const unchanged = unitId === currentUnit && checkIn === booking.check_in && checkOut === booking.check_out
  const problem = !checkIn || !checkOut ? 'Choose both dates.'
    : checkOut <= checkIn ? 'Check-out must be after check-in.'
    : !freeOn(unitId) ? (isRoom ? 'That room' : 'That venue') + ' is already booked on those dates.'
    : ''

  const moved = useMemo(
    () => (problem || unchanged ? null : moveBooking(booking, { unitId, type: isRoom ? 'room' : 'venue', checkIn, checkOut }, { rooms, venues, deals: partnerDeals, tabTotal })),
    [problem, unchanged, booking, unitId, isRoom, checkIn, checkOut, rooms, venues, partnerDeals, tabTotal],
  )
  const paid = Number(booking.downpayment_paid || 0)
  const total = moved ? stayTotalAfterMove(moved, { rooms, venues, tabTotal }) : 0
  const overpaid = moved ? Math.max(0, paid - total) : 0
  const nights = checkIn && checkOut && checkOut > checkIn
    ? Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
    : 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!moved || saving) return
    setSaving(true)
    setError('')
    try {
      await onMove(moved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not move the booking. Please try again.')
      setSaving(false)
    }
  }

  const field = 'mt-1 w-full h-11 bg-card border border-soft text-main px-3 rounded-lg text-[13px] outline-none focus:border-gold-500'
  const shown = error || (unchanged ? '' : problem)

  return (
    <form onSubmit={submit} className="space-y-2.5">
      {shown && (
        <div className="p-2.5 bg-danger-50 border border-danger-200 text-danger-600 text-[12px] flex items-center gap-2 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" /><span>{shown}</span>
        </div>
      )}
      <label className="block">
        <span className="block text-[12px] font-semibold text-muted">{isRoom ? 'Room' : 'Venue'}</span>
        <select value={unitId} onChange={e => setUnitId(e.target.value)} className={field + ' cursor-pointer'}>
          {isRoom
            ? rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {roomOptionLabel(r)}{r.id === currentUnit ? ' · now' : !freeOn(r.id) ? ' · booked' : ''}
                </option>
              ))
            : venues.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}{v.id === currentUnit ? ' · now' : !freeOn(v.id) ? ' · booked' : ''}
                </option>
              ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="block text-[12px] font-semibold text-muted">Check-in</span>
          <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="block text-[12px] font-semibold text-muted">Check-out</span>
          <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} className={field} />
        </label>
      </div>

      {moved && (
        <div className="p-3 bg-gold-100 border border-gold-200 rounded-lg text-[13px] space-y-1">
          <div className="flex justify-between text-muted">
            <span>Nights</span>
            <span className="text-main font-semibold">{nights}</span>
          </div>
          {paid > 0 && (
            <div className="flex justify-between text-muted">
              <span>Already paid</span>
              <span className="text-main font-semibold">{fmtPeso(paid)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t border-gold-200/70 pt-1">
            <span className="text-muted">New amount to pay</span>
            <span className={Number(moved.balance_due || 0) > 0 ? 'text-danger-600' : 'text-emerald-600'}>{fmtPeso(Number(moved.balance_due || 0))}</span>
          </div>
          {overpaid > 0 && (
            <p className="text-[12px] font-semibold text-main">They have paid {fmtPeso(overpaid)} more than this stay costs.</p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!moved || saving}
        className="w-full min-h-11 bg-card hover:bg-gold-100 disabled:bg-softbg disabled:text-muted disabled:cursor-default text-main border border-soft text-[13px] font-bold rounded-lg transition-colors cursor-pointer"
      >
        {saving ? 'Moving…' : 'Move booking'}
      </button>
    </form>
  )
}
