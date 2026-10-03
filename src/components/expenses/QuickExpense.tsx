import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Expense, ExpenseCategory } from '../../types/expense'

interface QuickExpenseProps {
  categories: ExpenseCategory[]
  /** Every expense on record — only used to put the most-used categories first. */
  expenses: Expense[]
  /** Saves one expense for the day on screen. Resolves once it is stored. */
  onAdd: (input: { amount: number; categoryId: string; notes?: string }) => Promise<void>
}

// Logging money out, in the order it is said out loud: how much, what for, done.
//
// One line and the keyboard: type the amount, tap what it was for, press Enter. The
// box empties and the cursor is back in it for the next one, so a handful of receipts
// from the day go in without touching the mouse between them. The date is not asked —
// it is the day the screen is showing.
export function QuickExpense({ categories, expenses, onAdd }: QuickExpenseProps) {
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [notes, setNotes] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)
  const noteRef = useRef<HTMLInputElement>(null)

  useEffect(() => { amountRef.current?.focus() }, [])

  // Most-used first, so the three or four things the hotel buys every day are the
  // first chips under the thumb.
  const ordered = useMemo(() => {
    const used: Record<string, number> = {}
    expenses.forEach(e => { used[e.category_id] = (used[e.category_id] || 0) + 1 })
    return [...categories].sort((a, b) => (used[b.id] || 0) - (used[a.id] || 0) || a.name.localeCompare(b.name))
  }, [categories, expenses])

  const value = parseFloat(amount) || 0
  const problem = !tried ? '' : value <= 0 ? 'Type the amount.' : !categoryId ? 'Tap what it was for.' : ''

  const typeAmount = (raw: string) => {
    let s = raw.replace(/[^0-9.]/g, '')
    const dot = s.indexOf('.')
    if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '')
    setAmount(s)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (value <= 0 || !categoryId || busy) return
    setBusy(true)
    try {
      await onAdd({ amount: value, categoryId, notes: notes.trim() || undefined })
      setAmount(''); setNotes(''); setCategoryId(''); setTried(false)
      amountRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-card border border-soft rounded-xl shadow-soft px-3 py-3 space-y-2.5">
      {/* How much, then what for — the chips sit right after the amount, so Tab (or a
          thumb) goes from one to the other in the order it is said. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted shrink-0 mr-1">Money out</span>
        <div className="relative w-[130px] mr-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm font-semibold">₱</span>
          <input
            ref={amountRef}
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => typeAmount(e.target.value)}
            placeholder="0"
            aria-label="Amount spent"
            className="w-full pl-7 pr-2.5 py-2 bg-page border border-soft rounded-lg text-[15px] font-mono font-bold text-main outline-none focus:bg-card focus:border-gold-500"
          />
        </div>
        {ordered.map(cat => {
          const on = cat.id === categoryId
          return (
            <button
              key={cat.id}
              type="button"
              // Picking what it was for moves on to the note, so Enter there saves it.
              onClick={() => { setCategoryId(on ? '' : cat.id); if (!on) noteRef.current?.focus() }}
              aria-pressed={on}
              className={'px-3 py-2 rounded-lg text-[12px] font-bold border transition-colors cursor-pointer ' +
                (on ? 'bg-gold-400 border-gold-400 text-ink-900' : 'bg-card border-soft text-main hover:border-gold-400 hover:bg-gold-100')}
            >
              {cat.name}
            </button>
          )
        })}
        {categories.length === 0 && <span className="text-[12px] text-muted">Add a category first.</span>}
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={noteRef}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Note (optional)"
          aria-label="Note"
          className="flex-1 min-w-0 px-2.5 py-2 bg-page border border-soft rounded-lg text-sm text-main outline-none focus:bg-card focus:border-gold-500"
        />
        <button
          type="submit"
          disabled={busy || categories.length === 0}
          className="shrink-0 inline-flex items-center gap-1.5 bg-gold-400 hover:bg-gold-600 text-ink-900 text-[13px] font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {problem && <p className="text-[11px] font-semibold text-danger-600">{problem}</p>}
    </form>
  )
}
