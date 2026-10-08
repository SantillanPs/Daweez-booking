import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChefHat, ChevronUp, ConciergeBell, Receipt } from 'lucide-react'
import { TabLine } from '../../types/tab'
import { cookingCount, newCount, readyCount } from '../../utils/orderSlips'
import { Served } from './served'
import { TableButton } from './TablesPopup'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

interface OrderDockProps {
  /** Who the desk is serving, or nobody. */
  person: Served | null
  /** `OS-0005`, or nothing before the slip's first order is saved. */
  number: string
  lines: TabLine[]
  total: number
  /** The bar's title while nobody is being served: `Pick a table`, or the table being started. */
  idleLabel: string
  /** Dishes cooked and waiting to be carried out, on any table. */
  ready: number
  /** True while the tables are open. */
  tablesOpen: boolean
  /** Opens the tables, hung from the bar's own table button. */
  onTables: (at: DOMRect) => void
  /** Opens the whole slip. */
  onOpen: () => void
  onSendKitchen: () => void
  onServed: () => void
  /** The guest has finished, or asks for the bill. Handed where the button is. */
  onBill: (at: DOMRect) => void
}

// The order, docked under the menu (Sebastian, 2026-10-04: the Restaurant screen "is
// supposed to be used on a tablet or phone most of the time").
//
// On a phone, or a tablet held upright, there is no room for the slip beside the menu.
// The slip used to sit ABOVE it: on a phone the first dish was a whole screen down, and
// the staff scrolled past the order to reach the menu and back up to send it. Now the
// menu has the screen, and the order is this one bar a thumb can reach: whose it is (a tap
// there opens the tables), how much it has come to, and the one thing to do next. A tap on
// the middle opens the whole slip.
export function OrderDock({ person, number, lines, total, idleLabel, ready, tablesOpen, onTables, onOpen, onSendKitchen, onServed, onBill }: OrderDockProps) {
  const bar = 'wide:hidden shrink-0 z-10 sticky bottom-[calc(65px+env(safe-area-inset-bottom,0px))] tall:static flex items-stretch gap-1.5 p-1.5 pl-4 rounded-xl bg-card border border-soft shadow-soft'

  if (!person) {
    return (
      <div data-slip-dock className={bar}>
        <TableButton label={idleLabel} ready={ready} open={tablesOpen} onOpen={onTables} />
      </div>
    )
  }

  const items = lines.reduce((n, l) => n + Number(l.qty || 0), 0)
  const toSend = lines.reduce((n, l) => n + newCount(l), 0)
  const toServe = lines.reduce((n, l) => n + readyCount(l), 0)
  const cooking = lines.reduce((n, l) => n + cookingCount(l), 0)
  // A table is not billed for food it has not had (Sebastian, 2026-10-08).
  const canBill = toSend === 0 && lines.some(l => Number(l.served_qty || 0) > 0)
  const next = 'shrink-0 min-h-12 inline-flex items-center justify-center gap-1.5 px-4 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-[14px] font-bold transition-colors duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:pointer-events-none'

  return (
    <div data-slip-dock className={bar}>
      <TableButton label={person.name} ready={ready} open={tablesOpen} onOpen={onTables} />
      <button type="button" onClick={onOpen} aria-label="Open the order slip"
        className="min-w-0 flex-1 min-h-12 flex items-center gap-2 pl-1.5 pr-1.5 rounded-lg text-left hover:bg-softbg transition-colors duration-200 active:scale-[0.99] cursor-pointer">
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted tabular-nums">
          {items === 0 ? 'Nothing ordered yet.' : (
            <>
              {/* On a phone the bar is narrow and the money matters more than the number. */}
              {number && <span className="hidden sm:inline">{number} · </span>}
              {items} {items === 1 ? 'item' : 'items'} · <b className="font-bold text-main">{fmtPeso(total)}</b>
              {toSend === 0 && toServe === 0 && cooking > 0 && ' · cooking'}
            </>
          )}
        </span>
        <ChevronUp className="w-5 h-5 shrink-0 text-muted" />
      </button>

      {/* The one thing to do next. Cooked food waiting comes before a new order, and once
          something has been served and nothing is left to send, the next thing is the bill
          — quieter, because it is the guest who decides when. */}
      {toServe > 0 ? (
        <button type="button" onClick={onServed} className={next}>
          <ConciergeBell className="w-4 h-4 shrink-0" /> Served · {toServe}
        </button>
      ) : toSend > 0 ? (
        <button type="button" onClick={onSendKitchen} className={next}
          aria-label={'Send to kitchen, ' + toSend + ' new'}>
          <ChefHat className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Send · {toSend} new</span>
          <span className="hidden sm:inline">Send to kitchen · {toSend} new</span>
        </button>
      ) : canBill ? (
        <button type="button" onClick={e => onBill(e.currentTarget.getBoundingClientRect())} aria-label="Send bill"
          className="shrink-0 min-h-12 inline-flex items-center justify-center gap-1.5 px-4 rounded-lg border border-soft bg-card text-main text-[14px] font-bold hover:border-gold-400 hover:bg-gold-100 transition-colors duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:pointer-events-none">
          <Receipt className="w-4 h-4 shrink-0" />
          Send bill
        </button>
      ) : null}
    </div>
  )
}

// The whole order slip, slid up over the menu from the order bar. Closed by the slip's
// own ×, a tap outside it, or Escape. It only exists while the slip has no room beside
// the menu: turn the tablet sideways and the slip is simply there.
export function OrderSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="wide:hidden fixed inset-0 z-[60] flex flex-col justify-end bg-ink-900/50 font-sans animate-in fade-in duration-200 motion-reduce:animate-none" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Order slip" onClick={e => e.stopPropagation()}
        className="relative max-h-[88dvh] min-h-0 flex flex-col gap-4 px-5 pt-2.5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] bg-card border-t border-soft rounded-t-2xl shadow-softLg animate-in slide-in-from-bottom duration-300 motion-reduce:animate-none">
        <span aria-hidden="true" className="shrink-0 mx-auto w-10 h-1 rounded-full bg-soft" />
        {children}
      </div>
    </div>,
    document.body,
  )
}
