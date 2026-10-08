import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Coffee, Minus, X } from 'lucide-react'
import { Booking } from '../../types/booking'
import { getBreakfastMenu } from '../../utils/rateConfig'
import { breakfastOn, saveBreakfastChoices, withBreakfastChoice } from '../../utils/breakfastChoice'
import { showToast } from '../../utils/toast'

interface BreakfastPickerProps {
  booking: Booking
  /** The day being answered for, `YYYY-MM-DD`. */
  date: string
  /** `Room 2` — where the plates go. */
  place: string
  onClose: () => void
}

// How long the "Sent to the kitchen" ticket stays before it flies off by itself, and how
// long its flight takes. A tap sends it off sooner.
const TICKET_STAYS = 2600
const TICKET_FLIES = 520
// The Serve button's own turn (the squash, the dark sweep, the tick) before the ticket drops.
const SERVE_TURN = 520

// What this room wants for breakfast today. The menu is the one in Settings; the desk
// taps how many of each. "Nothing today" is an answer too — it marks the room as asked.
//
// **It is meant to feel good to use** (Sebastian, 2026-10-08: *"aside from core
// functionality, I prioritise satisfying user experience over everything else"*, said of
// this window's mock). So everything in it answers a tap: the window rises and its lines
// slide in, a number springs up when a plate is added and drops when one comes off, Serve
// squashes and turns dark with a tick that draws itself, and a ticket drops in to say the
// order has gone to the kitchen, then flies away. The moves are in `index.css` (`bp-…`),
// and all of them stand still on a device that asks for less motion.
export function BreakfastPicker({ booking, date, place, onClose }: BreakfastPickerProps) {
  const queryClient = useQueryClient()
  const menu = getBreakfastMenu()
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const start: Record<string, number> = {}
    ;(breakfastOn(booking, date)?.items || []).forEach(i => { start[i.name] = i.qty })
    return start
  })
  // Which way each number last moved, so it comes in from the right side: up for one more,
  // down for one less. Nothing moves until something is tapped.
  const [moved, setMoved] = useState<Record<string, 1 | -1>>({})
  const [busy, setBusy] = useState(false)
  // Serve's own little story: pressed → the ticket is up → the ticket is flying off.
  const [stage, setStage] = useState<'pick' | 'served' | 'sent' | 'bye'>('pick')
  const [sent, setSent] = useState<{ name: string; qty: number }[]>([])
  const timers = useRef<number[]>([])
  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)) }, [])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }

  const bump = (name: string, by: 1 | -1) => {
    setCounts(c => ({ ...c, [name]: Math.max(0, (c[name] || 0) + by) }))
    setMoved(m => ({ ...m, [name]: by }))
  }

  const save = async (items: { name: string; qty: number }[]) => {
    const choices = withBreakfastChoice(booking, date, items)
    await saveBreakfastChoices(booking.id, choices)
    // Shown at once; the live update from the database follows a moment later.
    queryClient.setQueryData<Booking[]>(['bookings'], old =>
      old?.map(b => b.id === booking.id ? { ...b, breakfast_choices: choices } : b))
  }

  const chosen = menu.map(m => ({ name: m.name, qty: counts[m.name] || 0 })).filter(i => i.qty > 0)

  const nothingToday = async () => {
    setBusy(true)
    try { await save([]); onClose() }
    catch { showToast('Could not save the breakfast choice. Please try again.', 'error'); setBusy(false) }
  }

  const sendOff = () => {
    if (stage !== 'sent') return
    setStage('bye')
    later(onClose, TICKET_FLIES)
  }

  const serve = async () => {
    setBusy(true)
    setStage('served')
    try {
      await save(chosen)
      setSent(chosen)
      // The ticket only ever follows a save that worked: it says the kitchen has the order.
      later(() => setStage('sent'), SERVE_TURN)
      later(() => setStage(s => (s === 'sent' ? 'bye' : s)), SERVE_TURN + TICKET_STAYS)
      later(onClose, SERVE_TURN + TICKET_STAYS + TICKET_FLIES)
    } catch {
      showToast('Could not save the breakfast choice. Please try again.', 'error')
      setStage('pick')
      setBusy(false)
    }
  }

  const served = stage !== 'pick'
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 font-sans" onClick={busy ? undefined : onClose}>
      <div className="bp-rise relative w-full max-w-sm bg-card rounded-xl border border-soft shadow-softLg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-soft">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-main flex items-center gap-2">
              <Coffee className="w-4 h-4 text-gold-600" /> Breakfast today
            </h3>
            <p className="text-[12px] text-muted mt-0.5 truncate">{place} · {booking.guest_name}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-main transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {/* **It reads like the restaurant's menu** (Sebastian, 2026-10-08, pointing at the
            menu board): the dish on the left, a dotted line, and where the price would be,
            HOW MANY. The whole line is the tap — one tap, one more plate — as on the menu
            (`MenuPicker`). It used to be six boxes, each with a minus, a number and a plus.
            **The number is the way back**: tapping it takes one off, and under a mouse it
            turns into a minus sign to say so. */}
        <div className="bg-page px-2 py-2 max-h-[55vh] overflow-y-auto">
          {menu.length === 0 && <p className="text-[13px] text-muted p-2">The breakfast menu is empty — add items in Settings.</p>}
          {menu.map((item, i) => {
            const qty = counts[item.name] || 0
            const dir = moved[item.name]
            return (
              <div key={item.name} style={{ '--i': i } as React.CSSProperties}
                className={'bp-row flex items-center rounded-lg transition-colors duration-300 ' + (qty > 0 ? 'bg-gold-100' : 'hover:bg-paper-100')}>
                <button type="button" onClick={() => bump(item.name, 1)} disabled={served} aria-label={'One more ' + item.name}
                  className="flex min-h-[48px] min-w-0 flex-1 items-center gap-2 py-1.5 pl-2.5 pr-0.5 text-left cursor-pointer active:scale-[0.985] transition-transform duration-200">
                  <span key={qty} className={'text-[15px] font-bold text-main ' + (dir === 1 ? 'bp-nudge' : '')}>{item.name}</span>
                  <span className="flex-1 border-b border-dotted border-paper-400" />
                </button>
                {qty > 0 ? (
                  <button type="button" onClick={() => bump(item.name, -1)} disabled={served}
                    title="Tap to take one off" aria-label={qty + ' ' + item.name + '. Tap to take one off'}
                    className="group/less relative mr-1.5 h-9 w-9 shrink-0 rounded-full text-main cursor-pointer transition-[background-color,transform] duration-200 hover:bg-card active:scale-90">
                    <span className="absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover/less:opacity-0 group-hover/less:scale-50">
                      <span key={qty} className={'font-display text-[15px] font-bold tabular-nums ' + (dir === 1 ? 'bp-up' : dir === -1 ? 'bp-down' : '')}>{qty}</span>
                    </span>
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 -rotate-90 scale-50 transition-[opacity,transform] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover/less:opacity-100 group-hover/less:rotate-0 group-hover/less:scale-100">
                      <Minus className="w-4 h-4" strokeWidth={2.6} />
                    </span>
                  </button>
                ) : (
                  <span className="mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center font-display text-[15px] font-bold tabular-nums text-ink-300">
                    <span key={dir || 0} className={dir === -1 ? 'bp-down' : ''}>0</span>
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-2 px-3 py-3 border-t border-soft bg-page">
          <button type="button" disabled={busy} onClick={() => void nothingToday()}
            className="text-[12px] font-bold text-muted hover:text-main px-2 py-2 cursor-pointer transition-[color,transform] duration-200 active:scale-95 disabled:opacity-50">
            Nothing today
          </button>
          {/* **Serve, not Save** (Sebastian, 2026-10-08): it sends the order on. Pressed, it
              squashes and springs back, a dark fill sweeps across, and "Served" rises in. */}
          <button key={chosen.length > 0 ? 'ready' : 'idle'} type="button" disabled={busy || chosen.length === 0} onClick={() => void serve()}
            className={'relative min-w-[84px] overflow-hidden rounded-lg px-5 py-2.5 text-[13px] font-bold transition-[opacity,background-color,transform] duration-200 cursor-pointer active:scale-95 ' +
              (served ? 'bp-squash bg-gold-400 text-ink-900' : 'bg-gold-400 hover:bg-gold-600 text-ink-900 disabled:opacity-50 disabled:cursor-not-allowed ' + (chosen.length > 0 && Object.keys(moved).length > 0 ? 'bp-ready' : ''))}>
            <span aria-hidden="true" className={'absolute inset-0 origin-left bg-ink-900 transition-transform duration-[450ms] ease-[cubic-bezier(.16,1,.3,1)] ' + (served ? 'scale-x-100' : 'scale-x-0')} />
            <span className={'relative block transition-[opacity,transform] duration-300 ' + (served ? 'opacity-0 -translate-y-full' : '')}>Serve</span>
            <span className={'absolute inset-0 flex items-center justify-center gap-1.5 text-gold-400 transition-[opacity,transform] duration-[400ms] ease-[cubic-bezier(.34,1.56,.64,1)] ' + (served ? '' : 'opacity-0 translate-y-full')}>
              {served && <Check className="bp-tick w-3.5 h-3.5" strokeWidth={3} />} Served
            </span>
          </button>
        </div>

        {/* **The order has gone to the kitchen, and the window says so** (Sebastian,
            2026-10-08: *"a satisfying sent-to-kitchen card after pressing serve"*). It is
            true: the kitchen's screen shows the breakfast the moment it is saved
            (`KitchenTab`). The ticket drops in, its seal pops, the dishes land one by one,
            and it flies off by itself — or at a tap. */}
        {(stage === 'sent' || stage === 'bye') && (
          <div onClick={sendOff} role="status"
            className={'absolute inset-0 z-10 flex items-center justify-center bg-page/95 p-5 cursor-pointer ' + (stage === 'bye' ? 'bp-undim' : 'bp-dim')}>
            <div className={'w-full max-w-[250px] rounded-xl border border-soft bg-card px-[18px] pb-4 pt-5 text-center ' + (stage === 'bye' ? 'bp-fly' : 'bp-drop')}>
              <div className="bp-seal relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink-900 text-gold-400">
                <i /><i /><i /><i /><i /><i />
                <Check className="bp-tick bp-tick-late h-7 w-7" strokeWidth={3} />
              </div>
              <p className="bp-line mt-3 font-display text-[17px] font-bold text-main" style={{ '--i': 0 } as React.CSSProperties}>Sent to the kitchen</p>
              <p className="bp-line mt-0.5 truncate text-[12px] text-muted" style={{ '--i': 1 } as React.CSSProperties}>{place} · {booking.guest_name}</p>
              <ul className="mt-3.5 flex flex-col gap-1.5 border-t border-dashed border-paper-400 pt-3">
                {sent.map((item, i) => (
                  <li key={item.name} style={{ '--i': i + 2 } as React.CSSProperties} className="bp-line flex items-center gap-2 text-left text-[14px] font-bold text-main">
                    {item.name}
                    <span className="flex-1 border-b border-dotted border-paper-400" />
                    <span className="font-display tabular-nums">{item.qty}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
