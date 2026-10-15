import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Booking, PaymentRecord, Room, Venue } from '../../types/booking'
import { PaymentReceiptDocument } from './PaymentReceiptDocument'
import { useSlipPage } from './useSlipPage'

interface PrintPaymentReceiptModalProps {
  booking: Booking
  record: PaymentRecord
  rooms: Room[]
  venues: Venue[]
  onClose: () => void
  embedded?: boolean
  /** Every booking this payment covered, when it covered more than one — see `PaymentReceiptDocument`. */
  covered?: Booking[]
}

// Controller for the printable payment receipt: hands the booking + the one
// payment record to the presentational <PaymentReceiptDocument />.
export function PrintPaymentReceiptModal({ booking, record, rooms, venues, onClose, embedded = false, covered }: PrintPaymentReceiptModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // The hotel prints receipts on a 58 mm thermal roll; `useSlipPage` sizes the page.
  useSlipPage()
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
      covered={covered}
    />
  )

  if (embedded) return doc

  return createPortal(
    // The receipt rises in rather than appearing in one frame: after a payment it follows the
    // seal, and a slip that slammed in over it read as broken (the owner, 2026-10-15).
    <div className="fixed inset-0 z-[70] p-3 sm:p-4 bg-slate-900/50 print:bg-white print:p-0 print:static overflow-y-auto bp-dim print:[animation:none]">
      <div className="bp-rise motion-reduce:[animation:none] print:[animation:none]">{doc}</div>
    </div>,
    document.body
  )
}
