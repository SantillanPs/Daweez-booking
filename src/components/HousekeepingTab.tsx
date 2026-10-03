import React, { useEffect, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useDashboardData } from './DashboardContext'
import { getCleaningTasks, saveCleaningTasks, CleaningTask, CLEANING_ITEMS } from '../utils/cleaning'
import { useStockRoom } from './housekeeping/useStockRoom'
import { StockRoom } from './housekeeping/StockRoom'
import { DishStockEditor } from './housekeeping/DishStockEditor'

type Tab = 'stock' | 'dishes' | 'cleaning'

/**
 * Housekeeping: **the stock room**, the dishes that take stock, and the cleaning checklist.
 *
 * The stock room replaced the old flat inventory list (k71, the owner's ruling: *"go"*). The items are the same
 * rows as before — one shelf for the kitchen and the hotel — but they now carry a unit, a price, a par level,
 * and the movements that explain every number on the screen.
 *
 * This is the **Stock** tab (the owner's ruling, 2026-10-04). Which of the three screens shows comes from the
 * address — the sub-tabs are drawn by `DashboardLayout` with every other tab's, so this screen has no buttons
 * of its own for it. An address it does not know shows the stock room.
 */
export function HousekeepingTab() {
  const { rooms } = useDashboardData()
  const { view } = useParams({ strict: false })
  const tab: Tab = view === 'dishes' || view === 'cleaning' ? view : 'stock'
  const [cleaning, setCleaning] = useState<CleaningTask[]>([])
  const stock = useStockRoom()

  // Cleaning form
  const [taskItem, setTaskItem] = useState(CLEANING_ITEMS[0])
  const [taskRoom, setTaskRoom] = useState('')
  const [taskDate, setTaskDate] = useState('')
  const [taskCleanedBy, setTaskCleanedBy] = useState('')
  const [taskCheckedBy, setTaskCheckedBy] = useState('')

  useEffect(() => {
    getCleaningTasks().then(setCleaning).catch(() => {})
  }, [])

  const addTask = async () => {
    const task: CleaningTask = { id: 'clean-' + Date.now(), room_id: taskRoom || undefined, item: taskItem, date: taskDate || undefined, cleaned_by: taskCleanedBy.trim() || undefined, checked_by: taskCheckedBy.trim() || undefined, status: taskCleanedBy.trim() ? 'done' : 'pending', created_at: new Date().toISOString() }
    const next = [task, ...cleaning]
    setCleaning(next)
    await saveCleaningTasks(next)
    setTaskCleanedBy(''); setTaskCheckedBy(''); setTaskDate('')
  }

  const updateTask = async (id: string, patch: Partial<CleaningTask>) => {
    const next = cleaning.map(t => t.id === id ? { ...t, ...patch } : t)
    setCleaning(next)
    await saveCleaningTasks(next)
  }

  const removeTask = async (id: string) => {
    const next = cleaning.filter(t => t.id !== id)
    setCleaning(next)
    await saveCleaningTasks(next)
  }

  return (
    <div className="min-w-0">
      {tab === 'stock' && (
        <StockRoom
          items={stock.items}
          movements={stock.movements}
          loading={stock.loading}
          error={stock.error}
          onReceive={stock.receive}
          onSaveItem={stock.saveItem}
        />
      )}

      {tab === 'dishes' && (
        <DishStockEditor items={stock.items} dishStock={stock.dishStock} onSave={stock.saveRecipe} />
      )}

      {tab === 'cleaning' && (
        <div className="bg-card border border-soft rounded-lg overflow-hidden font-sans shadow-sm">
          <div className="px-5 py-4 border-b border-soft">
            <h3 className="text-sm font-semibold text-main">Cleaning Checklist</h3>
            <p className="text-xs text-muted mt-1">Log what was cleaned, who cleaned it, and who checked it.</p>
          </div>
          <div className="p-4 border-b border-soft flex flex-wrap items-end gap-2">
            <select value={taskItem} onChange={e => setTaskItem(e.target.value)} className="bg-page border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500 min-w-[140px]">
              {CLEANING_ITEMS.map(it => <option key={it} value={it}>{it}</option>)}
            </select>
            <select value={taskRoom} onChange={e => setTaskRoom(e.target.value)} className="bg-page border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500">
              <option value="">Room…</option>
              {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
            </select>
            <input type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)} className="bg-page border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
            <input value={taskCleanedBy} onChange={e => setTaskCleanedBy(e.target.value)} placeholder="Cleaned by" className="bg-page border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500 w-32" />
            <input value={taskCheckedBy} onChange={e => setTaskCheckedBy(e.target.value)} placeholder="Checked by" className="bg-page border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500 w-32" />
            <button onClick={addTask} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-sm font-semibold transition-colors cursor-pointer">Add</button>
          </div>
          <div className="divide-y divide-soft">
            {cleaning.length === 0 && <div className="px-5 py-6 text-sm text-muted">No cleaning entries yet.</div>}
            {cleaning.map(t => {
              const room = rooms.find(r => r.id === t.room_id)
              return (
                <div key={t.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-main">{t.item}</p>
                      <p className="text-[10px] text-muted">{room ? 'Room ' + room.room_number : 'General'} · {t.cleaned_by || 'not cleaned'} · checked by {t.checked_by || '—'}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateTask(t.id, { cleaned_by: 'unassigned', status: 'pending' })} className="text-[10px] px-2 py-1 rounded border border-soft text-muted hover:bg-softbg cursor-pointer">Reset</button>
                      <button onClick={() => removeTask(t.id)} className="text-muted/40 hover:text-rose-500 p-1 cursor-pointer" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <input value={t.cleaned_by || ''} onChange={e => updateTask(t.id, { cleaned_by: e.target.value, status: e.target.value ? 'done' : t.status })} placeholder="Cleaned by"
                      className="flex-1 bg-page border border-soft text-main px-2 py-1 rounded text-xs focus:outline-none focus:border-gold-500" />
                    <input value={t.checked_by || ''} onChange={e => updateTask(t.id, { checked_by: e.target.value, status: e.target.value ? 'checked' : t.status })} placeholder="Checked by"
                      className="flex-1 bg-page border border-soft text-main px-2 py-1 rounded text-xs focus:outline-none focus:border-gold-500" />
                    <span className={'text-[10px] font-bold uppercase px-2 py-1 rounded ' + (t.status === 'checked' ? 'bg-emerald-100 text-emerald-700' : t.status === 'done' ? 'bg-gold-100 text-gold-700' : 'bg-amber-100 text-amber-700')}>{t.status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
