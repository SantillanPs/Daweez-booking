import React from 'react'
import { Room, Venue, BookingSource, PartnerDeal } from '../../types/booking'
import { Mail, Printer } from 'lucide-react'

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
    formPartnerDealId
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
        <h4 className="text-[9px] font-bold text-[#9A783E] tracking-widest uppercase md:block hidden pb-0.5 border-b border-slate-200/40">
          Statement Estimate
        </h4>

        {formStatus === 'confirmed' ? (
          <div className="bg-[#FDFBF7] border border-[#E5D5C0] p-5 rounded-md text-xs space-y-4 shadow-sm relative overflow-hidden text-[#9A783E] animate-fade-in">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-[#B89251]" />
            <div className="text-center border-b border-dashed border-[#E5D5C0] pb-4">
              <div className="text-[9px] text-[#9A783E] font-bold tracking-widest uppercase mb-1 font-sans">
                {bookingType === 'partner' ? 'Guest Registration & Billing' : 'Estimated Invoice'}
              </div>
              <h5 className="text-sm font-extrabold text-slate-800 tracking-tight uppercase font-sans">Daweez Pension House</h5>
              <span className="text-[8px] font-mono text-slate-400 block mt-0.5">
                {bookingType === 'partner' ? `VOUCHER #${deal?.name.replace(/\s+/g, '-').toUpperCase() || 'PARTNER'}` : 'VOUCHER #WALK-IN'}
              </span>
            </div>

            {bookingType === 'partner' && deal && (
              <div className="border-b border-dashed border-[#E5D5C0] pb-3 text-[10px] space-y-1 text-slate-600 font-medium">
                <div className="flex justify-between">
                  <span className="text-slate-400 uppercase font-semibold">COMPANY:</span>
                  <span className="font-bold text-slate-800">{deal.name}</span>
                </div>
                {deal.contact_no && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase font-semibold">CONTACT NO:</span>
                    <span className="font-mono text-slate-800">{deal.contact_no}</span>
                  </div>
                )}
                {deal.email && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase font-semibold">EMAIL ADDRESS:</span>
                    <span className="text-slate-800 break-all">{deal.email}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 text-slate-600 font-medium">
              <div className="flex justify-between">
                <span>Selected Rooms:</span>
                <span className="font-mono text-slate-800 font-semibold">{unitCount} room{unitCount > 1 ? 's' : ''}</span>
              </div>

              {hasRooms && (
                <>
                  <div className="border-t border-dashed border-[#E5D5C0] my-2" />
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Rooms</div>
                  <div className="text-[10px] text-slate-500 pl-2 space-y-1 font-mono">
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
                        <div key={id} className="flex justify-between">
                          <span>Room {r.room_number} ({nights} night{nights > 1 ? 's' : ''}):</span>
                          <span>₱{(displayPrice * nights).toLocaleString()}</span>
                        </div>
                      ) : null
                    })}
                  </div>
                </>
              )}

              {hasVenues && (
                <>
                  <div className="border-t border-dashed border-[#E5D5C0] my-2" />
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Event Venues</div>
                  <div className="text-[10px] text-slate-500 pl-2 space-y-1 font-mono">
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
                        <div key={id} className="flex justify-between">
                          <span>{v.name} ({nights} day{nights > 1 ? 's' : ''}):</span>
                          <span>₱{(displayPrice * nights).toLocaleString()}</span>
                        </div>
                      ) : null
                    })}
                  </div>
                </>
              )}

              {(estBreakfast > 0 || estRentals > 0 || estAddons > 0) && (
                <>
                  <div className="border-t border-dashed border-[#E5D5C0] my-2" />
                  {estBreakfast > 0 && (
                    <div className="flex justify-between">
                      <span>Breakfast Order:</span>
                      <span className="font-mono text-slate-800 font-semibold">₱{estBreakfast.toLocaleString()}</span>
                    </div>
                  )}
                  {estRentals > 0 && (
                    <div className="flex justify-between">
                      <span>Rentals &amp; Amenities:</span>
                      <span className="font-mono text-slate-800 font-semibold">₱{estRentals.toLocaleString()}</span>
                    </div>
                  )}
                  {estAddons > 0 && (
                    <div className="flex justify-between">
                      <span>Venue Add-ons:</span>
                      <span className="font-mono text-slate-800 font-semibold">₱{estAddons.toLocaleString()}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="border-t border-dashed border-[#E5D5C0] pt-4 space-y-2">
              <div className="flex justify-between text-slate-500 font-medium text-xs">
                <span>Original Rate:</span>
                <span className="font-mono">₱{undiscountedBaseTotal.toLocaleString()}</span>
              </div>
              {formWalkInDiscount && walkInAmount > 0 && (
                <div className="flex justify-between text-rose-600 font-semibold text-xs animate-in fade-in">
                  <span>Direct Booking Discount (20%):</span>
                  <span className="font-mono">-₱{walkInAmount.toLocaleString()}</span>
                </div>
              )}
              {additionalAmount > 0 && (
                <div className="flex justify-between text-rose-600 font-semibold text-xs animate-in fade-in">
                  <span>Additional Discount ({formAdditionalDiscount}%):</span>
                  <span className="font-mono">-₱{additionalAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600 font-semibold text-xs border-t border-dashed border-[#E5D5C0]/60 pt-2">
                <span>Subtotal:</span>
                <span className="font-mono text-slate-800">₱{estTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-650 font-medium text-xs">
                <span>Refundable Security Deposit:</span>
                <span className="font-mono text-slate-800">₱{(unitCount * 500).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-extrabold text-xs border-t border-[#E5D5C0]/60 pt-2">
                <span>Grand Total:</span>
                <span className="font-mono text-slate-950">₱{(estTotal + unitCount * 500).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-800 font-bold text-xs border-t border-dashed border-[#E5D5C0]/60 pt-2">
                <span>Downpayment (50%):</span>
                <span className="font-mono text-emerald-600 font-extrabold">₱{estDown.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-800 font-bold text-xs">
                <span>Due at Check-in:</span>
                <span className="font-mono text-[#9A783E] font-extrabold">₱{estDue.toLocaleString()}</span>
              </div>
              <div className="text-[9px] text-slate-400 text-center pt-2 italic leading-normal font-sans">
                Includes ₱{(unitCount * 500).toLocaleString()} refundable security deposit (₱500/room)
              </div>

              <div className="border-t border-[#E5D5C0] pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    alert("This feature is under development.")
                  }}
                  className="flex-1 bg-white hover:bg-slate-50 text-[#9A783E] border border-[#E5D5C0] text-[10px] font-bold py-1.5 px-2.5 rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none"
                >
                  <Mail className="w-3.5 h-3.5 text-[#B89251]" />
                  Email Invoice
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert("This feature is under development.")
                  }}
                  className="flex-1 bg-white hover:bg-slate-50 text-[#9A783E] border border-[#E5D5C0] text-[10px] font-bold py-1.5 px-2.5 rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none"
                >
                  <Printer className="w-3.5 h-3.5 text-[#B89251]" />
                  Print Invoice
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#FDFBF7] border border-[#E5D5C0] p-5 rounded-md text-xs space-y-2 text-[#9A783E] font-sans">
            <div className="text-center border-b border-dashed border-[#E5D5C0] pb-2">
              <div className="text-[9px] text-[#9A783E] font-bold tracking-widest uppercase mb-1">Calendar Block</div>
              <h5 className="text-sm font-extrabold text-slate-800 tracking-tight uppercase">DAWEEZ PENSION HOUSE</h5>
            </div>
            <p className="text-slate-500 text-center text-[10px] py-4 leading-normal font-medium">
              No billing charge generated.<br />Room status will be marked as blocked.
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
      prevProps.formPartnerDealId === nextProps.formPartnerDealId
    )
  }
)
