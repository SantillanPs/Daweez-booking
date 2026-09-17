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

  // The hotel prints receipts on a 58 mm thermal roll. The page box is set only
  // for the moment of printing (the style is injected, then removed), so the A4
  // billing statement keeps its own page size instead of inheriting this one.
  const handlePrint = () => {
    const style = document.createElement('style')
    style.textContent = '@page { size: 58mm auto; margin: 3mm; }'
    document.head.appendChild(style)
    const done = () => {
      style.remove()
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    window.print()
    // Backstop: some browsers never fire afterprint.
    window.setTimeout(done, 60000)
  }

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
