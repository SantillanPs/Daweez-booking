import React from 'react'
import { X } from 'lucide-react'

interface BookingUnitCardProps {
  id: string
  name: string
  checkIn: string
  checkOut: string
  nights: number
  subtotal: number
  editable: boolean
  onDatesChange: (id: string, field: 'checkIn' | 'checkOut', value: string) => void
  onRemove: (id: string) => void
}

// One unit card inside the quick booking sheet: name, dates, and a small
// price line. The remove button is hidden while editing an existing booking.
export function BookingUnitCard({ id, name, checkIn, checkOut, nights, subtotal, editable, onDatesChange, onRemove }: BookingUnitCardProps) {
  return (
    <div className="bg-page border border-soft rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-main">{name}</span>
        {editable && (
          <button onClick={() => onRemove(id)} className="text-muted hover:text-coral-500 p-1 cursor-pointer" aria-label="Remove unit">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted font-bold block mb-1">Check-in</label>
          <input type="date" value={checkIn} onChange={e => onDatesChange(id, 'checkIn', e.target.value)} className="w-full bg-card border border-soft text-main px-2.5 py-1.5 rounded-lg text-sm focus:outline-none focus:border-sea-500" />
        </div>
        <div>
          <label className="text-[10px] text-muted font-bold block mb-1">Check-out</label>
          <input type="date" value={checkOut} onChange={e => onDatesChange(id, 'checkOut', e.target.value)} className="w-full bg-card border border-soft text-main px-2.5 py-1.5 rounded-lg text-sm focus:outline-none focus:border-sea-500" />
        </div>
      </div>
      <p className="text-[11px] text-muted">{nights} {nights === 1 ? 'night' : 'nights'} · ₱{subtotal.toLocaleString()}</p>
    </div>
  )
}
