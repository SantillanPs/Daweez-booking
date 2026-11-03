import React, { useEffect, useRef, useState } from 'react'
import { Check, ConciergeBell, Flame, Minus, Plus, Receipt, Send, UtensilsCrossed } from 'lucide-react'
import { TabLine } from '../../types/tab'
import { cookingCount, newCount, readyCount } from '../../utils/orderSlips'
import { AnimatedNumber } from '../AnimatedNumber'
import { useLateFocus, want } from '../billing/want'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

interface TabBillProps {
  lines: TabLine[]
  /** What the slip comes to. */
  total: number
  /** One fewer of a row. One fewer of a single serving removes the row, which asks first. */
  onQty: (line: TabLine, delta: 1 | -1) => void
  /** What to say when nothing is on the slip yet. */
  emptyText: string
  /** Gives the kitchen everything on the slip it has not been given yet. True when it went. */
  onSendKitchen: () => Promise<boolean>
  /** This dish's cooked food has been carried to the guest. */
  onServeLine: (line: TabLine) => void
  /** A charge written on the slip's "+ Charge" line. */
  onCharge: (description: string, price: number) => void
  /** The guest has finished, or asks for the bill. Handed where the button is. */
  onBill: (at: DOMRect) => void
  /** `Send bill`, or `Add to Room 3’s bill`. */
  billLabel: string
}

