import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Banknote, Printer, Tag, Trash2, Undo2, Utensils, X } from 'lucide-react'
import { Tab, TabLine } from '../../types/tab'
import { PaymentRecord } from '../../types/booking'
import { OrderSlip, slipNumber } from '../../utils/orderSlips'
import { readTabTotal, sendBackTab } from '../../utils/tabs'
import { showToast } from '../../utils/toast'
import { askConfirm } from '../../utils/confirm'
import { saveOrderChanges } from '../../utils/orderChanges'
import { TabSettlePanel } from './TabSettlePanel'
import { TabReceiptModal } from './TabReceiptModal'
import { RunningTabSlip } from './RunningTabSlip'
import { tableName } from './served'
import { DiscountPop, Discount } from '../calendar/NewBookingBill'
import { Floating } from '../calendar/BillRoomLines'
import { BIG, FACTS, GoneLine, HEAD, LINE, PALE, PART, RANK, RemoveBin, STACK } from '../billing/FixPayment'
import { discountLabel } from '../../utils/discounts'
import { NewTag } from '../NewMark'
import { markSeen } from '../../utils/newMarks'

import { peso } from '../../utils/helpers'


const QUIET = 'min-h-11 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-main transition-colors cursor-pointer disabled:opacity-50'

interface DinerPayModalProps {
  slip: OrderSlip
  onClose: () => void
  /** The slip was paid, sent back, or found changed: the list behind this is read again. */
  onChanged: () => void
}

