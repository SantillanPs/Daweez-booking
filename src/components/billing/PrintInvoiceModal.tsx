import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Booking, Room, Venue } from '../../types/booking'
import * as syncEngine from '../../utils/syncEngine'
import { X, Printer } from 'lucide-react'
import { useDashboardData } from '../DashboardContext'

interface PrintInvoiceModalProps {
  booking?: Booking
  bookingsToPrint?: Booking[]
  rooms: Room[]
  venues: Venue[]
  bookingsList: Booking[]
  onClose: () => void
}

export function PrintInvoiceModal({
  booking,
  bookingsToPrint,
  rooms,
  venues,
  bookingsList,
  onClose
}: PrintInvoiceModalProps) {
  const primaryBooking = booking || (bookingsToPrint && bookingsToPrint[0])
  if (!primaryBooking) return null

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const { partnerDeals } = useDashboardData()
  const deal = partnerDeals.find(d => d.id === primaryBooking.partner_deal_id)

  const relatedBookings = bookingsToPrint || 
    (primaryBooking.invoice_number 
      ? bookingsList.filter(b => b.invoice_number === primaryBooking.invoice_number)
      : [primaryBooking])

  const pricingAggregate = {
    undiscountedSubtotal: 0,
    subtotal: 0,
    discountAmount: 0,
    breakfastTotal: 0,
    rentalsTotal: 0,
    addonsTotal: 0,
    grandTotal: 0,
    downpaymentPaid: 0,
    balanceDue: 0
  }

  const breakdownRows: React.ReactNode[] = []
  
  relatedBookings.forEach((b) => {
    const isRoom = !!b.room_id
    const unitId = b.room_id || b.venue_id || ''
    const unitName = isRoom
      ? (rooms.find(r => r.id === unitId)?.name || `Room ${rooms.find(r => r.id === unitId)?.room_number || ''}`)
      : (venues.find(v => v.id === unitId)?.name || 'Event Venue')

    const nights = b.check_in && b.check_out
      ? Math.max(1, Math.ceil((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000))
      : 1

    let breakfastTotal = 0
    if (isRoom) {
      const guestCount = 1 + (b.companions?.length || 0)
      const bDeal = bookingsList.find(bx => bx.id === b.id)?.partner_deal_id
        ? partnerDeals.find(d => d.id === b.partner_deal_id)
        : undefined
      const isBreakfastIncluded = bDeal ? bDeal.breakfast_default === 'with' : b.breakfast_included
      if (!isBreakfastIncluded) {
        breakfastTotal = 150 * guestCount * nights
      }
    } else if (b.breakfast_orders) {
      b.breakfast_orders.forEach(order => {
        breakfastTotal += 150 * order.quantity
      })
    }

    let rentalsTotal = 0
    if (b.equipment_rentals) {
      if (isRoom) {
        const nightlyRentals =
          ((b.equipment_rentals.extraFoamCount || 0) * 200) +
          ((b.equipment_rentals.extraPillowCount || 0) * 50) +
          ((b.equipment_rentals.extraBlanketCount || 0) * 50) +
          ((b.equipment_rentals.extraTowelCount || 0) * 50)
        rentalsTotal += nightlyRentals * nights
      } else {
        rentalsTotal += ((b.equipment_rentals.bigTableCount || 0) * 150)
        rentalsTotal += ((b.equipment_rentals.smallTableCount || 0) * 100)
        rentalsTotal += ((b.equipment_rentals.chairCount || 0) * 15)
        rentalsTotal += ((b.equipment_rentals.mineralWaterCount || 0) * 35)
        rentalsTotal += ((b.equipment_rentals.tableCount || 0) * 150)
        rentalsTotal += ((b.equipment_rentals.tentCount || 0) * 500)
      }
    }

    let addonsTotal = 0
    if (b.event_addons) {
      if (b.event_addons.fullBandAndLights) addonsTotal += 2000
      if (b.event_addons.stage) addonsTotal += 2000
      if (b.event_addons.ledWall) addonsTotal += 5000
    }

    const actualSubtotal = Number(b.downpayment_paid) + Number(b.balance_due) - Number(b.security_deposit) - (breakfastTotal + rentalsTotal + addonsTotal)

    const basePrice = b.contract_rate_override !== undefined && b.contract_rate_override !== null
      ? b.contract_rate_override
      : isRoom
        ? (rooms.find(r => r.id === b.room_id)?.base_price || 0)
        : (venues.find(v => v.id === b.venue_id)?.base_price || 0)
    const undiscountedSubtotal = basePrice * nights

    const derivedMultiplier = undiscountedSubtotal > 0
      ? Math.min(1.0, Math.max(0.0, actualSubtotal / undiscountedSubtotal))
      : 1.0

    const pricing = syncEngine.calculatePricing({
      roomId: b.room_id,
      venueId: b.venue_id,
      checkIn: b.check_in,
      checkOut: b.check_out,
      guestEmail: b.guest_email,
      breakfastOrders: b.breakfast_orders,
      equipmentRentals: b.equipment_rentals,
      eventAddons: b.event_addons,
      companions: b.companions,
      bookingsList,
      rateMultiplier: derivedMultiplier,
      contractRateOverride: b.contract_rate_override
    })

    pricingAggregate.undiscountedSubtotal += pricing.undiscountedSubtotal
    pricingAggregate.subtotal += pricing.subtotal
    pricingAggregate.discountAmount += pricing.discountAmount
    pricingAggregate.breakfastTotal += pricing.breakfastTotal
    pricingAggregate.rentalsTotal += pricing.rentalsTotal
    pricingAggregate.addonsTotal += pricing.addonsTotal
    pricingAggregate.grandTotal += pricing.grandTotal
    pricingAggregate.downpaymentPaid += Number(b.downpayment_paid || 0)
    pricingAggregate.balanceDue += Number(b.balance_due || 0)

    breakdownRows.push(
      <React.Fragment key={b.id}>
        <tr>
          <td className="py-3 font-semibold text-main">
            {unitName} - Base Rate stay
            {b.contract_rate_override ? ' (Corporate Preset Rate)' : ''}
          </td>
          <td className="py-3 text-right font-mono">{nights}</td>
          <td className="py-3 text-right font-mono">
            ₱{(b.contract_rate_override || basePrice).toLocaleString()}
          </td>
          <td className="py-3 text-right font-mono font-semibold text-main">
            ₱{((b.contract_rate_override || basePrice) * nights).toLocaleString()}
          </td>
        </tr>
        {pricing.breakfastTotal > 0 && (
          <tr>
            <td className="py-3 pl-4 text-muted">↳ Breakfast order (₱150/guest/night)</td>
            <td className="py-3 text-right font-mono text-muted">
              {b.companions ? b.companions.length + 1 : 1} guest(s) × {nights} nights
            </td>
            <td className="py-3 text-right font-mono text-muted">₱150</td>
            <td className="py-3 text-right font-mono font-semibold text-muted">
              ₱{pricing.breakfastTotal.toLocaleString()}
            </td>
          </tr>
        )}
        {pricing.rentalsTotal > 0 && (
          <tr>
            <td className="py-3 pl-4 text-muted">↳ Extra foam / pillows / linens rentals</td>
            <td className="py-3 text-right font-mono text-muted">—</td>
            <td className="py-3 text-right font-mono text-muted">—</td>
            <td className="py-3 text-right font-mono font-semibold text-muted">
              ₱{pricing.rentalsTotal.toLocaleString()}
            </td>
          </tr>
        )}
        {pricing.addonsTotal > 0 && (
          <tr>
            <td className="py-3 pl-4 text-muted">↳ Event Add-ons</td>
            <td className="py-3 text-right font-mono text-muted">—</td>
            <td className="py-3 text-right font-mono text-muted">—</td>
            <td className="py-3 text-right font-mono font-semibold text-muted">
              ₱{pricing.addonsTotal.toLocaleString()}
            </td>
          </tr>
        )}
      </React.Fragment>
    )
  })

  // Format invoice number
  // If no generated invoice_number is stored, generate one on-the-fly for preview
  const displayInvoiceNumber = primaryBooking.invoice_number || (
    `GRF-${primaryBooking.check_in.substring(0, 7).replace('-', '')}-PREVIEW`
  )

  const handlePrint = () => {
    window.print()
  }

  const modalContent = (
    <div className="fixed inset-0 z-50 p-3 sm:p-4 bg-slate-900/50 print:bg-white print:p-0 print:static overflow-y-auto">
      {/* Print Wrapper Container */}
      <div className="bg-card w-full max-w-3xl mx-auto rounded-xl shadow-2xl overflow-hidden flex flex-col my-8 print:my-0 print:shadow-none print:rounded-none print:w-full print:max-w-none">
        
        {/* Modal Controls (Hidden during print) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0 print:hidden font-sans">
          <div className="flex items-center gap-2">
            <span className="bg-brand-primary text-xs font-bold px-2 py-0.5 rounded text-main uppercase">
              Guest Folio
            </span>
            <span className="text-xs font-mono text-muted">{displayInvoiceNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-brand-primary hover:bg-brand-text text-slate-950 font-bold text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              onClick={onClose}
              className="text-muted hover:text-white transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Body (Printed Area) */}
        <div className="p-8 md:p-12 overflow-y-auto print:p-0 print:overflow-visible flex-1 bg-card font-sans text-main leading-relaxed print:static">
          
          {/* Header section */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-soft pb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight font-serif uppercase">
                Daweez Pension Hotel
              </h1>
              <p className="text-xs text-muted font-medium mt-1">
                Panglao Island, Bohol, Philippines
              </p>
              <p className="text-xs text-muted font-medium">
                Email: reservations@daweezpensionhotel.com | Contact: +63 917 889 8978
              </p>
            </div>
            <div className="text-left sm:text-right">
              <h2 className="text-sm font-extrabold text-brand-text uppercase tracking-wider">
                GUEST FOLIO
              </h2>
              <div className="mt-2 text-xs font-medium space-y-0.5 text-muted">
                <div><span className="text-muted">Invoice No:</span> <strong className="font-mono text-slate-950">{displayInvoiceNumber}</strong></div>
                <div><span className="text-muted">Date Issued:</span> <span className="font-mono">{new Date(primaryBooking.created_at).toLocaleDateString()}</span></div>
                <div><span className="text-muted">Status:</span> <span className="uppercase text-emerald-600 font-bold">{primaryBooking.status}</span></div>
              </div>
            </div>
          </div>

          {/* Billed To Section (For Agency/Billing) */}
          {(primaryBooking.company_name || deal) && (
            <div className="py-6 border-b border-soft text-xs">
              <h3 className="text-muted font-bold uppercase tracking-wider mb-2">Bill To:</h3>
              <div className="space-y-1">
                <strong className="text-main text-[14px] uppercase block">{primaryBooking.company_name || deal?.name}</strong>
                {deal?.tin && <div><span className="text-muted">TIN:</span> <span className="font-mono font-medium">{deal.tin}</span></div>}
                {deal?.address && <div><span className="text-muted">Address:</span> <span className="font-medium">{deal.address}</span></div>}
              </div>
            </div>
          )}

          {/* Unified Guest & Stay Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6 border-b border-soft text-xs">
            {/* Left Column: Guest Info */}
            <div>
              <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Guest Information</h3>
              <div className="grid grid-cols-[120px_1fr] gap-y-1.5 items-center">
                <span className="text-muted font-semibold">Primary Guest</span>
                <strong className="text-main text-[13px]">{primaryBooking.guest_name}</strong>
                
                <span className="text-muted font-semibold">Contact No</span>
                <span className="text-main font-mono font-medium">{primaryBooking.guest_phone || 'None'}</span>
                
                <span className="text-muted font-semibold">Email Address</span>
                <span className="text-main font-medium truncate">{primaryBooking.guest_email || 'None'}</span>
                
                <span className="text-muted font-semibold">Vehicle Plate</span>
                <span className="text-main font-mono font-semibold uppercase">{primaryBooking.vehicle_plate || 'N/A'}</span>
                
                {primaryBooking.company_name && (
                  <>
                    <span className="text-muted font-semibold mt-2">Company / Agency</span>
                    <strong className="text-main font-semibold mt-2">{primaryBooking.company_name}</strong>
                  </>
                )}
                {deal?.tin && (
                  <>
                    <span className="text-muted font-semibold">TIN</span>
                    <span className="text-main font-mono font-medium">{deal.tin}</span>
                  </>
                )}
                {deal?.address && (
                  <>
                    <span className="text-muted font-semibold self-start mt-0.5">Billing Address</span>
                    <span className="text-main font-medium">{deal.address}</span>
                  </>
                )}
              </div>
            </div>

            {/* Right Column: Stay Info */}
            <div>
              <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Stay Details</h3>
              <div className="grid grid-cols-[120px_1fr] gap-y-2 items-center">
                <span className="text-muted font-semibold">Unit Details</span>
                <strong className="text-main text-[13px] bg-page px-2 py-0.5 rounded border border-soft/60 inline-flex w-fit flex-wrap gap-1">
                  {relatedBookings.map(b => {
                    const isR = !!b.room_id
                    const uId = b.room_id || b.venue_id || ''
                    const uName = isR
                      ? (rooms.find(r => r.id === uId)?.name || `Room ${rooms.find(r => r.id === uId)?.room_number || ''}`)
                      : (venues.find(v => v.id === uId)?.name || 'Event Venue')
                    return <span key={b.id} className="bg-slate-100/50 px-1.5 rounded border border-slate-200/50">{uName}</span>
                  })}
                </strong>
                
                <span className="text-muted font-semibold">Check-in Date</span>
                <strong className="text-main font-mono bg-emerald-50 px-2 py-0.5 rounded text-emerald-700 inline-flex w-fit border border-emerald-100/50">
                  {primaryBooking.check_in ? new Date(primaryBooking.check_in).toLocaleDateString() : 'TBD'}
                </strong>
                
                <span className="text-muted font-semibold">Check-out Date</span>
                <strong className="text-main font-mono bg-rose-50 px-2 py-0.5 rounded text-rose-700 inline-flex w-fit border border-rose-100/50">
                  {primaryBooking.check_out ? new Date(primaryBooking.check_out).toLocaleDateString() : 'TBD'}
                </strong>
                
                <span className="text-muted font-semibold">Duration</span>
                <span className="text-main font-bold">
                  {Math.max(1, Math.ceil((new Date(primaryBooking.check_out).getTime() - new Date(primaryBooking.check_in).getTime()) / 86400000))} 
                  {!!primaryBooking.room_id ? ' Night(s)' : ' Day(s)'}
                </span>
              </div>
            </div>
          </div>

          {/* Companions Section */}
          {primaryBooking.companions && primaryBooking.companions.length > 0 && (
            <div className="py-4 border-b border-soft text-xs">
              <span className="text-muted font-semibold block mb-2 uppercase tracking-wider">Registered Roommates / Companions</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {primaryBooking.companions.map((c, i) => (
                  <div key={i} className="bg-page p-2 rounded border border-soft/60 font-medium flex justify-between">
                    <span className="text-main">{c.name}</span>
                    <span className="text-muted text-[10px] capitalize">{c.gender}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Statement Items Table */}
          <div className="mt-6">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Charges Breakdown</h3>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-soft text-muted font-semibold bg-slate-550/5">
                  <th className="py-2">Item Description</th>
                  <th className="py-2 text-right">Quantity / Nights</th>
                  <th className="py-2 text-right">Unit Price</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-main">
                {breakdownRows}
              </tbody>
            </table>
          </div>

          {/* Calculations / Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 pt-6 border-t-2 border-soft">
            {/* GCash / Landbank billing details (GRB ONLY) */}
            <div>
              <div className="bg-[#FAF7F2] border border-[#EBE1D1] rounded-xl p-4 text-[11px] text-brand-text space-y-2 leading-relaxed">
                <strong className="text-xs uppercase tracking-wider block font-bold">Bank Transfer & Digital Payments</strong>
                <p>To settle balances, please transfer to either of the following official channels:</p>
                <div className="border-t border-[#EBE1D1] pt-2 space-y-1 font-medium">
                  <div>
                    <span className="text-muted block font-bold">GCASH ACCOUNT:</span>
                    <strong className="text-brand-text text-xs font-mono font-bold">DAWEEZ PENSION HOTEL</strong>
                    <span className="text-muted font-mono block">Number: 0917-889-8978</span>
                  </div>
                  <div className="pt-1.5">
                    <span className="text-muted block font-bold">LANDBANK ACCOUNT:</span>
                    <strong className="text-brand-text text-xs font-mono font-bold">DAWEEZ PENSION HOTEL</strong>
                    <span className="text-muted font-mono block">Account No: 1234-5678-90</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Price Ledger summary */}
            <div className="space-y-2 text-xs font-medium">
              <div className="flex justify-between text-muted">
                <span>Room Rate:</span>
                <span className="font-mono">₱{pricingAggregate.undiscountedSubtotal.toLocaleString()}</span>
              </div>
              {pricingAggregate.discountAmount > 0 && (
                <div className="flex justify-between text-rose-600 font-semibold">
                  <span>Direct Booking Discount ({Math.round((pricingAggregate.discountAmount / pricingAggregate.undiscountedSubtotal) * 100)}%):</span>
                  <span className="font-mono">-₱{pricingAggregate.discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-muted border-t border-soft pt-1.5">
                <span>Total Before Discounts:</span>
                <span className="font-mono">₱{pricingAggregate.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Add-ons / rentals:</span>
                <span className="font-mono">₱{(pricingAggregate.breakfastTotal + pricingAggregate.rentalsTotal + pricingAggregate.addonsTotal).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-main border-t border-soft pt-2 font-bold">
                <span>Total Amount:</span>
                <span className="font-mono text-[13px] text-slate-950 font-extrabold">₱{pricingAggregate.grandTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-650 border-t border-soft pt-2">
                <span>Downpayment Paid:</span>
                <span className="font-mono text-emerald-600 font-bold">-₱{pricingAggregate.downpaymentPaid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-brand-text border-t border-soft/60 pt-2 font-bold text-[13px]">
                <span>Amount to Pay:</span>
                <span className="font-mono text-[15px] text-brand-text font-extrabold">₱{pricingAggregate.balanceDue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-12 mt-16 pt-8 border-t border-dashed border-soft text-center text-xs">
            <div className="flex flex-col justify-end h-16">
              <div className="border-b border-slate-400 mx-auto w-3/4"></div>
              <span className="text-muted font-semibold uppercase tracking-wider block mt-2">PREPARED BY (STAFF)</span>
            </div>
            <div className="flex flex-col justify-end h-16">
              <div className="border-b border-slate-400 mx-auto w-3/4"></div>
              <span className="text-muted font-semibold uppercase tracking-wider block mt-2">RECEIVED BY (GUEST SIGNATURE)</span>
            </div>
          </div>

        </div>
      </div>

      {/* Global CSS Print rules overlay */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:static, .print\\:static * {
            visibility: visible;
          }
          .print\\:static {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )

  return createPortal(modalContent, document.body)
}
