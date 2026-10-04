import { useState } from 'react'
import { TabLine } from '../../types/tab'
import { MenuItem } from '../../utils/restaurantMenu'
import { addTabLine, deleteTabLine, getTabLines, setTabLineQty } from '../../utils/tabs'
import { deductForSale, returnForSale, reverseStockFor } from '../../utils/stock'
import { askConfirm } from '../../utils/confirm'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

/**
 * Putting things on an order slip, and taking them off again (board card k69).
 *
 * **The same dish is one row with a count** (the staff's feedback, 2026-10-04: *"add 2x
 * instead of adding another row"*). A tap on a dish already on the slip raises its count
 * by one; the row's own − and + do the same. A row taken down from one is removed, which
 * asks first — the same way a wrong payment is.
 *
 * **Every serving takes the dish off the shelf** (k71 part 1, the owner's ruling): the line
 * carries the menu item's id, and the stock room reads that dish's recipe and subtracts it.
 * One fewer puts one serving back, and removing the row puts back whatever is left.
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

  const reason = (err: unknown) => (err instanceof Error ? err.message : String(err))

  /** One tap on the menu card: the dish goes on the slip, or its count goes up by one. */
  const pickItem = async (item: MenuItem) => {
    setError(''); setBusy(true)
    try {
      const tabId = await resolveTabId()
      // Read from the database, not the screen: a second tablet may have put the same
      // dish on this slip a moment ago. A changed price is a different row.
      const already = (await getTabLines(tabId)).find(l =>
        l.kind === 'charge' && l.menu_item_id === item.id && Number(l.unit_price) === Number(item.price))
      const line = already || await addTabLine({
        tabId, description: item.name, qty: 1, unitPrice: item.price, menuItemId: item.id,
      })
      if (already) await setTabLineQty(already, Number(already.qty || 1) + 1)
      // The shelf follows the sale. A dish with no recipe deducts nothing, and a refused deduction must not
      // lose the order — the line is already on the slip, so it is reported instead.
      try {
        await deductForSale({ id: line.id, menuItemId: line.menu_item_id }, movedBy)
      } catch (stockErr) {
        console.error('The order landed, but its stock did not come off:', stockErr)
        setError('Added ' + item.name + ', but its stock did not come off the shelf — check the stock room.')
      }
      await onChanged()
    } catch (err) {
      console.error('Could not add that menu item:', err)
      setError('Could not add ' + item.name + ' — ' + reason(err))
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
      console.error('Could not add that line:', err)
      setError('Could not add that line — ' + reason(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  // Taking money off a bill is destructive, so it asks first — through the app's
  // own dialog, never a browser popup.
  const remove = async (line: TabLine) => {
    const qty = Number(line.qty || 1)
    const ok = await askConfirm({
      title: 'Remove “' + (qty > 1 ? qty + ' × ' : '') + line.description + '” from the order slip?',
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
      console.error('Could not remove that line:', err)
      setRemoveError('Could not remove that line — ' + reason(err))
    } finally {
      setBusy(false)
    }
  }

  /** The count on a row, up or down by one. Down from one removes the row. */
  const changeQty = async (shown: TabLine, delta: 1 | -1) => {
    setRemoveError(''); setBusy(true)
    try {
      // The count on screen may be a moment old; the change is made to the real one.
      const line = (await getTabLines(shown.tab_id)).find(l => l.id === shown.id) || shown
      const qty = Number(line.qty || 1)
      if (delta < 0 && qty <= 1) {
        setBusy(false)
        await remove(line)
        return
      }
      await setTabLineQty(line, qty + delta)
      try {
        if (delta > 0) await deductForSale({ id: line.id, menuItemId: line.menu_item_id }, movedBy)
        else await returnForSale({ id: line.id, menuItemId: line.menu_item_id }, movedBy)
      } catch (stockErr) {
        console.error('The count changed, but the stock did not follow:', stockErr)
        setRemoveError('The count changed, but the stock room did not follow — check the stock room.')
      }
      await onChanged()
    } catch (err) {
      console.error('Could not change that line:', err)
      setRemoveError('Could not change that line — ' + reason(err))
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, setError, removeError, pickItem, addWritten, remove, changeQty, showOther, setShowOther }
}
