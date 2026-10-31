import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Coffee, X } from 'lucide-react'
import { Booking, BreakfastChoice } from '../../types/booking'
import { getBreakfastMenu } from '../../utils/rateConfig'
import { breakfastMornings } from '../../utils/breakfast'
import { breakfastPlanOf, morningItems, saveBreakfastChoices, USUAL_BREAKFAST, withBreakfastChoice, withLaterMornings } from '../../utils/breakfastChoice'
import { minutesLabel } from '../../utils/doorTimes'
import { showToast } from '../../utils/toast'
import { DishRows, TimeStepper, UsualChip } from './BreakfastParts'

interface BreakfastPickerProps {
  booking: Booking
  /** The day being answered for, `YYYY-MM-DD`. */
  date: string
  today: string
  /** `Room 2` — where the plates go. */
  place: string
  /** Sets the stay's time, once this window has saved its answer. */
  onTime: (minutes: number) => void | Promise<void>
  onClose: () => void
}

// How long the "Sent to the kitchen" ticket stays before it flies off by itself, and how
// long its flight takes. A tap sends it off sooner.
const TICKET_STAYS = 2600
const TICKET_FLIES = 520
// The Serve button's own turn (the squash, the dark sweep, the tick) before the ticket drops.
const SERVE_TURN = 520

