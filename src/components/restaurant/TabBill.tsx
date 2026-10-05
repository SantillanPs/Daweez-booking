import React from 'react'
import { ChefHat, ConciergeBell, Minus, Plus, Trash2 } from 'lucide-react'
import { TabLine } from '../../types/tab'
import { cookingCount, newCount, readyCount } from '../../utils/orderSlips'
import { AnimatedNumber } from '../AnimatedNumber'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

interface TabBillProps {
  lines: TabLine[]
  /** What the slip comes to. */
  total: number
  busy?: boolean
  /** One more or one fewer of a row. One fewer of a single serving removes the row. */
  onQty: (line: TabLine, delta: 1 | -1) => void
  /** What to say when nothing is on the slip yet. */
  emptyText: string
  /** Gives the kitchen everything on the slip it has not been given yet. */
  onSendKitchen: () => void
  /** The cooked food has been carried to the guest. */
  onServed: () => void
  /** True while one of those two is on its way. */
  working?: boolean
}

// What is on the order slip right now: one row per dish with its count, the total, and
// what happens to it next (the staff's feedback, 2026-10-04).
//
// The count is changed on the row itself — − and + — because the staff asked for `2 ×`
// rather than a second row. A single serving shows a bin where the − would be: taking
// the last one off removes the row, and that asks first.
//
// **Each row says where the dish has got to** — new, cooking, ready, served — because the
// order goes to the kitchen on a screen now, not on a printed slip (Sebastian,
// 2026-10-04). "Send to kitchen" gives the cook what is new; "Served" is tapped once
// the cooked food is on the table.
//
// **Only the rows scroll.** The slip is read on a tablet or a phone most of the time
// (Sebastian, 2026-10-04), and a long order used to push the total and "Send to kitchen"
// off the bottom of the screen. It hands back two pieces for a column that has a height:
// the rows, which give way and scroll, and the total with its buttons, which never move.
export function TabBill({ lines, total, busy = false, onQty, emptyText, onSendKitchen, onServed, working = false }: TabBillProps) {
  if (lines.length === 0) {
    return <p className="shrink-0 text-[14px] text-muted">{emptyText}</p>
  }

  const toSend = lines.reduce((n, l) => n + newCount(l), 0)
  const toServe = lines.reduce((n, l) => n + readyCount(l), 0)
  // 44px: a finger, not a mouse.
  const step = 'w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-lg border border-soft text-main transition-[background-color,border-color,color,transform] duration-200 active:scale-95 cursor-pointer disabled:opacity-40 '
  const stepHover = 'hover:border-gold-400 hover:bg-gold-100'
  const binHover = 'hover:border-danger-400 hover:bg-danger-50 hover:text-danger-600'
  const loud = 'bg-gold-400 hover:bg-gold-600 text-ink-900'
  const plain = 'bg-card border border-soft text-main hover:border-gold-400 hover:bg-gold-100'
  const action = 'min-h-12 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-[14px] font-bold transition-[background-color,border-color,transform] duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:pointer-events-none '

  return (
    <>
      <ul className="min-h-0 shrink overflow-y-auto overscroll-contain divide-y divide-soft border-y border-soft">
        {lines.map(line => {
          const qty = Number(line.qty || 1)
          const fresh = newCount(line)
          const cooking = cookingCount(line)
          const ready = readyCount(line)
          const served = Number(line.served_qty || 0)
          // The count is only written when it is not the whole row: `cooking`, or `1 cooking` of three.
          const some = (n: number, word: string) => (n === qty ? word : n + ' ' + word)
          return (
            <li key={line.id} className="py-2 pr-1 flex items-center gap-2 animate-in fade-in slide-in-from-left-1 duration-200 motion-reduce:animate-none">
              <button type="button" onClick={() => onQty(line, -1)} disabled={busy}
                aria-label={qty > 1 ? 'One fewer ' + line.description : 'Remove ' + line.description}
                title={qty > 1 ? 'One fewer' : 'Remove'}
                className={step + (qty > 1 ? stepHover : binHover)}>
                {qty > 1 ? <Minus className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
              </button>
              <span className="w-6 shrink-0 text-center text-[16px] font-bold tabular-nums text-main">{qty}</span>
              <button type="button" onClick={() => onQty(line, 1)} disabled={busy}
                aria-label={'One more ' + line.description} title="One more" className={step + stepHover}>
                <Plus className="w-4 h-4" />
              </button>
              <span className="min-w-0 flex-1 pl-1">
                <span className="block text-[15px] font-semibold text-main break-words">{line.description}</span>
                <span className="block text-[13px] text-muted tabular-nums">
                  {fmtPeso(line.unit_price)} each
                  {fresh > 0 && <span className="font-semibold text-gold-800"> · {fresh} new</span>}
                  {cooking > 0 && <span> · {some(cooking, 'cooking')}</span>}
                  {ready > 0 && <span className="font-bold text-main"> · {some(ready, 'ready')}</span>}
                  {served > 0 && <span> · {some(served, 'served')}</span>}
                </span>
              </span>
              <span className="shrink-0 text-[15px] font-bold tabular-nums text-main">{fmtPeso(line.amount)}</span>
            </li>
          )
        })}
      </ul>

      <div className="shrink-0 space-y-3">
        {/* The total follows the slip as it changes, so the desk sees it move. */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[14px] font-medium text-muted">Total</span>
          <span className="font-display text-[26px] leading-none font-extrabold tracking-tight tabular-nums text-main">
            <AnimatedNumber value={total} duration={300} prefix="₱" />
          </span>
        </div>

        {/* Cooked food is waiting: the one thing to do next, so it gets the whole row. */}
        {toServe > 0 && (
          <button type="button" onClick={onServed} disabled={working} className={action + 'w-full ' + loud}>
            <ConciergeBell className="w-4 h-4" /> Served · {toServe} ready
          </button>
        )}

        {/* Loud while something on the slip has not been given to the kitchen yet; once
            everything has, it says so and there is nothing to tap. The count is the same
            gold dot the menu puts on a dish. (A "Guest copy" button stood beside it: the
            restaurant has no printer, so the bill is printed where it is paid.) */}
        <button type="button" onClick={onSendKitchen} disabled={working || toSend === 0}
          aria-label={toSend > 0 ? 'Send to kitchen, ' + toSend + ' new' : 'Sent to the kitchen'}
          className={action + 'w-full ' + (toSend > 0 ? loud : plain)}>
          <ChefHat className="w-4 h-4 shrink-0" /> {toSend > 0 ? 'Send to kitchen' : 'Sent to the kitchen'}
          {toSend > 0 && (
            <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-ink-900 text-gold-100 text-[12px] font-bold inline-flex items-center justify-center tabular-nums">
              {toSend}
            </span>
          )}
        </button>
      </div>
    </>
  )
}
