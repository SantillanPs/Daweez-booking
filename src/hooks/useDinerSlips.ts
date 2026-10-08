import { useCallback, useEffect, useRef, useState } from 'react'
import { OrderSlip, slipNumber } from '../utils/orderSlips'
import { readDinerSlips, tabTotal } from '../utils/tabs'
import { tableName } from '../components/restaurant/served'
import { useRealtimeTabs } from './useRealtimeTabs'
import { showToast } from '../utils/toast'

/**
 * The diners with no room who have not paid yet, for the front desk.
 *
 * **The money is always taken at the front desk, never in the restaurant** (Sebastian,
 * 2026-10-04). A room guest's slip is paid from their booking; a diner has no booking, so
 * their slips are listed here and paid from the calendar's Today line.
 *
 * **The restaurant sends the bill over** (Sebastian, 2026-10-05), once the diner has
 * finished or asks for it. The one who has waited longest is at the top, and the desk is
 * told as each arrives.
 *
 * **Only a bill that was sent is here** (Sebastian, 2026-10-09, of "Diners to pay" showing
 * for a table still eating: *"this should only pop up if the restaurant actually sends it
 * to front desk"*). A diner still at their table used to be listed too, in case they
 * walked up to pay early; the restaurant presses "Send bill" first now.
 *
 * Read when the front desk opens and again whenever a slip changes on any tablet. A
 * failed read changes nothing.
 */
export function useDinerSlips() {
  const [slips, setSlips] = useState<OrderSlip[]>([])
  // The slip the desk is taking money for, as it stood when it was picked.
  const [picked, setPicked] = useState<OrderSlip | null>(null)

  const reads = useRef(0)
  // The bills this desk has already been told about. Empty until the first read, so
  // opening the screen does not announce every bill that was already waiting.
  const told = useRef<Set<string> | null>(null)

  const load = useCallback(async () => {
    const mine = ++reads.current
    try {
      const { tabs, lines } = await readDinerSlips()
      if (mine !== reads.current) return // a newer read is on its way
      const billed: OrderSlip[] = tabs
        .filter(t => !!t.billed_at && (lines[t.id] || []).length > 0)
        .map(t => ({ tab: t, lines: lines[t.id], total: tabTotal(lines[t.id]), paid: false }))
        .sort((a, b) => Date.parse(a.tab.billed_at || '') - Date.parse(b.tab.billed_at || ''))
      setSlips(billed)

      const before = told.current
      if (before) {
        for (const s of billed) {
          if (before.has(s.tab.id)) continue
          const who = [tableName(s.tab.table_label) || s.tab.label || 'Walk-in', slipNumber(s.tab)].filter(Boolean).join(' · ')
          showToast('Bill at the front desk · ' + who + ' · ₱' + s.total.toLocaleString(), 'info')
        }
      }
      told.current = new Set(billed.map(s => s.tab.id))
    } catch (err) {
      console.error('Could not read the diners’ order slips:', err)
    }
  }, [])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])
  useRealtimeTabs(() => void load())

  // The slip being paid follows the restaurant: more ordered on it shows here at once.
  // Once it is paid it leaves the list, and what was picked is kept for its receipt.
  const paying = picked ? slips.find(s => s.tab.id === picked.tab.id) || picked : null

  return { slips, paying, pay: setPicked, reload: load }
}
