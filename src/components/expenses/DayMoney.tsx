import { CSSProperties, FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { Expense, ExpenseCategory, Handover } from '../../types/expense'
import { CountPeso } from '../CountPeso'
import { DailyReport, MoneyInLine, forwardedLabel, openKey } from '../../utils/dailyReport'
import { PaymentKind, paymentKind } from '../../utils/paymentMethod'

const peso = (n: number) => '₱' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })

// The day's expenses in groups of one category, each group where its first expense was.
const byCategory = (list: Expense[]) => {
  const groups = new Map<string, Expense[]>()
  list.forEach(e => { const g = groups.get(e.category_id); if (g) g.push(e); else groups.set(e.category_id, [e]) })
  return [...groups.values()]
}

const signed = (n: number) => n < 0 ? '(' + peso(-n) + ')' : peso(n)

interface DayMoneyProps {
  /** The day's sheet — the same figures the printed daily report carries. */
  report: DailyReport
  /** That day's expenses, so each one can be taken back off. */
  dayExpenses: Expense[]
  categories: ExpenseCategory[]
  onRemove: (expense: Expense) => void
  /** Saves a fix to one part of an expense; shown at once. */
  onChange: (expense: Expense, change: Partial<Pick<Expense, 'category_id' | 'amount' | 'notes'>>) => void
  /** Money handed to the owner on this day, so each can be taken back. */
  dayHandovers: Handover[]
  onTakeBack: (handover: Handover) => void
  /** Saves a new expense for the day on screen. */
  onAdd: (input: { amount: number; categoryId: string; notes?: string }) => Promise<void>
  /** "Oct 26" when the screen is on a day gone by, so the blank line says which day it writes on. */
  pastDay?: string
  /** Opens what a payment belongs to: a booking's bill, or a diner's receipt. */
  onOpenPayment?: (line: MoneyInLine) => void
  /** `openKey` of the payment whose paper is on its way, so its row shows it is loading. */
  opening?: string | null
  /** The quiet things and Print, in a thin row under the total. */
  footer?: ReactNode
}

// The bill's quiet tap: a dotted line under a part that can be changed.
const TAP = 'px-0.5 -mx-0.5 rounded-sm border-b-[1.5px] border-dotted border-paper-400 hover:border-gold-400 hover:bg-gold-100 aria-expanded:border-solid aria-expanded:border-gold-400 aria-expanded:bg-gold-100 active:scale-95 transition-[background-color,border-color,transform] cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400'
const BOX = 'bg-card border-[1.5px] border-gold-400 rounded-md px-1.5 py-0.5 outline-none [animation:bp-slide_.2s_cubic-bezier(.16,1,.3,1)]'

type Part = 'category' | 'note' | 'amount'

