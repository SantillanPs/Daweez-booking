import React, { useEffect, useRef, useState } from 'react'
import { Check, ConciergeBell, Flame, Minus, Receipt, Send, UtensilsCrossed } from 'lucide-react'
import { TabLine } from '../../types/tab'
import { cookingCount, newCount, readyCount } from '../../utils/orderSlips'
import { AnimatedNumber } from '../AnimatedNumber'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

interface TabBillProps {
  lines: TabLine[]
  /** What the slip comes to. */
  total: number
  busy?: boolean
  /** One fewer of a row. One fewer of a single serving removes the row, which asks first. */
  onQty: (line: TabLine, delta: 1 | -1) => void
  /** What to say when nothing is on the slip yet. */
  emptyText: string
  /** Gives the kitchen everything on the slip it has not been given yet. True when it went. */
  onSendKitchen: () => Promise<boolean>
  /** This dish's cooked food has been carried to the guest. */
  onServeLine: (line: TabLine) => void
  /** The guest has finished, or asks for the bill. Handed where the button is. */
  onBill: (at: DOMRect) => void
  /** `Send bill`, or `Add to Room 3’s bill`. */
  billLabel: string
  /** True while an order is on its way to the kitchen, or being marked as served. */
  working?: boolean
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
// **Only the rows scroll.** The slip is read on a tablet or a phone most of the time, and
// a long order used to push the total and "Send to kitchen" off the bottom of the screen.
// Whoever shows this gives it a column with a height, and `relative`: the "Sent to the
// kitchen" card lays itself over the whole slip.
export function TabBill({ lines, total, busy = false, onQty, emptyText, onSendKitchen, onServeLine, onBill, billLabel, working = false }: TabBillProps) {
  const [stage, setStage] = useState<'idle' | 'sending' | 'sent'>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  if (lines.length === 0) {
    return (
      <div className="flex-1 grid place-content-center justify-items-center gap-2 py-8 text-[14px] text-muted">
        <UtensilsCrossed className="w-12 h-12 text-paper-400" strokeWidth={1.2} />
        {emptyText}
      </div>
    )
  }

  const toSend = lines.reduce((n, l) => n + newCount(l), 0)
  const canBill = toSend === 0 && lines.some(l => Number(l.served_qty || 0) > 0)

  const send = async () => {
    setStage('sending')
    if (!(await onSendKitchen())) { setStage('idle'); return }
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
        <button type="button" onClick={() => onQty(line, -1)} disabled={busy}
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
          <button type="button" onClick={() => onServeLine(line)} disabled={working}
            className="shrink-0 h-9 px-3 inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[13px] font-bold transition-[background-color,transform] duration-150 active:scale-95 cursor-pointer disabled:opacity-60 animate-in zoom-in-50 duration-300 motion-reduce:animate-none">
            <Check className="w-4 h-4" /> Serve
          </button>
        ) : (
          <span className={'shrink-0 text-[13.5px] tabular-nums ' + (done ? 'text-ink-500' : 'text-muted')}>{fmtPeso(n * Number(line.unit_price || 0))}</span>
        )}
      </li>
    )
  }

  const fresh = lines.filter(l => newCount(l) > 0)
  const given = lines.filter(l => Number(l.qty || 1) - newCount(l) > 0)
  const ACTION = 'min-h-12 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-[14px] font-bold transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98] cursor-pointer disabled:pointer-events-none '

  return (
    <>
      <ul className="min-h-0 shrink overflow-y-auto overscroll-contain space-y-1">
        {fresh.length > 0 && <li className={GROUP}>To send</li>}
        {fresh.map(l => row(l, newCount(l), false))}
        {given.length > 0 && <li className={GROUP}>In the kitchen</li>}
        {given.map(l => row(l, Number(l.qty || 1) - newCount(l), true))}
      </ul>

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
          <button type="button" onClick={() => void send()} disabled={working || toSend === 0 || stage !== 'idle'}
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
          <button type="button" onClick={e => onBill(e.currentTarget.getBoundingClientRect())} disabled={working || !canBill}
            title={canBill ? undefined : toSend > 0 ? 'Send the new dishes to the kitchen first' : 'Nothing has been served yet'}
            className={ACTION + 'bg-card border border-soft text-main hover:border-gold-400 hover:bg-gold-100 disabled:opacity-40'}>
            <Receipt className="w-4 h-4 shrink-0" /> {billLabel}
          </button>
        </div>
      </div>

      {/* The order has gone: said over the whole slip for a moment, then it clears itself. */}
      {stage === 'sent' && (
        <div role="status" className="absolute inset-0 z-10 rounded-[inherit] bg-card/95 grid place-content-center justify-items-center gap-3 pointer-events-none bp-dim">
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
