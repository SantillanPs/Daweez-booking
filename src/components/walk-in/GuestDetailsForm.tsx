import React, { useMemo } from 'react'
import { Room, Venue, Booking, BookingSource } from '../../types/booking'
import * as syncEngine from '../../utils/syncEngine'

interface GuestDetailsFormProps {
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  unitSelections: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>
  setUnitSelections: (selections: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>) => void
  formSource: BookingSource
  setFormSource: (val: BookingSource) => void
  formStatus: 'confirmed' | 'blocked'
  setFormStatus: (val: 'confirmed' | 'blocked') => void
}

export const GuestDetailsForm = React.memo(
  ({
    rooms,
    venues,
    bookings,
    unitSelections,
    setUnitSelections,
    formSource,
    setFormSource,
    formStatus,
    setFormStatus,

  }: GuestDetailsFormProps) => {

    const formRoomIds = useMemo(() => {
      const s = new Set<string>()
      Object.entries(unitSelections).forEach(([id, sel]) => {
        if (sel.type === 'room') s.add(id)
      })
      return s
    }, [unitSelections])

    const formVenueIds = useMemo(() => {
      const s = new Set<string>()
      Object.entries(unitSelections).forEach(([id, sel]) => {
        if (sel.type === 'venue') s.add(id)
      })
      return s
    }, [unitSelections])

    const handleToggle = (id: string, type: 'room' | 'venue') => {
      const updated = { ...unitSelections }
      if (id in updated) {
        delete updated[id]
      } else {
        const firstSelection = Object.values(unitSelections)[0]
        const defaultCheckIn = firstSelection?.checkIn || new Date().toISOString().split('T')[0]
        const defaultCheckOut = firstSelection?.checkOut || new Date(Date.now() + 86400000).toISOString().split('T')[0]
        updated[id] = { checkIn: defaultCheckIn, checkOut: defaultCheckOut, type }
      }
      setUnitSelections(updated)
    }

    return (
      <div className="bg-card p-4 rounded-md border border-soft/60 shadow-sm space-y-4 font-sans animate-fade-in">
        <h4 className="text-[9px] font-bold text-brand-text tracking-widest uppercase border-b border-soft pb-1.5">
          1. Rooms &amp; Dates
        </h4>
        
        {/* Rooms Selection */}
        <div>
          <span className="text-[10px] text-muted font-semibold block mb-1">Choose Room(s):</span>
          <div className="flex flex-wrap gap-1.5">
            {rooms.map(room => {
              const sel = formRoomIds.has(room.id)
              return (
                <button 
                  key={room.id} 
                  type="button" 
                  onClick={() => handleToggle(room.id, 'room')}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all select-none cursor-pointer duration-100 ${
                    sel
                      ? 'bg-brand-bg border-brand-primary text-brand-text shadow-sm ring-1 ring-brand-ring'
                      : 'bg-card border-soft text-muted hover:border-soft hover:bg-page'
                  }`}
                >
                  <span>Rm {room.room_number}</span>
                  <span className="text-[9px] font-mono ml-1.5 opacity-80">₱{room.base_price.toLocaleString()}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected Rooms with Editable Dates */}
        {Object.keys(unitSelections).length > 0 && (
          <div className="border-t border-soft pt-2 pb-0.5 space-y-1">
            <span className="text-[9px] font-bold text-brand-text tracking-widest uppercase">Dates</span>
            {(() => {
              const groups: Record<string, { ids: string[]; checkIn: string; checkOut: string }> = {}
              Object.entries(unitSelections).forEach(([id, sel]) => {
                const key = `${sel.checkIn}_${sel.checkOut}`
                if (!groups[key]) groups[key] = { ids: [], checkIn: sel.checkIn, checkOut: sel.checkOut }
                groups[key].ids.push(id)
              })
              return Object.entries(groups).map(([key, group]) => {
                const names = group.ids.map(id => {
                  const sel = unitSelections[id]
                  if (sel.type === 'room') return `Rm ${rooms.find(r => r.id === id)?.room_number || id}`
                  return venues.find(v => v.id === id)?.name || id
                })
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-main w-[72px] shrink-0 truncate leading-none">{names.join(', ')}</span>
                    <input
                      type="date"
                      value={group.checkIn}
                      onChange={e => {
                        const newVal = e.target.value
                        setUnitSelections({
                          ...unitSelections,
                          ...Object.fromEntries(group.ids.map(id => [id, { ...unitSelections[id], checkIn: newVal }]))
                        })
                      }}
                      className="w-[124px] bg-white border border-soft text-main px-2 py-1 rounded text-[10px] font-mono focus:outline-none focus:border-brand-primary cursor-pointer"
                    />
                    <span className="text-brand-primary text-[10px] font-bold leading-none">→</span>
                    <input
                      type="date"
                      value={group.checkOut}
                      onChange={e => {
                        const newVal = e.target.value
                        setUnitSelections({
                          ...unitSelections,
                          ...Object.fromEntries(group.ids.map(id => [id, { ...unitSelections[id], checkOut: newVal }]))
                        })
                      }}
                      className="w-[124px] bg-white border border-soft text-main px-2 py-1 rounded text-[10px] font-mono focus:outline-none focus:border-brand-primary cursor-pointer"
                    />
                  </div>
                )
              })
            })()}
          </div>
        )}

        {/* Venues Selection */}
        <div className="pt-1">
          <span className="text-[10px] text-muted font-semibold block mb-1">Add a Venue:</span>
          <div className="flex flex-wrap gap-1.5">
            {venues.map(v => {
              const sel = formVenueIds.has(v.id)
              return (
                <button 
                  key={v.id} 
                  type="button" 
                  onClick={() => handleToggle(v.id, 'venue')}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all select-none cursor-pointer duration-100 ${
                    sel
                      ? 'bg-brand-bg border-brand-primary text-brand-text shadow-sm ring-1 ring-brand-ring'
                      : 'bg-card border-soft text-muted hover:border-soft hover:bg-page'
                  }`}
                >
                  {v.name} <span className="text-[9px] font-mono ml-1 opacity-80">₱{v.base_price.toLocaleString()}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Channel, Status & Discount Types in a highly space-efficient grid */}
        <div className="grid gap-3 pt-1 border-t border-soft grid-cols-2">
          <div>
            <label className="text-[10px] text-muted font-medium block mb-1">Booking Source</label>
            <select 
              value={formSource} 
              onChange={e => setFormSource(e.target.value as BookingSource)}
              className="w-full bg-brand-bg border border-soft text-main px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-ring transition-all"
            >
              <option value="manual">Walk-in / Phone</option>
              <option value="facebook">Facebook</option>
              <option value="google_maps">Google Maps</option>
            </select>
            {(formSource === 'manual' || formSource === 'facebook') && formStatus === 'confirmed' && (
              <p className="text-[9px] text-brand-text font-semibold mt-1.5 animate-in fade-in">
                ✓ 20% direct discount applied
              </p>
            )}
          </div>
          <div>
            <label className="text-[10px] text-muted font-medium block mb-1">Action</label>
            <div className="flex bg-softbg rounded rounded-md p-0.5 h-[32px]">
              <button 
                type="button" 
                onClick={() => setFormStatus('confirmed')}
                className={`flex-1 rounded text-xs font-semibold transition-all cursor-pointer ${formStatus === 'confirmed' ? 'bg-card text-main shadow-sm' : 'text-muted hover:text-main'}`}
              >
                Booking
              </button>
              <button 
                type="button" 
                onClick={() => setFormStatus('blocked')}
                className={`flex-1 rounded text-xs font-semibold transition-all cursor-pointer ${formStatus === 'blocked' ? 'bg-card text-main shadow-sm' : 'text-muted hover:text-main'}`}
              >
                Block
              </button>
            </div>
          </div>

        </div>
      </div>
    )
  },
  (prevProps, nextProps) => {
    // Compare selection records
    const prevKeys = Object.keys(prevProps.unitSelections)
    const nextKeys = Object.keys(nextProps.unitSelections)
    if (prevKeys.length !== nextKeys.length) return false
    
    const selectionsMatch = prevKeys.every(k => {
      const p = prevProps.unitSelections[k]
      const n = nextProps.unitSelections[k]
      return n && p.checkIn === n.checkIn && p.checkOut === n.checkOut && p.type === n.type
    })
    
    return (
      selectionsMatch &&
      prevProps.formSource === nextProps.formSource &&
      prevProps.formStatus === nextProps.formStatus &&
      prevProps.rooms === nextProps.rooms &&
      prevProps.venues === nextProps.venues &&
      prevProps.bookings === nextProps.bookings
    )
  }
)