// What this room wants for breakfast on one morning. The menu is the one in Settings; the desk
// taps how many of each. "Nothing today" is an answer too — it marks the room as asked.
// It starts from what the guest said for the stay, which is a confirmation and not an order
// (Sebastian, 2026-11-01: "it should be more of a confirmation"). **Only today's Serve reaches the
// kitchen:** another morning has Save, and a later one is still asked on its day.
//
// **It is meant to feel good to use** (Sebastian, 2026-10-08: *"aside from core
// functionality, I prioritise satisfying user experience over everything else"*, said of
// this window's mock). So everything in it answers a tap: the window rises and its lines
// slide in, a number springs up when a plate is added and drops when one comes off, Serve
// squashes and turns dark with a tick that draws itself, and a ticket drops in to say the
// order has gone to the kitchen, then flies away. The moves are in `index.css` (`bp-…`),
// and all of them stand still on a device that asks for less motion.
export function BreakfastPicker({ booking, date, today, place, onTime, onClose }: BreakfastPickerProps) {
  const queryClient = useQueryClient()
  const menu = getBreakfastMenu()
  const isToday = date === today
  const time = breakfastPlanOf(booking)?.time
  // The stay's time, set here only when the room has none yet; it is kept with the answer.
  const [newTime, setNewTime] = useState<number | undefined>(undefined)
  const [showTime, setShowTime] = useState(false)
  // Later mornings that take the same answer. Off by default: a tap changes only this morning.
  const laterDays = breakfastMornings(booking.check_in, booking.check_out, booking.breakfast_days).filter(d => d > date && d >= today)
  const [also, setAlso] = useState<string[]>([])
  const dayWord = (d: string) => new Date(d + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const start: Record<string, number> = {}
    morningItems(booking, date).forEach(i => { start[i.name] = i.qty })
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
    await saveChoices(withLaterMornings(withBreakfastChoice(booking, date, items), also, items))
  }
  const saveChoices = async (choices: BreakfastChoice[]) => {
    await saveBreakfastChoices(booking.id, choices)
    // Shown at once; the live update from the database follows a moment later.
    queryClient.setQueryData<Booking[]>(['bookings'], old =>
      old?.map(b => b.id === booking.id ? { ...b, breakfast_choices: choices } : b))
    if (newTime != null) await onTime(newTime)
  }
  // Another morning's answer: the window goes at once and the save follows. A morning gone by is
  // noted as confirmed; one still to come is only changed. Neither reaches the kitchen.
  const saveQuietly = (choices: BreakfastChoice[]) => {
    onClose()
    saveChoices(choices).catch(() => showToast('Could not save the breakfast choice. Please try again.', 'error'))
  }
  const saveMorning = () => saveQuietly(date < today
    ? withLaterMornings(withBreakfastChoice(booking, date, chosen), also, chosen)
    : withLaterMornings(booking.breakfast_choices || [], [date, ...also], chosen))

  const chosen = menu.map(m => ({ name: m.name, qty: counts[m.name] || 0 })).filter(i => i.qty > 0)

  // "Nothing" is an answer on every morning it is given for: that morning is not asked again.
  const nothing = () => saveQuietly([date, ...also].reduce<Booking>((b, d) => ({ ...b, breakfast_choices: withBreakfastChoice(b, d, []) }), booking).breakfast_choices || [])

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
              <Coffee className="w-4 h-4 text-gold-600" /> {isToday ? 'Breakfast today' : 'Breakfast · ' + dayWord(date)}
            </h3>
            <p className="text-[12px] text-muted mt-0.5 truncate">{place} · {booking.guest_name}{time != null && ' · ' + minutesLabel(time)}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-main transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-page px-2 py-2 max-h-[55vh] overflow-y-auto">
          <DishRows counts={counts} moved={moved} disabled={served} onBump={bump} />
          {time == null && (showTime ? (
            <div className="bw-unfold grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 pt-1.5 pl-2.5 pr-1">
              <span className="text-[12.5px] font-bold text-main">Served at</span>
              <TimeStepper minutes={newTime} onChange={setNewTime} />
              <UsualChip minutes={newTime} onUsual={() => setNewTime(USUAL_BREAKFAST)} />
            </div>
          ) : (
            <button type="button" onClick={() => setShowTime(true)} className="mt-1 px-2.5 py-1.5 text-[12px] font-bold text-muted hover:text-main cursor-pointer transition-[color,transform] duration-200 active:scale-95">Set time</button>
          ))}
          {laterDays.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-2 pt-2 pb-0.5">
              <ArrowRight aria-label="The same on" className="w-3.5 h-3.5 text-muted" strokeWidth={2.4} />
              {laterDays.map(d => {
                const on = also.includes(d)
                return (
                  <button key={d} type="button" aria-pressed={on} disabled={served} onClick={() => setAlso(a => (on ? a.filter(x => x !== d) : [...a, d]))}
                    className={'inline-flex items-center h-[30px] px-2.5 rounded-lg text-[12px] font-bold whitespace-nowrap cursor-pointer transition-[background-color,box-shadow,transform] duration-200 active:scale-95 ' +
                      (on ? 'bg-gold-400 text-ink-900' : 'text-main shadow-[inset_0_0_0_1px_rgba(28,28,28,0.14)] hover:bg-gold-100')}>{dayWord(d)}</button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-3 py-3 border-t border-soft bg-page">
          <button type="button" disabled={busy} onClick={nothing}
            className="text-[12px] font-bold text-muted hover:text-main px-2 py-2 cursor-pointer transition-[color,transform] duration-200 active:scale-95 disabled:opacity-50">
            {isToday ? 'Nothing today' : 'Nothing'}
          </button>
          {!isToday && chosen.length > 0 && (
            <button type="button" onClick={saveMorning} className="bp-ready min-w-[84px] rounded-lg px-5 py-2.5 text-[13px] font-bold bg-gold-400 hover:bg-gold-600 text-ink-900 transition-[background-color,transform] duration-200 cursor-pointer active:scale-95">Save</button>
          )}
          {/* **Serve, not Save** (Sebastian, 2026-10-08): it sends the order on. Pressed, it
              squashes and springs back, a dark fill sweeps across, and "Served" rises in. */}
          {isToday && chosen.length > 0 && <button type="button" disabled={busy} onClick={() => void serve()}
            className={'relative min-w-[84px] overflow-hidden rounded-lg px-5 py-2.5 text-[13px] font-bold transition-[opacity,background-color,transform] duration-200 cursor-pointer active:scale-95 ' +
              (served ? 'bp-squash bg-gold-400 text-ink-900' : 'bg-gold-400 hover:bg-gold-600 text-ink-900 bp-ready')}>
            <span aria-hidden="true" className={'absolute inset-0 origin-left bg-ink-900 transition-transform duration-[450ms] ease-[cubic-bezier(.16,1,.3,1)] ' + (served ? 'scale-x-100' : 'scale-x-0')} />
            <span className={'relative block transition-[opacity,transform] duration-300 ' + (served ? 'opacity-0 -translate-y-full' : '')}>Serve</span>
            <span className={'absolute inset-0 flex items-center justify-center gap-1.5 text-gold-400 transition-[opacity,transform] duration-[400ms] ease-[cubic-bezier(.34,1.56,.64,1)] ' + (served ? '' : 'opacity-0 translate-y-full')}>
              {served && <Check className="bp-tick w-3.5 h-3.5" strokeWidth={3} />} Served
            </span>
          </button>}
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
