import React, { useState, useMemo } from 'react'
import { X, AlertCircle, ChevronDown } from 'lucide-react'
import { Booking, Room, Venue, BookingSource, BreakfastOrder } from '../../types/booking'
import * as syncEngine from '../../utils/syncEngine'
import { isPromoActive } from '../../utils/promoMode'
import { dateToString } from '../../utils/helpers'
import { PaymentSection } from './PaymentSection'
import { roomDisplayName, roomOptionLabel } from './bookingStyles'
import { BookingSuccessView } from './BookingSuccessView'
import { BookingUnitCard } from './BookingUnitCard'

export interface UnitSelection {
  checkIn: string
  checkOut: string
  type: 'room' | 'venue'
}

export interface CreateBookingParams {
  roomId?: string; venueId?: string; guestName: string; guestEmail: string; guestPhone: string
  checkIn: string; checkOut: string; source: BookingSource; status: 'confirmed' | 'blocked'
  paymentStatus?: 'unpaid' | 'downpayment' | 'paid'; downpaymentPaid?: number; balanceDue?: number
  securityDeposit?: number; paymentMethod?: string; paymentReference?: string; usePromo?: boolean
  breakfastEnabled?: boolean
  breakfastOrders?: BreakfastOrder[]
}

interface QuickBookingSheetProps {
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  createManualBooking: (p: CreateBookingParams) => Promise<Booking>
  updateBooking?: (booking: Booking) => Promise<void>
  editingBooking?: Booking
  initialSelections: Record<string, UnitSelection>
  onClose: () => void
  onOpenAdvanced: (selections: Record<string, UnitSelection>) => void
}

