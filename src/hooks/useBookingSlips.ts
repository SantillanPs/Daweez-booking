import { useEffect, useRef, useState } from 'react'
import { Booking, Room, Venue } from '../types/booking'
import { OrderSlip, getSlipsForBooking, settleSlipsOfPaidStay, slipsTotal } from '../utils/orderSlips'
import { recomputeBalance } from '../utils/bookingBalance'
import { useRealtimeTabs } from './useRealtimeTabs'
import { showToast } from '../utils/toast'

interface UseBookingSlipsParams {
  /** The live booking. Passed as it changes, so a reload always reads the latest money. */
  booking: Booking
  rooms: Room[]
  venues: Venue[]
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
export function useBookingSlips({ booking, rooms, venues, setBooking, onUpdateBooking }: UseBookingSlipsParams) {
  const [slips, setSlips] = useState<OrderSlip[]>([])
  const latest = useRef({ booking, rooms, venues })
  useEffect(() => { latest.current = { booking, rooms, venues } })

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
    const synced = recomputeBalance(now.booking, { rooms: now.rooms, venues: now.venues, tabTotal: slipsTotal(read) })
    if (Math.abs(Number(synced.balance_due || 0) - Number(now.booking.balance_due || 0)) <= 0.005) return
    setBooking(synced)
    try {
      await onUpdateBooking?.(synced)
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
