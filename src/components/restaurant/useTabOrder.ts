import { useState } from 'react'
import { TabLine } from '../../types/tab'
import { MenuItem } from '../../utils/restaurantMenu'
import { addTabLine, deleteTabLine } from '../../utils/tabs'
import { deductForSale, reverseStockFor } from '../../utils/stock'
import { askConfirm } from '../../utils/confirm'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

/**
 * Putting things on a running tab, and taking them off again (board card k69).
 *
 * Two screens take orders — the Restaurant screen and a booking's Guest tab —
 * and both do exactly the same two things, so the writing lives here once
 * instead of being typed twice: **one tap = one line**, and a wrong line is
 * removed (never edited), the same way a wrong payment is.
 *
 * **A tap also takes the dish off the shelf** (k71 part 1, the owner's ruling): the line carries the menu item's
 * id, and the stock room reads that dish's recipe and subtracts it. Removing the line puts every gram back, so
 * a wrong order never quietly eats stock.
 */
export function useTabOrder(
  resolveTabId: () => Promise<string>,
  onChanged: () => Promise<void>,
  /** Whoever is at the till. Written on the stock movement, so the log says who sold it. */
  movedBy?: string,
) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [removeError, setRemoveError] = useState('')
  // The written row is hidden until it is wanted: an order is tapped off the
  // menu, so the till opens as the menu card and nothing else.
  const [showOther, setShowOther] = useState(false)

  /** One tap on the menu card = one line on the tab (k70), and the dish comes off the shelf (k71). */
  const pickItem = async (item: MenuItem) => {
    setError(''); setBusy(true)
    try {
      const tabId = await resolveTabId()
      const line = await addTabLine({
        tabId, description: item.name, qty: 1, unitPrice: item.price, menuItemId: item.id,
      })
      // The shelf follows the sale. A dish with no recipe deducts nothing, and a refused deduction must not
      // lose the order — the line is already on the tab, so it is reported instead.
      try {
        await deductForSale({ id: line.id, menuItemId: line.menu_item_id }, movedBy)
      } catch (stockErr) {
        console.error('The order landed, but its stock did not come off:', stockErr)
        setError('Added ' + item.name + ', but its stock did not come off the shelf — check the stock room.')
      }
      await onChanged()
    } catch (err) {
      console.error('Could not add that menu item:', err)
      setError('Could not add ' + item.name + ' — ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  /** The rare dish the menu does not carry, written and priced by hand. */
  const addWritten = async (description: string, qty: number, unitPrice: number): Promise<boolean> => {
    if (!description.trim()) { setError('What was ordered?'); return false }
    if (unitPrice <= 0) { setError('Enter the price.'); return false }
    setError(''); setBusy(true)
    try {
      const tabId = await resolveTabId()
      await addTabLine({ tabId, description, qty, unitPrice })
      await onChanged()
      return true
    } catch (err) {
      // The reason is shown, not swallowed: "please try again" on its own hid a
      // real failure and left nobody able to tell what went wrong.
      console.error('Could not add that tab line:', err)
      setError('Could not add that line — ' + (err instanceof Error ? err.message : String(err)))
      return false
    } finally {
      setBusy(false)
    }
  }

  // Taking money off a bill is destructive, so it asks first — through the app's
  // own dialog, never a browser popup.
  const remove = async (line: TabLine) => {
    const ok = await askConfirm({
      title: 'Remove “' + line.description + '” from the tab?',
      message: fmtPeso(line.amount) + ' comes off the bill.',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    setRemoveError(''); setBusy(true)
    try {
      // Put the dish's stock back first, then the line. If the stock fails, the line stays and the desk sees
      // why — an order taken off a bill must never leave the shelf short without saying so.
      await reverseStockFor('tab_line', line.id)
      await deleteTabLine(line.id)
      await onChanged()
    } catch (err) {
      console.error('Could not remove that tab line:', err)
      setRemoveError('Could not remove that line — ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, setError, removeError, pickItem, addWritten, remove, showOther, setShowOther }
}
