import React from 'react'
import { Calendar, X } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'

interface DayPreviewPanelProps {
  selectedPreviewDate: Date
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  bookingByRoomAndDate: Record<string, Booking>
  ROOM_COLORS: Record<string, { bg: string; text: string; border: string }>
  setSelectedPreviewDate: (date: Date | null) => void
  setSelectedExtendBooking: (booking: Booking) => void
  setExtendCheckoutDate: (date: string) => void
  setExtendError: (err: string) => void
  resetAndOpenManualForm: (pathway: 'room' | 'venue', roomIds: Set<string>, checkIn?: string, checkOut?: string) => void
}

export function DayPreviewPanel({
  selectedPreviewDate,
  rooms,
  venues,
  bookings,
  bookingByRoomAndDate,
  ROOM_COLORS,
  setSelectedPreviewDate,
  setSelectedExtendBooking,
  setExtendCheckoutDate,
  setExtendError,
  resetAndOpenManualForm
}: DayPreviewPanelProps) {
  const fd = selectedPreviewDate.toISOString().split('T')[0]
  const venueBookings = bookings.filter(b => b.venue_id && b.check_in === fd)

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 z-40 bg-slate-900/35 transition-opacity" 
        onClick={() => setSelectedPreviewDate(null)}
      />

      {/* Slide-out Drawer Panel */}
      <div className="fixed top-0 right-0 z-50 h-full w-full sm:max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#B89251]" />
            <span>
              {selectedPreviewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </h4>
          <button 
            onClick={() => setSelectedPreviewDate(null)} 
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block mb-2.5">Room Availability &amp; Bookings</span>
            <div className="space-y-2">
              {rooms.map(room => {
                const reserve = bookingByRoomAndDate[`${room.id}_${fd}`]
                const c = ROOM_COLORS[room.id] || ROOM_COLORS['room-10']
                return (
                  <div key={room.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between transition-all hover:bg-slate-100/50">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Room {room.room_number}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{room.name}</span>
                    </div>
                    {reserve ? (
                      <div 
                        onClick={() => { 
                          if (reserve.status !== 'blocked') { 
                            setSelectedExtendBooking(reserve)
                            setExtendCheckoutDate(reserve.check_out)
                            setExtendError('') 
                          } 
                        }}
                        className={`px-2.5 py-1 rounded border text-[10px] font-semibold cursor-pointer max-w-[150px] truncate text-center shadow-sm ${c.bg} ${c.text} ${c.border}`}
                      >
                        {reserve.status === 'blocked' ? 'Blocked' : reserve.guest_name}
                      </div>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => { 
                          const t = new Date(selectedPreviewDate)
                          t.setDate(t.getDate() + 1)
                          resetAndOpenManualForm('room', new Set([room.id]), fd, t.toISOString().split('T')[0]) 
                        }}
                        className="text-[10px] text-[#9A783E] hover:text-[#B89251] font-bold border border-[#E5D5C0] hover:bg-[#FDFBF7] px-2.5 py-1 rounded transition-all cursor-pointer bg-white"
                      >
                        Available · Book
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {venueBookings.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block mb-2.5">Venue Reservations</span>
              <div className="space-y-2">
                {venueBookings.map(b => (
                  <div key={b.id} className="p-3 bg-fuchsia-50/40 rounded-lg border border-fuchsia-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        {venues.find(v => v.id === b.venue_id)?.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Events Venue</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-fuchsia-800 block">{b.guest_name}</span>
                      <span className="text-[9px] text-slate-455 font-medium">{b.source} · {b.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
