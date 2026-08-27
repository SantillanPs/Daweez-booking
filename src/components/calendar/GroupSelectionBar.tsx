import React from 'react'
import { X } from 'lucide-react'
import { Room, Venue } from '../../types/booking'
import { roomDisplayName } from './bookingStyles'

interface GroupSelectionBarProps {
  groupSelection: Record<string, { checkIn: Date; checkOut: Date; type: 'room' | 'venue' }>
  rooms: Room[]
  venues: Venue[]
  onCancel: () => void
  onRemoveUnit: (id: string) => void
  onConfirm: () => void
}

// Floating bar shown while staff pick rooms/venues on the calendar. Stays out
// of the grid so the timeline never shifts while selecting.
export function GroupSelectionBar({ groupSelection, rooms, venues, onCancel, onRemoveUnit, onConfirm }: GroupSelectionBarProps) {
  const count = Object.keys(groupSelection).length
  const unitName = (id: string, type: 'room' | 'venue') =>
    type === 'room'
      ? roomDisplayName(rooms.find(r => r.id === id))
      : (venues.find(v => v.id === id)?.name ?? id)

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card border border-sea-200 p-3 md:p-4 rounded-xl shadow-softLg flex flex-col md:flex-row items-center gap-3 md:gap-4 max-w-[92vw] md:max-w-4xl animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center gap-2 shrink-0">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-sea-600"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-sea-600"></span>
        </span>
        <span className="text-xs font-bold text-main">
          {count} {count === 1 ? 'unit' : 'units'} picked
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
        {Object.entries(groupSelection).map(([id, sel]) => {
          const rangeStr = sel.checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' – ' + sel.checkOut.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return (
            <div key={id} className="flex items-center gap-1.5 bg-sea-50 border border-sea-200 px-2 py-1 rounded-lg text-[11px] text-main font-medium">
              <span>{unitName(id, sel.type)}</span>
              <span className="text-sea-700 text-[10px] font-mono">({rangeStr})</span>
              <button
                onClick={() => onRemoveUnit(id)}
                className="text-muted hover:text-coral-500 hover:bg-coral-50 p-0.5 rounded cursor-pointer transition-colors"
                title="Remove"
                aria-label={'Remove ' + unitName(id, sel.type)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 pt-2 md:pt-0 border-soft">
        <button
          onClick={onCancel}
          className="text-xs font-semibold text-muted hover:text-main transition-colors px-3 py-1.5 hover:bg-sand-50 rounded-lg cursor-pointer">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="text-xs font-bold text-white bg-sea-600 hover:bg-sea-700 px-4 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer">
          Continue booking
        </button>
      </div>
    </div>
  )
}
