import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { Room, Venue } from '../../types/booking'

export interface OldBookingUnitSel {
  checkIn: string
  checkOut: string
  type: 'room' | 'venue'
}

interface OldBookingUnitPickerProps {
  rooms: Room[]
  venues: Venue[]
  unitSelections: Record<string, OldBookingUnitSel>
  onChange: (next: Record<string, OldBookingUnitSel>) => void
}

// Multi-unit editor for the Log-old-booking form: lists every room/venue picked
// on the calendar, lets staff edit dates / remove units, and add more.
export function OldBookingUnitPicker({ rooms, venues, unitSelections, onChange }: OldBookingUnitPickerProps) {
  const [addType, setAddType] = useState<'room' | 'venue'>('room')
  const [addId, setAddId] = useState('')

  const entries = Object.entries(unitSelections)
  const firstSel = entries[0]?.[1]

  const baseField = 'bg-page border text-main px-2 py-1.5 rounded-lg text-xs focus:outline-none'
  const field = baseField + ' border-soft focus:border-gold-500'
  const label = 'text-[10px] text-muted font-bold block mb-1'
  const pickBtn = 'px-3 py-1.5 rounded-lg border border-soft text-main text-xs font-bold hover:bg-paper-50 transition-colors cursor-pointer'
  const pickBtnActive = 'px-3 py-1.5 rounded-lg bg-gold-400 text-ink-900 text-xs font-bold transition-colors cursor-pointer'

  const unitName = (id: string, type: 'room' | 'venue') => {
    if (type === 'room') {
      const r = rooms.find(r => r.id === id)
      return r ? `Room ${r.room_number} · ${r.name}` : id
    }
    const v = venues.find(v => v.id === id)
    return v ? v.name : id
  }

  const setUnit = (id: string, patch: Partial<OldBookingUnitSel>) =>
    onChange({ ...unitSelections, [id]: { ...unitSelections[id], ...patch } })

  const removeUnit = (id: string) => {
    const next = { ...unitSelections }
    delete next[id]
    onChange(next)
  }

  const addSelected = () => {
    if (!addId || unitSelections[addId]) { setAddId(''); return }
    const defaults = firstSel ? { checkIn: firstSel.checkIn, checkOut: firstSel.checkOut } : { checkIn: '', checkOut: '' }
    onChange({ ...unitSelections, [addId]: { ...defaults, type: addType } })
    setAddId('')
  }

  const available = addType === 'room'
    ? rooms.filter(r => !unitSelections[r.id])
    : venues.filter(v => !unitSelections[v.id])

  return (
    <div className="space-y-2">
      <div>
        <p className={label}>Rooms / venues *</p>
        {entries.length === 0 && (
          <p className="text-[11px] text-muted">No units picked. Add a room or venue below.</p>
        )}
        <div className="space-y-1.5">
          {entries.map(([id, sel]) => (
            <div key={id} className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-main flex-1 min-w-[120px]">{unitName(id, sel.type)}</span>
              <input type="date" value={sel.checkIn} onChange={e => setUnit(id, { checkIn: e.target.value })} className={field + ' w-32'} />
              <input type="date" value={sel.checkOut} onChange={e => setUnit(id, { checkOut: e.target.value })} className={field + ' w-32'} />
              <button type="button" onClick={() => removeUnit(id)} className="text-muted hover:text-danger-600 p-1 cursor-pointer" aria-label="Remove unit">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add unit */}
      <div className="flex gap-1.5 items-center">
        <div className="flex gap-1">
          <button type="button" onClick={() => { setAddType('room'); setAddId('') }} className={addType === 'room' ? pickBtnActive : pickBtn}>Room</button>
          <button type="button" onClick={() => { setAddType('venue'); setAddId('') }} className={addType === 'venue' ? pickBtnActive : pickBtn}>Venue</button>
        </div>
        <select value={addId} onChange={e => setAddId(e.target.value)} className={baseField + ' border-soft flex-1 cursor-pointer'}>
          <option value="">{addType === 'room' ? 'Add a room…' : 'Add a venue…'}</option>
          {available.map(u => (
            <option key={u.id} value={u.id}>{(addType === 'room' && 'room_number' in u) ? `Room ${u.room_number} · ${u.name}` : u.name}</option>
          ))}
        </select>
        <button type="button" onClick={addSelected} className="text-[11px] font-bold text-gold-700 bg-gold-100 border border-gold-200 hover:bg-gold-100 rounded-md px-2 py-1 transition-colors cursor-pointer inline-flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  )
}