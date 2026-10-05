import { useEffect, useRef, useState } from 'react'
import { TabLine } from '../../types/tab'
import { MenuItem } from '../../utils/restaurantMenu'
import { OrderChange, saveOrderChanges, squash, withChanges } from '../../utils/orderChanges'
import { randomUUID } from '../../utils/helpers'
import { askConfirm } from '../../utils/confirm'
import { Served } from './ServedStrip'
import { OpenSlipsStore } from './useOpenSlips'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

// How long the till waits after a tap before it saves, so taps made close together go
// to the database in one trip.
const PAUSE = 500

/** A change the desk has made that is waiting to be saved, or on its way. */
export interface WaitingChange {
  /** `Served.key`: the slip it is for, or the stay while it has no open slip. */
  key: string
  bookingId?: string
  /** The name a slip opened by this order is given. */
  label: string
  change: OrderChange
}

const reason = (err: unknown) => (err as { message?: string } | null)?.message || String(err)

/**
 * Putting things on an order slip, and taking them off again (board card k69).
 *
 * **The same dish is one row with a count** (the staff's feedback, 2026-10-04: *"add 2x
 * instead of adding another row"*). A tap on a dish already on the slip raises its count
 * by one; the row's own − and + do the same. A row taken down from one is removed, which
 * asks first — the same way a wrong payment is.
 *
 * **Every serving takes the dish off the shelf** (k71 part 1, the owner's ruling): the line
 * carries the menu item's id, and the database subtracts that dish's recipe as it writes
 * the line. One fewer puts one serving back, and removing the row puts back whatever is left.
 *
 * **A tap shows at once and is saved behind it** (the developer's report, 2026-10-04:
 * *"every time I add an order it has to load and wait for the server before I can add
 * another"*). The menu used to lock for about seventeen trips to the server per tap. Now
 * a tap is kept here as a waiting change, the slip on screen shows it straight away, and
 * what was tapped close together goes to the database in one trip. A save that fails
 * takes its changes back off the screen and says so.
 */
