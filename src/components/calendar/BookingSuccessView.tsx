import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2 } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'

interface BookingSuccessViewProps {
  created: Booking[]
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  onDone: () => void
  isEdit?: boolean
}

// Shown after a quick booking saves: confirmation + optional invoice print.
export function BookingSuccessView({ created, rooms, venues, bookings, onDone, isEdit = false }: BookingSuccessViewProps) {
  const [printOpen, setPrintOpen] = useState(false)

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onDone} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-md bg-card border-l border-soft shadow-sheet flex flex-col animate-in slide-in-from-right-4 duration-300">
        <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-3" />
          <h3 className="font-display font-bold text-lg text-main">{isEdit ? 'Booking updated!' : 'Booking saved!'}</h3>
          <p className="text-sm text-muted mt-1">
            {isEdit
              ? 'The changes are saved.'
              : created.length + ' ' + (created.length === 1 ? 'booking' : 'bookings') + ' added for ' + created.map(b => b.guest_name).join(', ') + '.'}
          </p>
          <div className="flex gap-2 mt-6">
            <button onClick={() => setPrintOpen(true)} className="px-4 py-2 rounded-lg bg-sea-600 hover:bg-sea-700 text-white text-sm font-semibold transition-colors cursor-pointer">
              Print invoice
            </button>
            <button onClick={onDone} className="px-4 py-2 rounded-lg border border-soft text-main text-sm font-semibold hover:bg-sand-50 transition-colors cursor-pointer">
              Done
            </button>
          </div>
        </div>
      </aside>
      {printOpen && createPortal(
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-900/60 p-4 flex flex-col items-center" onClick={() => setPrintOpen(false)}>
          <div className="w-full max-w-3xl mb-8" onClick={e => e.stopPropagation()}>
            <PrintInvoiceModal bookingsToPrint={created} rooms={rooms} venues={venues} bookingsList={bookings} onClose={() => setPrintOpen(false)} embedded />
          </div>
        </div>, document.body)}
    </div>
  )
}
