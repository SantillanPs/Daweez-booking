import React from 'react'
import { Printer, X } from 'lucide-react'
import { Booking, Room, Venue, PartnerDeal } from '../../types/booking'
import { roomDisplayName } from '../calendar/bookingStyles'

export interface InvoiceTotals {
  undiscountedSubtotal: number
  subtotal: number
  discountAmount: number
  breakfastTotal: number
  rentalsTotal: number
  addonsTotal: number
  grandTotal: number
  downpaymentPaid: number
  balanceDue: number
}

interface InvoiceDocumentProps {
  primaryBooking: Booking
  relatedBookings: Booking[]
  rooms: Room[]
  venues: Venue[]
  deal?: PartnerDeal | null
  breakdownRows: React.ReactNode[]
  totals: InvoiceTotals
  displayInvoiceNumber: string
  onClose: () => void
  onPrint: () => void
  embedded?: boolean
}

const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

// The printable guest folio. Designed to be read top-to-bottom: who, what,
// how much, and one big "Amount to pay" figure the guest can't miss.
export function InvoiceDocument({ primaryBooking, relatedBookings, rooms, venues, deal, breakdownRows, totals, displayInvoiceNumber, onClose, onPrint, embedded = false }: InvoiceDocumentProps) {
  const nights = Math.max(1, Math.ceil((new Date(primaryBooking.check_out).getTime() - new Date(primaryBooking.check_in).getTime()) / 86400000))
  const durationLabel = primaryBooking.room_id ? (nights === 1 ? 'night' : 'nights') : (nights === 1 ? 'day' : 'days')
  const depositRequired = Math.round(totals.grandTotal * 0.5)
  const isFullyPaid = totals.balanceDue <= 0
  const statusLabel = primaryBooking.status === 'confirmed' ? 'Confirmed' : primaryBooking.status === 'pending' ? 'On hold' : 'Blocked'
  const statusColor = primaryBooking.status === 'confirmed' ? 'text-emerald-600' : primaryBooking.status === 'pending' ? 'text-amber-600' : 'text-muted'

  const unitLabel = (b: Booking) => {
    const isRoom = !!b.room_id
    const id = b.room_id || b.venue_id || ''
    return isRoom
      ? roomDisplayName(rooms.find(r => r.id === id))
      : (venues.find(v => v.id === id)?.name ?? 'Event Venue')
  }

  const hasGuestEmail = primaryBooking.guest_email && primaryBooking.guest_email !== 'admin@daweez-booking.vercel.app'

  return (
    <div className={'bg-card w-full max-w-3xl mx-auto rounded-xl shadow-2xl overflow-hidden flex flex-col print:my-0 print:shadow-none print:rounded-none print:w-full print:max-w-none ' + (embedded ? 'my-0 shadow-xl' : 'my-8')}>
      {/* Modal controls (hidden when printing) */}
      <div className="flex items-center justify-between px-5 py-3 bg-sea-900 text-white shrink-0 print:hidden">
        <div className="flex items-center gap-2">
          <span className="bg-white text-sea-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase">Guest folio</span>
          <span className="text-xs font-mono text-white/70">{displayInvoiceNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onPrint} className="bg-white hover:bg-sand-100 text-sea-800 font-bold text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer">
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable body */}
      <div className="p-6 md:p-10 overflow-y-auto print:p-6 print:overflow-visible flex-1 bg-card font-sans text-main leading-relaxed print:static">

        {/* Brand header */}
        <div className="border-t-4 border-sea-600 bg-sand-100 rounded-lg px-5 py-4 flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h1 className="font-display font-extrabold text-xl md:text-[22px] text-sea-800 uppercase tracking-tight">Daweez Pension Hotel</h1>
            <p className="text-[12px] text-muted mt-0.5">Panglao Island, Bohol, Philippines</p>
            <p className="text-[11px] text-muted">reservations@daweezpensionhotel.com · +63 917 889 8978</p>
          </div>
          <div className="text-left sm:text-right">
            <h2 className="font-display font-bold text-[13px] text-sea-700 uppercase tracking-widest">Guest folio</h2>
            <div className="mt-1.5 text-[12px] text-main space-y-0.5">
              <div>Invoice <strong className="font-mono">{displayInvoiceNumber}</strong></div>
              <div>Issued <span className="font-mono">{fmtDate(primaryBooking.created_at)}</span></div>
              <div>Status <span className={'uppercase font-bold ' + statusColor}>{statusLabel}</span></div>
            </div>
          </div>
        </div>

        {/* Guest & stay */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-soft">
          <div>
            <h3 className="text-[11px] font-bold text-sea-700 uppercase tracking-wider mb-2.5">Guest</h3>
            <p className="text-[18px] font-bold text-main leading-tight">{primaryBooking.guest_name}</p>
            <div className="mt-1.5 space-y-0.5 text-[13px] text-muted">
              <p>{primaryBooking.guest_phone || 'No phone number'}</p>
              {hasGuestEmail && <p className="truncate">{primaryBooking.guest_email}</p>}
              {primaryBooking.vehicle_plate && <p>Plate: <span className="uppercase font-semibold text-main">{primaryBooking.vehicle_plate}</span></p>}
            </div>
            {(primaryBooking.company_name || deal) && (
              <div className="mt-3 pt-3 border-t border-soft/70">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Bill to</p>
                <p className="text-[13px] font-bold text-main uppercase">{primaryBooking.company_name || deal?.name}</p>
                {deal?.tin && <p className="text-[12px] text-muted">TIN: {deal.tin}</p>}
                {deal?.address && <p className="text-[12px] text-muted">{deal.address}</p>}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-[11px] font-bold text-sea-700 uppercase tracking-wider mb-2.5">Stay</h3>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {relatedBookings.map(b => (
                <span key={b.id} className="text-[12px] font-semibold bg-page border border-soft rounded-md px-2 py-1">{unitLabel(b)}</span>
              ))}
            </div>
            <div className="space-y-1.5 text-[13px]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-1.5 py-0.5">In</span>
                <strong className="font-mono text-main">{fmtDate(primaryBooking.check_in)}</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-100 rounded px-1.5 py-0.5">Out</span>
                <strong className="font-mono text-main">{fmtDate(primaryBooking.check_out)}</strong>
              </div>
              <div>Stay: <strong className="text-main">{nights} {durationLabel}</strong></div>
            </div>
            {primaryBooking.companions && primaryBooking.companions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-soft/70">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Guests staying with them</p>
                <div className="flex flex-wrap gap-1.5">
                  {primaryBooking.companions.map((c, i) => (
                    <span key={i} className="text-[11.5px] bg-page border border-soft rounded-md px-2 py-0.5">
                      {c.name} <span className="text-muted capitalize">({c.gender})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Charges */}
        <div className="py-6 border-b border-soft">
          <h3 className="text-[11px] font-bold text-sea-700 uppercase tracking-wider mb-3">Charges</h3>
          <table className="w-full text-[13px] text-left">
            <tbody className="divide-y divide-soft/70">{breakdownRows}</tbody>
          </table>
        </div>

        {/* Payment summary — the part the guest looks at */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-5">
          <div className="md:col-span-3 bg-sand-50 border border-sand-200 rounded-xl p-5 space-y-2.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted">Total</span>
              <span className="font-bold text-main">₱{totals.grandTotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted">Deposit (50%)</span>
              <span className="text-main font-semibold">₱{depositRequired.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted">Paid so far</span>
              <span className="font-bold text-emerald-600">−₱{totals.downpaymentPaid.toLocaleString()}</span>
            </div>
            <div className="flex items-end justify-between border-t border-soft pt-3">
              <span className="text-[12px] font-bold uppercase tracking-wider text-muted">Amount to pay</span>
              <span className="font-display text-[28px] font-extrabold leading-none text-sea-700">₱{totals.balanceDue.toLocaleString()}</span>
            </div>
            {isFullyPaid && (
              <p className="text-[13px] font-bold text-emerald-600">✓ Fully paid — thank you!</p>
            )}
          </div>
          <div className="md:col-span-2 bg-page border border-soft rounded-xl p-4 text-[11.5px] text-muted space-y-1.5 leading-relaxed">
            <p className="text-[11px] font-bold uppercase tracking-wider text-main">How to pay the balance</p>
            <p>GCash: <strong className="text-main font-mono">0917 889 8978</strong></p>
            <p>Landbank: <strong className="text-main font-mono">1234-5678-90</strong></p>
            <p className="pt-1">Send a screenshot of the payment and we'll update your folio.</p>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-12 mt-10 pt-6 border-t border-dashed border-soft text-center text-xs">
          <div className="flex flex-col justify-end h-16">
            <div className="border-b border-slate-400 mx-auto w-3/4"></div>
            <span className="text-muted font-bold uppercase tracking-wider block mt-2">Prepared by (staff)</span>
          </div>
          <div className="flex flex-col justify-end h-16">
            <div className="border-b border-slate-400 mx-auto w-3/4"></div>
            <span className="text-muted font-bold uppercase tracking-wider block mt-2">Received by (guest)</span>
          </div>
        </div>

      </div>
    </div>
  )
}
