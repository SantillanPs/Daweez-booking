import React, { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { TabLine } from '../../types/tab'
import { NumInput } from '../NumInput'
import { addTabLine, deleteTabLine } from '../../utils/tabs'
import { MenuPicker } from '../restaurant/MenuPicker'
import { MenuItem } from '../../utils/restaurantMenu'
import { askConfirm } from '../../utils/confirm'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

interface GuestTabPanelProps {
  /**
   * The tab to add to, opened first if there is none yet. A stay passes its
   * booking; the restaurant passes a walk-in tab that is already running.
   */
  resolveTabId: () => Promise<string>
  lines: TabLine[]
  /** What the tab adds to the bill. */
  tabTotal: number
  /** Reloads the tab and puts the bill right. */
  onChanged: () => Promise<void>
  /**
   * Set while the tab may not take new orders yet (k69): a stay's tab opens only
   * once the guest is actually checked in, because that is how the desk works —
   * people order when they are in the hotel, not over the phone.
   */
  locked?: boolean
}

// The guest's food and bar tab (board card k69).
//
// A line can be added, and a line added by mistake can be removed — the same rule
// the app already uses for a wrong payment, so taking it off puts the bill back
// on its own. Nothing here edits a line: staff remove it and add the right one.
export function GuestTabPanel({ resolveTabId, lines, tabTotal, onChanged, locked = false }: GuestTabPanelProps) {
  const [description, setDescription] = useState('')
  const [qty, setQty] = useState(1)
  const [unitPrice, setUnitPrice] = useState(0)
  const [error, setError] = useState('')
  const [removeError, setRemoveError] = useState('')
  // The off-menu row is hidden until asked for: the owner's rule is that an order
  // is tapped, never typed, so the till opens as a menu board and nothing else.
  const [showOther, setShowOther] = useState(false)
  const [busy, setBusy] = useState(false)

  const add = async () => {
    if (!description.trim()) { setError('What was ordered?'); return }
    if (unitPrice <= 0) { setError('Enter the price.'); return }
    setError(''); setBusy(true)
    try {
      const tabId = await resolveTabId()
      await addTabLine({ tabId, description, qty, unitPrice })
      setDescription(''); setQty(1); setUnitPrice(0)
      await onChanged()
    } catch (err) {
      // The reason is shown, not swallowed: "please try again" on its own hid a
      // real failure and left nobody able to tell what went wrong.
      console.error('Could not add that tab line:', err)
      setError('Could not add that line — ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  // One tap on the menu board = one line on the tab (k70). The written row below
  // stays for anything the menu does not carry.
  const pickItem = async (item: MenuItem) => {
    setError(''); setBusy(true)
    try {
      const tabId = await resolveTabId()
      await addTabLine({ tabId, description: item.name, qty: 1, unitPrice: item.price })
      await onChanged()
    } catch (err) {
      console.error('Could not add that menu item:', err)
      setError('Could not add ' + item.name + ' — ' + (err instanceof Error ? err.message : String(err)))
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
      await deleteTabLine(line.id)
      await onChanged()
    } catch (err) {
      console.error('Could not remove that tab line:', err)
      setRemoveError('Could not remove that line — ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  const box = 'w-full bg-card border border-soft text-main px-2 py-1.5 rounded-lg text-sm focus:outline-none focus:border-gold-500'
  const label = 'block text-[10px] font-bold uppercase tracking-wider text-muted'

  // How many of each dish are already on the tab, so the board lights that tile up
  // and says how many — the same order never lands twice unnoticed.
  const pickedCounts = lines.reduce<Record<string, number>>((acc, l) => {
    if (l.kind === 'charge') acc[l.description] = (acc[l.description] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-3">
      {lines.length === 0 ? (
        <p className="text-[12px] text-muted">Nothing on the tab yet. Add the first order below.</p>
      ) : (
        <ul className="divide-y divide-soft border border-soft rounded-lg overflow-hidden">
          {lines.map(line => (
            <li key={line.id} className="px-3 py-2 flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-main">{line.description}</span>
                <span className="block text-[10.5px] text-muted">
                  {line.qty > 1 ? line.qty + ' × ' + fmtPeso(line.unit_price) : fmtPeso(line.unit_price)}
                </span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-[13px] font-bold text-main">{fmtPeso(line.amount)}</span>
                <button type="button" onClick={() => void remove(line)} disabled={busy || locked}
                  title={'Remove ' + line.description}
                  aria-label={'Remove ' + line.description}
                  className="text-muted/50 hover:text-danger-600 p-0.5 transition-colors cursor-pointer disabled:opacity-40">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {removeError && <p className="text-[11px] font-semibold text-danger-600">{removeError}</p>}

      {lines.length > 0 && (
        <p className="text-[12px] flex items-center justify-between">
          <span className="text-muted font-semibold">On the tab</span>
          <span className="font-bold text-main">{fmtPeso(tabTotal)}</span>
        </p>
      )}

      {/* Adding a charge — only once the guest is actually in the hotel (k69). */}
      {locked ? (
        <p className="text-[12.5px] text-ink-600 bg-paper-50 border border-soft rounded-lg px-3 py-2.5">
          <b className="text-ink-900">Check the guest in first.</b> Orders are added once the guest is in the hotel, so the bill is only ever run up by someone who is actually here.
        </p>
      ) : (
      <div className="space-y-2.5">
        <MenuPicker onPick={item => void pickItem(item)} busy={busy} counts={pickedCounts} />
      {showOther ? (
      <div className="border border-soft rounded-lg p-2.5 space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[140px]">
            <span className={label}>Order</span>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Hotsilog"
              className={box} />
          </label>
          <label className="w-[62px]">
            <span className={label}>Qty</span>
            <NumInput value={qty} onChange={setQty} allowDecimal={false} className={box} />
          </label>
          <label className="w-[92px]">
            <span className={label}>Price</span>
            <NumInput value={unitPrice} onChange={setUnitPrice} className={box} />
          </label>
          <button type="button" onClick={() => void add()} disabled={busy}
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-ink-900 bg-gold-400 hover:bg-gold-600 px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        {error && <p className="text-[11px] font-semibold text-danger-600">{error}</p>}
        <p className="text-[10.5px] text-muted">
          Anything the menu does not carry can be written here and priced by hand.
        </p>
      </div>
      ) : (
        <button type="button" onClick={() => setShowOther(true)}
          className="text-[11px] font-semibold text-muted hover:text-gold-700 transition-colors cursor-pointer">
          + Something not on the menu
        </button>
      )}
      </div>
      )}
    </div>
  )
}
