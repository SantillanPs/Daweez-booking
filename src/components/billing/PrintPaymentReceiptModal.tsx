import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Booking, PaymentRecord, Room, Venue } from '../../types/booking'
import { PaymentReceiptDocument } from './PaymentReceiptDocument'

interface PrintPaymentReceiptModalProps {
  booking: Booking
  record: PaymentRecord
  rooms: Room[]
  venues: Venue[]
  onClose: () => void
  embedded?: boolean
}

// Controller for the printable payment receipt: hands the booking + the one
// payment record to the presentational <PaymentReceiptDocument />.
export function PrintPaymentReceiptModal({ booking, record, rooms, venues, onClose, embedded = false }: PrintPaymentReceiptModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handlePrint = () => window.print()
  const doc = (
    <PaymentReceiptDocument
      booking={booking}
      record={record}
      rooms={rooms}
      venues={venues}
      onClose={onClose}
      onPrint={handlePrint}
      embedded={embedded}
    />
  )

  if (embedded) return doc

  return createPortal(
    <div className="fixed inset-0 z-[70] p-3 sm:p-4 bg-slate-900/50 print:bg-white print:p-0 print:static overflow-y-auto">
      {doc}
    </div>,
    document.body
  )
}