// A diner with no room pays their order slip — at the front desk (Sebastian, 2026-10-04:
// "the guests actually always pay at the front desk, not at the restaurant"). The pay
// buttons used to sit on the Restaurant screen under the slip.
//
// The desk sees what was ordered and what it comes to, picks how the diner paid, and the
// numbered receipt opens straight away because the diner is standing there.
//
// **The bill is printed here**, where the printer is (Sebastian, 2026-10-05): the
// restaurant sends the bill over and no longer has a "Guest copy" of its own. A bill sent
// by mistake can be sent back, which opens the slip for more orders again.
export function DinerPayModal({ slip, onClose, onChanged }: DinerPayModalProps) {
  const [receipt, setReceipt] = useState<{ tab: Tab; lines: TabLine[]; record: PaymentRecord } | null>(null)
  const [changed, setChanged] = useState('')
  const [printing, setPrinting] = useState(false)
  const [busy, setBusy] = useState(false)
  // **A discount on a diner's bill** (Sebastian, 2026-10-24: "when a bill is sent to the front desk
  // from the restaurant, being able to add discounts is needed"). Taken off at the desk, the way the
  // booking bill's "+ Discount" is; the slip's lines keep their prices and the receipt shows it.
  // **Written like the bill's** (Sebastian, 2026-11-12, the "Discount cleanup" mock, c): one line with
  // what it is for, how much and what it takes off, each its own tap; the sub-total and the word
  // Discount are said once ("remove redundancies").
  const [disc, setDisc] = useState<Discount | null>(null)
  const [pop, setPop] = useState<{ part?: 'note' | 'v'; at: HTMLElement; right?: boolean } | null>(null)
  const [gone, setGone] = useState<{ disc: Discount; off: number } | null>(null)
  const [card, setCard] = useState<HTMLDivElement | null>(null)
  // **The front desk takes orders off too** (Sebastian, 2026-11-12: "allow the front desk to also delete
  // orders"): a row by its bin, or every row at once. A row goes at once and is saved behind; a failed
  // save puts it back. `apply_order_changes` takes removals on a diner's bill sent to the desk, never more.
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const [taken, setTaken] = useState<Set<string>>(new Set())
  const saving = useRef<Promise<unknown>>(Promise.resolve())
  const lines = slip.lines.filter(l => !taken.has(l.id))
  const total = lines.reduce((s, l) => s + Number(l.amount || 0), 0)
  const off = !disc ? 0 : Math.min(total, disc.pct ? Math.round(total * disc.v / 100) : disc.v)
  const given = disc && disc.v > 0 ? disc : null
  const words = given ? discountLabel({ type: given.pct ? 'percent' : 'flat', value: given.v, note: given.note?.trim() || undefined }) : ''
  const closePop = () => { setPop(null); setDisc(d => (d && d.v > 0 ? d : null)) }
  const part = (which: 'note' | 'v', name: string, look: string, body: React.ReactNode, right = false) => (
    <button type="button" aria-label={'Change ' + name} aria-expanded={pop?.part === which && pop.right === right}
      onClick={e => { const at = e.currentTarget; setPop(p => (p?.at === at ? null : { part: which, at, right })) }}
      className={PART + ' ' + look}>{body}</button>
  )
  const toPay = total - off
  // **The money is sealed before the receipt opens** (the owner, 2026-10-15: animations
  // for the table payments). The same seal as the booking panel's (`mark` in
  // ExtendStayModal): it stamps over the slip, fades for its last 300 ms, then the receipt
  // rises in. The receipt once opened in the same frame the money was saved.
  const [sealed, setSealed] = useState<'on' | 'leaving' | null>(null)
  const sealTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(sealTimer.current), [])

  if (receipt) {
    return <TabReceiptModal tab={receipt.tab} lines={receipt.lines} record={receipt.record} onClose={onClose} />
  }

  // The restaurant may still be adding to a slip whose bill has not been sent. The money
  // is only taken for the amount the desk was shown: a slip that has grown says so and is
  // read again first.
  const stillTheSame = async () => {
    await saving.current
    const now = await readTabTotal(slip.tab.id)
    if (Math.abs(now - total) <= 0.005) { setChanged(''); return true }
    setChanged('This order slip is now ' + peso(now) + '. Check it, then receive again.')
    onChanged()
    return false
  }

  const sendBack = async () => {
    setBusy(true)
    try {
      await sendBackTab(slip.tab.id)
      showToast((slipNumber(slip.tab) || 'The order slip') + ' is back with the restaurant.', 'success')
      onChanged()
      onClose()
    } catch {
      setChanged('Could not send it back. Please try again.')
      setBusy(false)
    }
  }

  const takeOff = (gone: TabLine[]) => {
    const ids = gone.map(l => l.id)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setLeaving(s => new Set([...s, ...ids]))
    window.setTimeout(() => setTaken(s => new Set([...s, ...ids])), reduce ? 0 : 260)
    const empty = gone.length === lines.length
    saving.current = saveOrderChanges({
      tabId: slip.tab.id,
      changes: gone.map(l => ({ lineId: l.id, menuItemId: l.menu_item_id, description: l.description, unitPrice: Number(l.unit_price || 0), delta: 0, remove: true, at: new Date().toISOString() })),
    }).then(() => {
      onChanged()
      // Nothing left to pay: the slip drops off "Diners to pay" by itself, and the window goes.
      if (empty) { showToast((slipNumber(slip.tab) || 'The order slip') + ' has no orders left.', 'success'); onClose() }
    }).catch(err => {
      console.error('Could not take orders off the slip:', err)
      setLeaving(s => new Set([...s].filter(id => !ids.includes(id))))
      setTaken(s => new Set([...s].filter(id => !ids.includes(id))))
      setChanged('Not removed: ' + gone.map(l => l.description).join(', ') + '. Please try again.')
    })
  }

  const removeAll = async () => {
    if (lines.length === 0) return
    const ok = await askConfirm({
      title: 'Remove every order on ' + (slipNumber(slip.tab) || 'this order slip') + '?',
      message: lines.length + (lines.length === 1 ? ' line' : ' lines') + ' · ' + peso(total) + ' comes off the bill.',
      confirmLabel: 'Remove all',
      tone: 'danger',
    })
    if (ok) takeOff(lines)
  }

  const who = slip.tab.label || 'Walk-in'
  const table = tableName(slip.tab.table_label)
  // The printed bill is drawn beside this window, not inside it: a tap on the paper must
  // not count as a tap outside the window, which closes it.
  return (
    <>
      {createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink-900/50 font-sans bp-dim" onClick={onClose}>
      <div ref={setCard} className="relative w-full max-w-sm bg-card rounded-xl border border-soft shadow-softLg overflow-hidden bp-rise motion-reduce:[animation:none]" onClick={e => e.stopPropagation()}>
        {sealed && (
          <div role="status" className={'absolute inset-0 z-10 bg-card grid place-content-center justify-items-center gap-2.5 pointer-events-none ' + (sealed === 'leaving' ? 'bp-gone' : 'bp-dim')}>
            <span className="relative w-16 h-16 grid place-items-center rounded-full bg-ink-900 text-gold-400 bp-seal">
              <Banknote className="w-7 h-7" />
              <i /><i /><i /><i /><i /><i />
            </span>
            <b className="font-display text-[19px] font-bold tracking-tight text-main">Paid {peso(toPay)}</b>
            <span className="text-[13px] text-muted">{[table || who, slipNumber(slip.tab)].filter(Boolean).join(' · ')}</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-soft">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-main flex items-center gap-2">
              <Utensils className="w-4 h-4 text-gold-600" /> Order slip {slipNumber(slip.tab)}
            </h3>
            <p className="text-[13px] text-muted mt-0.5 truncate">
              {[table, slip.tab.label, slip.tab.billed_at ? '' : 'still eating'].filter(Boolean).join(' · ') || who}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-main transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-4 pt-3 pb-3">
          <ul className="max-h-[38vh] overflow-y-auto divide-y divide-soft text-[14px]">
            {lines.map((line, i) => (
              <li key={line.id} style={{ '--i': Math.min(i, 8), animationDelay: leaving.has(line.id) ? Math.min(i, 8) * 60 + 'ms' : undefined } as React.CSSProperties}
                className={'relative py-1.5 grid grid-cols-[1fr_auto_22px] items-center gap-x-3 motion-reduce:[animation:none] ' + (leaving.has(line.id) ? 'slip-leave' : 'bp-row')}>
                <span className="min-w-0 text-main break-words">
                  <b className="tabular-nums">{Number(line.qty || 1)} ×</b> {line.description}
                </span>
                <span className="tabular-nums text-main">{peso(line.amount)}</span>
                <RemoveBin what={line.description} onRemove={() => { markSeen('desk-remove-orders'); takeOff([line]) }} />
              </li>
            ))}
          </ul>
          {(given || gone) && (
            <div className="pt-2 border-t border-soft space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-[14px] text-muted"><span>Sub-total</span><span className="tabular-nums">{peso(total)}</span></div>
              {given && (
                <div className={LINE + ' ' + RANK + ' bw-rise'}>
                  <Tag aria-hidden="true" className="justify-self-center w-3 h-3 text-danger-600" />
                  <span className={STACK}>
                    {part('note', 'what the discount is for', HEAD, given.note?.trim() || <span className="text-gold-800">What for?</span>)}
                    {/* The second row says only what the figure does not: the percentage, or a ₱ the slip had too little for. */}
                    {(given.pct || off < given.v) && (
                      <span className={FACTS}>
                        {part('v', 'how much the discount is', 'shrink-0 whitespace-nowrap tabular-nums' + PALE + (given.pct ? '' : ' line-through decoration-paper-400'), given.pct ? given.v + '%' : peso(given.v))}
                      </span>
                    )}
                  </span>
                  {part('v', 'what the discount takes off', BIG + ' text-danger-600' + PALE, <span key={off} className="bw-rise">−{peso(off)}</span>, true)}
                  <RemoveBin what={given.note?.trim() || 'the discount'} onRemove={() => { setGone({ disc: given, off }); setDisc(null); setPop(null) }} />
                </div>
              )}
              {gone && !given && (
                <GoneLine icon={<Tag className="w-3 h-3" />} name={gone.disc.note?.trim() || 'Discount'} detail={gone.disc.pct ? gone.disc.v + '%' : ''}
                  amount={'−' + peso(gone.off)} onUndo={() => { setDisc(gone.disc); setGone(null) }} />
              )}
            </div>
          )}
          <div className="flex items-baseline justify-between gap-2 pt-3 border-t border-soft">
            <span className="text-[14px] font-medium text-muted">{off > 0 ? 'To pay' : 'Total'}</span>
            <span key={toPay} className="font-display text-[26px] leading-none font-extrabold tracking-tight tabular-nums text-main bw-rise">{peso(toPay)}</span>
          </div>
          {!given && (
            <span className="relative inline-block">
              <button type="button" aria-expanded={!!pop && !pop.part}
                onClick={e => { markSeen('diner-discount-note'); const at = e.currentTarget; if (pop && !pop.part) { closePop(); return } setGone(null); setDisc({ pct: true, v: 0, note: '' }); setPop({ at }) }}
                className="mt-1 text-[13px] font-bold text-gold-800 hover:underline cursor-pointer">+ Discount</button>
              <NewTag id="diner-discount-note" />
            </span>
          )}
          {pop && disc && card && (
            <Floating at={() => pop.at} sheet={card} right={pop.right} label={pop.part === 'note' ? 'What the discount is for' : 'A discount'} onClose={closePop}>
              <DiscountPop disc={disc} off={off} part={pop.part} onChange={setDisc} onDone={closePop} />
            </Floating>
          )}
          {changed && <p role="alert" className="mt-2 text-[13px] font-semibold text-danger-600">{changed}</p>}

          <TabSettlePanel
            tab={slip.tab}
            total={toPay}
            discount={off || undefined}
            discountNote={words || undefined}
            ready={stillTheSame}
            onSettled={record => {
              onChanged()
              setSealed('on')
              sealTimer.current = window.setTimeout(() => setSealed('leaving'), 1000)
              return new Promise<void>(done => {
                sealTimer.current = window.setTimeout(() => { setReceipt({ tab: slip.tab, lines, record }); done() }, 1300)
              })
            }}
          />

          {/* The paper the diner is shown before paying, and the way back for a bill sent
              by mistake. Quiet: neither is the reason this window is open. */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4">
            <button type="button" onClick={() => setPrinting(true)} className={QUIET}>
              <Printer className="w-4 h-4" /> Print the bill
            </button>
            {slip.tab.billed_at && (
              <button type="button" onClick={() => void sendBack()} disabled={busy} className={QUIET}>
                <Undo2 className="w-4 h-4" /> Send back to the restaurant
              </button>
            )}
            {lines.length > 1 && (
              <button type="button" onClick={() => { markSeen('desk-remove-orders'); void removeAll() }} className={'relative ' + QUIET + ' hover:!text-danger-600'}>
                <Trash2 className="w-4 h-4" /> Remove all orders
                <NewTag id="desk-remove-orders" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
      )}
      {printing && (
        <RunningTabSlip
          number={slipNumber(slip.tab)}
          who={who}
          place={slip.tab.table_label ? { label: 'Table', value: slip.tab.table_label } : undefined}
          lines={lines}
          total={total}
          discount={off ? { label: words, amount: off } : undefined}
          note="To be paid at the front desk."
          onClose={() => setPrinting(false)}
        />
      )}
    </>
  )
}
