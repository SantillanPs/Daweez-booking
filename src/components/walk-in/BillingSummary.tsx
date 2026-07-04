import React from 'react'
import { Room, Venue } from '../../types/booking'

interface BillingSummaryProps {
  formStatus: 'confirmed' | 'blocked'
  formPathway: 'room' | 'venue'
  basePrice: number
  estNights: number
  formRoomIds: Set<string>
  rooms: Room[]
  venues: Venue[]
  formVenueId: string
  estBreakfast: number
  estRentals: number
  estAddons: number
  estTotal: number
  estDown: number
  estDue: number
}

// Compare Set contents to determine if selected rooms changed
const setsEqual = (a: Set<string>, b: Set<string>) => a.size === b.size && Array.from(a).every(x => b.has(x))

export const BillingSummary = React.memo(
  ({
    formStatus,
    formPathway,
    basePrice,
    estNights,
    formRoomIds,
    rooms,
    venues,
    formVenueId,
    estBreakfast,
    estRentals,
    estAddons,
    estTotal,
    estDown,
    estDue
  }: BillingSummaryProps) => {
    return (
      <div className="space-y-4 font-sans">
        <h4 className="text-[9px] font-bold text-[#9A783E] tracking-widest uppercase md:block hidden pb-0.5 border-b border-slate-200/40">
          Statement Estimate
        </h4>
        
        {formStatus === 'confirmed' ? (
          <div className="bg-[#FDFBF7] border border-[#E5D5C0] p-5 rounded-md text-xs space-y-4 shadow-sm relative overflow-hidden text-[#9A783E] animate-fade-in">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-[#B89251]" />
            <div className="text-center border-b border-dashed border-[#E5D5C0] pb-4">
              <div className="text-[9px] text-[#9A783E] font-bold tracking-widest uppercase mb-1 font-sans">Estimated Invoice</div>
              <h5 className="text-sm font-extrabold text-slate-800 tracking-tight uppercase font-sans">Daweez Pension House</h5>
              <span className="text-[8px] font-mono text-slate-400 block mt-0.5">VOUCHER #WALK-IN</span>
            </div>
            
            <div className="space-y-2 text-slate-600 font-medium">
              <div className="flex justify-between">
                <span>Base Rate:</span>
                <span className="font-mono font-semibold text-slate-800">₱{basePrice.toLocaleString()}{formPathway === 'room' ? '/night' : ''}</span>
              </div>
              <div className="flex justify-between">
                <span>Pathway:</span>
                <span className="capitalize text-slate-800 font-semibold">{formPathway}</span>
              </div>
              {formPathway === 'room' && (
                <div className="flex justify-between">
                  <span>Nights:</span>
                  <span className="font-mono text-slate-800 font-semibold">{estNights} night{estNights > 1 ? 's' : ''}</span>
                </div>
              )}
              
              <div className="border-t border-dashed border-[#E5D5C0] my-2" />
              
              {formPathway === 'room' ? (
                <div className="text-[10px] text-slate-500 pl-2 space-y-1 font-mono">
                  {Array.from(formRoomIds).map(id => {
                    const r = rooms.find(room => room.id === id)
                    return r ? (
                      <div key={id} className="flex justify-between">
                        <span>Room {r.room_number} ({r.name}):</span>
                        <span>₱{r.base_price.toLocaleString()}</span>
                      </div>
                    ) : null
                  })}
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 pl-2 font-mono">
                  <span>{venues.find(v => v.id === formVenueId)?.name || 'Gazebo'}</span>
                </div>
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
                      <span>Equipment Rentals:</span>
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
              <div className="flex justify-between text-slate-800 font-extrabold text-xs">
                <span>Subtotal:</span>
                <span className="font-mono text-slate-900">₱{estTotal.toLocaleString()}</span>
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
                Includes ₱500 refundable security deposit
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
    return (
      prevProps.formStatus === nextProps.formStatus &&
      prevProps.formPathway === nextProps.formPathway &&
      prevProps.basePrice === nextProps.basePrice &&
      prevProps.estNights === nextProps.estNights &&
      setsEqual(prevProps.formRoomIds, nextProps.formRoomIds) &&
      prevProps.formVenueId === nextProps.formVenueId &&
      prevProps.estBreakfast === nextProps.estBreakfast &&
      prevProps.estRentals === nextProps.estRentals &&
      prevProps.estAddons === nextProps.estAddons &&
      prevProps.estTotal === nextProps.estTotal &&
      prevProps.estDown === nextProps.estDown &&
      prevProps.estDue === nextProps.estDue &&
      prevProps.rooms === nextProps.rooms &&
      prevProps.venues === nextProps.venues
    )
  }
)