// Calendar-first booking path, used for new bookings AND editing an existing
// one. Corporate / amenities flows live behind "full booking form".
export function QuickBookingSheet({ rooms, venues, bookings, createManualBooking, updateBooking, editingBooking, initialSelections, onClose, onOpenAdvanced }: QuickBookingSheetProps) {
  const isEdit = !!editingBooking
  const editUnitId = (editingBooking?.room_id || editingBooking?.venue_id || '')

  const [units, setUnits] = useState<Record<string, UnitSelection>>(() =>
    editingBooking && editUnitId
      ? { [editUnitId]: { checkIn: editingBooking.check_in, checkOut: editingBooking.check_out, type: editingBooking.room_id ? 'room' : 'venue' } }
      : initialSelections
  )
  const [pickUnitId, setPickUnitId] = useState(''); const [guestName, setGuestName] = useState(editingBooking?.guest_name || '')
  const [guestPhone, setGuestPhone] = useState(editingBooking && editingBooking.guest_phone !== 'None' ? editingBooking.guest_phone : ''); const [guestEmail, setGuestEmail] = useState(editingBooking && editingBooking.guest_email !== 'admin@daweez-booking.vercel.app' ? editingBooking.guest_email : '')
  const [source, setSource] = useState<BookingSource>(editingBooking?.source || 'manual')
  const [isBlock, setIsBlock] = useState(editingBooking?.status === 'blocked')
  const promoOn = isPromoActive(); const [usePromo, setUsePromo] = useState(!!(editingBooking as Booking & { promo_applied?: boolean })?.promo_applied)
  const [payStatus, setPayStatus] = useState<'unpaid' | 'downpayment' | 'paid'>(editingBooking?.payment_status || 'downpayment')
  const [payMethod, setPayMethod] = useState(editingBooking?.payment_method || 'Cash'); const [payRef, setPayRef] = useState(editingBooking?.payment_reference || '')
  const [showMore, setShowMore] = useState(false); const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false); const [created, setCreated] = useState<Booking[]>([])

  const unitName = (id: string, type: 'room' | 'venue') =>
    type === 'room'
      ? roomDisplayName(rooms.find(r => r.id === id))
      : (venues.find(v => v.id === id)?.name ?? id)

  const unitEntries = Object.entries(units)

  const addUnit = () => {
    if (!pickUnitId) return
    const isRoom = rooms.some(r => r.id === pickUnitId)
    const type = isRoom ? 'room' : 'venue'
    const cin = dateToString(new Date(Date.now() + 86400000))
    const cout = dateToString(new Date(Date.now() + 2 * 86400000))
    setUnits(prev => ({ ...prev, [pickUnitId]: { checkIn: cin, checkOut: cout, type } }))
    setPickUnitId('')
  }
  const setUnitDates = (id: string, field: 'checkIn' | 'checkOut', value: string) => {
    setUnits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const removeUnit = (id: string) => {
    setUnits(prev => { const n = { ...prev }; delete n[id]; return n })
  }
  // Pricing per unit (quick bookings don't sell breakfast).
  const perUnitPricing = useMemo(() => {
    const map: Record<string, ReturnType<typeof syncEngine.calculatePricing>> = {}
    Object.entries(units).forEach(([id, sel]) => {
      if (!sel.checkIn || !sel.checkOut) return
      map[id] = syncEngine.calculatePricing({
        roomId: sel.type === 'room' ? id : undefined,
        venueId: sel.type === 'venue' ? id : undefined,
        checkIn: sel.checkIn,
        checkOut: sel.checkOut,
        guestEmail,
        source,
        breakfastEnabled: false,
        rooms, venues,
        usePromo
      })
    })
    return map
  }, [units, guestEmail, source, rooms, venues, usePromo])

  const totals = useMemo(() => {
    let grand = 0, deposit = 0, balance = 0
    Object.values(perUnitPricing).forEach(p => {
      grand += p.grandTotal; deposit += p.downpayment; balance += p.balanceDue
    })
    return { grand, deposit, balance }
  }, [perUnitPricing])
  const anyPromo = promoOn && unitEntries.some(([id, sel]) => {
    const u = sel.type === 'room' ? rooms.find(r => r.id === id) : venues.find(v => v.id === id)
    return u && u.promo_price != null && u.promo_price > 0
  })

  const canSave = unitEntries.length > 0 &&
    unitEntries.every(([, s]) => s.checkIn && s.checkOut && s.checkIn < s.checkOut) &&
    (isBlock || (guestName.trim() && guestPhone.trim()))
  const handleSave = async () => {
    if (!canSave) { setError('Please fill in the guest name, phone, and dates.'); return }
    setError(''); setIsSaving(true)
    try {
      const createdList: Booking[] = []
      const availabilityBookings = isEdit && editingBooking ? bookings.filter(b => b.id !== editingBooking.id) : bookings
      for (const [id, sel] of unitEntries) {
        if (sel.type === 'room') {
          if (!syncEngine.isRoomAvailable(id, sel.checkIn, sel.checkOut, availabilityBookings)) throw new Error(unitName(id, 'room') + ' is already booked for these dates.')
        } else if (!syncEngine.isVenueRangeAvailable(id, sel.checkIn, sel.checkOut, availabilityBookings)) {
          throw new Error(unitName(id, 'venue') + ' is already reserved for these dates.')
        }
        const p = perUnitPricing[id]
        const paid = payStatus === 'paid' ? p.grandTotal : payStatus === 'downpayment' ? p.downpayment : 0
        const due = payStatus === 'paid' ? 0 : payStatus === 'downpayment' ? p.balanceDue : p.grandTotal
        if (isEdit && updateBooking && editingBooking) {
          const updated: Booking = {
            ...editingBooking,
            room_id: sel.type === 'room' ? id : editingBooking.room_id,
            venue_id: sel.type === 'venue' ? id : editingBooking.venue_id,
            guest_name: guestName.trim() || editingBooking.guest_name,
            guest_phone: guestPhone.trim() || 'None',
            guest_email: guestEmail.trim() || 'admin@daweez-booking.vercel.app',
            check_in: sel.checkIn, check_out: sel.checkOut,
            source,
            status: isBlock ? 'blocked' : 'confirmed',
            payment_status: isBlock ? undefined : payStatus,
            downpayment_paid: isBlock ? 0 : paid,
            balance_due: isBlock ? 0 : due,
            payment_method: payStatus === 'unpaid' ? undefined : payMethod,
            payment_reference: payStatus === 'unpaid' ? undefined : (payRef.trim() || undefined),
            breakfast_orders: editingBooking.breakfast_orders ?? []
          }
          ;(updated as Booking & { promo_applied?: boolean }).promo_applied = usePromo
          await updateBooking(updated)
          createdList.push(updated)
        } else {
          const b = await createManualBooking({
            roomId: sel.type === 'room' ? id : undefined,
            venueId: sel.type === 'venue' ? id : undefined,
            guestName: guestName.trim() || 'Date block',
            guestEmail: guestEmail.trim() || 'admin@daweez-booking.vercel.app',
            guestPhone: guestPhone.trim() || 'None',
            checkIn: sel.checkIn, checkOut: sel.checkOut,
            source, status: isBlock ? 'blocked' : 'confirmed',
            paymentStatus: isBlock ? undefined : payStatus,
            downpaymentPaid: isBlock ? undefined : paid,
            balanceDue: isBlock ? undefined : due,
            securityDeposit: isBlock ? undefined : p.securityDeposit,
            paymentMethod: payStatus === 'unpaid' ? undefined : payMethod,
            paymentReference: payStatus === 'unpaid' ? undefined : (payRef.trim() || undefined),
            usePromo,
            breakfastEnabled: false,
            breakfastOrders: [] // quick bookings don't sell breakfast; explicit opt-out
          })
          createdList.push(b)
        }
      }
      setCreated(createdList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the booking. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (created.length > 0) {
    return <BookingSuccessView created={created} rooms={rooms} venues={venues} bookings={bookings} onDone={onClose} isEdit={isEdit} />
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-md bg-card border-l border-soft shadow-sheet flex flex-col animate-in slide-in-from-right-4 duration-300">
        <div className="flex items-center justify-between px-5 py-4 border-b border-soft bg-sea-50 shrink-0">
          <div>
            <h3 className="font-display font-bold text-main">{isEdit ? 'Edit booking' : 'New booking'}</h3>
            <p className="text-[11px] text-muted font-medium">{isEdit ? 'Update the guest and dates' : 'Add a guest in under a minute'}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-main transition-colors p-1.5 -mr-1.5 cursor-pointer" aria-label="Close">
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 bg-coral-50 border border-coral-200 text-coral-600 text-xs flex items-center gap-2 rounded-lg animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
            </div>
          )}

          <section className="space-y-2">
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider">Where are they staying?</p>
            {unitEntries.length === 0 && (
              <div className="flex gap-2">
                <select value={pickUnitId} onChange={e => setPickUnitId(e.target.value)} className="flex-1 bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-sea-500">
                  <option value="">Choose a room or venue…</option>
                  <optgroup label="Rooms">
                    {rooms.map(r => <option key={r.id} value={r.id}>{roomOptionLabel(r)}</option>)}
                  </optgroup>
                  <optgroup label="Event venues">
                    {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </optgroup>
                </select>
                <button onClick={addUnit} className="px-3 py-2 rounded-lg bg-sea-600 hover:bg-sea-700 text-white text-sm font-semibold transition-colors cursor-pointer shrink-0">Add</button>
              </div>
            )}
            {unitEntries.map(([id, sel]) => {
              const p = perUnitPricing[id]
              const nights = sel.checkIn && sel.checkOut ? Math.ceil((new Date(sel.checkOut).getTime() - new Date(sel.checkIn).getTime()) / 86400000) : 0
              return (
                <BookingUnitCard key={id} id={id} name={unitName(id, sel.type)} checkIn={sel.checkIn} checkOut={sel.checkOut} nights={nights} subtotal={p?.subtotal || 0} editable={!isEdit} onDatesChange={setUnitDates} onRemove={removeUnit} />
              )
            })}
          </section>

          {!isBlock && (
            <section className="space-y-2.5">
              <p className="text-[11px] font-bold text-muted uppercase tracking-wider">Guest</p>
              <div>
                <label className="text-[10px] text-muted font-bold block mb-1">Name</label>
                <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Guest name" className="w-full bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-sea-500" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] text-muted font-bold block mb-1">Phone</label>
                  <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="09xx…" className="w-full bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-sea-500" />
                </div>
                <div>
                  <label className="text-[10px] text-muted font-bold block mb-1">Booked from</label>
                  <select value={source} onChange={e => setSource(e.target.value as BookingSource)} className="w-full bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-sea-500">
                    <option value="manual">Walk-in</option>
                    <option value="facebook">Facebook</option>
                    <option value="google_maps">Google Maps</option>
                    <option value="website">Website</option>
                    <option value="airbnb">Airbnb</option>
                    <option value="booking_com">Booking.com</option>
                  </select>
                </div>
              </div>
              {anyPromo && (
                <label className="flex items-center gap-2 text-xs text-main cursor-pointer select-none">
                  <input type="checkbox" checked={usePromo} onChange={e => setUsePromo(e.target.checked)} className="accent-sea-600 w-4 h-4" />
                  Use promo price
                </label>
              )}
            </section>
          )}

          {!isBlock && (
            <PaymentSection totals={totals} payStatus={payStatus} setPayStatus={setPayStatus} payMethod={payMethod} setPayMethod={setPayMethod} payRef={payRef} setPayRef={setPayRef} />
          )}

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-main cursor-pointer select-none">
              <input type="checkbox" checked={isBlock} onChange={e => setIsBlock(e.target.checked)} className="accent-sea-600 w-4 h-4" />
              Block these dates instead (no guest)
            </label>
            <button onClick={() => setShowMore(!showMore)} className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-sea-700 cursor-pointer">
              <ChevronDown className={'w-3.5 h-3.5 transition-transform ' + (showMore ? 'rotate-180' : '')} />
              More guest details
            </button>
            {showMore && (
              <div className="space-y-2 animate-in fade-in">
                <input value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="Email (optional)" className="w-full bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-sea-500" />
                <button onClick={() => onOpenAdvanced(units)} className="w-full px-3 py-2 rounded-lg border border-sea-200 text-sea-700 text-xs font-bold hover:bg-sea-50 transition-colors cursor-pointer">
                  Open full booking form (corporate, amenities…)
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-soft bg-sand-50/60 shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-soft text-main text-sm font-semibold hover:bg-sand-50 transition-colors cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={!canSave || isSaving} className={'flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-bold transition-colors cursor-pointer ' + (canSave && !isSaving ? 'bg-sea-600 hover:bg-sea-700 shadow-sm' : 'bg-muted/40 cursor-not-allowed')}>
            {isSaving ? 'Saving…' : (isEdit ? 'Save changes' : 'Save booking')}
          </button>
        </div>
      </aside>
    </div>
  )
}