// One expense, every part of it changed where it is written (Sebastian, 2026-10-27: a
// mistake used to mean removing it and typing it again). Enter or a tap away saves it,
// Esc puts it back; there is no Save button.
function ExpenseLine({ expense, categories, nameOf, onRemove, onChange, time }: {
  expense: Expense
  /** Inside a merged line: when it was written, so the repeats can be told apart. */
  time?: string
  categories: ExpenseCategory[]
  nameOf: (id: string) => string
  onRemove: (expense: Expense) => void
  onChange: DayMoneyProps['onChange']
}) {
  const [open, setOpen] = useState<Part | null>(null)
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState(0)
  const row = useRef<HTMLDivElement>(null)

  // The list of what it was for shuts on a tap anywhere else.
  useEffect(() => {
    if (open !== 'category') return
    const away = (e: PointerEvent) => { if (!row.current?.contains(e.target as Node)) setOpen(null) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const start = (part: Part) => {
    setDraft(part === 'amount' ? String(expense.amount) : part === 'note' ? expense.notes || '' : '')
    setOpen(o => (o === part ? null : part))
  }
  const save = (change: Parameters<DayMoneyProps['onChange']>[1]) => {
    setOpen(null)
    onChange(expense, change)
    setSaved(n => n + 1)
  }
  const commit = () => {
    if (open === 'amount') {
      const v = parseFloat(draft)
      if (v > 0 && v !== expense.amount) return save({ amount: v })
    } else if (open === 'note') {
      const v = draft.trim()
      if (v !== (expense.notes || '')) return save({ notes: v })
    }
    setOpen(null)
  }
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') setOpen(null)
  }

  return (
    <div ref={row} key={saved} className={'relative flex items-center justify-between gap-3 py-1 -mx-1 px-1 rounded-md text-[13px] ' + (saved ? '[animation:ex-saved_.9s_ease-out]' : '')}>
      <span className="min-w-0 flex flex-wrap items-baseline gap-x-1">
        {time && <span className="font-mono text-[11px] text-muted mr-1">{time}</span>}
        <button type="button" aria-expanded={open === 'category'} aria-label="What it was for" onClick={() => start('category')} className={TAP + ' text-main'}>
          {nameOf(expense.category_id)}
        </button>
        {open === 'note' ? (
          <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={keys}
            onFocus={e => e.target.select()} placeholder="e.g. for Ana, receipt 0412" aria-label="Note"
            className={BOX + ' w-[180px] text-[16px] md:text-[13px] text-main'} />
        ) : expense.notes ? (
          <><span className="text-muted">·</span>
          <button type="button" aria-label="Note" onClick={() => start('note')} className={TAP + ' text-muted truncate'}>{expense.notes}</button></>
        ) : (
          <button type="button" onClick={() => start('note')} className={TAP + ' text-paper-400 italic'}>add a note</button>
        )}
      </span>
      <span className="flex items-center gap-2 shrink-0">
        {open === 'amount' ? (
          <input autoFocus inputMode="decimal" value={draft} onChange={e => setDraft(e.target.value.replace(/[^0-9.]/g, ''))}
            onBlur={commit} onKeyDown={keys} onFocus={e => e.target.select()} placeholder="e.g. 250" aria-label="Amount"
            className={BOX + ' w-[100px] text-right font-mono text-[16px] md:text-[14px] font-bold text-danger-600'} />
        ) : (
          <button type="button" aria-label="Amount" onClick={() => start('amount')} className={TAP + ' font-mono text-[14px] font-bold text-danger-600'}>
            {peso(expense.amount)}
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(expense)}
          aria-label={'Remove ' + nameOf(expense.category_id) + ' ' + peso(expense.amount)}
          className="text-muted hover:text-danger-600 active:scale-90 transition-[color,transform] cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </span>
      {open === 'category' && (
        <CategoryPicker categories={categories} chosen={expense.category_id} onClose={() => setOpen(null)}
          onPick={id => (id === expense.category_id ? setOpen(null) : save({ category_id: id }))} />
      )}
    </div>
  )
}

// The same thing bought again and again is one line with how many times (Sebastian, 2026-10-28:
// "if theres repeat expenses just merge them and show how many times it's merged"; design A of
// the mock). It sits where the first one was, and a tap opens every one of them below it, each
// still changed where it is written; their notes are only seen there ("keep the notes inside the
// dropdown").
function ExpenseGroup({ expenses, categories, nameOf, onRemove, onChange }: {
  expenses: Expense[]
  categories: ExpenseCategory[]
  nameOf: (id: string) => string
  onRemove: (expense: Expense) => void
  onChange: DayMoneyProps['onChange']
}) {
  const [open, setOpen] = useState(false)
  const name = nameOf(expenses[0].category_id)
  const sum = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const timeOf = (e: Expense) => e.created_at ? new Date(e.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="group w-full flex items-center justify-between gap-3 py-1 -mx-1 px-1 rounded-md text-[13px] text-left hover:bg-paper-50 aria-expanded:bg-paper-50 transition-colors cursor-pointer" style={{ width: 'calc(100% + 0.5rem)' }}>
        <span className="min-w-0 flex items-baseline gap-1.5">
          <span className="truncate text-main">{name}</span>
          <span key={expenses.length} className="shrink-0 inline-grid place-items-center min-w-6 h-[19px] px-1.5 rounded-full bg-danger-50 text-danger-600 text-[11px] font-extrabold group-active:scale-90 transition-transform [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]">×{expenses.length}</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span key={sum} className="font-mono text-[14px] font-bold text-danger-600 inline-block [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]">{peso(sum)}</span>
          <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-gold-600 transition-transform duration-[350ms] ease-[cubic-bezier(.34,1.4,.64,1)] group-aria-expanded:rotate-180" />
        </span>
      </button>
      <div className={'grid transition-[grid-template-rows] duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)] ' + (open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="min-h-0 overflow-hidden">
          <div className="ml-1.5 mb-1 pl-3 border-l-2 border-paper-200">
            {expenses.map((expense, i) => (
              <div key={expense.id} className={open ? 'bw-rise' : ''} style={{ '--i': i } as CSSProperties}>
                <ExpenseLine expense={expense} time={timeOf(expense)} categories={categories} nameOf={nameOf} onRemove={onRemove} onChange={onChange} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// What it was for, as a tidy list under the word (the owner's pick from the drawing,
// 2026-10-27): a search box, the five used most, and the rest below them to scroll to.
// `categories` arrives most-used first.
function CategoryPicker({ categories, chosen, onPick, onClose }: {
  categories: ExpenseCategory[]
  chosen: string
  onPick: (id: string) => void
  onClose: () => void
}) {
  const [find, setFind] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const term = find.trim().toLowerCase()
  const hits = categories.filter(c => c.name.toLowerCase().includes(term))

  const item = (cat: ExpenseCategory, i: number) => {
    const on = cat.id === chosen
    const at = term ? cat.name.toLowerCase().indexOf(term) : -1
    return (
      <button key={cat.id} type="button" role="option" aria-selected={on} style={{ '--i': i } as CSSProperties}
        onClick={() => onPick(cat.id)}
        className={'bp-row flex items-center gap-2 w-full min-h-[40px] px-2.5 rounded-lg text-left text-[13px] hover:bg-gold-100 active:scale-[.97] transition-[background-color,transform] cursor-pointer ' + (on ? 'font-extrabold text-ink-900' : 'font-semibold text-main')}>
        <span className={'w-3 text-gold-800 font-extrabold transition-[opacity,transform] duration-300 ' + (on ? 'opacity-100 scale-100' : 'opacity-0 scale-50')}>✓</span>
        {at < 0 ? cat.name : <span>{cat.name.slice(0, at)}<b className="font-extrabold text-gold-800">{cat.name.slice(at, at + term.length)}</b>{cat.name.slice(at + term.length)}</span>}
      </button>
    )
  }
  const label = (words: string, first: boolean) => (
    <p className={'mx-2.5 mb-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-muted ' + (first ? 'mt-1.5' : 'mt-2.5 pt-2 border-t border-soft')}>{words}</p>
  )

  return (
    <div role="dialog" aria-label="What it was for"
      className="absolute left-0 top-full mt-1 z-10 w-[240px] bg-card rounded-xl shadow-softLg ring-1 ring-gold-100 overflow-hidden [animation:bp-slide_.22s_cubic-bezier(.16,1,.3,1)]">
      <label className="flex items-center gap-2 m-1.5 px-2.5 rounded-lg bg-page text-muted focus-within:ring-[1.5px] focus-within:ring-gold-400 transition-shadow">
        <Search className="w-3.5 h-3.5 shrink-0" />
        <input autoFocus value={find} onChange={e => setFind(e.target.value)} placeholder="Search, e.g. gas" aria-label="Search what it was for"
          onKeyDown={e => {
            if (e.key === 'Enter' && hits[0]) onPick(hits[0].id)
            if (e.key === 'Escape') onClose()
          }}
          className="flex-1 min-w-0 h-9 bg-transparent outline-none text-[16px] md:text-[13px] text-main placeholder:text-paper-400" />
      </label>
      <div role="listbox" onScroll={e => setScrolled(e.currentTarget.scrollTop > 2)}
        className={'max-h-[240px] overflow-y-auto overscroll-contain px-1.5 pb-1.5 border-t transition-colors ' + (scrolled ? 'border-soft' : 'border-transparent')}>
        {term ? (
          hits.length ? hits.map(item) : <p className="mx-2.5 my-2.5 text-[12px] text-muted [animation:bp-slide_.25s_both]">Nothing called “{find.trim()}”</p>
        ) : (
          <>
            {label('Most used', true)}
            {categories.slice(0, 5).map(item)}
            {categories.length > 5 && label('The rest', false)}
            {categories.slice(5).map((c, i) => item(c, i + 5))}
          </>
        )}
      </div>
    </div>
  )
}

// The bill's blanks: a line to write on, no boxes (the owner, 2026-10-27: it should feel like
// adding information on paper, the way the bill takes a payment).
const SLOT = 'min-w-0 bg-transparent border-0 border-b-[1.5px] border-ink-900 rounded-none px-0.5 py-px text-[16px] md:text-[14px] font-semibold text-ink-900 placeholder:text-paper-400 placeholder:font-medium focus:outline-none focus:border-gold-400 transition-colors'

// A new expense is written on a blank line at the end of Money out, like "Write a payment" on
// the bill (the owner's pick of the drawings, 2026-10-27), closed until it is wanted. It is
// filled in the order it goes on paper: what for (the list opens first), a note, the amount, ✓.
// The line clears at once and the next one is ready with its list open; the save happens
// behind it, and the line comes back filled in if it fails.
function ExpenseBlank({ categories, another, pastDay, onAdd }: {
  categories: ExpenseCategory[]
  another: boolean
  pastDay?: string
  onAdd: DayMoneyProps['onAdd']
}) {
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [notes, setNotes] = useState('')
  const [amount, setAmount] = useState('')
  const [tried, setTried] = useState(false)
  const line = useRef<HTMLDivElement>(null)
  const noteRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!picking) return
    const away = (e: PointerEvent) => { if (!line.current?.contains(e.target as Node)) setPicking(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [picking])

  const value = parseFloat(amount) || 0
  const problem = !tried ? '' : !categoryId ? 'Pick what it was for.' : value <= 0 ? 'Write the amount.' : ''
  const name = categories.find(c => c.id === categoryId)?.name

  const shut = () => { setOpen(false); setPicking(false); setTried(false) }
  const write = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!categoryId || value <= 0) return
    const kept = { categoryId, notes, amount }
    setCategoryId(''); setNotes(''); setAmount(''); setTried(false); setPicking(true)
    onAdd({ amount: value, categoryId: kept.categoryId, notes: kept.notes.trim() || undefined }).catch(() => {
      setCategoryId(kept.categoryId); setNotes(kept.notes); setAmount(kept.amount); setPicking(false)
    })
  }
  const typeAmount = (raw: string) => {
    let s = raw.replace(/[^0-9.]/g, '')
    const dot = s.indexOf('.')
    if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '')
    setAmount(s)
  }

  if (!open) {
    return (
      <button type="button" onClick={() => { setOpen(true); setPicking(true) }}
        className="w-full mt-1.5 flex items-center gap-1.5 px-2 py-[5px] rounded-md border-[1.5px] border-dashed border-ink-200 text-[11px] font-bold text-gold-800 hover:border-gold-400 hover:bg-gold-100/40 active:scale-[0.99] transition-[background-color,border-color,transform] cursor-pointer [animation:bp-slide_.25s_cubic-bezier(.16,1,.3,1)]">
        <Plus aria-hidden="true" className="w-3.5 h-3.5" />{another ? 'Another expense' : 'Write an expense'}{pastDay ? ' for ' + pastDay : ''}
      </button>
    )
  }

  return (
    <div ref={line} className="relative mt-1 pt-1 pb-0.5 [animation:bp-slide_.25s_cubic-bezier(.16,1,.3,1)]"
      onKeyDown={e => { if (e.key === 'Escape' && !picking) shut() }}>
      <form onSubmit={write} className="flex items-end gap-2">
        <button type="button" aria-expanded={picking} aria-label="What it was for" onClick={() => setPicking(p => !p)}
          className={'group shrink-0 inline-flex items-center gap-0.5 min-h-7 px-0.5 border-b-[1.5px] border-dashed border-gold-400 text-[12px] font-bold active:scale-95 transition-transform cursor-pointer ' + (name ? 'text-ink-900' : 'text-gold-800')}>
          <span key={name} className="inline-block [animation:bp-slide_.25s_cubic-bezier(.16,1,.3,1)]">{name || 'What for?'}</span>
          <ChevronDown aria-hidden="true" className="w-3 h-3 text-gold-600 transition-transform duration-300 group-aria-expanded:rotate-180" />
        </button>
        <input ref={noteRef} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note, e.g. for Ana" aria-label="Note"
          // Enter on the note moves on to the amount, as the pen would.
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); amountRef.current?.focus() } }}
          className={SLOT + ' flex-1'} />
        <label className="flex items-baseline gap-0.5 border-b-2 border-ink-900 focus-within:border-gold-400 transition-colors">
          <span className="font-display text-[11px] font-extrabold text-muted">₱</span>
          <input ref={amountRef} inputMode="decimal" value={amount} onChange={e => typeAmount(e.target.value)} placeholder="250" aria-label="Amount spent"
            className="min-w-0 w-[72px] bg-transparent border-0 p-0 text-right font-display text-[16px] font-extrabold text-ink-900 placeholder:text-paper-400 focus:outline-none" />
        </label>
        <button type="submit" aria-label="Write the expense" className="shrink-0 w-[30px] h-7 grid place-items-center rounded-lg bg-ink-900 hover:bg-ink-700 text-white active:scale-90 transition-[background-color,transform] cursor-pointer">
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
        </button>
        <button type="button" onClick={shut} aria-label="Close" className="shrink-0 w-6 h-7 grid place-items-center rounded-md text-muted hover:text-main hover:bg-page cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </form>
      {(problem || pastDay) && (
        <p role={problem ? 'alert' : undefined} className={'mt-1 text-[10px] font-semibold ' + (problem ? 'text-danger-600 [animation:bp-slide_.25s]' : 'text-muted')}>
          {problem || 'Spent on ' + pastDay}
        </p>
      )}
      {picking && (
        <CategoryPicker categories={categories} chosen={categoryId} onClose={() => setPicking(false)}
          onPick={id => { setCategoryId(id); setPicking(false); setTimeout(() => noteRef.current?.focus()) }} />
      )}
    </div>
  )
}

const METHOD_DOT: Record<PaymentKind, string> = {
  cash: 'bg-emerald-600', gcash: 'bg-blue-700', bank: 'bg-ink-900', check: 'bg-paper-500', other: 'bg-paper-400',
}

// **One payment, read as its receipt** (design A of the Money in mock, Sebastian, 2026-10-28: "it's a
// payment receipt and for some reason it say OS"): who paid and where on top with the amount; what
// for, how and when beneath with the receipt number. An order slip's number shows only on a diner's
// payment, in gold like the restaurant's. A room's payment opens its bill right here, ready to
// work on; a diner's opens its receipt, which reads its lines first, so the row shows it is on its way.
function PaymentLine({ line, loading, onOpen }: { line: MoneyInLine; loading: boolean; onOpen?: (line: MoneyInLine) => void }) {
  const what = line.purpose || (line.slip ? 'Order slip' : '')
  const body = (
    <>
      <span className="min-w-0 truncate font-bold text-main">
        {line.who}
        {line.place && (
          <span className={'ml-1.5 inline-block align-[1px] px-1.5 rounded-md text-[10.5px] font-extrabold ' + (line.slip ? 'bg-gold-100 text-gold-800' : 'bg-paper-100 text-main')}>{line.place}</span>
        )}
      </span>
      <span className="flex items-center justify-end gap-1.5">
        {loading && <Loader2 className="w-3.5 h-3.5 text-gold-600 animate-spin" />}
        <span className="font-mono text-[14px] font-bold text-emerald-600">{peso(line.amount)}</span>
      </span>
      <span className="min-w-0 truncate text-[12px] text-muted">
        {what && <>{what} · </>}
        <span className="inline-flex items-center gap-1"><i className={'w-1.5 h-1.5 rounded-full ' + METHOD_DOT[paymentKind(line.method)]} />{line.method}</span>
        {line.paidAt && <> · {timeOf(line.paidAt)}</>}
      </span>
      <span className="justify-self-end font-mono text-[11px] text-muted">{line.receipt}</span>
    </>
  )
  const grid = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-1.5 -mx-2 px-2 rounded-lg text-[13px] text-left'
  return onOpen && openKey(line) ? (
    <button type="button" onClick={() => onOpen(line)} aria-busy={loading}
      className={grid + ' w-[calc(100%+1rem)] hover:bg-page active:scale-[.985] transition-[background-color,transform] cursor-pointer' + (loading ? ' bg-page' : '')}>
      {body}
    </button>
  ) : <div className={grid}>{body}</div>
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

// The day on screen, in the order the printed sheet reads: money in, money out, and
// the money in the hotel at the bottom. Money in is read-only here — it comes from the receipts
// recorded on bookings and at the restaurant — and money out is the list just typed. A payment
// written on a booking opens that guest's billing statement (Sebastian, 2026-10-28).
export function DayMoney({ report, dayExpenses, categories, onRemove, onChange, dayHandovers, onTakeBack, onAdd, pastDay, footer, onOpenPayment, opening }: DayMoneyProps) {
  const nameOf = (id: string) => categories.find(c => c.id === id)?.name || 'Other'

  return (
    <div className="bg-card border border-soft rounded-xl shadow-soft">
      <div className="grid md:grid-cols-2 md:divide-x divide-soft">
        <div className="p-4 flex flex-col">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Money in</p>
          {report.moneyIn.length === 0 && <p className="text-[13px] text-muted">Nothing received yet.</p>}
          {report.moneyIn.map((line, i) => (
            <PaymentLine key={(line.receipt || line.label) + i} line={line} loading={!!opening && opening === openKey(line)} onOpen={onOpenPayment} />
          ))}
          {/* The totals sit on the same line at the foot of both columns, however long either list is (Sebastian, 2026-10-27). */}
          <div className="flex-1 min-h-2" />
          <div className="flex justify-between items-baseline gap-3 border-t border-soft pt-2 text-[14px] font-extrabold">
            <span className="text-main">Total in</span>
            <span className="font-mono text-[18px] text-emerald-600">{peso(report.totalIn)}</span>
          </div>
        </div>

        <div className="p-4 flex flex-col border-t md:border-t-0 border-soft">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Money out</p>
          {dayExpenses.length === 0 && <p className="text-[13px] text-muted">Nothing spent yet.</p>}
          {byCategory(dayExpenses).map(group => group.length > 1 ? (
            <ExpenseGroup key={group[0].category_id} expenses={group} categories={categories} nameOf={nameOf} onRemove={onRemove} onChange={onChange} />
          ) : (
            <ExpenseLine key={group[0].id} expense={group[0]} categories={categories} nameOf={nameOf} onRemove={onRemove} onChange={onChange} />
          ))}
          <ExpenseBlank key={report.date} categories={categories} another={dayExpenses.length > 0} pastDay={pastDay} onAdd={onAdd} />
          {/* The totals sit on the same line at the foot of both columns, however long either list is (Sebastian, 2026-10-27). */}
          <div className="flex-1 min-h-2" />
          <div className="flex justify-between items-baseline gap-3 border-t border-soft pt-2 text-[14px] font-extrabold">
            <span className="text-main">Total out</span>
            <span key={report.totalOut} className="font-mono text-[18px] text-danger-600 inline-block [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]">{peso(report.totalOut)}</span>
          </div>
        </div>
      </div>

      {/* THE SUMMARY, line for line as the staff write it on paper (their sheet, 2026-10-13):
          Cash for today · Add: Cash balance forwarded · Cash on hand · Less: Expenses ·
          Less: Cash remitted · Total cash on hand. The hotel's money does not start again at
          zero each morning, so the day before is carried in. Each figure keeps the colour it has
          above — money in green, money out red — and a hand-over is gold, so it is not read as
          money spent. */}
      <div className="px-4 py-3 border-t-2 border-ink-800 bg-page rounded-b-xl text-[13px] text-main">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Summary</p>
        <div className="flex justify-between gap-3 py-0.5">
          <span>Total Sales</span>
          <span className="font-mono font-bold text-emerald-600">{peso(report.totalIn)}</span>
        </div>
        <div className="flex justify-between gap-3 py-0.5">
          <span><span className="text-muted">Add:</span> {forwardedLabel(report.date)}</span>
          <span className="font-mono font-bold">{signed(report.broughtForward)}</span>
        </div>
        {/* Cash put into the hotel, like a hand-over, is here only on the day it happened. */}
        {dayHandovers.filter(h => h.kind === 'in').map(added => (
          <div key={added.id} className="flex items-center justify-between gap-3 text-gold-800 [animation:bp-slide_.3s_cubic-bezier(.16,1,.3,1)]">
            <span className="min-w-0 truncate">
              <span className="opacity-80">Add:</span> Cash added
              {added.handed_by ? ' · by ' + added.handed_by : ''} · {timeOf(added.created_at)}
              {added.notes ? ' · ' + added.notes : ''}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onTakeBack(added)}
                className="min-h-[44px] px-2 text-[12px] font-bold underline underline-offset-2 hover:text-ink-900 transition-colors cursor-pointer"
              >
                Take back
              </button>
              <span className="font-mono font-bold">{peso(added.amount)}</span>
            </span>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-soft mt-1 pt-1.5 font-bold">
          <span>Cash on hand</span>
          <span className="font-mono">{signed(report.cashOnHand)}</span>
        </div>
        <div className="flex justify-between gap-3 py-0.5 mt-0.5">
          <span>Total Expenses</span>
          <span className="font-mono font-bold text-danger-600">({peso(report.totalOut)})</span>
        </div>
        {/* A hand-over is rare, so its line is here only on the day it happened. */}
        {dayHandovers.filter(h => h.kind !== 'in').map(handover => (
          <div key={handover.id} className="flex items-center justify-between gap-3 text-gold-800 [animation:bp-slide_.3s_cubic-bezier(.16,1,.3,1)]">
            <span className="min-w-0 truncate">
              <span className="opacity-80">Less:</span> Cash remitted
              {handover.handed_by ? ' · by ' + handover.handed_by : ''} · {timeOf(handover.created_at)}
              {handover.notes ? ' · ' + handover.notes : ''}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onTakeBack(handover)}
                className="min-h-[44px] px-2 text-[12px] font-bold underline underline-offset-2 hover:text-ink-900 transition-colors cursor-pointer"
              >
                Take back
              </button>
              <span className="font-mono font-bold">({peso(handover.amount)})</span>
            </span>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-soft mt-2 pt-2.5">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.14em]">Total cash on hand</span>
          <span className={'font-mono text-[26px] font-extrabold leading-none ' + (report.balance < 0 ? 'text-danger-600' : 'text-emerald-600')}>
            {report.balance < 0 && '('}<CountPeso value={Math.abs(report.balance)} />{report.balance < 0 && ')'}
          </span>
        </div>
        {footer && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-soft mt-3 pt-2.5">{footer}</div>}
      </div>
    </div>
  )
}
