import React from 'react'
import { Room, Venue, BookingSource, PartnerDeal } from '../../types/booking'

interface BillingSummaryProps {
  formStatus: 'confirmed' | 'blocked'
  unitSelections: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>
  rooms: Room[]
  venues: Venue[]
  estBreakfast: number
  estRentals: number
  estAddons: number
  estTotal: number
  estDown: number
  estDue: number
  formSource: BookingSource
  formAdditionalDiscount: number
  guestEmail?: string
  bookingType: 'individual' | 'partner'
  formWalkInDiscount: boolean
  partnerDeals?: PartnerDeal[]
  formPartnerDealId?: string
  formPaymentMethod?: string
  setFormPaymentMethod?: (val: string) => void
  formPaymentReference?: string
  setFormPaymentReference?: (val: string) => void
  formVenueExcessHours?: number

  // Edit Mode Overrides
  isEditMode?: boolean
  formInvoiceNumber?: string
  setFormInvoiceNumber?: (val: string) => void
  formPaymentStatus?: 'unpaid' | 'downpayment' | 'paid'
  setFormPaymentStatus?: (val: 'unpaid' | 'downpayment' | 'paid') => void
  formDownpaymentPaid?: number
  setFormDownpaymentPaid?: (val: number) => void
  formBalanceDue?: number | null
  setFormBalanceDue?: (val: number | null) => void
  formSecurityDeposit?: number | null
  setFormSecurityDeposit?: (val: number | null) => void
}

