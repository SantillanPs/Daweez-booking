import React, { useState } from 'react'
import { Utensils, Plus, X } from 'lucide-react'
import { BreakfastMenuOption, BreakfastRecord } from '../../types/booking'
import { NumInput } from '../NumInput'

const fmtPeso = (n: number) => '₱' + n.toLocaleString()
const fmtDay = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

interface BreakfastRecorderProps {
  menu: BreakfastMenuOption[]
  records: BreakfastRecord[]
  stayDays: string[]
  onChange: (records: BreakfastRecord[]) => void
}

// Records breakfast day by day during the stay — one meal per person per day,
// charged at check-out (the Daweez workflow: prompted per day, not ahead).
export function BreakfastRecorder({ menu, records, stayDays, onChange }: BreakfastRecorderProps) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(stayDays[0] || '')
  const [item, setItem] = useState(menu[0]?.name || '')
  const [qty, setQty] = useState(1)

  const priceFor = (name: string) => menu.find(m => m.name === name)?.price || 0

  const add = () => {
    if (!item || !date || qty <= 0) return
    const rec: BreakfastRecord = { id: 'bf-' + Date.now(), date, item, quantity: qty, price: priceFor(item) }
    onChange([...records, rec])
    setQty(1)
    setOpen(false)
  }

  const remove = (id: string) => onChange(records.filter(r => r.id !== id))
  const subTotal = records.reduce((s, r) => s + (r.price || 0) * (r.quantity || 0), 0)

  return (
    <div className="border-t border-soft pt-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <Utensils className="w-3.5 h-3.5 text-sea-600" /> Breakfast (during the stay)
        </p>
        <button type="button" onClick={() => setOpen(v => !v)}
          className="text-[11px] font-bold text-sea-700 bg-sea-50 border border-sea-200 hover:bg-sea-100 rounded-md px-2.5 py-1 transition-colors cursor-pointer">
          {open ? 'Cancel' : '+ Add breakfast'}
        </button>
      </div>

      {open && (
        <div className="p-3 bg-page border border-soft rounded-lg space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-muted font-bold block">
              Day
              <select value={date} onChange={e => setDate(e.target.value)}
                className="mt-1 w-full bg-card border border-soft text-main px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:border-sea-500">
                {stayDays.map(d => <option key={d} value={d}>{fmtDay(d)}</option>)}
              </select>
            </label>
            <label className="text-[10px] text-muted font-bold block">
              Meal
              <select value={item} onChange={e => setItem(e.target.value)}
                className="mt-1 w-full bg-card border border-soft text-main px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:border-sea-500">
                {menu.map(m => <option key={m.name} value={m.name}>{m.name} · {fmtPeso(m.price)}</option>)}
              </select>
            </label>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-[10px] text-muted font-bold block flex-1">
              Qty
              <NumInput value={qty} onChange={setQty} min={1} allowDecimal={false}
                className="mt-1 w-full bg-card border border-soft text-main px-2 py-1.5 rounded-lg text-xs font-mono focus:outline-none focus:border-sea-500" />
            </label>
            <button type="button" onClick={add}
              className="bg-sea-600 hover:bg-sea-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer">
              Save
            </button>
          </div>
        </div>
      )}

      {records.length > 0 ? (
        <ul className="space-y-1.5">
          {records.map(r => (
            <li key={r.id} className="flex items-center justify-between gap-2 bg-card border border-soft rounded-md px-2.5 py-1.5 text-[12px]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-main shrink-0">{fmtDay(r.date)}</span>
                <span className="text-muted truncate">{r.item} × {r.quantity}</span>
                <span className="text-emerald-600 shrink-0">{fmtPeso((r.price || 0) * (r.quantity || 0))}</span>
              </div>
              <button type="button" onClick={() => remove(r.id)} className="text-muted hover:text-coral-600 p-1 cursor-pointer shrink-0" aria-label="Remove">
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted">No breakfast recorded yet — add each day as the guests order it.</p>
      )}

      {subTotal > 0 && (
        <div className="flex items-center justify-between text-[12px] pt-0.5">
          <span className="text-muted">Breakfast total</span>
          <span className="font-bold text-main">{fmtPeso(subTotal)}</span>
        </div>
      )}
    </div>
  )
}
