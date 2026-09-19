import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Booking, Room, Venue } from '../../types/booking'
import { TabLine } from '../../types/tab'
import { InvoiceDocument } from './InvoiceDocument'
import { buildStatement } from '../../utils/statement'
import { getOpenTabLinesByBooking } from '../../utils/tabs'

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
//
// The guest's food and bar tab (k69) is read first and folded into the statement,
// because the balance the screen shows already includes it — a bill printed
// without it would disagree with what the guest actually owes.
export function PrintInvoiceModal({ booking, bookingsToPrint, rooms, venues, bookingsList, onClose, embedded = false }: PrintInvoiceModalProps) {
  const primaryBooking = booking || (bookingsToPrint && bookingsToPrint[0])

  const relatedBookings = primaryBooking
    ? (bookingsToPrint ||
      (primaryBooking.invoice_number
        ? bookingsList.filter(b => b.invoice_number === primaryBooking.invoice_number)
        : [primaryBooking]))
    : []

  // Null until the tab has been read, so a short bill is never shown even for a
  // moment — the page is held back rather than printed wrong.
  const [tabLinesByBooking, setTabLinesByBooking] = useState<Record<string, TabLine[]> | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const map = await getOpenTabLinesByBooking(relatedBookings.map(b => b.id))
      if (!cancelled) setTabLinesByBooking(map)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryBooking?.id])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!primaryBooking) return null
  if (!tabLinesByBooking) return null

  const statement = buildStatement({ primaryBooking, relatedBookings, rooms, venues, bookingsList, tabLinesByBooking })

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
