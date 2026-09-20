import React, { RefObject } from 'react'
import { Room, Venue, PartnerDeal } from '../../types/booking'
import { roomDisplayName } from '../calendar/bookingStyles'

type FieldKey = 'guestName' | 'checkIn' | 'checkOut' | 'units' | 'dates'

interface PartnerBookingFieldsProps {
  partnerDropdownRef: RefObject<HTMLDivElement | null>
  isPartnerDropdownOpen: boolean
  setIsPartnerDropdownOpen: (v: boolean) => void
  partnerSearchQuery: string
  setPartnerSearchQuery: (v: string) => void
  filteredDeals: PartnerDeal[]
  onSelectDeal: (deal: PartnerDeal) => void
  setFormGuestName: (v: string) => void
  formCompanyName: string
  formCheckIn: string
  formCheckOut: string
  handlePartnerDateChange: (field: 'checkIn' | 'checkOut', value: string) => void
  markTouched: (f: FieldKey) => () => void
  isInvalid: (f: FieldKey) => boolean
  showErr: (f: FieldKey) => string
  dateField: string
  dateFieldErr: string
  unitSelections: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>
  rooms: Room[]
  venues: Venue[]
  partnerDeals: PartnerDeal[]
  formPartnerDealId: string
  isSubmitting: boolean
  onClose: () => void
}

