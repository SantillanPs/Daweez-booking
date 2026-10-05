import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient'
import { markLinesReady } from '../utils/tabs'
import { slipNumber } from '../utils/orderSlips'
import { useRealtimeTabs } from './useRealtimeTabs'
import { showToast } from '../utils/toast'

/** One dish the kitchen was given and has not cooked yet, as the database lists it. */
interface QueueRow {
  id: string
  tab_id: string
  description: string
  sent_qty: number
  ready_qty: number
  sent_at: string | null
  created_at: string
  os_number: number | null
  label: string | null
  table_label: string | null
  booking_id: string | null
}

/** A dish ticked on this screen: the row as it stood, kept so it can be shown struck and un-ticked. */
interface Ticked {
  row: QueueRow
}

export interface KitchenDish {
  id: string
  description: string
  /** How many of it this order asks for. */
  count: number
  /** Ticked: cooked, and shown struck through until the whole order is. */
  done: boolean
}

/** Everything the kitchen was given for one order slip. */
export interface KitchenOrder {
  tabId: string
  /** `OS-0010`. */
  number: string
  who: string
  /** The table the food goes to; blank for a slip started for a room, which is found by its booking. */
  tableLabel: string
  bookingId: string | null
  /** When the dish that has waited longest was sent. */
  sentAt: string | null
  dishes: KitchenDish[]
}

// A card whose last dish has just been ticked stays for a moment, so the cook sees the
// tick land before the card goes.
const LINGER = 1400

/**
 * What the kitchen has to cook, kept in step with the restaurant (Sebastian, 2026-10-04).
 *
 * The staff taking orders used to walk to the front desk's printer for every order. Now
 * "Send to kitchen" puts the order on the kitchen's screen: this reads every dish the
 * kitchen was given and has not cooked (`kitchen_queue`, one trip), and reads again
 * whenever a slip changes on any device.
 *
 * **A ticked dish stays on its card, struck through, until the whole order is done**
 * (Sebastian, 2026-10-05: the kitchen was "a bit confusing"). A dish used to vanish the
 * moment it was tapped, so the cook could not see what had been done, nor take a wrong
 * tap back. The restaurant is told the moment it is ticked; only the card waits. That
 * memory is this screen's own — the database only knows the dish is cooked.
 *
 * A tap saves behind the screen, the same way the till does. A read that was on its way
 * while a tap was being saved is thrown away and read again, so a dish the cook just
 * ticked never jumps back.
 */
