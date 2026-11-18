import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Banknote, Clock, Trash2, X } from 'lucide-react'
import { Tab, TabLine } from '../../types/tab'
import { PaymentRecord } from '../../types/booking'
import { OrderSlip, slipNumber } from '../../utils/orderSlips'
import { payTowards, slipLeft } from '../../utils/tabs'
import { PAYMENT_METHODS, methodNeedsReference, paymentKind, paymentMethodLabel } from '../../utils/paymentMethod'
import { NumInput } from '../NumInput'
import { TabReceiptModal } from './TabReceiptModal'
import { tableName } from './served'
import { NewTag } from '../NewMark'
import { markSeen } from '../../utils/newMarks'
import { peso } from '../../utils/helpers'
import { saveOrderChanges } from '../../utils/orderChanges'
import { showToast } from '../../utils/toast'

// **Pay later** (Sebastian, 2026-11-17): many diners eat and do not pay at once, and their slips sat
// on the restaurant's tables or under "Diners to pay", "taking up space and unneeded attention". The
// restaurant's "Send bill" puts such a bill here, under the name of who pays. It is a quiet button
// with a count, apart from the diners standing at the desk, and one name's slips are paid together,
// all at once or a bit at a time ("add a partial payment").

/** One person on the list: every slip under their name. */
interface Owing {
  key: string
  name: string
  slips: OrderSlip[]
  left: number
  paid: number
  days: number
}

const DAY = 86400000
const shortDay = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

function owingOf(slips: OrderSlip[]): Owing[] {
  const by = new Map<string, Owing>()
  for (const s of slips) {
    const name = (s.tab.label || '').trim()
    // A bill put here with no name keeps its table and day, alone.
    const key = name ? 'n:' + name.toLowerCase() : 't:' + s.tab.id
    const shown = name || [tableName(s.tab.table_label) || 'Walk-in', shortDay(s.tab.pay_later_at)].join(' · ')
    const o = by.get(key) || { key, name: shown, slips: [], left: 0, paid: 0, days: 0 }
    o.slips.push(s)
    o.left += slipLeft(s.lines, s.tab.payment_records)
    o.paid += (s.tab.payment_records || []).reduce((n, r) => n + Number(r.amount || 0), 0)
    o.days = Math.max(o.days, Math.floor((Date.now() - Date.parse(s.tab.pay_later_at || s.tab.created_at)) / DAY))
    by.set(key, o)
  }
  // Longest waiting first: that is who the desk should ask.
  return [...by.values()].sort((a, b) => b.days - a.days)
}

const daysWords = (n: number) => n === 0 ? 'today' : n === 1 ? '1 day' : n + ' days'

