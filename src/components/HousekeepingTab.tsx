import React, { useEffect, useState } from 'react'
import { Boxes, ClipboardCheck, Plus, Trash2 } from 'lucide-react'
import { NumInput } from './NumInput'
import { useDashboardData } from './DashboardContext'
import { getInventory, saveInventory, InventoryItem } from '../utils/inventory'
import { getCleaningTasks, saveCleaningTasks, CleaningTask, CLEANING_ITEMS } from '../utils/cleaning'

type Tab = 'inventory' | 'cleaning'

export function HousekeepingTab() {
  const { rooms } = useDashboardData()
  const [tab, setTab] = useState<Tab>('inventory')
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [cleaning, setCleaning] = useState<CleaningTask[]>([])

  const [newItemName, setNewItemName] = useState('')
  const [newItemQty, setNewItemQty] = useState(0)
  const [newItemCategory, setNewItemCategory] = useState('room')

  // Cleaning form
  const [taskItem, setTaskItem] = useState(CLEANING_ITEMS[0])
  const [taskRoom, setTaskRoom] = useState('')
  const [taskDate, setTaskDate] = useState('')
  const [taskCleanedBy, setTaskCleanedBy] = useState('')
  const [taskCheckedBy, setTaskCheckedBy] = useState('')

  useEffect(() => {
    getInventory().then(setInventory).catch(() => {})
    getCleaningTasks().then(setCleaning).catch(() => {})
  }, [])

  const addItem = async () => {
    if (!newItemName.trim()) return
    const item: InventoryItem = { id: 'inv-' + Date.now(), name: newItemName.trim(), category: newItemCategory, quantity: newItemQty, created_at: new Date().toISOString() }
    const next = [...inventory, item]
    setInventory(next)
    await saveInventory(next)
    setNewItemName(''); setNewItemQty(0)
  }

  const updateQty = async (id: string, qty: number) => {
    const next = inventory.map(i => i.id === id ? { ...i, quantity: Math.max(0, qty) } : i)
    setInventory(next)
    await saveInventory(next)
  }

  const removeItem = async (id: string) => {
    const next = inventory.filter(i => i.id !== id)
    setInventory(next)
    await saveInventory(next)
  }

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
    <div className="flex flex-col md:flex-row gap-6 h-full">
      <div className="w-full md:w-56 shrink-0">
        <nav className="flex md:flex-col gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0">
          <button onClick={() => setTab('inventory')} className={'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ' + (tab === 'inventory' ? 'bg-brand-primary text-ink-900 shadow-sm' : 'text-muted hover:bg-softbg')}>
            <Boxes className="w-4 h-4" /> Hotel Inventory
          </button>
          <button onClick={() => setTab('cleaning')} className={'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ' + (tab === 'cleaning' ? 'bg-brand-primary text-ink-900 shadow-sm' : 'text-muted hover:bg-softbg')}>
            <ClipboardCheck className="w-4 h-4" /> Cleaning Checklist
          </button>
        </nav>
      </div>

      <div className="flex-1 min-w-0">
        {tab === 'inventory' && (
          <div className="bg-card border border-soft rounded-lg overflow-hidden font-sans shadow-sm">
            <div className="px-5 py-4 border-b border-soft">
              <h3 className="text-sm font-semibold text-main">Hotel Inventory</h3>
              <p className="text-xs text-muted mt-1">Track what is in house — pillows, blankets, soap, and more.</p>
            </div>
            <div className="p-4 border-b border-soft flex flex-wrap items-end gap-2">
              <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="New item name"
                className="flex-1 min-w-[160px] bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
              <select value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)} className="bg-page border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500">
                <option value="room">Room</option><option value="bathroom">Bathroom</option><option value="common">Common</option>
              </select>
              <NumInput value={newItemQty} onChange={setNewItemQty} placeholder="Qty" allowDecimal={false}
                className="w-20 bg-page border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
              <button onClick={addItem} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-sm font-semibold transition-colors cursor-pointer"><Plus className="w-4 h-4" /> Add</button>
            </div>
            <div className="divide-y divide-soft">
              {inventory.length === 0 && <div className="px-5 py-6 text-sm text-muted">No inventory items yet.</div>}
              {inventory.map(i => (
                <div key={i.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-main">{i.name}</p>
                    <p className="text-[10px] text-muted uppercase">{i.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(i.id, i.quantity - 1)} className="w-6 h-6 rounded bg-page border border-soft text-muted flex items-center justify-center text-sm font-bold hover:bg-softbg cursor-pointer">-</button>
                    <span className="font-mono w-8 text-center text-sm font-semibold text-main">{i.quantity}</span>
                    <button onClick={() => updateQty(i.id, i.quantity + 1)} className="w-6 h-6 rounded bg-page border border-soft text-muted flex items-center justify-center text-sm font-bold hover:bg-softbg cursor-pointer">+</button>
                    <button onClick={() => removeItem(i.id)} className="text-muted/40 hover:text-rose-500 p-1 cursor-pointer" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
              <button onClick={addTask} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-sm font-semibold transition-colors cursor-pointer"><Plus className="w-4 h-4" /> Add</button>
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
    </div>
  )
}
