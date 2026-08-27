import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Booking, Room, Venue } from '../../types/booking'
import * as syncEngine from '../../utils/syncEngine'
import { useDashboardData } from '../DashboardContext'
import { InvoiceDocument, InvoiceTotals } from './InvoiceDocument'
import { roomDisplayName } from '../calendar/bookingStyles'

interface PrintInvoiceModalProps {
  booking?: Booking
  bookingsToPrint?: Booking[]
  rooms: Room[]
  venues: Venue[]
  bookingsList: Booking[]
  onClose: () => void
  embedded?: boolean
}

// Controller for the printable guest folio: computes totals + breakdown rows
// and hands them to the presentational <InvoiceDocument />.
export function PrintInvoiceModal({ booking, bookingsToPrint, rooms, venues, bookingsList, onClose, embedded = false }: PrintInvoiceModalProps) {
  const primaryBooking = booking || (bookingsToPrint && bookingsToPrint[0])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const { partnerDeals } = useDashboardData()

  if (!primaryBooking) return null

  const deal = partnerDeals.find(d => d.id === primaryBooking.partner_deal_id)

  const relatedBookings = bookingsToPrint ||
    (primaryBooking.invoice_number
      ? bookingsList.filter(b => b.invoice_number === primaryBooking.invoice_number)
      : [primaryBooking])

  const unitName = (b: Booking) => {
    const isRoom = !!b.room_id
    const id = b.room_id || b.venue_id || ''
    return isRoom
      ? roomDisplayName(rooms.find(r => r.id === id))
      : (venues.find(v => v.id === id)?.name || 'Event Venue')
  }

  const nightlyRateFor = (b: Booking) => {
    const isRoom = !!b.room_id
    const room = rooms.find(r => r.id === b.room_id)
    const venue = venues.find(v => v.id === b.venue_id)
    const usePromo = (b as Booking & { promo_applied?: boolean }).promo_applied === true
    if (b.contract_rate_override != null) return b.contract_rate_override
    const promo = isRoom ? room?.promo_price ?? null : venue?.promo_price ?? null
    if (usePromo && promo != null && promo > 0) return promo
    return (isRoom ? room?.base_price : venue?.base_price) || 0
  }

  const totals: InvoiceTotals = {
    undiscountedSubtotal: 0, subtotal: 0, discountAmount: 0,
    breakfastTotal: 0, rentalsTotal: 0, addonsTotal: 0,
    grandTotal: 0, downpaymentPaid: 0, balanceDue: 0
  }

  const breakdownRows: React.ReactNode[] = []

  relatedBookings.forEach(b => {
    const nights = b.check_in && b.check_out
      ? Math.max(1, Math.ceil((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000))
      : 1

    const usePromo = (b as Booking & { promo_applied?: boolean }).promo_applied === true

    const pricing = syncEngine.calculatePricing({
      roomId: b.room_id,
      venueId: b.venue_id,
      checkIn: b.check_in,
      checkOut: b.check_out,
      guestEmail: b.guest_email,
      breakfastOrders: b.breakfast_orders == null ? [] : b.breakfast_orders,
      equipmentRentals: b.equipment_rentals,
      eventAddons: b.event_addons,
      companions: b.companions,
      bookingsList,
      contractRateOverride: b.contract_rate_override,
      rooms,
      venues,
      usePromo,
    })

    totals.undiscountedSubtotal += pricing.undiscountedSubtotal
    totals.subtotal += pricing.subtotal
    totals.discountAmount += pricing.discountAmount
    totals.breakfastTotal += pricing.breakfastTotal
    totals.rentalsTotal += pricing.rentalsTotal
    totals.addonsTotal += pricing.addonsTotal
    totals.grandTotal += pricing.grandTotal
    totals.downpaymentPaid += Number(b.downpayment_paid || 0)
    totals.balanceDue += Number(b.balance_due || 0)

    const rateLabel = b.contract_rate_override != null ? ' — corporate rate' : usePromo ? ' — promo rate' : ''
    breakdownRows.push(
      <React.Fragment key={b.id}>
        <tr>
          <td className="py-2.5 pr-3 align-top">
            <div className="text-[13px] font-semibold text-main">{unitName(b)}{rateLabel}</div>
            <div className="text-[11.5px] text-muted mt-0.5">{nights} {nights === 1 ? 'night' : 'nights'} × ₱{nightlyRateFor(b).toLocaleString()}</div>
          </td>
          <td className="py-2.5 text-right font-mono font-semibold text-main whitespace-nowrap align-top">₱{pricing.subtotal.toLocaleString()}</td>
        </tr>
        {pricing.breakfastTotal > 0 && (
          <tr>
            <td className="py-1.5 pr-3 text-[12.5px] text-muted">Breakfast (₱150/guest/night)</td>
            <td className="py-1.5 text-right font-mono text-muted whitespace-nowrap">₱{pricing.breakfastTotal.toLocaleString()}</td>
          </tr>
        )}
        {pricing.rentalsTotal > 0 && (
          <tr>
            <td className="py-1.5 pr-3 text-[12.5px] text-muted">Extra foam / pillows / linens</td>
            <td className="py-1.5 text-right font-mono text-muted whitespace-nowrap">₱{pricing.rentalsTotal.toLocaleString()}</td>
          </tr>
        )}
        {pricing.addonsTotal > 0 && (
          <tr>
            <td className="py-1.5 pr-3 text-[12.5px] text-muted">Event add-ons</td>
            <td className="py-1.5 text-right font-mono text-muted whitespace-nowrap">₱{pricing.addonsTotal.toLocaleString()}</td>
          </tr>
        )}
      </React.Fragment>
    )
  })

  const displayInvoiceNumber = primaryBooking.invoice_number || (
    'GRF-' + primaryBooking.check_in.substring(0, 7).replace('-', '') + '-PREVIEW'
  )

  const handlePrint = () => window.print()

  const doc = (
    <InvoiceDocument
      primaryBooking={primaryBooking}
      relatedBookings={relatedBookings}
      rooms={rooms}
      venues={venues}
      deal={deal}
      breakdownRows={breakdownRows}
      totals={totals}
      displayInvoiceNumber={displayInvoiceNumber}
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
