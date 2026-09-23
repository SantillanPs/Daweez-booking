import React, { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Room, Venue, Booking, PartnerDeal } from '../../types/booking'
import { PartyPopper, X, AlertCircle } from 'lucide-react'
import * as syncEngine from '../../utils/syncEngine'
import { useDashboardData } from '../DashboardContext'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'
import { roomDisplayName } from '../calendar/bookingStyles'

interface CorporateParams {
  roomId?: string; venueId?: string
  guestName: string; guestEmail: string; guestPhone: string
  checkIn: string; checkOut: string
  source: 'manual'; status: 'confirmed'
  usePromo?: boolean; partnerDealId?: string
  companyName?: string; vehiclePlate?: string
  contractRateOverride?: number
  paymentMethod?: string; paymentReference?: string
}

interface CorporateBookingFormProps {
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  initialSelections: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>
  createManualBooking: (p: CorporateParams) => Promise<Booking>
  onClose: () => void
}

// Standalone corporate / partner booking screen — separate from the walk-in
// full form. Pick a partner preset, choose dates, confirm.
export function CorporateBookingForm({ rooms, venues, bookings, initialSelections, createManualBooking, onClose }: CorporateBookingFormProps) {
  const { partnerDeals } = useDashboardData()

  const [formCheckIn, setFormCheckIn] = useState(() => Object.values(initialSelections)[0]?.checkIn || '')
  const [formCheckOut, setFormCheckOut] = useState(() => Object.values(initialSelections)[0]?.checkOut || '')
  const [unitSelections, setUnitSelections] = useState<Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>>(initialSelections)

  const [formPartnerDealId, setFormPartnerDealId] = useState('')
  const [formCompanyName, setFormCompanyName] = useState('')
  const [formVehiclePlate, setFormVehiclePlate] = useState('')
  const [error, setError] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [trySave, setTrySave] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdList, setCreatedList] = useState<Booking[]>([])

  const [partnerSearchQuery, setPartnerSearchQuery] = useState('')
  const [isPartnerDropdownOpen, setIsPartnerDropdownOpen] = useState(false)
  const partnerDropdownRef = useRef<HTMLDivElement>(null)

  const filteredDeals = useMemo(() => {
    const q = partnerSearchQuery.toLowerCase().trim()
    if (!q) return partnerDeals
    return partnerDeals.filter(d => d.name.toLowerCase().includes(q) || d.type.toLowerCase().includes(q))
  }, [partnerSearchQuery, partnerDeals])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (partnerDropdownRef.current && !partnerDropdownRef.current.contains(event.target as Node)) setIsPartnerDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectPartnerDeal = (deal: PartnerDeal | null) => {
    if (deal) {
      setFormPartnerDealId(deal.id)
      setFormCompanyName(deal.name)
      setFormVehiclePlate(deal.vehicle_plate || '')
      const initial: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }> = {}
      if (deal.contracted_rates) {
        Object.entries(deal.contracted_rates).forEach(([id, rate]) => {
          if (rate > 0) {
            const isRoom = rooms.some(r => r.id === id)
            const isVenue = venues.some(v => v.id === id)
            if (isRoom) initial[id] = { checkIn: formCheckIn, checkOut: formCheckOut, type: 'room' }
            else if (isVenue) initial[id] = { checkIn: formCheckIn, checkOut: formCheckOut, type: 'venue' }
          }
        })
      }
      setUnitSelections(initial)
    } else {
      setFormPartnerDealId(''); setFormCompanyName(''); setFormVehiclePlate(''); setUnitSelections({})
    }
  }

  const handleDateChange = (field: 'checkIn' | 'checkOut', value: string) => {
    if (field === 'checkIn') { setFormCheckIn(value); setUnitSelections(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { n[k] = { ...n[k], checkIn: value } }); return n }) }
    else { setFormCheckOut(value); setUnitSelections(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { n[k] = { ...n[k], checkOut: value } }); return n }) }
  }

  const fieldErrors = {
    partner: formPartnerDealId ? '' : 'Choose a partner account.',
    checkIn: formCheckIn ? '' : 'Check-in is required.',
    checkOut: !formCheckOut ? 'Check-out is required.' : (formCheckOut <= formCheckIn ? 'Check-out must be after check-in.' : ''),
    units: Object.keys(unitSelections).length > 0 ? '' : 'Pick a partner with a room or venue rate.',
  }
  const showErr = (f: keyof typeof fieldErrors) => (touched[f] || trySave) ? fieldErrors[f] : ''
  const isInvalid = (f: keyof typeof fieldErrors) => Boolean(showErr(f))
  const markTouched = (f: keyof typeof fieldErrors) => () => setTouched(t => ({ ...t, [f]: true }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (Object.values(fieldErrors).some(v => v)) { setTrySave(true); return }
    const deal = partnerDeals.find(d => d.id === formPartnerDealId)
    if (!deal) { setError('Choose a partner account.'); return }
    setIsSubmitting(true)
    try {
      const created: Booking[] = []
      for (const [id, sel] of Object.entries(unitSelections)) {
        const isRoom = sel.type === 'room'
        if (isRoom && !syncEngine.isRoomAvailable(id, sel.checkIn, sel.checkOut, bookings)) throw new Error(roomDisplayName(rooms.find(r => r.id === id)) + ' is already booked.')
        if (!isRoom && !syncEngine.isVenueRangeAvailable(id, sel.checkIn, sel.checkOut, bookings)) throw new Error((venues.find(v => v.id === id)?.name || 'Venue') + ' is already reserved.')
        const b = await createManualBooking({
          roomId: isRoom ? id : undefined,
          venueId: isRoom ? undefined : id,
          guestName: ((deal.name || 'Corporate') + ' Representative').toUpperCase(),
          guestEmail: deal.email || 'admin@daweez-booking.vercel.app',
          guestPhone: deal.contact_no || 'None',
          checkIn: sel.checkIn, checkOut: sel.checkOut,
          source: 'manual', status: 'confirmed',
          partnerDealId: formPartnerDealId,
          companyName: deal.name,
          vehiclePlate: formVehiclePlate || undefined,
          contractRateOverride: deal.contracted_rates[id] || undefined,
        })
        created.push(b)
      }
      setCreatedList(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed — possible overlap.')
    } finally { setIsSubmitting(false) }
  }

  if (createdList.length > 0) {
    return createPortal(
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 flex flex-col items-center" onClick={onClose}>
        <div className="w-full max-w-3xl mb-8" onClick={e => e.stopPropagation()}>
          <PrintInvoiceModal bookingsToPrint={createdList} rooms={rooms} venues={venues} bookingsList={bookings} onClose={onClose} embedded />
        </div>
      </div>, document.body)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 font-sans" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-lg border border-soft shadow-xl flex flex-col max-h-[92vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-soft shrink-0 bg-card">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 flex items-center justify-center bg-brand-bg border border-brand-border rounded-md"><PartyPopper className="w-3.5 h-3.5 text-brand-text" /></div>
            <div><h3 className="text-sm font-bold text-main">Corporate Booking</h3><p className="text-[10px] text-muted font-medium">Partner / agency reservation</p></div>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-main transition-colors p-1.5 -mr-1.5 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 p-5 bg-page/30">
            <div className="space-y-3.5 text-xs">
              {error && <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2 rounded-md"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}

              <div className="relative" ref={partnerDropdownRef}>
                <label className="text-[10px] text-brand-text font-bold block mb-1 uppercase tracking-wider">Partner Account *</label>
                <div onClick={() => { setIsPartnerDropdownOpen(!isPartnerDropdownOpen); markTouched('partner')() }} className={isInvalid('partner') ? 'w-full bg-brand-bg border border-rose-400 text-main px-3 py-2 rounded-lg focus:outline-none focus:border-rose-500 font-semibold cursor-pointer flex justify-between items-center shadow-sm select-none' : 'w-full bg-brand-bg border border-brand-border text-main px-3 py-2 rounded-lg focus:outline-none focus:border-brand-primary font-semibold cursor-pointer flex justify-between items-center shadow-sm select-none'}>
                  <span className={formCompanyName ? 'text-main' : 'text-muted font-normal'}>{formCompanyName || '-- Search & Select Partner --'}</span>
                  <span className="text-[10px] text-muted">▼</span>
                </div>
                {showErr('partner') && <p className="text-[10px] text-rose-600 mt-1">{showErr('partner')}</p>}
                {isPartnerDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-card border border-soft rounded-lg shadow-lg overflow-hidden flex flex-col max-h-60" onClick={e => e.stopPropagation()}>
                    <div className="p-2 border-b border-soft bg-page"><input type="text" placeholder="Type to search agency..." value={partnerSearchQuery} onChange={e => setPartnerSearchQuery(e.target.value)} className="w-full bg-card border border-soft text-main px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-brand-primary" autoFocus /></div>
                    <div className="overflow-y-auto flex-1 py-1 max-h-48">
                      {filteredDeals.length > 0 ? filteredDeals.map(d => (
                        <button key={d.id} type="button" onClick={() => { handleSelectPartnerDeal(d); setIsPartnerDropdownOpen(false); setPartnerSearchQuery('') }}
                          className="w-full text-left px-3 py-2 hover:bg-brand-bg hover:text-brand-text text-xs font-semibold text-main flex justify-between items-center transition-colors border-none bg-transparent cursor-pointer">
                          <span>{d.name}</span><span className="text-[9px] bg-softbg text-muted px-1.5 py-0.5 rounded uppercase font-bold shrink-0">{d.type}</span>
                        </button>
                      )) : <div className="px-3 py-3 text-center text-xs text-muted font-medium">No matching partner accounts</div>}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div><label className="text-[10px] text-brand-text font-bold block mb-1 uppercase tracking-wider">Check-in *</label>
                  <input type="date" required value={formCheckIn} onChange={e => handleDateChange('checkIn', e.target.value)} onBlur={markTouched('checkIn')} className={isInvalid('checkIn') ? 'w-full bg-brand-bg border border-rose-400 text-main px-3 py-2 rounded-lg focus:outline-none focus:border-rose-500 font-mono font-medium' : 'w-full bg-brand-bg border border-brand-border text-main px-3 py-2 rounded-lg focus:outline-none focus:border-brand-primary font-mono font-medium'} />
                  {showErr('checkIn') && <p className="text-[10px] text-rose-600 mt-1">{showErr('checkIn')}</p>}</div>
                <div><label className="text-[10px] text-brand-text font-bold block mb-1 uppercase tracking-wider">Check-out *</label>
                  <input type="date" required value={formCheckOut} onChange={e => handleDateChange('checkOut', e.target.value)} onBlur={markTouched('checkOut')} className={isInvalid('checkOut') ? 'w-full bg-brand-bg border border-rose-400 text-main px-3 py-2 rounded-lg focus:outline-none focus:border-rose-500 font-mono font-medium' : 'w-full bg-brand-bg border border-brand-border text-main px-3 py-2 rounded-lg focus:outline-none focus:border-brand-primary font-mono font-medium'} />
                  {showErr('checkOut') && <p className="text-[10px] text-rose-600 mt-1">{showErr('checkOut')}</p>}</div>
              </div>

              <div>
                <label className="text-[10px] text-brand-text font-bold block mb-1.5 uppercase tracking-wider">Rooms / Venues</label>
                <div className="flex flex-wrap gap-2.5">
                  {Object.entries(unitSelections).length === 0 && <span className="text-[11px] text-muted italic">Pick a partner with a contracted rate.</span>}
                  {Object.entries(unitSelections).map(([id, sel]) => {
                    const isRoom = sel.type === 'room'
                    const name = isRoom ? roomDisplayName(rooms.find(r => r.id === id)) : (venues.find(v => v.id === id)?.name || id)
                    const deal = partnerDeals.find(d => d.id === formPartnerDealId)
                    const contractedPrice = deal?.contracted_rates[id]
                    const basePrice = isRoom ? (rooms.find(r => r.id === id)?.base_price || 0) : (venues.find(v => v.id === id)?.base_price || 0)
                    return <div key={id} className="bg-brand-bg border border-brand-border rounded-md px-2 py-1 flex items-center gap-1.5 shadow-sm text-[11px] select-none">
                      <span className="font-bold text-main">{name}</span><span className="text-slate-300">|</span>
                      {contractedPrice !== undefined && contractedPrice !== null
                        ? <span className="font-extrabold text-brand-text flex items-center gap-1">₱{contractedPrice.toLocaleString()}<span className="text-[8px] text-brand-text font-bold bg-[#9A783E]/10 px-1 py-0.5 rounded uppercase">Neg</span></span>
                        : <span className="font-semibold text-muted flex items-center gap-1">₱{basePrice.toLocaleString()}<span className="text-[8px] text-muted font-bold bg-softbg px-1 py-0.5 rounded uppercase">Std</span></span>}
                    </div>
                  })}
                </div>
                {showErr('units') && <p className="text-[10px] text-rose-600 mt-1">{showErr('units')}</p>}
              </div>

              {/* No promo switch (card k128): one price, and a partner's
                  contracted rate when the deal sets one. */}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="text-xs text-muted font-bold px-4 py-3 rounded-md border border-soft bg-card hover:bg-page transition-all cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSubmitting || !formPartnerDealId || Object.keys(unitSelections).length === 0} className="flex-1 bg-brand-primary hover:bg-gold-500 disabled:bg-softbg disabled:text-muted text-ink-900 text-xs font-bold py-3 rounded-md transition-all cursor-pointer shadow-sm">
                  {isSubmitting ? 'Booking...' : 'Confirm Corporate Booking'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>, document.body)
}