export function useKitchenQueue(onArrived: () => void) {
  const [rows, setRows] = useState<QueueRow[]>([])
  const [ticked, setTicked] = useState<Ticked[]>([])
  const [loading, setLoading] = useState(true)
  // The last order cleared off the screen, kept so a wrong tap can be put back.
  const [lastDone, setLastDone] = useState<{ label: string; lines: { id: string; qty: number }[] } | null>(null)

  const reads = useRef(0)       // only the newest read is put on screen
  const saves = useRef(0)       // taps being saved
  const saveMark = useRef(0)    // goes up whenever a save leaves or lands
  // What this screen has already shown: a line's id and how many of it the kitchen was
  // given. Anything above it is a new order — which is what the chime is for.
  const seen = useRef<Map<string, number> | null>(null)
  const arrived = useRef(onArrived)
  useEffect(() => { arrived.current = onArrived })

  const load = useCallback(async () => {
    for (;;) {
      if (saves.current > 0) return // the save reads again when it lands
      const mine = ++reads.current
      const mark = saveMark.current

      let read: QueueRow[] = []
      try {
        if (isSupabaseConfigured) {
          const { data, error } = await supabase.from('kitchen_queue').select('*')
          if (error) throw error
          read = (data || []) as QueueRow[]
        }
      } catch (err) {
        // The screen keeps what it had; the next change on any device reads again.
        console.error('Could not read the kitchen’s orders:', err)
        setLoading(false)
        return
      }

      if (mine !== reads.current || saves.current > 0) return
      if (mark !== saveMark.current) continue // a tap was saved while this was being read

      const before = seen.current
      const fresh = !!before && read.some(r => Number(r.sent_qty) > (before.get(r.id) ?? 0))
      const now = before || new Map<string, number>()
      for (const r of read) now.set(r.id, Math.max(now.get(r.id) ?? 0, Number(r.sent_qty)))
      seen.current = now

      setRows(read)
      // A ticked dish the kitchen has been given again (more ordered, or put back from
      // another screen) is to cook again, so it is no longer shown as done.
      setTicked(was => was.filter(t => !read.some(r => r.id === t.row.id)))
      setLoading(false)
      if (fresh) arrived.current()
      return
    }
  }, [])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])
  useRealtimeTabs(() => void load())

  /** One change to what is cooked, with the screen read again once it has landed. */
  const save = useCallback(async (lines: { id: string; qty: number }[], failed: string): Promise<boolean> => {
    saves.current++
    saveMark.current++
    let ok = true
    try {
      await markLinesReady(lines)
    } catch (err) {
      console.error(failed, err)
      showToast(failed, 'error')
      ok = false
    }
    saves.current--
    saveMark.current++
    if (saves.current === 0) void load()
    return ok
  }, [load])

  /** A tap on a dish: cooked — or, tapped again, not cooked after all. */
  const toggle = async (id: string) => {
    const waiting = rows.find(r => r.id === id)
    if (waiting) {
      setRows(now => now.filter(r => r.id !== id))
      setTicked(now => [...now, { row: waiting }])
      const ok = await save([{ id, qty: Number(waiting.sent_qty) }], 'Could not mark that as ready. Please try again.')
      if (!ok) setTicked(now => now.filter(t => t.row.id !== id))
      return
    }
    const done = ticked.find(t => t.row.id === id)
    if (!done) return
    setTicked(now => now.filter(t => t.row.id !== id))
    setRows(now => [...now, done.row])
    await save([{ id, qty: Number(done.row.ready_qty) }], 'Could not take that back. Please try again.')
  }

  /** The whole order is ready. Its card leaves at once; "Put back" brings it back. */
  const markReady = async (order: KitchenOrder) => {
    const left = rows.filter(r => r.tab_id === order.tabId)
    const done = ticked.filter(t => t.row.tab_id === order.tabId).map(t => t.row)
    setRows(now => now.filter(r => r.tab_id !== order.tabId))
    setTicked(now => now.filter(t => t.row.tab_id !== order.tabId))
    setLastDone({ label: order.number || order.who, lines: [...left, ...done].map(r => ({ id: r.id, qty: Number(r.ready_qty) })) })
    if (left.length === 0) return
    const ok = await save(left.map(r => ({ id: r.id, qty: Number(r.sent_qty) })), 'Could not mark that as ready. Please try again.')
    if (!ok) setLastDone(null)
  }

  /** A wrong tap: the last order cleared goes back on the screen, nothing on it cooked. */
  const putBack = async () => {
    if (!lastDone) return
    const lines = lastDone.lines
    setLastDone(null)
    await save(lines, 'Could not put that back. Please try again.')
  }

  // Every dish on a card has been ticked: the card has nothing left to cook, so after a
  // moment it leaves by itself — and can still be put back.
  useEffect(() => {
    const stillCooking = new Set(rows.map(r => r.tab_id))
    const finished = ticked.filter(t => !stillCooking.has(t.row.tab_id))
    if (finished.length === 0) return
    const timer = window.setTimeout(() => {
      const gone = new Set(finished.map(t => t.row.id))
      setTicked(now => now.filter(t => !gone.has(t.row.id)))
      const last = finished[finished.length - 1].row
      setLastDone({
        label: slipNumber(last) || last.label || 'the order',
        lines: finished.filter(t => t.row.tab_id === last.tab_id).map(t => ({ id: t.row.id, qty: Number(t.row.ready_qty) })),
      })
    }, LINGER)
    return () => window.clearTimeout(timer)
  }, [rows, ticked])

  // One card per order slip, the one that has waited longest first; its dishes in the
  // order they were tapped, the ticked ones left in their place.
  const orders = useMemo(() => {
    const byTab = new Map<string, KitchenOrder>()
    const all = [
      ...rows.map(row => ({ row, done: false })),
      ...ticked.map(t => ({ row: t.row, done: true })),
    ].sort((a, b) => Date.parse(a.row.created_at) - Date.parse(b.row.created_at))
    for (const { row: r, done } of all) {
      let order = byTab.get(r.tab_id)
      if (!order) {
        order = {
          tabId: r.tab_id,
          number: slipNumber(r),
          who: r.label || '',
          tableLabel: r.table_label || '',
          bookingId: r.booking_id,
          sentAt: r.sent_at,
          dishes: [],
        }
        byTab.set(r.tab_id, order)
      }
      if (r.sent_at && (!order.sentAt || r.sent_at < order.sentAt)) order.sentAt = r.sent_at
      order.dishes.push({ id: r.id, description: r.description, count: Number(r.sent_qty) - Number(r.ready_qty), done })
    }
    const sentTime = (o: KitchenOrder) => (o.sentAt ? Date.parse(o.sentAt) : Number.MAX_SAFE_INTEGER)
    return [...byTab.values()].sort((a, b) => sentTime(a) - sentTime(b))
  }, [rows, ticked])

  // Everything still to cook, added up across the orders: three tables each wanting
  // Porksilog is one pan of four, and the cook should not have to add that up.
  const totals = useMemo(() => {
    const byDish = new Map<string, number>()
    for (const r of rows) byDish.set(r.description, (byDish.get(r.description) ?? 0) + Number(r.sent_qty) - Number(r.ready_qty))
    return [...byDish.entries()].map(([description, count]) => ({ description, count })).sort((a, b) => b.count - a.count)
  }, [rows])

  return { orders, totals, loading, lastDone: lastDone?.label || '', toggle, markReady, putBack }
}
