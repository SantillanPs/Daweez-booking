import { useEffect, useState } from 'react'
import { Booking, Room, Venue } from '../types/booking'
import { TabLine } from '../types/tab'
import { getOpenTabForBooking, getTabLines, openTab, tabTotal } from '../utils/tabs'
import { recomputeBalance } from '../utils/bookingBalance'
import { showToast } from '../utils/toast'

interface UseGuestTabParams {
  /** The live booking. Passed as it changes, so a reload always reads the latest money. */
  booking: Booking
  rooms: Room[]
  venues: Venue[]
  /** Writes the recomputed booking back into the slide-over's local state. */
  setBooking: (booking: Booking) => void
  onUpdateBooking?: (booking: Booking) => Promise<void>
}

/**
 * The guest's food and bar tab for one booking (board card k69).
 *
 * The lines live in their own tables, so they are read separately and folded into
 * what is owed. Two jobs, both here so the slide-over stays thin:
 *
 *  1. On open, read the tab and make sure the STORED balance already includes it.
 *     A line added while this panel was closed would otherwise leave the bill
 *     short — the balance is stored, so it cannot be left to chance.
 *  2. After a line is added or corrected, read it back and put the bill right.
 *
 * Nothing here writes any booking field except the recomputed balance.
 */
export function useGuestTab({ booking, rooms, venues, setBooking, onUpdateBooking }: UseGuestTabParams) {
  const [lines, setLines] = useState<TabLine[]>([])
  const [amount, setAmount] = useState(0)

  const readLines = async (): Promise<TabLine[]> => {
    const open = await getOpenTabForBooking(booking.id)
    return open ? await getTabLines(open.id) : []
  }

  // Once per booking. The slide-over is keyed by booking id in CalendarTab, so a
  // different booking mounts a fresh instance and this runs again.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const read = await readLines()
      if (cancelled) return
      const total = tabTotal(read)
      setLines(read)
      setAmount(total)
      const synced = recomputeBalance(booking, { rooms, venues, tabTotal: total })
      if (Math.abs(Number(synced.balance_due || 0) - Number(booking.balance_due || 0)) > 0.005) {
        setBooking(synced)
        try { await onUpdateBooking?.(synced) } catch { /* the tab total still reads right */ }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id])

  /** A line was added or corrected: read the tab back, then put the bill right. */
  const reload = async (): Promise<void> => {
    let read: TabLine[] = []
    try {
      read = await readLines()
    } catch {
      showToast('Could not read the tab back. Please try again.', 'error')
      return
    }
    const total = tabTotal(read)
    setLines(read)
    setAmount(total)
    const updated = recomputeBalance(booking, { rooms, venues, tabTotal: total })
    setBooking(updated)
    try {
      await onUpdateBooking?.(updated)
    } catch {
      showToast('Could not update the bill. Please try again.', 'error')
    }
  }

  /**
   * Adds a line to this booking's tab, opening one on the first order. Kept here
   * so the panel never has to know whether a tab already exists.
   */
  const resolveTabId = async (): Promise<string> => (await openTab({ bookingId: booking.id })).id

  return { lines, amount, reload, resolveTabId }
}
