import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Booking, Room, Venue } from '../../types/booking'
import { InvoiceDocument } from './InvoiceDocument'
import { buildStatement } from '../../utils/statement'

interface PrintInvoiceModalProps {
  booking?: Booking
  bookingsToPrint?: Booking[]
  rooms: Room[]
  venues: Venue[]
  bookingsList: Booking[]
  onClose: () => void
  embedded?: boolean
}

// Controller for the printable "Guest Billing Statement": computes the
// structured line items + totals and hands them to the presentational
// <InvoiceDocument />, which mirrors the paper form.
export function PrintInvoiceModal({ booking, bookingsToPrint, rooms, venues, bookingsList, onClose, embedded = false }: PrintInvoiceModalProps) {
  const primaryBooking = booking || (bookingsToPrint && bookingsToPrint[0])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!primaryBooking) return null

  const relatedBookings = bookingsToPrint ||
    (primaryBooking.invoice_number
      ? bookingsList.filter(b => b.invoice_number === primaryBooking.invoice_number)
      : [primaryBooking])

  const statement = buildStatement({ primaryBooking, relatedBookings, rooms, venues, bookingsList })

  const handlePrint = () => window.print()

  const doc = (
    <InvoiceDocument
      primaryBooking={primaryBooking}
      rooms={rooms}
      venues={venues}
      statement={statement}
      onClose={onClose}
      onPrint={handlePrint}
      embedded={embedded}
    />
  )

  if (embedded) return doc

  return createPortal(
    <div className="fixed inset-0 z-50 p-3 sm:p-4 bg-slate-900/50 print:bg-white print:p-0 print:static overflow-y-auto">
      {doc}
    </div>,
    document.body
  )
}