export function PayLater({ slips, onChanged }: { slips: OrderSlip[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Owing | null>(null)
  const owing = owingOf(slips)
  // The person being paid follows their slips as they change; once all paid they leave the list,
  // and the window keeps what was picked for the receipt.
  const paying = picked ? owing.find(o => o.key === picked.key) || picked : null

  if (owing.length === 0 && !paying) return null
  return (
    <div className="relative mr-1.5 pb-[5px]">
      <button type="button" onClick={() => { markSeen('desk-pay-later'); setOpen(o => !o) }} aria-expanded={open}
        title="Diners who pay another time"
        className={'relative inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-[13px] font-semibold text-main transition-colors duration-150 active:scale-[0.98] cursor-pointer ' +
          (open ? 'border-gold-400 bg-gold-100' : 'border-soft bg-card hover:border-gold-400 hover:bg-gold-100')}>
        <Clock className="w-4 h-4 text-gold-800" />
        Pay later
        <span key={owing.length} className="min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-ink-900 text-gold-400 text-[11px] font-bold tabular-nums bw-rise">{owing.length}</span>
        <NewTag id="desk-pay-later" />
      </button>

      {open && owing.length > 0 && (<>
        <button type="button" aria-label="Close the list" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
        <div className="absolute right-0 top-full z-50 mt-2 flex max-h-[360px] w-[320px] max-w-[calc(100vw-2rem)] flex-col overflow-y-auto rounded-lg border border-gold-400 bg-card p-1.5 origin-top-right animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none">
          {owing.map((o, i) => (
            <button key={o.key} type="button" onClick={() => { setOpen(false); setPicked(o) }} style={{ animationDelay: i * 30 + 'ms' }}
              className={'grid grid-cols-[1fr_auto] items-center gap-x-3 min-h-14 px-2.5 py-2 rounded-md text-left hover:bg-gold-100 transition-colors cursor-pointer animate-in fade-in slide-in-from-top-1 fill-mode-both motion-reduce:animate-none ' + (i ? 'border-t border-soft' : '')}>
              <b className="min-w-0 truncate text-[14.5px] text-main">{o.name}</b>
              <b className="text-[15px] text-main tabular-nums text-right">{peso(o.left)}</b>
              {/* Two weeks waiting is said in red: someone should be asked. */}
              <span className={'text-[12.5px] ' + (o.days >= 14 ? 'font-semibold text-danger-600' : 'text-muted')}>
                {o.slips.length === 1 ? '1 slip' : o.slips.length + ' slips'} · {daysWords(o.days)}
              </span>
              <span className="text-[12px] font-semibold text-emerald-700 text-right tabular-nums">{o.paid > 0 ? peso(o.paid) + ' paid' : ''}</span>
            </button>
          ))}
        </div>
      </>)}

      {paying && <PayLaterModal key={paying.key} owing={paying} onClose={() => setPicked(null)} onChanged={onChanged} />}
    </div>
  )
}

function PayLaterModal({ owing, onClose, onChanged }: { owing: Owing; onClose: () => void; onChanged: () => void }) {
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState(owing.left)
  const [error, setError] = useState('')
  const [sealed, setSealed] = useState<{ amount: number; left: number } | null>(null)
  const [receipt, setReceipt] = useState<{ tab: Tab; lines: TabLine[]; record: PaymentRecord } | null>(null)
  const saving = useRef(false)
  const needsRef = methodNeedsReference(method)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !receipt) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, receipt])

  // **A slip on Pay later can be removed** (Sebastian, 2026-11-18: "I want the entire order slip to be
  // removable. the remove button should be below the receive button"). Every row comes off the way the
  // desk takes a diner's orders off (`apply_order_changes`, stock back), so the empty slip drops off the
  // list. A slip with money on it stays: what was received belongs to it. Several slips: the desk ticks
  // which, none to start. The slip goes at once and is saved behind; a failed save puts it back.
  const [asking, setAsking] = useState(false)
  const [picks, setPicks] = useState<Set<string>>(new Set())
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const [gone, setGone] = useState<Set<string>>(new Set())

  const slips = [...owing.slips].filter(s => !gone.has(s.tab.id)).sort((a, b) => (a.tab.created_at || '').localeCompare(b.tab.created_at || ''))
  const left = slips.reduce((n, s) => n + slipLeft(s.lines, s.tab.payment_records), 0)
  const paying = Math.min(Math.max(0, amount || 0), left)
  const free = slips.filter(s => (s.tab.payment_records || []).length === 0)

  const removeSlips = (chosen: OrderSlip[]) => {
    setAsking(false)
    setPicks(new Set())
    const ids = chosen.map(s => s.tab.id)
    const all = chosen.length === slips.length
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setLeaving(s => new Set([...s, ...ids]))
    window.setTimeout(() => {
      setGone(s => new Set([...s, ...ids]))
      setAmount(a => Math.min(a, left - chosen.reduce((n, s) => n + slipLeft(s.lines, s.tab.payment_records), 0)))
      if (all) onClose()
    }, reduce ? 0 : 260)
    const at = new Date().toISOString()
    Promise.all(chosen.map(s => saveOrderChanges({
      tabId: s.tab.id,
      changes: s.lines.map(l => ({ lineId: l.id, menuItemId: l.menu_item_id, description: l.description, unitPrice: Number(l.unit_price || 0), delta: 0, remove: true, at })),
    }))).then(() => {
      onChanged()
      showToast(all ? owing.name + ' is off Pay later' : chosen.map(s => slipNumber(s.tab) || 'The order slip').join(', ') + ' removed', 'success')
    }).catch(err => {
      console.error('Could not remove the order slip:', err)
      onChanged()
      setLeaving(s => new Set([...s].filter(id => !ids.includes(id))))
      setGone(s => new Set([...s].filter(id => !ids.includes(id))))
      setError('Not removed. Please try again.')
      if (all) showToast((owing.name) + '’s order slip was not removed. Please try again.', 'error')
    })
  }

  const chosen = free.length === 1 ? free : free.filter(s => picks.has(s.tab.id))
  const confirmRemove = () => {
    if (chosen.length === 0) { setError('Tick the slips to remove.'); return }
    setError('')
    removeSlips(chosen)
  }

  const receive = async () => {
    if (saving.current) return
    if (paying <= 0) { setError('Type how much they are paying.'); return }
    if (!method) { setError('Choose how they paid.'); return }
    if (needsRef && !reference.trim()) { setError('Enter the ' + method + ' reference number.'); return }
    setError('')
    saving.current = true
    const before = { ...owing, slips, left }
    setSealed({ amount: paying, left: before.left - paying })
    try {
      const record = await payTowards({ slips: before.slips, amount: paying, method, reference })
      onChanged()
      // The receipt shows every slip this payment was towards, and what is still owed after it.
      const all = slips.flatMap(s => s.lines)
      const first = slips[0].tab
      const earlier = slips.flatMap(s => s.tab.payment_records || [])
      window.setTimeout(() => setReceipt({
        tab: { ...first, os_number: slips.length === 1 ? first.os_number : null, label: before.name, payment_records: [...earlier, record] },
        lines: all, record,
      }), 1100)
    } catch (err) {
      setSealed(null)
      setError('The payment was not saved — ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      saving.current = false
    }
  }

  if (receipt) return <TabReceiptModal {...receipt} onClose={onClose} />

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink-900/50 font-sans bp-dim" onClick={onClose}>
      <div className="relative w-full max-w-sm max-h-[calc(100dvh-32px)] flex flex-col bg-card rounded-xl border border-soft shadow-softLg overflow-hidden bp-rise motion-reduce:[animation:none]" onClick={e => e.stopPropagation()}>
        {sealed && (
          <div role="status" className="absolute inset-0 z-10 bg-card grid place-content-center justify-items-center gap-2.5 bp-dim">
            <span className="relative w-16 h-16 grid place-items-center rounded-full bg-ink-900 text-gold-400 bp-seal"><Banknote className="w-7 h-7" /></span>
            <b className="font-display text-[19px] font-bold tracking-tight text-main">Paid {peso(sealed.amount)}</b>
            <span className="text-[13px] text-muted">{sealed.left > 0.005 ? peso(sealed.left) + ' left · stays on Pay later' : owing.name + ' is all paid'}</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-soft">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-main flex items-center gap-2 truncate"><Clock className="w-4 h-4 shrink-0 text-gold-600" /> {owing.name}</h3>
            <p className="text-[13px] text-muted mt-0.5">{slips.length === 1 ? '1 slip' : slips.length + ' slips'} · Pay later</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-main transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-4 pt-2 pb-3 overflow-y-auto">
          {slips.map(s => (
            <div key={s.tab.id} className={leaving.has(s.tab.id) ? 'slip-leave' : undefined}>
              <p className="mt-2 flex justify-between text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                <span>{[slipNumber(s.tab), tableName(s.tab.table_label), shortDay(s.tab.created_at)].filter(Boolean).join(' · ')}</span>
                <span className="tabular-nums">{peso(s.total)}</span>
              </p>
              <ul className="divide-y divide-soft text-[14px]">
                {s.lines.map(l => (
                  <li key={l.id} className="py-1.5 flex justify-between gap-3">
                    <span className="min-w-0 break-words"><b className="tabular-nums">{Number(l.qty || 1)} ×</b> {l.description}</span>
                    <span className="tabular-nums">{peso(l.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* What was paid before, one receipt a line: a payment split over two slips is one line. */}
          {paidBefore(slips).map(p => (
            <div key={p.key} className="flex justify-between gap-3 py-1.5 text-[14px] text-emerald-700">
              <span>Paid · {paymentMethodLabel(p.method)} <span className="text-[12.5px] text-muted">{shortDay(p.at)}{p.receipt ? ' · ' + p.receipt : ''}</span></span>
              <span className="tabular-nums">−{peso(p.amount)}</span>
            </div>
          ))}

          <div className="flex items-baseline justify-between gap-2 pt-3 mt-1 border-t border-soft">
            <span className="text-[14px] font-medium text-muted">Left to pay</span>
            <span key={left} className="font-display text-[26px] leading-none font-extrabold tracking-tight tabular-nums text-main bw-rise">{peso(left)}</span>
          </div>

          <div className="mt-3 pt-3 border-t border-soft space-y-2.5">
            <div className="grid grid-cols-2 gap-1.5">
              {PAYMENT_METHODS.map(m => (
                <button key={m} type="button" onClick={() => { setMethod(m); setReference(''); setError('') }} aria-pressed={m === method}
                  className={'min-h-11 text-[13px] font-bold px-2.5 rounded-lg border transition-colors cursor-pointer ' +
                    (m === method ? 'bg-gold-400 border-gold-400 text-ink-900' : 'bg-card border-soft text-main hover:border-gold-400 hover:bg-gold-100')}>
                  {m}
                </button>
              ))}
            </div>
            {needsRef && (
              <input value={reference} onChange={e => setReference(e.target.value)} aria-label={paymentKind(method) === 'gcash' ? 'GCash reference no.' : 'Reference no.'}
                placeholder={paymentKind(method) === 'gcash' ? 'GCash ref no., e.g. 1012 345 678901' : 'Reference no., e.g. 0045821'}
                className="w-full h-11 bg-card border border-soft text-main px-3 rounded-lg text-[16px] focus:outline-none focus:border-gold-500" />
            )}
            {/* The whole amount is filled in; typing less is a part payment. */}
            <label className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-muted whitespace-nowrap">Paying</span>
              <span className="flex-1 flex items-center h-11 px-3 rounded-lg border border-soft bg-card focus-within:border-gold-500">
                <span className="text-[16px] font-bold text-muted">₱</span>
                <NumInput value={amount} onChange={setAmount} placeholder={String(left)} aria-label="Amount paid"
                  onFocus={e => e.currentTarget.select()}
                  className="w-full bg-transparent pl-1 text-[16px] font-bold text-main tabular-nums focus:outline-none" />
              </span>
            </label>
            <p className="min-h-[18px] text-right text-[12.5px] text-muted">
              {paying > 0 && paying < left - 0.005 ? <><b className="text-gold-800 tabular-nums">{peso(left - paying)}</b> still to pay after this</> : null}
            </p>
            {error && <p role="alert" className="text-[12px] font-semibold text-danger-600">{error}</p>}
            <button type="button" onClick={() => void receive()}
              className="w-full min-h-12 inline-flex items-center justify-center gap-1.5 text-[14px] font-bold px-3 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 transition-[background-color,transform] active:scale-[0.98] cursor-pointer">
              Receive {peso(paying)}
            </button>
            {free.length > 0 && (
              <div className="flex justify-center">
                <button type="button" onClick={() => { markSeen('pay-later-remove'); setError(''); setPicks(new Set()); setAsking(true) }}
                  className="relative min-h-11 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-danger-600 transition-colors cursor-pointer">
                  <Trash2 className="w-4 h-4" /> Remove order slip{free.length > 1 ? 's' : ''}
                  <NewTag id="pay-later-remove" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* The ask, drawn like `ConfirmDialog`, over this window: one slip is asked plainly; several are ticked. */}
        {asking && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-ink-900/50 bp-dim" onClick={() => setAsking(false)}>
            <div className="w-full bg-card rounded-xl shadow-softLg overflow-hidden bp-rise motion-reduce:[animation:none]" onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-3 px-5 pt-4 pb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-danger-50"><AlertTriangle className="w-4 h-4 text-danger-500" /></div>
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-main text-[15px] leading-snug">
                    {free.length === 1 ? 'Remove ' + (slipNumber(free[0].tab) || 'this order slip') + '?' : 'Which slips for ' + owing.name + '?'}
                  </h3>
                  {free.length === 1 && (
                    <p className="text-[12px] text-muted mt-1 leading-snug">
                      {free[0].lines.length === 1 ? '1 line' : free[0].lines.length + ' lines'} · {peso(free[0].total)} comes off.{slips.length === 1 ? ' ' + owing.name + ' leaves Pay later.' : ''}
                    </p>
                  )}
                </div>
              </div>
              {free.length > 1 && (
                <div className="grid gap-1 px-5 pb-3">
                  {free.map(s => {
                    const on = picks.has(s.tab.id)
                    return (
                      <label key={s.tab.id} className={'grid grid-cols-[20px_1fr_auto] items-center gap-2.5 min-h-11 px-2.5 rounded-lg border text-[14px] cursor-pointer transition-colors ' + (on ? 'border-danger-500 bg-danger-50' : 'border-soft')}>
                        <input type="checkbox" checked={on} className="w-[18px] h-[18px] accent-danger-500"
                          onChange={() => { setError(''); setPicks(p => { const n = new Set(p); if (n.has(s.tab.id)) n.delete(s.tab.id); else n.add(s.tab.id); return n }) }} />
                        <span className="min-w-0 truncate">{[slipNumber(s.tab), shortDay(s.tab.created_at)].filter(Boolean).join(' · ')}</span>
                        <b className="tabular-nums">{peso(s.total)}</b>
                      </label>
                    )
                  })}
                  {error && <p role="alert" className="text-[12px] font-semibold text-danger-600">{error}</p>}
                </div>
              )}
              <div className="flex gap-2 px-5 pb-4">
                <button type="button" onClick={() => { setError(''); setAsking(false) }}
                  className="flex-1 border border-soft text-main text-sm font-semibold py-2.5 rounded-lg hover:bg-page transition-colors cursor-pointer">Cancel</button>
                <button type="button" onClick={confirmRemove}
                  className="flex-1 text-sm font-bold py-2.5 rounded-lg transition-colors cursor-pointer bg-danger-500 hover:bg-danger-600 text-white">
                  {free.length === 1 ? 'Remove' : chosen.length === 0 ? 'Pick a slip' : 'Remove ' + (chosen.length === 1 ? '1 slip' : chosen.length + ' slips') + ' · ' + peso(chosen.reduce((n, s) => n + s.total, 0))}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** The payments already made on these slips, one per receipt number, oldest first. */
function paidBefore(slips: OrderSlip[]) {
  const by = new Map<string, { key: string; method: string; at: string; receipt?: string; amount: number }>()
  for (const s of slips) for (const r of s.tab.payment_records || []) {
    const key = r.receipt_number || r.id
    const p = by.get(key) || { key, method: r.method, at: r.paid_at || '', receipt: r.receipt_number, amount: 0 }
    p.amount += Number(r.amount || 0)
    by.set(key, p)
  }
  return [...by.values()].sort((a, b) => a.at.localeCompare(b.at))
}
