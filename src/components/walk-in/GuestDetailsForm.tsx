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
  formAdditionalDiscount: number
  setFormAdditionalDiscount: (val: number) => void
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
    formAdditionalDiscount,
    setFormAdditionalDiscount
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
          1. Resource &amp; Schedule
        </h4>
        
        {/* Rooms Selection */}
        <div>
          <span className="text-[10px] text-muted font-semibold block mb-1">Select Room(s):</span>
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

        {/* Venues Selection */}
        <div className="pt-1">
          <span className="text-[10px] text-muted font-semibold block mb-1">Select Gazebo/Venue(s):</span>
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

        {/* Individual Staggered Stay Dates */}
        {Object.keys(unitSelections).length > 0 && (
          <div className="space-y-2 pt-2 border-t border-soft">
            <span className="text-[10px] text-muted font-semibold block mb-1.5">Stay Dates per Selected Unit:</span>
            <div className="border border-soft/60 rounded-lg overflow-hidden divide-y divide-slate-150 bg-page/15">
              {Object.entries(unitSelections).map(([id, sel]) => {
                const name = sel.type === 'room'
                  ? `Room ${rooms.find(r => r.id === id)?.room_number}`
                  : venues.find(v => v.id === id)?.name || id
                
                // Overlap check
                const isRoom = sel.type === 'room'
                const isOverlapping = sel.checkIn && sel.checkOut && (isRoom
                  ? !syncEngine.isRoomAvailable(id, sel.checkIn, sel.checkOut, bookings)
                  : !syncEngine.isVenueRangeAvailable(id, sel.checkIn, sel.checkOut, bookings))

                return (
                  <div key={id} className="p-2 sm:px-3 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-page/50 transition-colors">
                    <div className="sm:w-28 shrink-0">
                      <span className="text-xs font-bold text-main block leading-tight">{name}</span>
                      {isOverlapping && (
                        <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1 rounded block mt-0.5 max-w-max animate-pulse">
                          Overlap Collision
                        </span>
                      )}
                    </div>
                    
                    <div className="flex-1 flex items-center gap-2 max-w-sm">
                      <input
                        type="date"
                        required
                        value={sel.checkIn}
                        onChange={e => {
                          const updated = { ...unitSelections }
                          updated[id] = { ...sel, checkIn: e.target.value }
                          setUnitSelections(updated)
                        }}
                        className="w-full bg-card border border-soft text-main px-2 py-1 rounded text-xs font-mono focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-ring transition-all"
                      />
                      <span className="text-muted text-xs shrink-0 select-none font-medium">to</span>
                      <input
                        type="date"
                        required
                        value={sel.checkOut}
                        onChange={e => {
                          const updated = { ...unitSelections }
                          updated[id] = { ...sel, checkOut: e.target.value }
                          setUnitSelections(updated)
                        }}
                        className="w-full bg-card border border-soft text-main px-2 py-1 rounded text-xs font-mono focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-ring transition-all"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Channel, Status & Discount Types in a highly space-efficient grid */}
        <div className={`grid gap-3 pt-1 border-t border-soft ${formStatus === 'confirmed' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
          <div>
            <label className="text-[10px] text-muted font-medium block mb-1">Booking Channel</label>
            <select 
              value={formSource} 
              onChange={e => setFormSource(e.target.value as BookingSource)}
              className="w-full bg-brand-bg border border-soft text-main px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-ring transition-all"
            >
              <option value="manual">Walk-in / Phone Reservation</option>
              <option value="facebook">Facebook Messenger</option>
              <option value="google_maps">Google Maps</option>
            </select>
            {(formSource === 'manual' || formSource === 'facebook') && formStatus === 'confirmed' && (
              <p className="text-[9px] text-brand-text font-semibold mt-1.5 animate-in fade-in">
                ✓ 20% direct discount applied
              </p>
            )}
          </div>
          <div>
            <label className="text-[10px] text-muted font-medium block mb-1">Status Type</label>
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
          {formStatus === 'confirmed' && (
            <div className="animate-in fade-in duration-200">
              <label className="text-[10px] text-muted font-medium block mb-1">Add'l Discount</label>
              <div className="flex items-center gap-1.5">
                <input 
                  type="number"
                  min="0"
                  max="100"
                  value={formAdditionalDiscount || ''}
                  onChange={e => {
                    const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                    setFormAdditionalDiscount(val)
                  }}
                  placeholder="0"
                  className="w-full bg-brand-bg border border-soft text-main px-2.5 py-1.5 rounded text-xs text-center font-mono focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-ring transition-all"
                />
                <span className="text-xs font-bold text-muted font-mono shrink-0">%</span>
              </div>
              {(formSource === 'manual' || formSource === 'facebook') && formAdditionalDiscount > 0 && (
                <p className="text-[9px] text-muted mt-1.5 font-medium">Total: {20 + formAdditionalDiscount}% off</p>
              )}
            </div>
          )}
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
      prevProps.bookings === nextProps.bookings &&
      prevProps.formAdditionalDiscount === nextProps.formAdditionalDiscount
    )
  }
)
