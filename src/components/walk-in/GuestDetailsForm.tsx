import React from 'react'
import { Room, Venue, Booking, BookingSource } from '../../types/booking'
import { BedDouble, PartyPopper, CalendarDays } from 'lucide-react'
import * as syncEngine from '../../utils/syncEngine'

interface GuestDetailsFormProps {
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  formPathway: 'room' | 'venue'
  setFormPathway: (p: 'room' | 'venue') => void
  formRoomIds: Set<string>
  setFormRoomIds: (ids: Set<string>) => void
  formVenueId: string
  setFormVenueId: (id: string) => void
  formCheckIn: string
  setFormCheckIn: (val: string) => void
  formCheckOut: string
  setFormCheckOut: (val: string) => void
  formSource: BookingSource
  setFormSource: (val: BookingSource) => void
  formStatus: 'confirmed' | 'blocked'
  setFormStatus: (val: 'confirmed' | 'blocked') => void
}

// Compare Set contents to determine if selected rooms changed
const setsEqual = (a: Set<string>, b: Set<string>) => a.size === b.size && Array.from(a).every(x => b.has(x))

export const GuestDetailsForm = React.memo(
  ({
    rooms,
    venues,
    bookings,
    formPathway,
    setFormPathway,
    formRoomIds,
    setFormRoomIds,
    formVenueId,
    setFormVenueId,
    formCheckIn,
    setFormCheckIn,
    formCheckOut,
    setFormCheckOut,
    formSource,
    setFormSource,
    formStatus,
    setFormStatus
  }: GuestDetailsFormProps) => {
    return (
      <div className="bg-white p-4 rounded-md border border-slate-200/60 shadow-sm space-y-3.5 font-sans animate-fade-in">
        <h4 className="text-[9px] font-bold text-[#9A783E] tracking-widest uppercase border-b border-slate-100 pb-1.5">
          1. Resource &amp; Schedule
        </h4>
        
        {/* Pathway Segmented Toggle */}
        <div className="flex bg-slate-100 rounded-md p-0.5 text-xs font-semibold">
          <button 
            type="button" 
            onClick={() => { setFormPathway('room'); setFormRoomIds(new Set([rooms[0]?.id || 'room-1'])) }}
            className={`flex-1 py-1.5 text-center rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${formPathway === 'room' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <BedDouble className="w-3.5 h-3.5 text-[#B89251]" /> Room Unit
          </button>
          <button 
            type="button" 
            onClick={() => { setFormPathway('venue'); setFormVenueId(venues[0]?.id || 'venue-gazebo') }}
            className={`flex-1 py-1.5 text-center rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${formPathway === 'venue' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <PartyPopper className="w-3.5 h-3.5 text-[#B89251]" /> Event Venue
          </button>
        </div>

        {/* Available Chips List */}
        {formPathway === 'room' ? (
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block mb-1">Select Room(s):</span>
            <div className="flex flex-wrap gap-1.5">
              {rooms.map(room => {
                const sel = formRoomIds.has(room.id)
                const avail = formCheckIn && formCheckOut ? syncEngine.isRoomAvailable(room.id, formCheckIn, formCheckOut, bookings) : true
                return (
                  <button 
                    key={room.id} 
                    type="button" 
                    disabled={!avail && !sel}
                    onClick={() => {
                      const n = new Set(formRoomIds)
                      if (n.has(room.id)) { if (n.size > 1) n.delete(room.id) } else { n.add(room.id) }
                      setFormRoomIds(n)
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all select-none cursor-pointer duration-100 ${
                      !avail && !sel
                        ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed line-through opacity-60'
                        : sel
                          ? 'bg-[#FDFBF7] border-[#B89251] text-[#9A783E] shadow-sm ring-1 ring-[#e6c280]'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>Rm {room.room_number}</span>
                    <span className="text-[9px] font-mono ml-1.5 opacity-80">₱{room.base_price.toLocaleString()}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block mb-1">Select Gazebo/Venue:</span>
            <div className="flex flex-wrap gap-1.5">
              {venues.map(v => {
                const sel = formVenueId === v.id
                return (
                  <button 
                    key={v.id} 
                    type="button" 
                    onClick={() => setFormVenueId(v.id)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all select-none cursor-pointer duration-100 ${
                      sel ? 'bg-[#FDFBF7] border-[#B89251] text-[#9A783E] shadow-sm ring-1 ring-[#e6c280]' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {v.name} <span className="text-[9px] font-mono ml-1 opacity-80">₱{v.base_price.toLocaleString()}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Dates Segment */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-1">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400" /> {formPathway === 'room' ? 'Check-in' : 'Event date'}
            </label>
            <input 
              type="date" 
              required 
              value={formCheckIn} 
              onChange={e => setFormCheckIn(e.target.value)}
              className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 px-2.5 py-1.5 rounded text-xs font-mono focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] transition-all" 
            />
          </div>
          {formPathway === 'room' && (
            <div>
              <label className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-1">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400" /> Check-out
              </label>
              <input 
                type="date" 
                required 
                value={formCheckOut} 
                onChange={e => setFormCheckOut(e.target.value)}
                className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 px-2.5 py-1.5 rounded text-xs font-mono focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] transition-all" 
              />
            </div>
          )}
        </div>

        {/* Channel & Status Types */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 font-medium block mb-1">Booking Channel</label>
            <select 
              value={formSource} 
              onChange={e => setFormSource(e.target.value as BookingSource)}
              className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] transition-all"
            >
              <option value="manual">Walk-in (Cash)</option>
              <option value="facebook">Facebook Messenger</option>
              <option value="google_maps">Google Maps</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-medium block mb-1">Status Type</label>
            <div className="flex bg-slate-100 rounded rounded-md p-0.5 h-[32px]">
              <button 
                type="button" 
                onClick={() => setFormStatus('confirmed')}
                className={`flex-1 rounded text-xs font-semibold transition-all cursor-pointer ${formStatus === 'confirmed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Booking
              </button>
              <button 
                type="button" 
                onClick={() => setFormStatus('blocked')}
                className={`flex-1 rounded text-xs font-semibold transition-all cursor-pointer ${formStatus === 'blocked' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
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
    return (
      prevProps.formPathway === nextProps.formPathway &&
      setsEqual(prevProps.formRoomIds, nextProps.formRoomIds) &&
      prevProps.formVenueId === nextProps.formVenueId &&
      prevProps.formCheckIn === nextProps.formCheckIn &&
      prevProps.formCheckOut === nextProps.formCheckOut &&
      prevProps.formSource === nextProps.formSource &&
      prevProps.formStatus === nextProps.formStatus &&
      prevProps.rooms === nextProps.rooms &&
      prevProps.venues === nextProps.venues &&
      prevProps.bookings === nextProps.bookings
    )
  }
)