// Corporate / agency booking panel (the "partner" booking type). Contract rates,
// partner search, and the read-only selected-units list.
export function PartnerBookingFields({
  partnerDropdownRef, isPartnerDropdownOpen, setIsPartnerDropdownOpen,
  partnerSearchQuery, setPartnerSearchQuery, filteredDeals, onSelectDeal, setFormGuestName,
  formCompanyName, formCheckIn, formCheckOut, handlePartnerDateChange,
  markTouched, isInvalid, showErr, dateField, dateFieldErr,
  unitSelections, rooms, venues, partnerDeals, formPartnerDealId,
  isSubmitting, onClose,
}: PartnerBookingFieldsProps) {
  return (
    <div className="space-y-4 font-sans bg-base-100 border border-base-300 rounded-xl p-5 shadow-sm">
      <div className="border-b border-base-300 pb-3">
        <h4 className="text-xs font-bold text-base-content uppercase tracking-wider">
          Corporate / Agency details
        </h4>
        <p className="text-[10px] text-base-content/60 font-medium mt-0.5">
          Select a partner account to automatically populate contract rates, invoices, and contact info.
        </p>
      </div>

      <div className="space-y-3.5 text-xs">
        {/* 1. Searchable Partner Selector */}
        <div className="relative" ref={partnerDropdownRef}>
          <label className="text-[10px] text-primary font-bold block mb-1 uppercase tracking-wider">Partner Account</label>
          <div
            onClick={() => setIsPartnerDropdownOpen(!isPartnerDropdownOpen)}
            className="w-full bg-base-100 border border-base-300 text-base-content px-3 py-2 rounded-lg focus:outline-none font-semibold cursor-pointer flex justify-between items-center shadow-sm select-none"
          >
            <span className={formCompanyName ? 'text-base-content' : 'text-base-content/60 font-normal'}>
              {formCompanyName || '-- Search & Select Partner --'}
            </span>
            <span className="text-[10px] text-base-content/60">▼</span>
          </div>

          {isPartnerDropdownOpen && (
            <div className="absolute z-50 mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-lg overflow-hidden flex flex-col max-h-60" onClick={e => e.stopPropagation()}>
              <div className="p-2 border-b border-base-300 bg-base-200">
                <input
                  type="text"
                  placeholder="Type to search agency..."
                  value={partnerSearchQuery}
                  onChange={e => setPartnerSearchQuery(e.target.value)}
                  className="input input-bordered w-full text-sm"
                  autoFocus
                />
              </div>
              <div className="overflow-y-auto flex-1 py-1 max-h-48">
                {filteredDeals.length > 0 ? (
                  filteredDeals.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        onSelectDeal(d)
                        setFormGuestName(`${d.name} Representative`)
                        setIsPartnerDropdownOpen(false)
                        setPartnerSearchQuery('')
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-primary/10 hover:text-primary text-xs font-semibold text-base-content flex justify-between items-center transition-colors border-none bg-transparent cursor-pointer"
                    >
                      <span>{d.name}</span>
                      <span className="text-[9px] bg-base-300/50 text-base-content/60 px-1.5 py-0.5 rounded uppercase font-bold shrink-0">{d.type}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-3 text-center text-xs text-base-content/60 font-medium">
                    No matching partner accounts
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. Dates Row */}
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="text-[10px] text-primary font-bold block mb-1 uppercase tracking-wider">Check-in *</label>
            <input
              type="date"
              onBlur={markTouched('checkIn')}
              value={formCheckIn}
              onChange={e => handlePartnerDateChange('checkIn', e.target.value)}
              className={isInvalid('checkIn') ? dateFieldErr : dateField}
            />
            {showErr('checkIn') && <p className="text-[10px] text-error mt-1">{showErr('checkIn')}</p>}
          </div>
          <div>
            <label className="text-[10px] text-primary font-bold block mb-1 uppercase tracking-wider">Check-out *</label>
            <input
              type="date"
              onBlur={markTouched('checkOut')}
              value={formCheckOut}
              onChange={e => handlePartnerDateChange('checkOut', e.target.value)}
              className={isInvalid('checkOut') ? dateFieldErr : dateField}
            />
            {showErr('checkOut') && <p className="text-[10px] text-error mt-1">{showErr('checkOut')}</p>}
          </div>
        </div>
        {showErr('dates') && <p className="text-[10px] text-error mt-1">{showErr('dates')}</p>}
        {showErr('units') && <p className="text-[10px] text-error mt-1">{showErr('units')}</p>}

        {/* 3. Selected Rooms Display (Read-Only) */}
        <div>
          <label className="text-[10px] text-primary font-bold block mb-1.5 uppercase tracking-wider">Selected Rooms</label>
          <div className="flex flex-wrap gap-2.5">
            {Object.entries(unitSelections).map(([id, sel]) => {
              const isRoom = sel.type === 'room'
              const name = isRoom
                ? roomDisplayName(rooms.find(r => r.id === id))
                : (venues.find(v => v.id === id)?.name || id)
              const deal = partnerDeals.find(d => d.id === formPartnerDealId)
              const contractedPrice = deal?.contracted_rates[id]
              const basePrice = isRoom
                ? (rooms.find(r => r.id === id)?.base_price || 0)
                : (venues.find(v => v.id === id)?.base_price || 0)

              return (
                <div key={id} className="bg-primary/10 border border-base-300 rounded-md px-2 py-1 flex items-center gap-1.5 shadow-sm text-[11px] animate-in fade-in select-none">
                  <span className="font-bold text-base-content">{name}</span>
                  <span className="text-slate-300">|</span>
                  {contractedPrice !== undefined && contractedPrice !== null ? (
                    <span className="font-extrabold text-primary flex items-center gap-1">
                      ₱{contractedPrice.toLocaleString()}
                      <span className="text-[8px] text-primary font-bold bg-[#9A783E]/10 px-1 py-0.5 rounded uppercase">Neg</span>
                    </span>
                  ) : (
                    <span className="font-semibold text-base-content/60 flex items-center gap-1">
                      ₱{basePrice.toLocaleString()}
                      <span className="text-[8px] text-base-content/60 font-bold bg-base-300/50 px-1 py-0.5 rounded uppercase">Std</span>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* There is no promo switch any more (card k128): one price, and the
            partner's contracted rate when a deal sets one. */}
        <div className="pt-2 border-t border-base-300">
          <div className="pt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formPartnerDealId || Object.keys(unitSelections).length === 0}
              className="flex-1 btn btn-primary"
            >
              {isSubmitting ? 'Booking...' : 'Confirm Corporate Booking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