export function useTabOrder(
  slips: Pick<OpenSlipsStore, 'latest' | 'beginSave' | 'endSave'>,
  /** Who the desk is serving, or nobody. */
  serving: Served | null,
  /** An order was saved. Handed the stay it was for, when the guest has a room. */
  onSaved: (bookingId?: string) => void,
  /** Whoever is at the till. Written on the stock movement, so the log says who sold it. */
  movedBy?: string,
) {
  const [waiting, setWaiting] = useState<WaitingChange[]>([])
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  // The written row is hidden until it is wanted: an order is tapped off the
  // menu, so the till opens as the menu card and nothing else.
  const [showOther, setShowOther] = useState(false)

  // The same list as `waiting`, for the code that runs between two draws: a second tap
  // must see the first one, and a save must take exactly what is there when it leaves.
  const queue = useRef<WaitingChange[]>([])
  const setQueue = (next: WaitingChange[]) => { queue.current = next; setWaiting(next) }
  // A stay with no open slip yet: the id its slip will be given by the first save.
  const drafts = useRef<Record<string, string>>({})
  const sending = useRef<Promise<void> | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const lost = useRef(false)
  const till = useRef({ onSaved, movedBy })
  useEffect(() => { till.current = { onSaved, movedBy } })

  const savedSlip = (key: string, bookingId?: string) => {
    const { tabs, lines } = slips.latest()
    const tab = bookingId ? tabs.find(t => t.booking_id === bookingId) : tabs.find(t => 'tab:' + t.id === key)
    return { tab, lines: tab ? lines[tab.id] || [] : [] }
  }

  /** One trip: everything waiting for the slip at the head of the queue. */
  const sendNext = async () => {
    const first = queue.current[0]
    if (!first) return
    const batch = queue.current.filter(q => q.key === first.key)
    const saved = savedSlip(first.key, first.bookingId)
    const changes = squash(batch.map(q => q.change), saved.lines)
    const done = () => setQueue(queue.current.filter(q => !batch.includes(q)))
    if (changes.length === 0) { done(); return }

    const tabId = saved.tab?.id || (drafts.current[first.key] ||= randomUUID())
    slips.beginSave()
    try {
      const result = await saveOrderChanges({
        tabId, changes, bookingId: first.bookingId, label: first.label, movedBy: till.current.movedBy,
      })
      delete drafts.current[first.key]
      done()
      slips.endSave(result)
      // A refused stock movement must not lose the order — the line is on the slip, so it is reported instead.
      if (result.stockProblem) setSaveError('The order is on the slip, but its stock did not come off the shelf — check the stock room.')
      till.current.onSaved(first.bookingId)
    } catch (err) {
      // The reason is shown, not swallowed: "please try again" on its own hid a
      // real failure and left nobody able to tell what went wrong.
      console.error('Could not save that order:', err)
      lost.current = true
      done()
      slips.endSave()
      const what = [...new Set(changes.map(c => c.description))].join(', ')
      setSaveError('Not saved: ' + what + '. Please do it again. (' + reason(err) + ')')
    }
  }

  /** Saves everything that is waiting, one slip after another, and answers when none is left. */
  const flush = async () => {
    window.clearTimeout(timer.current)
    while (sending.current || queue.current.length > 0) {
      if (!sending.current) sending.current = sendNext().finally(() => { sending.current = null })
      await sending.current
    }
  }

  // Nothing waits for the pause when the tablet is put down or the desk leaves this screen.
  const flushNow = useRef(flush)
  useEffect(() => { flushNow.current = flush })
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') void flushNow.current() }
    document.addEventListener('visibilitychange', hidden)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      void flushNow.current()
    }
  }, [])

  /** Everything tapped so far is saved before this answers. False when a save failed. */
  const finish = async (): Promise<boolean> => {
    lost.current = false
    await flush()
    return !lost.current
  }

  const add = (change: Omit<OrderChange, 'at'>) => {
    if (!serving) return
    setSaveError('')
    setQueue([...queue.current, {
      key: serving.key,
      bookingId: serving.booking?.id,
      label: serving.name,
      change: { ...change, at: new Date().toISOString() },
    }])
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), PAUSE)
  }

  // The slip as it stands this instant — what is saved with what is waiting laid over
  // it — not as it stood at the last draw: two quick taps on a new dish are one row.
  const shownNow = (): TabLine[] => {
    if (!serving) return []
    const saved = savedSlip(serving.key, serving.booking?.id)
    const mine = queue.current.filter(q => q.key === serving.key).map(q => q.change)
    return withChanges(saved.lines, mine, saved.tab?.id)
  }

  /** One tap on the menu card: the dish goes on the slip, or its count goes up by one. */
  const pickItem = (item: MenuItem) => {
    // A changed price is a different row.
    const already = shownNow().find(l =>
      l.kind === 'charge' && l.menu_item_id === item.id && Number(l.unit_price) === Number(item.price))
    add({ lineId: already?.id || randomUUID(), menuItemId: item.id, description: item.name, unitPrice: item.price, delta: 1 })
  }

  /** The rare dish the menu does not carry, written and priced by hand. */
  const addWritten = async (description: string, qty: number, unitPrice: number): Promise<boolean> => {
    if (!description.trim()) { setError('What was ordered?'); return false }
    if (unitPrice <= 0) { setError('Enter the price.'); return false }
    setError('')
    add({ lineId: randomUUID(), description: description.trim(), unitPrice, delta: qty > 0 ? qty : 1 })
    return true
  }

  /** The count on a row, up or down by one. Down from one removes the row. */
  const changeQty = async (shown: TabLine, delta: 1 | -1) => {
    // The count on screen may be a moment old; the change is made to the real one.
    const line = shownNow().find(l => l.id === shown.id) || shown
    const row = {
      lineId: line.id, menuItemId: line.menu_item_id,
      description: line.description, unitPrice: Number(line.unit_price || 0),
    }
    const qty = Number(line.qty || 1)
    if (delta > 0 || qty > 1) { add({ ...row, delta }); return }

    // Taking money off a bill is destructive, so it asks first — through the app's
    // own dialog, never a browser popup.
    const ok = await askConfirm({
      title: 'Remove “' + (qty > 1 ? qty + ' × ' : '') + line.description + '” from the order slip?',
      message: fmtPeso(line.amount) + ' comes off the bill.',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (ok) add({ ...row, delta: 0, remove: true })
  }

  return { waiting, error, setError, saveError, pickItem, addWritten, changeQty, finish, showOther, setShowOther }
}
