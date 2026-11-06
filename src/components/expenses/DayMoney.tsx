import { CSSProperties, FormEvent, ReactNode, createElement, useCallback, useEffect, useRef, useState } from 'react'
import { Banknote, BedDouble, Check, ChevronDown, Droplet, Fuel, HandCoins, House, Loader2, PenLine, Pencil, Plus, Receipt, Search, ShoppingBasket, Trees, Users, UtensilsCrossed, Wrench, X, Zap, type LucideIcon } from 'lucide-react'
import { Expense, ExpenseCategory, Handover } from '../../types/expense'
import { CountPeso } from '../CountPeso'
import { NewTag } from '../NewMark'
import { markSeen } from '../../utils/newMarks'
import { PaymentEdit } from './PaymentEdit'
import { ExpenseEdit, type ExpenseChange } from './ExpenseEdit'
import type { PaymentPatch } from '../walk-in/bookingPayment'
import { DailyReport, MoneyInLine, forwardedLabel, openKey } from '../../utils/dailyReport'
import { PAYMENT_METHODS, PaymentKind, methodNeedsReference, paymentKind } from '../../utils/paymentMethod'
import { peso } from '../../utils/helpers'


// The day's expenses in groups of one category, each group where its first expense was.
const byCategory = (list: Expense[]) => {
  const groups = new Map<string, Expense[]>()
  list.forEach(e => { const g = groups.get(e.category_id); if (g) g.push(e); else groups.set(e.category_id, [e]) })
  return [...groups.values()]
}

// The day's payments in groups of one bill (design B of the Money in mock, Sebastian, 2026-10-29: "group up
// the payments from the same billing statement like how we grouped the expenses"), each group where its
// first payment was. A diner's slips are grouped by their table the same way (Sebastian, 2026-11-06: "if
// it's for the same table, then keep them grouped") — a slip with no table and money in written by hand
// stand alone.
const groupKey = (l: MoneyInLine, i: number) =>
  l.bill ? 'b:' + l.bill : l.slip && l.place && l.who && l.who !== 'Order slip' ? 't:' + l.who : 'x:' + i
const byBill = (list: MoneyInLine[]) => {
  const groups = new Map<string, MoneyInLine[]>()
  list.forEach((l, i) => { const k = groupKey(l, i); const g = groups.get(k); if (g) g.push(l); else groups.set(k, [l]) })
  return [...groups.entries()]
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
  onChange: (expense: Expense, change: ExpenseChange) => void
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
  /** The bills a payment can be written on, newest first. */
  bills: BillChoice[]
  /** Saves money in written by hand: a restaurant sale, or a payment on a booking's bill. */
  onAddIn: (input: MoneyInInput) => Promise<void>
  /** Saves a fix to one payment; shown at once. `label` renames plain money in. */
  onFixPayment: (line: MoneyInLine, patch: PaymentPatch, label?: string) => void
  /** Takes one payment back off; gone at once. */
  onRemovePayment: (line: MoneyInLine) => void
  /** The latest day a payment can be moved to. */
  today: string
}

/** The pencil's state, handed down to each payment line. */
interface PaymentEditing {
  editing: string | null
  fresh: string | null
  onEdit: (key: string | null) => void
  onSave: DayMoneyProps['onFixPayment']
  onRemove: DayMoneyProps['onRemovePayment']
}

/** An expense's pencil, handed down the same way; its key shares the payments' one slip at a time. */
interface ExpenseEditing {
  editing: string | null
  fresh: string | null
  onEdit: (key: string | null) => void
  onSave: (expense: Expense, change: ExpenseChange) => void
  onRemove: (expense: Expense) => void
  categories: ExpenseCategory[]
  nameOf: (id: string) => string
  today: string
}

const lineKey = (line: MoneyInLine) => line.receipt + '|' + line.recordId

/** A bill to write a payment on: its first room's booking, and how it reads in the search. */
export interface BillChoice {
  id: string
  who: string
  /** `Room 8`, `Rooms 2, 3`, `Vacation House`. */
  place: string
  /** `Oct 12–14`. */
  when: string
  bill: string
}

export interface MoneyInInput {
  /** Restaurant, a booking, or plain: money in linked to nothing. */
  kind: 'restaurant' | 'booking' | 'plain'
  /** The bill's first booking, for a booking's payment. */
  billId?: string
  note: string
  amount: number
  method: string
  reference?: string
}