export const BillingSummary = React.memo(
  ({
    formStatus,
    unitSelections,
    rooms,
    venues,
    estBreakfast,
    estRentals,
    estAddons,
    estTotal,
    estDown,
    estDue,
    formSource,
    formAdditionalDiscount,
    guestEmail,
    bookingType,
    formWalkInDiscount,
    partnerDeals,
    formPartnerDealId,
    formPaymentMethod,
    setFormPaymentMethod,
    formPaymentReference,
    setFormPaymentReference,
    formVenueExcessHours,
    isEditMode,
    formInvoiceNumber,
    setFormInvoiceNumber,
    formPaymentStatus,
    setFormPaymentStatus,
    formDownpaymentPaid,
    setFormDownpaymentPaid,
    formBalanceDue,
    setFormBalanceDue,
    formSecurityDeposit,
    setFormSecurityDeposit
  }: BillingSummaryProps) => {
    const unitCount = Object.keys(unitSelections).length
    const hasRooms = Object.values(unitSelections).some(s => s.type === 'room')
    const hasVenues = Object.values(unitSelections).some(s => s.type === 'venue')

    const deal = partnerDeals?.find(d => d.id === formPartnerDealId)

    let undiscountedBaseTotal = 0
    let walkInAmount = 0
    let additionalAmount = 0

    Object.entries(unitSelections).forEach(([id, sel]) => {
      const isRoom = sel.type === 'room'
      const stdPrice = isRoom
        ? (rooms.find(r => r.id === id)?.base_price ?? 0)
        : (venues.find(v => v.id === id)?.base_price ?? 0)

      const nights = sel.checkIn && sel.checkOut
        ? Math.max(1, Math.ceil((new Date(sel.checkOut).getTime() - new Date(sel.checkIn).getTime()) / 86400000))
        : 1

      const contractedRate = deal?.contracted_rates[id]
      const price = contractedRate !== undefined && contractedRate !== null
        ? contractedRate
        : stdPrice

      undiscountedBaseTotal += price * nights
      if (formWalkInDiscount) {
        walkInAmount += Math.round(price * 0.2) * nights
      }
      if (formAdditionalDiscount > 0) {
        additionalAmount += Math.round(price * (formAdditionalDiscount / 100)) * nights
      }
    })

    return (
      <div className="space-y-4 font-sans">
        <h4 className="text-[9px] font-bold text-brand-text tracking-widest uppercase md:block hidden pb-0.5 border-b border-soft/40">
          Price Estimate
        </h4>

        {formStatus === 'confirmed' ? (
          <div className="bg-gradient-to-br from-white to-[#FDFBF9] border border-brand-border p-5 rounded-lg text-xs space-y-4 shadow-sm relative overflow-hidden text-brand-text animate-fade-in">
            <div className="absolute top-0 inset-x-0 h-1 bg-brand-primary" />
            
            {/* Header */}
            <div className="text-center border-b border-brand-border/40 pb-3">
              <div className="text-[10px] text-brand-text font-bold tracking-widest uppercase mb-0.5">
                {bookingType === 'partner' ? 'Corporate Booking Cost' : 'Estimated Cost'}
              </div>
              <h5 className="text-[13px] font-black text-main tracking-tight uppercase">Daweez Pension House</h5>
              <span className="text-[8px] font-bold text-muted block mt-0.5 uppercase tracking-wider">
                {bookingType === 'partner' ? `${deal?.name.replace(/\s+/g, '-').toUpperCase() || 'PARTNER'} Booking` : 'Walk-in Booking'}
              </span>
            </div>
            
            {/* Company Info Box */}
            {bookingType === 'partner' && deal && (
              <div className="bg-[#FAF7F2]/50 border border-brand-border/30 rounded-md p-3 text-[10px] space-y-1.5 text-muted">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-muted font-bold tracking-wider uppercase font-sans">Company</span>
                  <span className="font-bold text-main">{deal.name}</span>
                </div>
                {deal.contact_no && (
                  <div className="flex justify-between items-center pt-1 border-t border-brand-border/20">
                    <span className="text-[9px] text-muted font-bold tracking-wider uppercase font-sans">Contact No</span>
                    <span className="font-semibold text-main font-mono">{deal.contact_no}</span>
                  </div>
                )}
                {deal.email && (
                  <div className="flex justify-between items-center pt-1 border-t border-brand-border/20">
                    <span className="text-[9px] text-muted font-bold tracking-wider uppercase font-sans">Email Address</span>
                    <span className="font-semibold text-main">{deal.email}</span>
                  </div>
                )}
              </div>
            )}

            {/* Selected Rooms / Items List */}
            <div className="space-y-2.5 text-slate-650 font-medium">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-muted uppercase tracking-wider text-[9px]">Rooms</span>
                <span className="font-bold text-main bg-[#FAF7F2] border border-brand-border/40 px-2 py-0.5 rounded-full">{unitCount} room{unitCount > 1 ? 's' : ''}</span>
              </div>

              {hasRooms && (
                <div className="space-y-1.5 border-t border-dashed border-brand-border/40 pt-2.5">
                  {Object.entries(unitSelections).filter(([_, s]) => s.type === 'room').map(([id, sel]) => {
                    const r = rooms.find(room => room.id === id)
                    const nights = sel.checkIn && sel.checkOut
                      ? Math.max(1, Math.ceil((new Date(sel.checkOut).getTime() - new Date(sel.checkIn).getTime()) / 86400000))
                      : 1
                    const contractedRate = deal?.contracted_rates[id]
                    const displayPrice = contractedRate !== undefined && contractedRate !== null
                      ? contractedRate
                      : (r?.base_price ?? 0)
                    return r ? (
                      <div key={id} className="flex justify-between items-center text-slate-750 font-medium py-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-main text-[11px] whitespace-nowrap">Room {r.room_number}</span>
                          <span className="text-[9px] bg-softbg border border-soft/50 text-muted px-1 rounded font-mono">{sel.checkIn.substring(5)} to {sel.checkOut.substring(5)}</span>
                          <span className="text-[9px] text-muted font-bold whitespace-nowrap">({nights}N)</span>
                        </div>
                        <span className="font-extrabold text-emerald-600 font-mono text-[11px]">₱{(displayPrice * nights).toLocaleString()}</span>
                      </div>
                    ) : null
                  })}
                </div>
              )}

              {hasVenues && (
                <div className="space-y-1.5 border-t border-brand-border/40 pt-2">
                  {Object.entries(unitSelections).filter(([_, s]) => s.type === 'venue').map(([id, sel]) => {
                    const v = venues.find(venue => venue.id === id)
                    const nights = sel.checkIn && sel.checkOut
                      ? Math.max(1, Math.ceil((new Date(sel.checkOut).getTime() - new Date(sel.checkIn).getTime()) / 86400000))
                      : 1
                    const contractedRate = deal?.contracted_rates[id]
                    const displayPrice = contractedRate !== undefined && contractedRate !== null
                      ? contractedRate
                      : (v?.base_price ?? 0)
                    return v ? (
                      <div key={id} className="flex justify-between items-center text-slate-750 font-medium py-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-main text-[11px] whitespace-nowrap max-w-[80px] truncate">{v.name}</span>
                          <span className="text-[9px] bg-softbg border border-soft/50 text-muted px-1 rounded font-mono">{sel.checkIn.substring(5)} to {sel.checkOut.substring(5)}</span>
                          <span className="text-[9px] text-muted font-bold whitespace-nowrap">({nights}D)</span>
                        </div>
                        <span className="font-extrabold text-emerald-600 font-mono text-[11px]">₱{(displayPrice * nights).toLocaleString()}</span>
                      </div>
                    ) : null
                  })}
                </div>
              )}

              {(estBreakfast > 0 || estRentals > 0 || estAddons > 0) && (
                <div className="space-y-1.5 border-t border-dashed border-brand-border/40 pt-2">
                  {estBreakfast > 0 && (
                    <div className="flex justify-between items-center text-slate-750 font-medium">
                      <span>Breakfast</span>
                      <span className="font-extrabold text-emerald-600 font-mono">₱{estBreakfast.toLocaleString()}</span>
                    </div>
                  )}
                  {estRentals > 0 && (
                    <div className="flex justify-between items-center text-slate-750 font-medium">
                      <span>Extras</span>
                      <span className="font-extrabold text-emerald-600 font-mono">₱{estRentals.toLocaleString()}</span>
                    </div>
                  )}
                  {estAddons > 0 && (
                    <div className="flex justify-between items-center text-slate-750 font-medium">
                      <span>Venue Extras</span>
                      <span className="font-extrabold text-emerald-600 font-mono">₱{estAddons.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Discounts and Rates */}
            <div className="border-t border-brand-border/40 pt-3.5 space-y-2">
              <div className="flex justify-between text-muted font-semibold text-[11px]">
                <span>Standard Price</span>
                <span className="font-mono text-emerald-600 font-bold">₱{undiscountedBaseTotal.toLocaleString()}</span>
              </div>
              
              {formWalkInDiscount && walkInAmount > 0 && (
                <div className="flex justify-between items-center text-rose-700 font-bold text-[11px] bg-rose-50/50 border border-rose-100/50 px-2.5 py-1 rounded-md animate-in fade-in">
                  <span>Direct Booking Discount (20%)</span>
                  <span className="font-mono">-₱{walkInAmount.toLocaleString()}</span>
                </div>
              )}
              {additionalAmount > 0 && (
                <div className="flex justify-between items-center text-rose-700 font-bold text-[11px] bg-rose-50/50 border border-rose-100/50 px-2.5 py-1 rounded-md animate-in fade-in">
                  <span>Additional Discount ({formAdditionalDiscount}%)</span>
                  <span className="font-mono">-₱{additionalAmount.toLocaleString()}</span>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex justify-between items-center text-main border-t border-brand-border/40 pt-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Total Cost</span>
                <span className="text-[17px] font-black text-emerald-600 font-mono">₱{estTotal.toLocaleString()}</span>
              </div>

              {/* Split Payment Cards Grid */}
              <div className="grid grid-cols-2 gap-2.5 border-t border-brand-border/40 pt-3.5">
                <div className="bg-emerald-50/60 border border-emerald-100/80 rounded-md p-2 text-center animate-in fade-in">
                  <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider block">Pay Now (50%)</span>
                  <span className="text-[13px] font-black text-emerald-700 block mt-0.5 font-mono">₱{estDown.toLocaleString()}</span>
                </div>
                <div className="bg-[#FAF7F2]/80 border border-brand-border/40 rounded-md p-2 text-center animate-in fade-in">
                  <span className="text-[9px] text-brand-text font-bold uppercase tracking-wider block">Pay at Check-in</span>
                  <span className="text-[13px] font-black text-brand-text block mt-0.5 font-mono">₱{estDue.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Details */}
              {(setFormPaymentMethod && setFormPaymentReference) && (
                <div className="border-t border-brand-border/40 pt-3.5 mt-3 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">Payment Details</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-main">Method</label>
                      <select
                        value={formPaymentMethod || ''}
                        onChange={e => setFormPaymentMethod(e.target.value)}
                        className="w-full bg-page/50 border border-soft rounded px-2.5 py-1.5 text-xs text-main focus:outline-none focus:border-brand-primary/50 transition-colors cursor-pointer appearance-none"
                      >
                        <option value="">Select...</option>
                        <option value="Cash">Cash</option>
                        <option value="GCash">GCash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-main">Reference / Date</label>
                      <input
                        type="text"
                        value={formPaymentReference || ''}
                        onChange={e => setFormPaymentReference(e.target.value)}
                        placeholder="e.g. 123456789"
                        className="w-full bg-page/50 border border-soft rounded px-2.5 py-1.5 text-xs text-main focus:outline-none focus:border-brand-primary/50 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Mode Overrides */}
              {isEditMode && setFormPaymentStatus && (
                <div className="border-t border-brand-border/40 pt-3.5 mt-3 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">Financial Overrides</span>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-main">Payment Status</label>
                    <select
                      value={formPaymentStatus || 'unpaid'}
                      onChange={e => setFormPaymentStatus(e.target.value as 'unpaid' | 'downpayment' | 'paid')}
                      className="w-full bg-page/50 border border-soft rounded px-2.5 py-1.5 text-xs text-main focus:outline-none focus:border-brand-primary/50 transition-colors cursor-pointer appearance-none"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="downpayment">Downpayment Paid</option>
                      <option value="paid">Fully Paid</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-main">Downpayment Paid (₱)</label>
                      <input
                        type="number"
                        min="0"
                        value={formDownpaymentPaid ?? ''}
                        onChange={e => setFormDownpaymentPaid?.(parseFloat(e.target.value) || 0)}
                        className="w-full bg-page/50 border border-soft rounded px-2.5 py-1.5 text-xs text-main focus:outline-none focus:border-brand-primary/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-main">Balance Due (₱)</label>
                      <input
                        type="number"
                        min="0"
                        value={formBalanceDue ?? ''}
                        onChange={e => setFormBalanceDue?.(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder={`Auto: ${estDue}`}
                        className="w-full bg-page/50 border border-soft rounded px-2.5 py-1.5 text-xs text-main focus:outline-none focus:border-brand-primary/50 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-main">Security Deposit (₱)</label>
                      <input
                        type="number"
                        min="0"
                        value={formSecurityDeposit ?? ''}
                        onChange={e => setFormSecurityDeposit?.(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="Optional"
                        className="w-full bg-page/50 border border-soft rounded px-2.5 py-1.5 text-xs text-main focus:outline-none focus:border-brand-primary/50 transition-colors"
                      />
                    </div>
                    {setFormInvoiceNumber && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-main">Invoice Number</label>
                        <input
                          type="text"
                          value={formInvoiceNumber || ''}
                          onChange={e => setFormInvoiceNumber(e.target.value)}
                          placeholder="Auto-generated if empty"
                          className="w-full bg-page/50 border border-soft rounded px-2.5 py-1.5 text-xs text-main focus:outline-none focus:border-brand-primary/50 transition-colors"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-brand-bg border border-brand-border p-5 rounded-md text-xs space-y-2 text-brand-text font-sans">
            <div className="text-center border-b border-dashed border-brand-border pb-2">
              <div className="text-[9px] text-brand-text font-bold tracking-widest uppercase mb-1">Calendar Block</div>
              <h5 className="text-sm font-extrabold text-main tracking-tight uppercase">DAWEEZ PENSION HOUSE</h5>
            </div>
            <p className="text-muted text-center text-[10px] py-4 leading-normal font-medium">
              This reservation will be marked as <strong className="text-brand-text">Blocked</strong>. No prices or payments will be recorded.
            </p>
          </div>
        )}
      </div>
    )
  },
  (prevProps, nextProps) => {
    // Compare selection records
    const prevKeys = Object.keys(prevProps.unitSelections)
    const nextKeys = Object.keys(nextProps.unitSelections)
    if (prevKeys.length !== nextKeys.length) return false

    const selectionsMatch = prevKeys.every(k => {
      const p = prevProps.unitSelections[k]
      const n = nextProps.unitSelections[k]
      return n && p.checkIn === n.checkIn && p.checkOut === n.checkOut && p.type === n.type
    })

    return (
      selectionsMatch &&
      prevProps.formStatus === nextProps.formStatus &&
      prevProps.estBreakfast === nextProps.estBreakfast &&
      prevProps.estRentals === nextProps.estRentals &&
      prevProps.estAddons === nextProps.estAddons &&
      prevProps.estTotal === nextProps.estTotal &&
      prevProps.estDown === nextProps.estDown &&
      prevProps.estDue === nextProps.estDue &&
      prevProps.rooms === nextProps.rooms &&
      prevProps.venues === nextProps.venues &&
      prevProps.formSource === nextProps.formSource &&
      prevProps.formAdditionalDiscount === nextProps.formAdditionalDiscount &&
      prevProps.guestEmail === nextProps.guestEmail &&
      prevProps.bookingType === nextProps.bookingType &&
      prevProps.formWalkInDiscount === nextProps.formWalkInDiscount &&
      prevProps.formPartnerDealId === nextProps.formPartnerDealId &&
      prevProps.formPaymentMethod === nextProps.formPaymentMethod &&
      prevProps.formPaymentReference === nextProps.formPaymentReference &&
      prevProps.formVenueExcessHours === nextProps.formVenueExcessHours &&
      prevProps.isEditMode === nextProps.isEditMode &&
      prevProps.formInvoiceNumber === nextProps.formInvoiceNumber &&
      prevProps.formPaymentStatus === nextProps.formPaymentStatus &&
      prevProps.formDownpaymentPaid === nextProps.formDownpaymentPaid &&
      prevProps.formBalanceDue === nextProps.formBalanceDue &&
      prevProps.formSecurityDeposit === nextProps.formSecurityDeposit
    )
  }
)