// What is on the order slip right now, and what happens to it next.
//
// **Two groups, in the order the work goes** (Sebastian's redesign, 2026-10-08): "To send"
// is what the kitchen has not been given, "In the kitchen" is everything it has, each dish
// saying whether it is cooking, ready or served. A row of three with one still to send is
// in both, split by count.
//
// **The number is the take-one-off button**, the same as the breakfast window: it turns
// into a minus under the finger. A dish is added from the menu, so the − and + that stood
// either side of the count are gone. Taking the last one off removes the row, and that
// still asks first — it is money coming off a bill.
//
// **A dish that is ready has its own "Serve"** and turns green: it is the one thing on the
// slip somebody has to do right now.
//
// **"Send bill" cannot be pressed until something has been served** (his ruling the same
// day), nor while a dish is still to send: a table is not billed for food it has not had.
//
// **No button here waits for the server**, so none of them greys out and comes back: a
// dish is served, sent or taken off on screen the moment it is tapped (`RestaurantTab`
// marks the slip and saves behind it). The one wait that shows is the sweep across "Send
// to kitchen", which is at least half a second so the card that follows is always earned.
//
// **Only the rows scroll.** The slip is read on a tablet or a phone most of the time, and
// a long order used to push the total and "Send to kitchen" off the bottom of the screen.
// Whoever shows this gives it a column with a height, and `relative`: the "Sent to the
// kitchen" card lays itself over the whole slip.
export function TabBill({ lines, total, onQty, emptyText, onSendKitchen, onServeLine, onCharge, onBill, billLabel }: TabBillProps) {
  const [stage, setStage] = useState<'idle' | 'sending' | 'sent'>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  if (lines.length === 0) {
    return (
      <>
        <div className="flex-1 grid place-content-center justify-items-center gap-2 py-8 text-[14px] text-muted">
          <UtensilsCrossed className="w-12 h-12 text-paper-400" strokeWidth={1.2} />
          {emptyText}
        </div>
        {/* Corkage can be the whole bill: a group that brought its own food. */}
        <ChargeLine onCharge={onCharge} />
      </>
    )
  }

  const toSend = lines.reduce((n, l) => n + newCount(l), 0)
  const canBill = toSend === 0 && lines.some(l => Number(l.served_qty || 0) > 0)

  const send = async () => {
    setStage('sending')
    const [sent] = await Promise.all([onSendKitchen(), new Promise(r => window.setTimeout(r, 550))])
    if (!sent) { setStage('idle'); return }
    setStage('sent')
    timer.current = window.setTimeout(() => setStage('idle'), 1700)
  }

  const GROUP = 'flex items-center gap-2 pt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-text after:flex-1 after:border-t after:border-soft after:content-[""]'
  const WORD = 'inline-flex items-center gap-1 '

  /** One row: `n` of the line, either still to send or with the kitchen. */
  const row = (line: TabLine, n: number, sent: boolean) => {
    const cooking = sent ? cookingCount(line) : 0
    const ready = sent ? readyCount(line) : 0
    const served = sent ? Number(line.served_qty || 0) : 0
    // The count is only written when it is not the whole row: `cooking`, or `1 cooking` of three.
    const some = (count: number, word: string) => (count === n ? word : count + ' ' + word)
    const done = sent && served === n
    return (
      <li key={line.id + (sent ? ':k' : ':n')} data-slip-line={line.description}
        className={'flex items-center gap-2.5 py-1.5 pl-1.5 pr-2 rounded-lg animate-in fade-in slide-in-from-top-1 duration-300 motion-reduce:animate-none ' +
          (ready > 0 ? 'bg-emerald-50 shadow-[inset_4px_0_0_#047857]' : '')}>
        <button type="button" onClick={() => onQty(line, -1)}
          aria-label={Number(line.qty || 1) > 1 ? 'One fewer ' + line.description : 'Remove ' + line.description}
          className="group/less relative w-11 h-11 shrink-0 grid place-items-center rounded-lg border border-soft text-[15px] font-bold tabular-nums text-main transition-[background-color,border-color,color,transform] duration-150 hover:bg-ink-900 hover:border-ink-900 hover:text-gold-400 active:scale-90 cursor-pointer disabled:opacity-40">
          {/* `key` on the count: a changed number is a new element, so it lands with a bump. */}
          <span key={n} className="bp-up transition-[opacity,transform] duration-150 group-hover/less:opacity-0 group-hover/less:scale-50">{n}</span>
          <Minus className="absolute w-4 h-4 opacity-0 scale-50 transition-[opacity,transform] duration-150 group-hover/less:opacity-100 group-hover/less:scale-100" />
        </button>
        <span className="min-w-0 flex-1">
          <span className={'block text-[14.5px] font-semibold break-words ' + (done ? 'text-ink-500 line-through' : 'text-main')}>{line.description}</span>
          {sent && (
            <span className="flex flex-wrap gap-x-2 text-[12.5px] font-medium">
              {cooking > 0 && <span className={WORD + 'text-gold-800'}><Flame className="w-3.5 h-3.5" />{some(cooking, 'cooking')}</span>}
              {ready > 0 && <span className={WORD + 'text-emerald-700'}><ConciergeBell className="w-3.5 h-3.5" />{some(ready, 'ready')}</span>}
              {served > 0 && <span className={WORD + 'text-muted'}><Check className="w-3.5 h-3.5" />{some(served, 'served')}</span>}
            </span>
          )}
        </span>
        {ready > 0 ? (
          <button type="button" onClick={() => onServeLine(line)}
            className="shrink-0 h-9 px-3 inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[13px] font-bold transition-[background-color,transform] duration-150 active:scale-95 cursor-pointer disabled:opacity-60 animate-in zoom-in-50 duration-300 motion-reduce:animate-none">
            <Check className="w-4 h-4" /> Serve
          </button>
        ) : (
          <span className={'shrink-0 text-[13.5px] tabular-nums ' + (done ? 'text-ink-500' : 'text-muted')}>{fmtPeso(n * Number(line.unit_price || 0))}</span>
        )}
      </li>
    )
  }

  const food = lines.filter(l => !l.other_charge)
  const charges = lines.filter(l => l.other_charge)
  const fresh = food.filter(l => newCount(l) > 0)
  const given = food.filter(l => Number(l.qty || 1) - newCount(l) > 0)

  /** A charge: its count (the take-one-off button, dashed gold) and its money. No kitchen words. */
  const chargeRow = (line: TabLine) => {
    const n = Number(line.qty || 1)
    return (
      <li key={line.id} data-slip-line={line.description}
        className="flex items-center gap-2.5 py-1.5 pl-1.5 pr-2 rounded-lg animate-in fade-in slide-in-from-top-1 duration-300 motion-reduce:animate-none">
        <button type="button" onClick={() => onQty(line, -1)}
          aria-label={n > 1 ? 'One fewer ' + line.description : 'Remove ' + line.description}
          className="group/less relative w-11 h-11 shrink-0 grid place-items-center rounded-lg border-[1.5px] border-dashed border-gold-400 text-[15px] font-bold tabular-nums text-gold-800 transition-[background-color,border-color,color,transform] duration-150 hover:bg-ink-900 hover:border-solid hover:border-ink-900 hover:text-gold-400 active:scale-90 cursor-pointer">
          <span key={n} className="bp-up transition-[opacity,transform] duration-150 group-hover/less:opacity-0 group-hover/less:scale-50">{n}</span>
          <Minus className="absolute w-4 h-4 opacity-0 scale-50 transition-[opacity,transform] duration-150 group-hover/less:opacity-100 group-hover/less:scale-100" />
        </button>
        <span className="min-w-0 flex-1 text-[14.5px] font-semibold text-main break-words">{line.description}</span>
        <span className="shrink-0 text-[13.5px] tabular-nums text-muted">{fmtPeso(n * Number(line.unit_price || 0))}</span>
      </li>
    )
  }
  const ACTION = 'min-h-12 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-[14px] font-bold transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98] cursor-pointer disabled:pointer-events-none '

  return (
    <>
      <ul className="min-h-0 shrink overflow-y-auto overscroll-contain space-y-1">
        {fresh.length > 0 && <li className={GROUP}>To send</li>}
        {fresh.map(l => row(l, newCount(l), false))}
        {given.length > 0 && <li className={GROUP}>In the kitchen</li>}
        {given.map(l => row(l, Number(l.qty || 1) - newCount(l), true))}
        {charges.length > 0 && <li className={GROUP}>Charges</li>}
        {charges.map(chargeRow)}
      </ul>
      <ChargeLine onCharge={onCharge} />

      <div className="shrink-0 space-y-3 mt-auto pt-3 border-t border-dashed border-soft">
        {/* The total follows the slip as it changes, so the desk sees it move. */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[14px] font-medium text-muted">Total</span>
          <span className="font-display text-[26px] leading-none font-extrabold tracking-tight tabular-nums text-main">
            <AnimatedNumber value={total} duration={300} prefix="₱" />
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Gold while something on the slip has not been given to the kitchen; a dark
              sweep crosses it as the order goes. Once everything has gone it says so and
              there is nothing to tap. */}
          <button type="button" onClick={() => void send()} disabled={toSend === 0 || stage !== 'idle'}
            aria-label={toSend > 0 ? 'Send to kitchen, ' + toSend + ' new' : 'Sent to the kitchen'}
            className={ACTION + 'relative overflow-hidden flex-1 basis-44 ' +
              (stage === 'sending' ? 'bg-gold-400 text-gold-400' : toSend > 0 ? 'bg-gold-400 hover:bg-gold-600 text-ink-900' : 'bg-card border border-soft text-muted')}>
            <span aria-hidden="true" className={'absolute inset-0 bg-ink-900 transition-transform duration-500 ease-out ' + (stage === 'sending' ? 'translate-x-0' : '-translate-x-full')} />
            <Send className={'relative w-4 h-4 shrink-0 ' + (stage === 'sending' ? 'bp-fly' : '')} />
            <span className="relative">{stage === 'sending' ? 'Sending' : toSend > 0 ? 'Send to kitchen' : 'Sent to the kitchen'}</span>
            {toSend > 0 && stage === 'idle' && (
              <span className="relative min-w-[22px] h-[22px] px-1.5 rounded-full bg-ink-900 text-gold-100 text-[12px] font-bold inline-flex items-center justify-center tabular-nums">
                {toSend}
              </span>
            )}
          </button>
          <button type="button" onClick={e => onBill(e.currentTarget.getBoundingClientRect())} disabled={!canBill}
            title={canBill ? undefined : toSend > 0 ? 'Send the new dishes to the kitchen first' : 'Nothing has been served yet'}
            className={ACTION + 'bg-card border border-soft text-main hover:border-gold-400 hover:bg-gold-100 disabled:opacity-40'}>
            <Receipt className="w-4 h-4 shrink-0" /> {billLabel}
          </button>
        </div>
      </div>

      {/* The order has gone: said over the whole slip for a moment, then it clears itself. */}
      {stage === 'sent' && (
        <div role="status" className="absolute inset-0 z-10 rounded-[inherit] bg-card grid place-content-center justify-items-center gap-3 pointer-events-none bp-dim">
          <span className="relative w-14 h-14 grid place-items-center rounded-full bg-ink-900 text-gold-400 bp-seal">
            <Check className="w-6 h-6" strokeWidth={2.6} />
            <i /><i /><i /><i /><i /><i />
          </span>
          <b className="font-display text-[17px] font-bold tracking-tight text-main">Sent to the kitchen</b>
        </div>
      )}
    </>
  )
}

