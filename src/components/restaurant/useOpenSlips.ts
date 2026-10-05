import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Tab, TabLine } from '../../types/tab'
import { Booking, Room, Venue } from '../../types/booking'
import { readOpenSlips } from '../../utils/tabs'
import { SavedSlip } from '../../utils/orderChanges'
import { getSlipsByBooking, settleSlipsOfPaidStay } from '../../utils/orderSlips'
import { useRealtimeTabs } from '../../hooks/useRealtimeTabs'

interface OpenSlips {
  tabs: Tab[]
  lines: Record<string, TabLine[]>
}

/**
 * The open order slips and their lines, kept in step with the database.
 *
 * They are read when the screen opens and again whenever a slip changes on any tablet.
 * An order saved from this tablet does not wait for that read: the save answers with the
 * slip as it now stands (`endSave`), and that is put on screen directly.
 *
 * **A read never overwrites a save.** A read that was on its way while an order was
 * being saved may be older than the save, and putting it on screen would take the dish
 * off the slip for a moment — so it is thrown away and read again.
 */
export function useOpenSlips(live: RefObject<{ bookings: Booking[]; rooms: Room[]; venues: Venue[] }>) {
  const [slips, setSlips] = useState<OpenSlips>({ tabs: [], lines: {} })
  const [loading, setLoading] = useState(true)

  // What the screen holds right now, for the code that runs between two renders: a save
  // that lands and the next one that leaves do not wait for the screen to be drawn.
  const now = useRef<OpenSlips>({ tabs: [], lines: {} })
  const put = useCallback((next: OpenSlips) => { now.current = next; setSlips(next) }, [])

  const reads = useRef(0)       // only the newest read is put on screen
  const saves = useRef(0)       // saves on their way
  const saveMark = useRef(0)    // goes up whenever a save leaves or lands
  const readAgain = useRef(false)

  /** Reads every open slip and its lines — a stay's and a diner's alike. */
  const load = useCallback(async () => {
    for (;;) {
      if (saves.current > 0) { readAgain.current = true; return }
      const mine = ++reads.current
      const mark = saveMark.current

      let read: OpenSlips
      try {
        read = await readOpenSlips()
      } catch (err) {
        // The screen keeps what it had; the next change on any tablet reads again.
        console.error('Could not read the order slips:', err)
        setLoading(false)
        return
      }

      // A stay that has nothing left to pay has paid for its food: its slip is closed
      // here, so food the guest already paid for never stays on this screen.
      const paidStays = new Set<string>()
      const stays = read.tabs.filter(t => t.booking_id && (read.lines[t.id] || []).length > 0)
      if (stays.length > 0) {
        try {
          const hotel = live.current
          const byBooking = await getSlipsByBooking(stays.map(t => t.booking_id as string))
          for (const t of stays) {
            const booking = hotel.bookings.find(b => b.id === t.booking_id)
            if (booking && await settleSlipsOfPaidStay(booking, byBooking[booking.id] || [], hotel)) paidStays.add(booking.id)
          }
        } catch (err) {
          console.error('Could not check which order slips are paid:', err)
        }
      }

      if (mine !== reads.current) return // a newer read is on its way
      if (saves.current > 0) { readAgain.current = true; return }
      if (mark === saveMark.current) {
        put({ tabs: read.tabs.filter(t => !(t.booking_id && paidStays.has(t.booking_id))), lines: read.lines })
        setLoading(false)
        return
      }
      // An order was saved while this was being read, so it may be older than the save.
    }
  }, [live, put])

  // The first read, then again whenever a slip changes on any tablet.
  useEffect(() => { queueMicrotask(() => void load()) }, [load])
  useRealtimeTabs(() => void load())

  /** A save is leaving: nothing read from now until it lands is put on screen. */
  const beginSave = useCallback(() => { saves.current++; saveMark.current++ }, [])

  /**
   * A save came back. With the slip it wrote, the screen is put right without another
   * read; with nothing (it failed), the slips are read again so the screen shows the truth.
   */
  const endSave = useCallback((saved?: SavedSlip) => {
    saves.current--
    saveMark.current++
    if (saved) {
      const { tabs, lines } = now.current
      const sameSlip = (t: Tab) => t.id === saved.tab.id
      // A stay has one open slip: the one just written replaces any other the screen
      // still holds for it (a paid one this tablet has not seen close yet).
      const sameStay = (t: Tab) => !!saved.tab.booking_id && t.booking_id === saved.tab.booking_id
      const others = tabs.filter(t => !sameSlip(t) && !sameStay(t))
      put({
        tabs: saved.tab.status !== 'open' ? others
          : tabs.some(sameSlip) ? tabs.filter(t => sameSlip(t) || !sameStay(t)).map(t => (sameSlip(t) ? saved.tab : t))
          : [saved.tab, ...others],
        lines: { ...lines, [saved.tab.id]: saved.lines },
      })
    }
    if (saves.current === 0 && (readAgain.current || !saved)) {
      readAgain.current = false
      void load()
    }
  }, [load, put])

  /** The slips as they stand this instant, not as they stood at the last draw. */
  const latest = useCallback(() => now.current, [])

  return { tabs: slips.tabs, lines: slips.lines, loading, load, beginSave, endSave, latest }
}

export type OpenSlipsStore = ReturnType<typeof useOpenSlips>
