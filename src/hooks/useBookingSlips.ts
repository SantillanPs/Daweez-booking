import { useEffect, useRef, useState } from 'react'
import { Booking, Room, Venue } from '../types/booking'
import { OrderSlip, getSlipsByBooking, getSlipsForBooking, settleSlipsOfPaidStay, slipsTotal } from '../utils/orderSlips'
import { changedRows, settleBill } from '../utils/bookingBalance'
import { groupOf } from '../utils/bookingGroup'
import { useRealtimeTabs } from './useRealtimeTabs'
import { showToast } from '../utils/toast'

interface UseBookingSlipsParams {
  /** The live booking. Passed as it changes, so a reload always reads the latest money. */
  booking: Booking
  rooms: Room[]
  venues: Venue[]
  /** Every booking, to find the rest of the bill. */
  bookings: Booking[]
  /** Writes the recomputed booking back into the panel's local state. */
  setBooking: (booking: Booking) => void
  onUpdateBooking?: (booking: Booking) => Promise<void>
}

/**
 * A stay's order slips (board card k69, reshaped by the staff's feedback, 2026-10-04).
 *
 * The slips live in their own tables, so they are read separately and folded into what
 * is owed. Three jobs, all here so the booking panel stays thin:
 *
 *  1. Read every slip of the stay — the open one and the ones already closed.
 *  2. Close the slips a settled stay has paid for, so paid food never stays open.
 *  3. Make sure the STORED balance includes the food. An order taken while this panel
 *     was closed would otherwise leave the bill short.
 *
 * It reads again whenever a slip changes on any tablet, so an order taken in the
 * restaurant shows here without the panel being reopened. Nothing here writes any
 * booking field except the recomputed balance, and a failed read changes nothing — an
 * empty answer would take the guest's food off their bill.
 */
export function useBookingSlips({ booking, rooms, venues, bookings, setBooking, onUpdateBooking }: UseBookingSlipsParams) {
  const [slips, setSlips] = useState<OrderSlip[]>([])
  const latest = useRef({ booking, rooms, venues, bookings })
  useEffect(() => { latest.current = { booking, rooms, venues, bookings } })

  const sync = async (announce: boolean): Promise<void> => {
    let read: OrderSlip[]
    try {
      read = await getSlipsForBooking(latest.current.booking.id)
      if (await settleSlipsOfPaidStay(latest.current.booking, read, latest.current)) {
        read = await getSlipsForBooking(latest.current.booking.id)
      }
    } catch {
      if (announce) showToast('Could not read the order slips. Please try again.', 'error')
      return
    }
    setSlips(read)
    const now = latest.current
    // The whole bill is priced again: its money is on its first room. The other rooms' food is read too.
    const rows = groupOf(now.booking, now.bookings)
    let food: Record<string, number>
    try {
      const others = rows.length > 1 ? await getSlipsByBooking(rows.filter(b => b.id !== now.booking.id).map(b => b.id)) : {}
      food = Object.fromEntries(rows.map(b => [b.id, slipsTotal(b.id === now.booking.id ? read : others[b.id] || [])]))
    } catch { return }
    const changed = changedRows(rows, settleBill(rows, { rooms: now.rooms, venues: now.venues, food }))
    if (changed.length === 0) return
    const mine = changed.find(b => b.id === now.booking.id)
    if (mine) setBooking(mine)
    try {
      for (const b of changed) await onUpdateBooking?.(b)
    } catch {
      if (announce) showToast('Could not update the bill. Please try again.', 'error')
    }
  }

  // Once per booking. The panel is keyed by booking id in CalendarTab, so a different
  // booking mounts a fresh instance and this runs again.
  useEffect(() => {
    queueMicrotask(() => void sync(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id])
  useRealtimeTabs(() => void sync(false))

  return { slips, amount: slipsTotal(slips), reload: () => sync(true) }
}