/**
 * **"+ Charge"** under the slip's rows (Sebastian, 2026-11-03, notes #20): corkage, a take-out
 * box, a broken glass. Just a label and a price, with no ready-made list, and they open on this
 * same ruled line so the slip grows by nothing (his comment on the mock: "the design size is
 * too big than the content it contains"). The + turns to a cross to close it. The look is the
 * billing statement's Charge line.
 */
function ChargeLine({ onCharge }: { onCharge: (description: string, price: number) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState(0)
  const nameBox = useRef<HTMLInputElement>(null)
  const priceBox = useRef<HTMLInputElement>(null)
  useLateFocus(nameBox, open)
  const shut = () => { setOpen(false); setName(''); setPrice(0) }
  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { want(nameBox.current); return }
    if (!(price > 0)) { want(priceBox.current); return }
    onCharge(name.trim(), price)
    shut()
  }
  const SLOT = 'min-w-0 h-9 bg-transparent border-0 border-b-[1.5px] border-dashed border-gold-400 rounded-none px-0.5 text-[16px] font-semibold text-ink-900 placeholder:text-paper-400 focus:outline-none focus:border-solid'
  return (
    <div className="shrink-0 flex items-center gap-1 min-h-11 border-b border-dotted border-ink-200">
      <button type="button" onClick={() => (open ? shut() : setOpen(true))} aria-expanded={open}
        aria-label={open ? 'Close' : 'Add a charge'}
        className="shrink-0 min-h-11 inline-flex items-center gap-1.5 pr-2 text-[12px] font-bold uppercase tracking-[0.06em] text-gold-800 hover:underline underline-offset-[3px] active:scale-95 transition-transform cursor-pointer">
        <span className={'w-4 h-4 grid place-items-center rounded-full bg-gold-400 text-ink-900 transition-transform duration-200 motion-reduce:transition-none ' + (open ? 'rotate-45' : '')}>
          <Plus className="w-3 h-3" strokeWidth={3} />
        </span>
        {!open && 'Charge'}
      </button>
      {open && (
        <form onSubmit={add} className="min-w-0 flex-1 flex items-center gap-1.5 origin-left animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none">
          <input ref={nameBox} value={name} onChange={e => setName(e.target.value)} placeholder="Corkage"
            aria-label="What the charge is for" autoComplete="off" className={SLOT + ' flex-1'} />
          <label className="shrink-0 flex items-baseline gap-0.5">
            <span className="font-display text-[12px] font-extrabold text-muted">₱</span>
            <input ref={priceBox} inputMode="numeric" placeholder="200" aria-label="Price" value={price ? price.toLocaleString() : ''}
              onChange={e => setPrice(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)} className={SLOT + ' w-16 text-right tabular-nums'} />
          </label>
          <button type="submit" aria-label="Add the charge"
            className="shrink-0 w-11 h-11 grid place-items-center rounded-full active:scale-90 transition-transform cursor-pointer">
            <span className="w-8 h-8 grid place-items-center rounded-full bg-ink-900 text-gold-400"><Check className="w-4 h-4" strokeWidth={3} /></span>
          </button>
        </form>
      )}
    </div>
  )
}
