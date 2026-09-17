import React from 'react'
import { Room, Venue, BookingSource, PartnerDeal } from '../../types/booking'
import { CircleDollarSign } from 'lucide-react'

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
  formUsePromo: boolean
  partnerDeals?: PartnerDeal[]
  formPartnerDealId?: string
  formPaymentMethod?: string
  setFormPaymentMethod?: (val: string) => void
  /** Required field — chosen at booking so the payment can be verified later. */
  paymentMethodError?: string
  onPaymentMethodBlur?: () => void
  formPaymentPlan?: 'deposit' | 'full'
  setFormPaymentPlan?: (val: 'deposit' | 'full') => void
  formVenueExcessHours?: number

  // Edit Mode Overrides
  isEditMode?: boolean
  formInvoiceNumber?: string
  setFormInvoiceNumber?: (val: string) => void
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
    formAdditionalDiscount,
    bookingType,
    formUsePromo,
    partnerDeals,
    formPartnerDealId,
    formPaymentMethod,
    setFormPaymentMethod,
    paymentMethodError,
    onPaymentMethodBlur,
    formPaymentPlan,
    setFormPaymentPlan,
    isEditMode,
    formInvoiceNumber,
    setFormInvoiceNumber,
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
    const plan: 'deposit' | 'full' = formPaymentPlan === 'full' ? 'full' : 'deposit'

    let undiscountedBaseTotal = 0
    let promoAmount = 0
    let additionalAmount = 0

    Object.entries(unitSelections).forEach(([id, sel]) => {
      const isRoom = sel.type === 'room'
      const room = isRoom ? rooms.find(r => r.id === id) : undefined
      const venue = !isRoom ? venues.find(v => v.id === id) : undefined
      const regularPrice = isRoom ? (room?.base_price ?? 0) : (venue?.base_price ?? 0)
      const promoPrice = isRoom ? (room?.promo_price ?? null) : (venue?.promo_price ?? null)

      const nights = sel.checkIn && sel.checkOut
        ? Math.max(1, Math.ceil((new Date(sel.checkOut).getTime() - new Date(sel.checkIn).getTime()) / 86400000))
        : 1

      const contractedRate = deal?.contracted_rates[id]
      const hasPromo = formUsePromo && promoPrice != null && promoPrice > 0
      const stdPrice = contractedRate !== undefined && contractedRate !== null
        ? contractedRate
        : regularPrice
      // Undiscounted total always uses regular/contracted price
      undiscountedBaseTotal += stdPrice * nights
      if (hasPromo && contractedRate == null) {
        const perNightSaving = Math.max(0, regularPrice - promoPrice)
        promoAmount += perNightSaving * nights
      }
      if (formAdditionalDiscount > 0) {
        additionalAmount += Math.round(stdPrice * (formAdditionalDiscount / 100)) * nights
      }
    })

    return (
      <div className="space-y-4 font-sans">
        <div className="flex items-center gap-2 pb-0.5 border-b border-base-300 hidden md:flex">
          <span className="w-5 h-5 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0"><CircleDollarSign className="w-3 h-3" /></span>
          <h4 className="text-[9px] font-bold text-primary tracking-widest uppercase">Price Estimate</h4>
        </div>

        {formStatus === 'confirmed' ? (
          <div className="bg-gradient-to-br from-base-100 to-base-200 border border-primary/20 p-3 rounded-xl text-xs space-y-2.5 shadow-sm relative overflow-hidden text-base-content animate-fade-in">
            <div className="absolute top-0 inset-x-0 h-1 bg-primary" />
            
            {/* Header */}
            <div className="text-center border-b border-base-300 pb-3">
              <div className="text-[10px] text-primary font-bold tracking-widest uppercase mb-0.5">
                {bookingType === 'partner' ? 'Corporate Booking Cost' : 'Estimated Cost'}
              </div>
              <h5 className="text-[13px] font-black text-base-content tracking-tight uppercase">Daweez Pension House</h5>
              <span className="text-[8px] font-bold text-base-content/60 block mt-0.5 uppercase tracking-wider">
                {bookingType === 'partner' ? `${deal?.name.replace(/\s+/g, '-').toUpperCase() || 'PARTNER'} Booking` : 'Walk-in Booking'}
              </span>
            </div>
            
            {/* Company Info Box */}
            {bookingType === 'partner' && deal && (
              <div className="bg-base-200/50 border border-base-300 rounded-md p-3 text-[10px] space-y-1.5 text-base-content/60">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-base-content/60 font-bold tracking-wider uppercase font-sans">Company</span>
                  <span className="font-bold text-base-content">{deal.name}</span>
                </div>
                {deal.contact_no && (
                  <div className="flex justify-between items-center pt-1 border-t border-base-300">
                    <span className="text-[9px] text-base-content/60 font-bold tracking-wider uppercase font-sans">Contact No</span>
                    <span className="font-semibold text-base-content font-mono">{deal.contact_no}</span>
                  </div>
                )}
                {deal.email && (
                  <div className="flex justify-between items-center pt-1 border-t border-base-300">
                    <span className="text-[9px] text-base-content/60 font-bold tracking-wider uppercase font-sans">Email Address</span>
                    <span className="font-semibold text-base-content">{deal.email}</span>
                  </div>
                )}
              </div>
            )}

            {/* Selected Rooms / Items List */}
            <div className="space-y-2.5 text-slate-650 font-medium">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-base-content/60 uppercase tracking-wider text-[9px]">Rooms</span>
                <span className="font-bold text-base-content bg-base-200 border border-base-300 px-2 py-0.5 rounded-full">{unitCount} room{unitCount > 1 ? 's' : ''}</span>
              </div>

              {hasRooms && (
                <div className="space-y-1.5 border-t border-dashed border-base-300 pt-2.5">
                  {Object.entries(unitSelections).filter(([, s]) => s.type === 'room').map(([id, sel]) => {
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
                          <span className="font-bold text-base-content text-[11px] whitespace-nowrap">Room {r.room_number}</span>
                          <span className="text-[9px] bg-base-300/50 border border-base-300/60 text-base-content/60 px-1 rounded font-mono">{sel.checkIn.substring(5)} to {sel.checkOut.substring(5)}</span>
                          <span className="text-[9px] text-base-content/60 font-bold whitespace-nowrap">({nights}N)</span>
                        </div>
                        <span className="font-extrabold text-success font-mono text-[11px]">₱{(displayPrice * nights).toLocaleString()}</span>
                      </div>
                    ) : null
                  })}
                </div>
              )}

              {hasVenues && (
                <div className="space-y-1.5 border-t border-base-300 pt-2">
                  {Object.entries(unitSelections).filter(([, s]) => s.type === 'venue').map(([id, sel]) => {
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
                          <span className="font-bold text-base-content text-[11px] whitespace-nowrap max-w-[80px] truncate">{v.name}</span>
                          <span className="text-[9px] bg-base-300/50 border border-base-300/60 text-base-content/60 px-1 rounded font-mono">{sel.checkIn.substring(5)} to {sel.checkOut.substring(5)}</span>
                          <span className="text-[9px] text-base-content/60 font-bold whitespace-nowrap">({nights}D)</span>
                        </div>
                        <span className="font-extrabold text-success font-mono text-[11px]">₱{(displayPrice * nights).toLocaleString()}</span>
                      </div>
                    ) : null
                  })}
                </div>
              )}

              {(estBreakfast > 0 || estRentals > 0 || estAddons > 0) && (
                <div className="space-y-1.5 border-t border-dashed border-base-300 pt-2">
                  {estBreakfast > 0 && (
                    <div className="flex justify-between items-center text-slate-750 font-medium">
                      <span>Breakfast</span>
                      <span className="font-extrabold text-success font-mono">₱{estBreakfast.toLocaleString()}</span>
                    </div>
                  )}
                  {estRentals > 0 && (
                    <div className="flex justify-between items-center text-slate-750 font-medium">
                      <span>Extras</span>
                      <span className="font-extrabold text-success font-mono">₱{estRentals.toLocaleString()}</span>
                    </div>
                  )}
                  {estAddons > 0 && (
                    <div className="flex justify-between items-center text-slate-750 font-medium">
                      <span>Venue Extras</span>
                      <span className="font-extrabold text-success font-mono">₱{estAddons.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Discounts and Rates */}
            <div className="border-t border-base-300 pt-3.5 space-y-2">
              <div className="flex justify-between text-base-content/60 font-semibold text-[11px]">
                <span>Standard Price</span>
                <span className="font-mono text-success font-bold">₱{undiscountedBaseTotal.toLocaleString()}</span>
              </div>
              
              {formUsePromo && promoAmount > 0 && (
                <div className="flex justify-between items-center text-success font-bold text-sm bg-success/10 border border-success/20 px-2.5 py-1 rounded-md animate-in fade-in">
                  <span>Promo Price</span>
                  <span className="font-mono">-₱{promoAmount.toLocaleString()}</span>
                </div>
              )}
              {additionalAmount > 0 && (
                <div className="flex justify-between items-center text-error font-bold text-sm bg-error/10 border border-error/20 px-2.5 py-1 rounded-md animate-in fade-in">
                  <span>Additional Discount ({formAdditionalDiscount}%)</span>
                  <span className="font-mono">-₱{additionalAmount.toLocaleString()}</span>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex justify-between items-center text-base-content border-t border-base-300 pt-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/60">Total Cost</span>
                <span className="text-[17px] font-black text-success font-mono">₱{estTotal.toLocaleString()}</span>
              </div>

              {/* Split Payment Cards Grid */}
              <div className="grid grid-cols-2 gap-2.5 border-t border-base-300 pt-3.5">
                <div className="bg-success/10 border border-success/20 rounded-md p-2 text-center animate-in fade-in">
                  <span className="text-[9px] text-success font-bold uppercase tracking-wider block">Deposit (50%)</span>
                  <span className="text-[13px] font-black text-success block mt-0.5 font-mono">₱{estDown.toLocaleString()}</span>
                </div>
                <div className="bg-base-200/80 border border-base-300 rounded-md p-2 text-center animate-in fade-in">
                  <span className="text-[9px] text-primary font-bold uppercase tracking-wider block">Balance at check-in</span>
                  <span className="text-[13px] font-black text-primary block mt-0.5 font-mono">₱{estDue.toLocaleString()}</span>
                </div>
              </div>

              {/* What the guest pays now, and how. Printed on the Guest Billing
                  Statement and read back in the booking quick view, which then
                  expects that money (plus a GCash / bank reference) to be
                  recorded. Nothing is taken here — the guest gets the statement
                  first. Leaving the method blank prints every way to pay. */}
              {setFormPaymentMethod && (
                <div className="border-t border-base-300 pt-3.5 mt-3 space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/60 block">What the guest pays now</span>

                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'deposit' as const, label: 'Deposit (50%)', amount: estDown },
                      { value: 'full' as const, label: 'Pay in full', amount: estTotal },
                    ]).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormPaymentPlan?.(opt.value)}
                        className={'rounded-md border px-2 py-2 text-center transition-colors cursor-pointer ' + (plan === opt.value ? 'border-brand-primary bg-brand-bg' : 'border-base-300 bg-base-100 hover:bg-base-200')}
                      >
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-base-content/60">{opt.label}</span>
                        <span className="block text-[13px] font-black font-mono text-base-content mt-0.5">₱{opt.amount.toLocaleString()}</span>
                      </button>
                    ))}
                  </div>

                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/60 block mb-1">
                      Payment method <span className="text-danger-500">*</span>
                    </span>
                    <select
                      value={formPaymentMethod || ''}
                      onChange={e => setFormPaymentMethod(e.target.value)}
                      onBlur={onPaymentMethodBlur}
                      className={paymentMethodError ? 'select select-bordered select-sm w-full select-error' : 'select select-bordered select-sm w-full'}
                    >
                      <option value="">Choose how the guest will pay</option>
                      <option value="Cash">Cash</option>
                      <option value="GCash">GCash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                    {paymentMethodError && <p className="text-[10px] text-error mt-1">{paymentMethodError}</p>}
                  </label>

                  <p className="text-[10px] text-base-content/60 leading-snug">
                    Expecting <strong className="text-base-content font-mono">₱{(plan === 'full' ? estTotal : estDown).toLocaleString()}</strong>
                    {plan === 'full' ? ' in full' : ' deposit'}{formPaymentMethod ? ' by ' + formPaymentMethod : ''} when they pay.
                    No payment is recorded yet — hand them the statement first.
                  </p>
                </div>
              )}

              {/* Edit Mode Overrides */}
              {isEditMode && setFormDownpaymentPaid && (
                <div className="border-t border-base-300 pt-3.5 mt-3 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/60 block mb-1">Correct the money</span>
                  <p className="text-[10px] text-base-content/60">For an existing booking only. The payment status follows whatever you enter here.</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-base-content">Downpayment Paid (₱)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formDownpaymentPaid || ''}
                        onChange={e => setFormDownpaymentPaid?.(parseFloat(e.target.value) || 0)}
                        className="input input-bordered w-full"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-base-content">Balance Due (₱)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formBalanceDue || ''}
                        onChange={e => setFormBalanceDue?.(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder={`Auto: ${estDue}`}
                        className="input input-bordered w-full"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-base-content">Security Deposit (₱)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formSecurityDeposit || ''}
                        onChange={e => setFormSecurityDeposit?.(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="Optional"
                        className="input input-bordered w-full"
                      />
                    </div>
                    {setFormInvoiceNumber && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-base-content">Invoice Number</label>
                        <input
                          type="text"
                          value={formInvoiceNumber || ''}
                          onChange={e => setFormInvoiceNumber(e.target.value)}
                          placeholder="Auto-generated if empty"
                          className="input input-bordered w-full"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-primary/10 border border-primary/30 p-5 rounded-md text-xs space-y-2 text-primary font-sans">
            <div className="text-center border-b border-dashed border-base-300 pb-2">
              <div className="text-[9px] text-primary font-bold tracking-widest uppercase mb-1">Calendar Block</div>
              <h5 className="text-sm font-extrabold text-base-content tracking-tight uppercase">DAWEEZ PENSION HOUSE</h5>
            </div>
            <p className="text-base-content/60 text-center text-[10px] py-4 leading-normal font-medium">
              This reservation will be marked as <strong className="text-primary">Blocked</strong>. No prices or payments will be recorded.
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
      prevProps.formUsePromo === nextProps.formUsePromo &&
      prevProps.formPartnerDealId === nextProps.formPartnerDealId &&
      prevProps.formPaymentMethod === nextProps.formPaymentMethod &&
      prevProps.paymentMethodError === nextProps.paymentMethodError &&
      prevProps.formPaymentPlan === nextProps.formPaymentPlan &&
      prevProps.formVenueExcessHours === nextProps.formVenueExcessHours &&
      prevProps.isEditMode === nextProps.isEditMode &&
      prevProps.formInvoiceNumber === nextProps.formInvoiceNumber &&
      prevProps.formDownpaymentPaid === nextProps.formDownpaymentPaid &&
      prevProps.formBalanceDue === nextProps.formBalanceDue &&
      prevProps.formSecurityDeposit === nextProps.formSecurityDeposit
    )
  }
)