// How a line reads (C of the money lines mock, Sebastian, 2026-11-03): a sign for what kind it is on the
// left, the one thing to read first in bold, the amount as the loudest figure, and the codes and times
// faint in the corner. The pencil waits for the pointer on a PC; on a tablet it is always there.
const TILE = 'row-span-2 w-[34px] h-[34px] grid place-items-center rounded-[11px]'
const LINE = 'grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2 -mx-2 px-2 rounded-lg text-[13px]'
const AMOUNT = 'font-display font-extrabold tabular-nums inline-block'
const PEN = 'w-7 h-7 -my-1 -mr-1 grid place-items-center rounded-lg text-gold-800 hover:bg-gold-100 aria-expanded:bg-gold-100 active:scale-[.85] active:-rotate-[8deg] mouse:opacity-0 mouse:group-hover/line:opacity-100 mouse:focus-visible:opacity-100 mouse:aria-expanded:opacity-100 transition-[opacity,background-color,transform] cursor-pointer'

/** A name typed in capitals reads in ordinary case; one typed any other way is left as it is. */
const soft = (s: string) => (s && s === s.toUpperCase() && /[A-Z]/.test(s) ? { text: s.toLowerCase(), cls: ' capitalize' } : { text: s, cls: '' })

// A sign for what the money went on, read from the category's own name; anything else is a receipt.
const SPEND_ICONS: [RegExp, LucideIcon][] = [
  [/salar|wage|payroll/i, Users], [/advance|vale/i, HandCoins], [/electric|power|meralco/i, Zap], [/water/i, Droplet],
  [/gas|fuel|lpg|diesel/i, Fuel], [/repair|mainten/i, Wrench], [/resto|food|kitchen|market|grocer/i, ShoppingBasket],
]
const spendIcon = (name: string) => SPEND_ICONS.find(([re]) => re.test(name))?.[1] || Receipt
/** A line's sign, drawn from the icon its kind was given. */
const sign = (Icon: LucideIcon) => createElement(Icon, { 'aria-hidden': true, className: 'w-[17px] h-[17px]' })

