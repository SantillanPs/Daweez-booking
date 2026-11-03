import { CSSProperties, FormEvent, useEffect, useRef, useState } from 'react'
import { Check, Search, Tag, Trash2, X } from 'lucide-react'
import { Expense, ExpenseCategory } from '../../types/expense'
import { CHIP, MonthGrid, TAP_AREA } from './PaymentEdit'

export type ExpenseChange = Partial<Pick<Expense, 'category_id' | 'amount' | 'notes' | 'expense_date'>>

/**
 * **An expense fixed from Money out** (Sebastian, 2026-11-03, B of the mock: "make the expenses
 * consistent with the design similar to the money in"). The same slip as a payment's: the note and the
 * amount on one rule, what it was for and the day as chips that unfold their choices, and the bin asks
 * once by turning into Remove. Nothing changes until ✓, and then only the parts that were changed.
 */
export function ExpenseEdit({ expense, categories, nameOf, today, onSave, onRemove, onClose }: {
  expense: Expense
  /** Most used first, as the blank line has them. */
  categories: ExpenseCategory[]
  nameOf: (id: string) => string
  today: string
  onSave: (change: ExpenseChange) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [notes, setNotes] = useState(expense.notes || '')
  const [amount, setAmount] = useState(String(expense.amount))
  const [category, setCategory] = useState(expense.category_id)
  const [day, setDay] = useState(expense.expense_date)
  const [open, setOpen] = useState<'category' | 'day' | null>(null)
  const [find, setFind] = useState('')
  const [removing, setRemoving] = useState(false)
  const [tried, setTried] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  const value = parseFloat(amount) || 0
  const term = find.trim().toLowerCase()
  const hits = categories.filter(c => c.name.toLowerCase().includes(term))

  useEffect(() => { amountRef.current?.select() }, [])
  useEffect(() => { form.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [open])

  // As a payment's slip: a tap anywhere else shuts it and does nothing else; another pencil still works.
  useEffect(() => {
    const away = (e: MouseEvent) => {
      const at = e.target as Element
      if (form.current?.contains(at) || at.closest?.('[data-pay-pen]')) return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('click', away, true)
    return () => document.removeEventListener('click', away, true)
  }, [onClose])

  const typeAmount = (raw: string) => {
    let s = raw.replace(/[^0-9.]/g, '')
    const dot = s.indexOf('.')
    if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '')
    setAmount(s)
  }
  const save = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (value <= 0) { amountRef.current?.focus(); return }
    const change: ExpenseChange = {}
    if (notes.trim() !== (expense.notes || '')) change.notes = notes.trim()
    if (value !== expense.amount) change.amount = value
    if (category !== expense.category_id) change.category_id = category
    if (day !== expense.expense_date) change.expense_date = day
    if (Object.keys(change).length === 0) { onClose(); return }
    onSave(change)
  }
  const pickCategory = (id: string) => {
    setCategory(id)
    setOpen(null)
    setFind('')
  }

  const [, monthNum, dayNum] = day.split('-').map(Number)
  const monthWord = new Date(2000, monthNum - 1, 1).toLocaleDateString('en-US', { month: 'short' })
  const item = (cat: ExpenseCategory, i: number) => (
    <button key={cat.id} type="button" role="option" aria-selected={cat.id === category} onClick={() => pickCategory(cat.id)} style={{ '--i': i } as CSSProperties}
      className="bp-row group flex items-center gap-2 w-full min-h-[40px] px-2.5 rounded-lg text-left text-[13px] font-semibold text-main aria-selected:font-extrabold aria-selected:text-ink-900 hover:bg-gold-100 active:scale-[.97] transition-[background-color,transform] cursor-pointer">
      <span className="w-3 text-gold-800 font-extrabold opacity-0 scale-50 group-aria-selected:opacity-100 group-aria-selected:scale-100 transition-[opacity,transform] duration-300">✓</span>
      {cat.name}
    </button>
  )
  const label = (words: string) => <p className="mx-2.5 mt-1.5 mb-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-muted">{words}</p>

  return (
    <form ref={form} onSubmit={save} role="dialog" aria-label="Edit this expense"
      onClick={e => e.stopPropagation()}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); if (open) setOpen(null); else onClose() } }}
      className="absolute right-[-4px] top-[calc(100%-2px)] z-20 scroll-mb-24 lg:scroll-mb-4 w-[284px] max-w-[calc(100vw-40px)] bg-card rounded-lg shadow-softLg ring-1 ring-gold-100 px-2.5 pt-1.5 pb-2.5 text-left [animation:bp-slide_.22s_cubic-bezier(.16,1,.3,1)]">
      <div className="flex items-center gap-2 h-8 border-b-[1.5px] border-ink-900 focus-within:border-gold-400 transition-colors">
        <input value={notes} onChange={e => setNotes(e.target.value)} aria-label="Note" placeholder="e.g. for Ana, receipt 0412"
          className="flex-1 min-w-0 bg-transparent border-0 p-0 font-sans text-[16px] md:text-[14px] font-bold text-ink-900 placeholder:text-[13px] placeholder:font-medium placeholder:text-paper-400 focus:outline-none" />
        <label className="flex-none flex items-baseline gap-0.5">
          <span className="font-display text-[11px] font-extrabold text-muted">₱</span>
          <input ref={amountRef} inputMode="decimal" value={amount} onChange={e => typeAmount(e.target.value)} placeholder="250" aria-label="Amount spent"
            className="w-[72px] min-w-0 bg-transparent border-0 p-0 text-right font-display text-[18px] font-extrabold text-ink-900 placeholder:text-paper-400 focus:outline-none" />
        </label>
      </div>
      {/* A long name ("Pension House Expense") pushed ✓ out of the slip; now only the name gives way. */}
      <div className="flex items-center gap-2 mt-2 min-w-0">
        <button type="button" aria-expanded={open === 'category'} aria-label={'What it was for: ' + nameOf(category)} onClick={() => { setRemoving(false); setOpen(o => (o === 'category' ? null : 'category')) }}
          className={TAP_AREA + ' pl-1.5 pr-2 min-w-0 max-w-[140px] ' + CHIP}>
          <span key={category} className="inline-flex items-center gap-1 min-w-0 [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]">
            <Tag aria-hidden="true" className="flex-none w-3.5 h-3.5 text-gold-800" />
            <span className="truncate">{nameOf(category)}</span>
          </span>
        </button>
        <button type="button" aria-expanded={open === 'day'} aria-label={'Day it was spent: ' + monthWord + ' ' + dayNum} onClick={() => { setRemoving(false); setOpen(o => (o === 'day' ? null : 'day')) }}
          className={TAP_AREA + ' px-2 flex-none ' + CHIP}>
          <span key={day} className="inline-flex items-center gap-1 [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]">
            <i className="not-italic text-gold-800 text-[9px] font-extrabold tracking-[.05em] uppercase">{monthWord}</i>
            {dayNum}
          </span>
        </button>
        <span className="ml-auto flex-none flex items-center gap-1">
          {/* Armed, Remove stands where the bin and ✕ stood, at their width, so nothing else in the row moves
              (Sebastian, 2026-11-03: the wider word pushed ✓ out of the slip). A tap anywhere else puts them back. */}
          {removing ? (
            <button type="button" onClick={onRemove} onBlur={() => setRemoving(false)} autoFocus
              className={TAP_AREA + ' w-[60px] h-7 grid place-items-center rounded-lg bg-danger-600 hover:bg-danger-500 text-white text-[12px] font-bold active:scale-90 transition-[background-color,transform] cursor-pointer [animation:bp-ready_.35s_cubic-bezier(.34,1.56,.64,1)]'}>
              Remove
            </button>
          ) : (
            <>
              <button type="button" onClick={() => { setOpen(null); setRemoving(true) }} aria-label="Remove this expense"
                className={TAP_AREA + ' w-7 h-7 grid place-items-center rounded-lg text-muted hover:text-danger-600 hover:bg-danger-50 active:scale-90 transition-[background-color,color,transform] cursor-pointer'}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={onClose} aria-label="Close" className={TAP_AREA + ' w-7 h-7 grid place-items-center rounded-lg text-muted hover:text-main hover:bg-page cursor-pointer'}>
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button type="submit" aria-label="Save" className={TAP_AREA + ' w-8 h-7 grid place-items-center rounded-lg bg-ink-900 hover:bg-ink-700 text-white active:scale-90 transition-[background-color,transform] cursor-pointer'}>
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
          </button>
        </span>
      </div>
      {open === 'category' && (
        <div className="bw-unfold">
          <label className="flex items-center gap-2 mt-2 px-2.5 rounded-lg bg-page text-muted focus-within:ring-[1.5px] focus-within:ring-gold-400 transition-shadow">
            <Search className="w-3.5 h-3.5 shrink-0" />
            <input autoFocus value={find} onChange={e => setFind(e.target.value)} placeholder="Search, e.g. gas" aria-label="Search what it was for"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (hits[0]) pickCategory(hits[0].id) } }}
              className="flex-1 min-w-0 h-9 bg-transparent outline-none text-[16px] md:text-[13px] text-main placeholder:text-paper-400" />
          </label>
          <div role="listbox" aria-label="What it was for" className="max-h-[200px] overflow-y-auto overscroll-contain pt-1">
            {term ? (
              hits.length ? hits.map(item) : <p className="mx-2.5 my-2.5 text-[12px] text-muted [animation:bp-slide_.25s_both]">Nothing called “{find.trim()}”</p>
            ) : (
              <>
                {label('Most used')}
                {categories.slice(0, 5).map(item)}
                {categories.length > 5 && label('The rest')}
                {categories.slice(5).map((c, i) => item(c, i + 5))}
              </>
            )}
          </div>
        </div>
      )}
      {open === 'day' && <div className="bw-unfold"><MonthGrid day={day} today={today} onPick={d => { setDay(d); setOpen(null) }} /></div>}
      {tried && value <= 0 && <p role="alert" className="mt-1 text-[11px] font-semibold text-danger-600 [animation:bp-slide_.25s]">Write the amount.</p>}
    </form>
  )
}
