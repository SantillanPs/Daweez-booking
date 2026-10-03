import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Booking, Room, Venue } from '../../types/booking'
import { TabLine } from '../../types/tab'
import { InvoiceDocument } from './InvoiceDocument'
import { AgencyInvoiceDocument } from './AgencyInvoiceDocument'
import { buildStatement } from '../../utils/statement'
import { getOpenTabLinesByBooking } from '../../utils/tabs'
import { useDashboardData } from '../DashboardContext'
import { groupOf } from '../../utils/bookingGroup'

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
  const asked = booking || (bookingsToPrint && bookingsToPrint[0])
  // The agency that is paying, if any: its address, contact and TIN print on the bill
  // straight from the profile, so no booking column is needed for them.
  const { partnerDeals } = useDashboardData()

  // Every room of the booking, whichever room the bill was asked from — and the bill
  // carries the FIRST room's number, so a reprint from Room 9 is the same paper as the
  // one printed from Room 7.
  const relatedBookings = asked ? (bookingsToPrint || groupOf(asked, bookingsList)) : []
  const primaryBooking = relatedBookings[0] || asked

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

  const statement = buildStatement({
    primaryBooking, relatedBookings, rooms, venues, bookingsList, tabLinesByBooking,
    deal: partnerDeals.find(d => d.id === primaryBooking.partner_deal_id) ?? null,
  })

  // The statement prints on A5 (the hotel's own bill pad) with the page box set to **zero margin**: that is what
  // stops the browser printing its own header (the date/time and the page title) and
  // footer (the URL and page number) across the top and bottom of the bill — the paper
  // carries its own margins instead (see `StatementShell`). The style is injected for the
  // moment of printing only, the way the 58 mm receipt modal sets its own page box.
  const handlePrint = () => {
    const style = document.createElement('style')
    style.textContent = '@page { size: A5; margin: 0; }'
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

  // WHICH BILL (the owner's design, 2026-09): an ordinary booking gets the usual Guest
  // Billing Statement; **an agency booking gets its own document**, read line by line from
  // the hotel's real PGO bill — the paper's banded room table, `TOTAL` only, both bank
  // accounts, `Prepared by` and the thank-you line, with no Pension Policies and no guest
  // signature. The two never mix, and the normal bill is untouched by any of it.
  const doc = statement.companyName ? (
    <AgencyInvoiceDocument
      primaryBooking={primaryBooking}
      statement={statement}
      onClose={onClose}
      onPrint={handlePrint}
      embedded={embedded}
    />
  ) : (
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