// One expense, drawn like a payment in Money in (B of the Money out mock, Sebastian, 2026-11-03: "make
// the expenses consistent with the design similar to the money in"). The note leads, the category is
// second and the time last (Sebastian, 2026-11-03: "the note should be the primary focus, category is
// 2nd, everything else is tertiary"). The pencil opens the same small slip a payment has (`ExpenseEdit`).
// Inside a group the category is said once above, so a line there is its note and its time.
function ExpenseLine({ expense, time, edit }: {
  expense: Expense
  /** Inside a merged line: when it was written, so the repeats can be told apart. */
  time?: string
  edit: ExpenseEditing
}) {
  const key = 'x:' + expense.id
  const editing = edit.editing === key
  const fresh = edit.fresh === key
  const at = expense.created_at ? new Date(expense.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  const note = soft((expense.notes || '').trim())
  const name = edit.nameOf(expense.category_id)
  const Icon = spendIcon(name)
  const amount = <span key={expense.amount} className={'justify-self-end text-danger-600 ' + AMOUNT + (time ? ' text-[14px]' : ' text-[16px]') + (fresh ? ' [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]' : '')}>{peso(expense.amount)}</span>
  const pen = (
    <button type="button" data-pay-pen aria-label={'Edit this expense, ' + peso(expense.amount)} aria-expanded={editing}
      onClick={e => { e.stopPropagation(); edit.onEdit(editing ? null : key) }}
      className={'justify-self-end ' + PEN}>
      <Pencil aria-hidden="true" className="w-3.5 h-3.5" />
    </button>
  )
  return (
    <div className={editing ? 'relative z-20' : 'relative'}>
      {time ? (
        <div className={'group/line relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-1.5 -mx-2 px-2 rounded-lg text-[13px] transition-colors' + (editing ? ' bg-page' : '') + (fresh ? ' [animation:ex-saved_.9s_ease-out]' : '')}>
          <span className={'min-w-0 truncate font-semibold text-main' + note.cls}>{note.text || 'Expense'}</span>
          {amount}
          <span className="min-w-0 truncate text-[12px] text-muted">{time}</span>
          {pen}
        </div>
      ) : (
        <div className={'group/line relative ' + LINE + ' transition-colors' + (editing ? ' bg-page' : '') + (fresh ? ' [animation:ex-saved_.9s_ease-out]' : '')}>
          <span className={TILE + ' bg-danger-50 text-danger-600'}>{sign(Icon)}</span>
          <span className={'min-w-0 truncate text-[13.5px] font-bold text-main' + note.cls}>{note.text || name}</span>
          {amount}
          <span className="min-w-0 truncate text-[12px] text-muted">
            {note.text && <span className="font-bold text-ink-600">{name}</span>}{note.text && at && ' · '}{at}
          </span>
          {pen}
        </div>
      )}
      {editing && (
        <ExpenseEdit expense={expense} categories={edit.categories} nameOf={edit.nameOf} today={edit.today}
          onClose={() => edit.onEdit(null)} onSave={change => edit.onSave(expense, change)} onRemove={() => edit.onRemove(expense)} />
      )}
    </div>
  )
}

/** How many a merged line holds, in words and quiet, so the amount stays the only coloured figure on it. */
const ItemCount = ({ n }: { n: number }) => (
  <span key={n} className="ml-1.5 inline-block text-[12.5px] font-semibold text-muted [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]">· {n} items</span>
)

// The same thing bought again and again is one line with how many times (Sebastian, 2026-10-28:
// "if theres repeat expenses just merge them and show how many times it's merged"; design A of
// the mock). It sits where the first one was, and a tap opens every one of them below it, each
// with its own pencil. Its title is what it was for and how many (Sebastian, 2026-11-06: "the grouped
// title should just be the category and how many items there are", option B of the mock): the notes
// joined together made the title longer with every repeat, so they live in the opened rows only.
function ExpenseGroup({ expenses, edit }: { expenses: Expense[]; edit: ExpenseEditing }) {
  const [open, setOpen] = useState(false)
  const name = edit.nameOf(expenses[0].category_id)
  const Icon = spendIcon(name)
  const sum = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  // The slip floats past the end of the group, so while it is up the group does not clip it.
  const floating = expenses.some(e => edit.editing === 'x:' + e.id)
  const timeOf = (e: Expense) => e.created_at ? new Date(e.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  const times = expenses.map(timeOf).filter(Boolean)
  const span = times.length > 1 ? times[0] + '–' + times[times.length - 1] : times[0]
  const title = soft(name)
  return (
    <div>
      <button type="button" onClick={() => { setOpen(o => !o); markSeen('group-items') }} aria-expanded={open}
        className={'group relative ' + LINE + ' w-[calc(100%+1rem)] text-left hover:bg-page aria-expanded:bg-page active:scale-[.985] transition-[background-color,transform] cursor-pointer'}>
        <span className={TILE + ' bg-danger-50 text-danger-600'}>{sign(Icon)}</span>
        <NewTag id="group-items" />
        <span className="min-w-0 truncate text-[13.5px] font-bold text-main">
          <span className={title.cls}>{title.text}</span>
          <ItemCount n={expenses.length} />
        </span>
        <span className="flex items-center justify-end gap-1.5">
          <span key={sum} className={'text-[16px] text-danger-600 ' + AMOUNT + ' [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]'}>{peso(sum)}</span>
          <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-gold-600 transition-transform duration-[350ms] ease-[cubic-bezier(.34,1.4,.64,1)] group-aria-expanded:rotate-180" />
        </span>
        <span className="col-span-2 min-w-0 truncate text-[12px] text-muted">
          {span}
        </span>
      </button>
      <div className={'grid transition-[grid-template-rows] duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)] ' + (open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className={'min-h-0 ' + (floating ? 'overflow-visible' : 'overflow-hidden')}>
          <div className="ml-[17px] mb-1 pl-[27px] border-l-2 border-paper-200">
            {expenses.map((expense, i) => (
              <div key={expense.id} className={(open ? 'bw-rise ' : '') + (edit.editing === 'x:' + expense.id ? 'relative z-20' : '')} style={{ '--i': i } as CSSProperties}>
                <ExpenseLine expense={expense} time={timeOf(expense)} edit={edit} />
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

// The floating list under a blank line's first word, the same as the expense's "What for?" list.
const POP = 'absolute left-0 top-full mt-1 z-10 bg-card rounded-xl shadow-softLg ring-1 ring-gold-100 overflow-hidden [animation:bp-slide_.22s_cubic-bezier(.16,1,.3,1)]'
const OPT = 'bp-row flex items-center gap-2.5 w-full min-h-[44px] px-2.5 rounded-lg text-left text-[13px] font-bold text-main hover:bg-gold-100 active:scale-[.97] transition-[background-color,transform] cursor-pointer'

// **Money in written by hand** (#19, option A of the mock, Sebastian, 2026-10-30: "Since the
// restaurant isn't fully done yet, we need an alternative method of adding restaurant orders, and
// also add a way to just log the old booking's payments"). One blank line at the end of Money in,
// the expense's twin: what it was for, linked if it belongs somewhere (the restaurant, or a booking found by guest,
// room or bill number), the amount, ✓, and how it was paid beneath. The line clears at
// once and the next is ready; the save happens behind it, and it comes back filled in if it fails.
// Linking it is optional (Sebastian, 2026-10-30: "if there isn't a booking for a payment, it should just be a
// normal payment"): the line opens on what it was for, and with nothing linked it is plain money in.
function MoneyInBlank({ bills, pastDay, onAddIn }: { bills: BillChoice[]; pastDay?: string; onAddIn: DayMoneyProps['onAddIn'] }) {
  const [open, setOpen] = useState(false)
  const [pop, setPop] = useState<'kind' | 'bill' | null>(null)
  const [kind, setKind] = useState<'restaurant' | 'booking' | null>(null)
  const [billId, setBillId] = useState('')
  const [find, setFind] = useState('')
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<string>('Cash')
  const [reference, setReference] = useState('')
  const [tried, setTried] = useState(false)
  const line = useRef<HTMLDivElement>(null)
  const noteRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!pop) return
    const away = (e: PointerEvent) => { if (!line.current?.contains(e.target as Node)) setPop(null) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [pop])

  const bill = bills.find(b => b.id === billId)
  const value = parseFloat(amount) || 0
  const needsRef = methodNeedsReference(method)
  const problem = !tried ? '' : kind === 'booking' && !bill ? 'Pick the booking.'
    : value <= 0 ? 'Write the amount.' : needsRef && !reference.trim() ? 'Write the ref no.' : ''
  const term = find.trim().toLowerCase()
  const hits = bills.filter(b => (b.who + ' ' + b.place + ' ' + b.bill).toLowerCase().includes(term)).slice(0, 8)

  const shut = () => { setOpen(false); setPop(null); setTried(false) }
  const pickKind = (k: 'restaurant' | 'booking' | null) => {
    setKind(k)
    if (k === 'booking') { setFind(''); setPop('bill') } else { setBillId(''); setPop(null); setTimeout(() => noteRef.current?.focus()) }
  }
  const write = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if ((kind === 'booking' && !bill) || value <= 0 || (needsRef && !reference.trim())) return
    const kept = { kind, billId, note, amount, method, reference }
    setKind(null); setBillId(''); setNote(''); setAmount(''); setReference(''); setTried(false); setPop(null)
    setTimeout(() => noteRef.current?.focus())
    onAddIn({ kind: kept.kind || 'plain', billId: kept.billId || undefined, note: kept.note.trim(), amount: value, method: kept.method, reference: needsRef ? kept.reference.trim() : undefined }).catch(() => {
      setKind(kept.kind); setBillId(kept.billId); setNote(kept.note); setAmount(kept.amount); setMethod(kept.method); setReference(kept.reference); setPop(null)
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
      <button type="button" onClick={() => { setOpen(true); setTimeout(() => noteRef.current?.focus()) }}
        className="w-full mt-1.5 flex items-center gap-1.5 px-2 py-[5px] rounded-md border-[1.5px] border-dashed border-ink-200 text-[11px] font-bold text-gold-800 hover:border-gold-400 hover:bg-gold-100/40 active:scale-[0.99] transition-[background-color,border-color,transform] cursor-pointer [animation:bp-slide_.25s_cubic-bezier(.16,1,.3,1)]">
        <Plus aria-hidden="true" className="w-3.5 h-3.5" />Write money in{pastDay ? ' for ' + pastDay : ''}
      </button>
    )
  }

  const word = kind === 'restaurant' ? 'Restaurant' : kind === 'booking' ? (bill ? bill.who : 'Which booking?') : 'Link'
  const set = kind === 'restaurant' || !!bill

  return (
    <div ref={line} className="relative mt-1 pt-1 pb-0.5 [animation:bp-slide_.25s_cubic-bezier(.16,1,.3,1)]"
      onKeyDown={e => { if (e.key === 'Escape') { if (pop) setPop(null); else shut() } }}>
      {kind === 'booking' && bill && (
        <div key={bill.id} className="flex items-center gap-1.5 mb-1 [animation:bp-slide_.25s_cubic-bezier(.16,1,.3,1)]">
          <span className="px-1.5 rounded-md bg-paper-100 text-[10.5px] font-extrabold text-main">{bill.place}</span>
          <span className="px-1 rounded-md border border-paper-200 font-mono text-[10.5px] font-semibold text-muted">{bill.bill}</span>
        </div>
      )}
      <form onSubmit={write} className="flex items-end gap-2">
        <button type="button" aria-expanded={!!pop} aria-label="Where it came from"
          onClick={() => setPop(p => (p ? null : kind === 'booking' ? 'bill' : 'kind'))}
          className={'group shrink-0 max-w-[40%] inline-flex items-center gap-0.5 min-h-7 px-0.5 border-b-[1.5px] border-dashed border-gold-400 text-[12px] font-bold active:scale-95 transition-transform cursor-pointer ' + (set ? 'text-ink-900' : 'text-gold-800')}>
          <span key={word} className="truncate [animation:bp-slide_.25s_cubic-bezier(.16,1,.3,1)]">{word}</span>
          <ChevronDown aria-hidden="true" className="w-3 h-3 shrink-0 text-gold-600 transition-transform duration-300 group-aria-expanded:rotate-180" />
        </button>
        <input ref={noteRef} value={note} onChange={e => setNote(e.target.value)} aria-label="What it was for"
          placeholder={kind === 'booking' ? 'For, e.g. Balance' : kind ? 'e.g. Table 2 · 2 pancit, 1 coke' : 'What for, e.g. Sold old bedsheets'}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); amountRef.current?.focus() } }}
          className={SLOT + ' flex-1'} />
        <label className="flex items-baseline gap-0.5 border-b-2 border-ink-900 focus-within:border-gold-400 transition-colors">
          <span className="font-display text-[11px] font-extrabold text-muted">₱</span>
          <input ref={amountRef} inputMode="decimal" value={amount} onChange={e => typeAmount(e.target.value)} aria-label="Amount received"
            placeholder={kind === 'booking' ? '1,200' : kind ? '350' : '500'}
            className="min-w-0 w-[72px] bg-transparent border-0 p-0 text-right font-display text-[16px] font-extrabold text-ink-900 placeholder:text-paper-400 focus:outline-none" />
        </label>
        <button type="submit" aria-label="Write the money in" className="shrink-0 w-[30px] h-7 grid place-items-center rounded-lg bg-ink-900 hover:bg-ink-700 text-white active:scale-90 transition-[background-color,transform] cursor-pointer">
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
        </button>
        <button type="button" onClick={shut} aria-label="Close" className="shrink-0 w-6 h-7 grid place-items-center rounded-md text-muted hover:text-main hover:bg-page cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {PAYMENT_METHODS.map(m => (
          <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-full ring-1 ring-inset ring-paper-200 text-[11px] font-bold text-muted aria-pressed:ring-ink-900 aria-pressed:bg-ink-900 aria-pressed:text-white active:scale-95 transition-[background-color,color,box-shadow,transform] cursor-pointer">
            <i className={'w-1.5 h-1.5 rounded-full ' + METHOD_DOT[paymentKind(m)]} />{m}
          </button>
        ))}
        {needsRef && (
          <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Ref no. · e.g. 4012 3381 22" aria-label="Reference number"
            className={SLOT + ' w-[170px] text-[16px] md:text-[12px] [animation:bp-slide_.25s_cubic-bezier(.16,1,.3,1)]'} />
        )}
      </div>
      {(problem || pastDay) && (
        <p role={problem ? 'alert' : undefined} className={'mt-1 text-[10px] font-semibold ' + (problem ? 'text-danger-600 [animation:bp-slide_.25s]' : 'text-muted')}>
          {problem || 'Received on ' + pastDay}
        </p>
      )}
      {pop === 'kind' && (
        <div role="dialog" aria-label="Where it came from" className={POP + ' w-[240px] p-1.5'}>
          <button type="button" style={{ '--i': 0 } as CSSProperties} onClick={() => pickKind('restaurant')} className={OPT}>
            <span className="w-8 h-8 shrink-0 grid place-items-center rounded-lg bg-gold-100 text-gold-800"><UtensilsCrossed className="w-4 h-4" /></span>
            <span>Restaurant<small className="block text-[11px] font-medium text-muted">Food or drinks paid</small></span>
          </button>
          <button type="button" style={{ '--i': 1 } as CSSProperties} onClick={() => pickKind('booking')} className={OPT}>
            <span className="w-8 h-8 shrink-0 grid place-items-center rounded-lg bg-paper-100 text-main"><BedDouble className="w-4 h-4" /></span>
            <span>A booking<small className="block text-[11px] font-medium text-muted">Paid on a room or venue</small></span>
          </button>
          {kind && (
            <button type="button" style={{ '--i': 2 } as CSSProperties} onClick={() => pickKind(null)} className={OPT}>
              <span className="w-8 h-8 shrink-0 grid place-items-center rounded-lg bg-page text-muted"><X className="w-4 h-4" /></span>
              <span>Nothing<small className="block text-[11px] font-medium text-muted">Just money in</small></span>
            </button>
          )}
        </div>
      )}
      {pop === 'bill' && (
        <div role="dialog" aria-label="Find the booking" className={POP + ' w-[290px] max-w-[calc(100vw-3rem)]'}>
          <label className="flex items-center gap-2 m-1.5 px-2.5 rounded-lg bg-page text-muted focus-within:ring-[1.5px] focus-within:ring-gold-400 transition-shadow">
            <Search className="w-3.5 h-3.5 shrink-0" />
            <input autoFocus value={find} onChange={e => setFind(e.target.value)} placeholder="Guest, room or GRF-…" aria-label="Find the booking"
              onKeyDown={e => { if (e.key === 'Enter' && hits[0]) { e.preventDefault(); setBillId(hits[0].id); setPop(null); setTimeout(() => noteRef.current?.focus()) } }}
              className="flex-1 min-w-0 h-9 bg-transparent outline-none text-[16px] md:text-[13px] text-main placeholder:text-paper-400" />
          </label>
          <div role="listbox" className="max-h-[260px] overflow-y-auto overscroll-contain px-1.5 pb-1.5">
            {hits.length ? hits.map((b, i) => (
              <button key={b.id} type="button" role="option" aria-selected={b.id === billId} style={{ '--i': i } as CSSProperties}
                onClick={() => { setBillId(b.id); setPop(null); setTimeout(() => noteRef.current?.focus()) }} className={OPT}>
                <span className="min-w-0">
                  <span className="block truncate">{b.who}</span>
                  <small className="block truncate text-[11px] font-medium text-muted">{b.place} · {b.when} · <span className="font-mono">{b.bill.slice(-4)}</span></small>
                </span>
              </button>
            )) : <p className="mx-2.5 my-2.5 text-[12px] text-muted [animation:bp-slide_.25s_both]">Nobody called “{find.trim()}”</p>}
          </div>
        </div>
      )}
    </div>
  )
}

const METHOD_DOT: Record<PaymentKind, string> = {
  cash: 'bg-emerald-600', gcash: 'bg-blue-700', bank: 'bg-ink-900', check: 'bg-paper-500', other: 'bg-paper-400',
}

// **One payment, read as its receipt** (design A of the Money in mock, Sebastian, 2026-10-28: "it's a
// payment receipt and for some reason it say OS"). What it paid for leads — the room, the venue, the
// restaurant — then who paid, and how they paid sits loud beside the amount (Sebastian, 2026-11-03:
// "the primary should be for what like garden area, room, or venue, secondary should be who or from
// what like name or table. payment type should be a bit louder"). A room's payment opens its bill
// right here, ready to work on; a diner's opens its receipt, which reads its lines first, so the row
// shows it is on its way. Inside a bill's group the room and guest are said once above, so a payment
// there leads with what it was for. A payment on a cancelled booking stays on the day it came in,
// scratched off with the day it was cancelled, and counts in no total (option B of the mock, Sebastian, 2026-10-29).
const cancelChip = (day: string) => (
  <span className="ml-1.5 inline-block align-[1px] px-1.5 rounded-full ring-1 ring-inset ring-danger-300 text-danger-600 text-[10.5px] font-extrabold dm-pop">
    Cancelled {new Date(day + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
  </span>
)

const PayPill = ({ method }: { method: string }) => (
  <span className="inline-flex items-center gap-[5px] h-[19px] pl-1.5 pr-2 rounded-full bg-paper-100 text-[11.5px] font-extrabold text-main whitespace-nowrap">
    <i className={'w-1.5 h-1.5 rounded-full ' + METHOD_DOT[paymentKind(method)]} />{method}
  </span>
)

/** What a payment leads with, who paid, and its sign. Plain money in written by hand is a slip with no number. */
function payHead(line: MoneyInLine): { title: string; who: string; Icon: LucideIcon; tone: string } {
  if (line.slip && line.place) return { title: 'Restaurant', who: line.who, Icon: UtensilsCrossed, tone: 'bg-gold-100 text-gold-800' }
  if (line.slip) return { title: line.purpose || 'Money in', who: line.who === 'Order slip' ? '' : line.who, Icon: Banknote, tone: 'bg-emerald-50 text-emerald-600' }
  const Icon = /^Rooms? /.test(line.place) ? BedDouble : /house|exclusive/i.test(line.place) ? House : Trees
  return { title: line.place || line.who, who: line.place ? line.who : '', Icon, tone: 'bg-paper-100 text-main' }
}

function PaymentLine({ line, loading, onOpen, inGroup, today, edit }: {
  line: MoneyInLine
  loading: boolean
  onOpen?: (line: MoneyInLine) => void
  inGroup?: boolean
  today: string
  edit: PaymentEditing
}) {
  const what = line.purpose || (line.slip && line.place ? 'Order slip' : '')
  const head = payHead(line)
  const who = soft(head.who)
  const key = lineKey(line)
  const editing = edit.editing === key
  // A scratched-off payment counts for nothing, so there is nothing to fix on it.
  const canEdit = !line.cancelled && !!line.recordId
  const fresh = edit.fresh === key
  const hand = line.hand && <PenLine aria-label="Written by hand" className="ml-1.5 inline-block align-[-1px] w-3 h-3 text-gold-600" />
  // What it was for and the slip's number, at the quiet end of the second line. Plain money in already leads with it.
  const rest = [line.slip && !line.place ? '' : what, line.slip ? line.place : ''].filter(Boolean).join(' · ')
  const body = (
    <>
      {line.cancelled && <i aria-hidden="true" className="dm-scratch" />}
      {inGroup ? (
        <span className="min-w-0 truncate font-semibold text-main">{(line.slip ? [line.place, line.purpose].filter(Boolean).join(' · ') : what) || 'Payment'}{hand}</span>
      ) : (
        <>
          <span className={TILE + ' ' + head.tone}>{sign(head.Icon)}</span>
          <span className="min-w-0 truncate text-[13.5px] font-bold text-main">
            {head.title}{hand}
            {line.cancelled && cancelChip(line.cancelled)}
          </span>
        </>
      )}
      <span className="flex items-center justify-end gap-2">
        {loading && <Loader2 className="w-3.5 h-3.5 text-gold-600 animate-spin" />}
        <PayPill method={line.method} />
        <span key={line.amount} className={AMOUNT + (inGroup ? ' text-[14px]' : ' text-[16px]') + (line.cancelled ? ' text-paper-400' : ' text-emerald-600') + (fresh ? ' [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]' : '')}>{peso(line.amount)}</span>
      </span>
      <span className="min-w-0 truncate text-[12px] text-muted">
        {inGroup ? (line.paidAt && timeOf(line.paidAt)) : (
          <>{who.text && <span className={'font-bold text-ink-600' + who.cls}>{who.text}</span>}{who.text && rest && ' · '}{rest}</>
        )}
      </span>
      <span className="justify-self-end flex items-center gap-1 font-mono text-[10.5px] text-paper-500">
        {!inGroup && line.paidAt && <>{timeOf(line.paidAt)} · </>}{line.receipt}
        {canEdit && (
          <button type="button" data-pay-pen aria-label={'Edit this payment, ' + peso(line.amount)} aria-expanded={editing}
            onClick={e => { e.stopPropagation(); edit.onEdit(editing ? null : key) }}
            className={PEN}>
            <Pencil aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
        )}
      </span>
    </>
  )
  const grid = 'group/line relative ' + (inGroup ? 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-1.5 -mx-2 px-2 rounded-lg text-[13px]' : LINE) + ' text-left' + (line.cancelled ? ' dm-struck' : '') + (fresh ? ' [animation:ex-saved_.9s_ease-out]' : '')
  // Not a <button>: the pencil is a button of its own and cannot sit inside one.
  const row = onOpen && openKey(line) ? (
    <div role="button" tabIndex={0} onClick={() => onOpen(line)} aria-busy={loading}
      onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(line) } }}
      className={grid + ' w-[calc(100%+1rem)] hover:bg-page active:scale-[.985] transition-[background-color,transform] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400' + (loading || editing ? ' bg-page' : '')}>
      {body}
    </div>
  ) : <div className={grid}>{body}</div>
  return (
    <div className={editing ? 'relative z-20' : 'relative'}>
      {row}
      {editing && <PaymentEdit line={line} today={today} onClose={() => edit.onEdit(null)} onSave={(patch, label) => edit.onSave(line, patch, label)} onRemove={() => edit.onRemove(line)} />}
    </div>
  )
}

// A bill's payments as one line with a count, opening to each payment (the expense group's shape).
function PaymentGroup({ lines, opening, onOpen, today, edit }: { lines: MoneyInLine[]; opening?: string | null; onOpen?: (line: MoneyInLine) => void; today: string; edit: PaymentEditing }) {
  const [open, setOpen] = useState(false)
  const first = lines[0]
  const head = payHead(first)
  const who = soft(head.who)
  // The slip floats past the end of the group, so while it is up the group does not clip it.
  const floating = lines.some(l => lineKey(l) === edit.editing)
  const whole = lines.reduce((s, l) => s + Number(l.amount || 0), 0)
  const sum = lines.reduce((s, l) => (l.cancelled ? s : s + Number(l.amount || 0)), 0)
  // A bill's payments share its booking, so a cancelled bill scratches off the whole group.
  const cancelled = lines.every(l => l.cancelled) ? first.cancelled : undefined
  const loading = !!opening && lines.some(l => openKey(l) === opening)
  return (
    <div>
      <button type="button" onClick={() => { setOpen(o => !o); markSeen('group-items') }} aria-expanded={open}
        className={'group relative ' + LINE + ' w-[calc(100%+1rem)] text-left hover:bg-page aria-expanded:bg-page active:scale-[.985] transition-[background-color,transform] cursor-pointer' + (cancelled ? ' dm-struck' : '')}>
        {cancelled && <i aria-hidden="true" className="dm-scratch group-aria-expanded:opacity-0" />}
        <span className={TILE + ' ' + head.tone}>{sign(head.Icon)}</span>
        <NewTag id="group-items" />
        <span className="min-w-0 truncate text-[13.5px] font-bold text-main">
          {head.title}
          <ItemCount n={lines.length} />
          {cancelled && cancelChip(cancelled)}
        </span>
        <span className="flex items-center justify-end gap-1.5">
          {loading && <Loader2 className="w-3.5 h-3.5 text-gold-600 animate-spin" />}
          <span key={sum} className={'text-[16px] ' + AMOUNT + (cancelled ? ' text-paper-400' : ' text-emerald-600') + ' [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]'}>{peso(cancelled ? whole : sum)}</span>
          <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-gold-600 transition-transform duration-[350ms] ease-[cubic-bezier(.34,1.4,.64,1)] group-aria-expanded:rotate-180" />
        </span>
        <span className="min-w-0 truncate text-[12px] text-muted">
          {who.text && <span className={'font-bold text-ink-600' + who.cls}>{who.text}</span>}{who.text && ' · '}{lines.map(l => (l.slip ? l.place : l.purpose) || 'Payment').join(' · ')}
        </span>
        <span className="justify-self-end font-mono text-[10.5px] text-paper-500">{first.bill}</span>
      </button>
      <div className={'grid transition-[grid-template-rows] duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)] ' + (open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className={'min-h-0 ' + (floating ? 'overflow-visible' : 'overflow-hidden')}>
          <div className="ml-[17px] mb-1 pl-[27px] border-l-2 border-paper-200">
            {lines.map((line, i) => (
              <div key={(line.receipt || line.label) + i} className={(open ? 'bw-rise ' : '') + (edit.editing === lineKey(line) ? 'relative z-20' : '')} style={{ '--i': i } as CSSProperties}>
                <PaymentLine line={line} inGroup today={today} edit={edit} loading={!!opening && opening === openKey(line)} onOpen={onOpen} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

// The day on screen, in the order the printed sheet reads: money in, money out, and
// the money in the hotel at the bottom. Money in comes from the receipts recorded on bookings and
// at the restaurant, plus what is written by hand on its blank line; money out is the list just typed. A payment
// written on a booking opens that guest's billing statement (Sebastian, 2026-10-28).
export function DayMoney({ report, dayExpenses, categories, onRemove, onChange, dayHandovers, onTakeBack, onAdd, pastDay, footer, onOpenPayment, opening, bills, onAddIn, onFixPayment, onRemovePayment, today }: DayMoneyProps) {
  const nameOf = (id: string) => categories.find(c => c.id === id)?.name || 'Other'

  // One payment's slip at a time; the line just fixed glows for a moment, on the day it stayed on.
  const [editing, setEditing] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  useEffect(() => {
    if (!fresh) return
    const id = window.setTimeout(() => setFresh(null), 1000)
    return () => window.clearTimeout(id)
  }, [fresh])
  const closeEdit = useCallback((key: string | null) => setEditing(key), [])
  const edit: PaymentEditing = {
    editing,
    fresh,
    onEdit: closeEdit,
    onSave: (line, patch, label) => {
      setEditing(null)
      setFresh(lineKey(line))
      onFixPayment(line, patch, label)
    },
    onRemove: line => {
      setEditing(null)
      onRemovePayment(line)
    },
  }
  const editExpense: ExpenseEditing = {
    editing,
    fresh,
    onEdit: closeEdit,
    onSave: (expense, change) => {
      setEditing(null)
      setFresh('x:' + expense.id)
      onChange(expense, change)
    },
    onRemove: expense => {
      setEditing(null)
      onRemove(expense)
    },
    categories,
    nameOf,
    today,
  }

  return (
    <div className="bg-card border border-soft rounded-xl shadow-soft">
      <div className="grid md:grid-cols-2 md:divide-x divide-soft">
        <div className="p-4 flex flex-col">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Money in</p>
          {report.moneyIn.length === 0 && <p className="text-[13px] text-muted">Nothing received yet.</p>}
          {byBill(report.moneyIn).map(([k, group], i) => group.length > 1 ? (
            <PaymentGroup key={k} lines={group} opening={opening} onOpen={onOpenPayment} today={today} edit={edit} />
          ) : (
            <PaymentLine key={(group[0].receipt || group[0].label) + i} line={group[0]} today={today} edit={edit} loading={!!opening && opening === openKey(group[0])} onOpen={onOpenPayment} />
          ))}
          <MoneyInBlank key={report.date} bills={bills} pastDay={pastDay} onAddIn={onAddIn} />
          {/* The totals sit on the same line at the foot of both columns, however long either list is (Sebastian, 2026-10-27). */}
          <div className="flex-1 min-h-2" />
          <div className="flex justify-between items-baseline gap-3 border-t border-soft pt-2 text-[14px] font-extrabold">
            <span className="text-main">Total in</span>
            <span key={report.totalIn} className="font-mono text-[18px] text-emerald-600 inline-block [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]">{peso(report.totalIn)}</span>
          </div>
        </div>

        <div className="p-4 flex flex-col border-t md:border-t-0 border-soft">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Money out</p>
          {dayExpenses.length === 0 && <p className="text-[13px] text-muted">Nothing spent yet.</p>}
          {byCategory(dayExpenses).map(group => group.length > 1 ? (
            <ExpenseGroup key={group[0].category_id} expenses={group} edit={editExpense} />
          ) : (
            <ExpenseLine key={group[0].id} expense={group[0]} edit={editExpense} />
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
