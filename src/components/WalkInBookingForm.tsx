import React, { useState, useMemo } from 'react'
import { Room, Venue, Booking, BookingSource, BreakfastOrder, Companion, EquipmentRental, EventAddons } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import {
  User, Phone, Mail, Plus, Trash2, AlertCircle, X, Users,
  CalendarDays, BedDouble, PartyPopper, ChevronDown, Coffee, Armchair, CheckCircle2
} from 'lucide-react'

interface WalkInBookingFormProps {
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  createManualBooking: (params: {
    roomId?: string
    venueId?: string
    guestName: string
    guestEmail: string
    guestPhone: string
    checkIn: string
    checkOut: string
    source: BookingSource
    status: 'confirmed' | 'blocked'
    breakfastOrders?: BreakfastOrder[]
    equipmentRentals?: EquipmentRental
    eventAddons?: EventAddons
    rateMultiplier?: number
    companions?: Companion[]
  }) => Promise<Booking>
  initialPathway: 'room' | 'venue'
  initialRoomIds: Set<string>
  initialCheckIn: string
  initialCheckOut: string
  onClose: () => void
}

export function WalkInBookingForm({
  rooms,
  venues,
  bookings,
  createManualBooking,
  initialPathway,
  initialRoomIds,
  initialCheckIn,
  initialCheckOut,
  onClose
}: WalkInBookingFormProps) {
  // ── Core wizard state ──
  const [formStep, setFormStep] = useState<number>(1)
  const [formPathway, setFormPathway] = useState<'room' | 'venue'>(initialPathway)
  const [formRoomIds, setFormRoomIds] = useState<Set<string>>(initialRoomIds)
  const [formVenueId, setFormVenueId] = useState<string>(venues[0]?.id || 'venue-gazebo')
  const [formGuestName, setFormGuestName] = useState('')
  const [formGuestEmail, setFormGuestEmail] = useState('')
  const [formGuestPhone, setFormGuestPhone] = useState('')
  const [formCheckIn, setFormCheckIn] = useState(initialCheckIn)
  const [formCheckOut, setFormCheckOut] = useState(initialCheckOut)
  const [formSource, setFormSource] = useState<BookingSource>('manual')
  const [formStatus, setFormStatus] = useState<'confirmed' | 'blocked'>('confirmed')
  const [formError, setFormError] = useState('')
  const [formCompanions, setFormCompanions] = useState<Companion[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Add-ons ──
  const [formBreakfastQty, setFormBreakfastQty] = useState<Record<string, number>>({ Bangsilog: 0, Lumpiasilog: 0, Cornsilog: 0, Hotsilog: 0 })
  const [formBigTable, setFormBigTable] = useState(0)
  const [formSmallTable, setFormSmallTable] = useState(0)
  const [formChairs, setFormChairs] = useState(0)
  const [formWater, setFormWater] = useState(0)
  const [formBand, setFormBand] = useState(false)
  const [formStage, setFormStage] = useState(false)
  const [formLedWall, setFormLedWall] = useState(false)

  // ── Collapsible sections ──
  const [showAddons, setShowAddons] = useState(true) 
  const [showCompanions, setShowCompanions] = useState(true) // Open by default inside the stepper since there is more room

  // ── Pricing ──
  const { basePrice, estNights, estBreakfast, estRentals, estAddons, estTotal, estDown, estDue } = useMemo(() => {
    const bp = formPathway === 'room'
      ? Array.from(formRoomIds).reduce((s, id) => s + (rooms.find(r => r.id === id)?.base_price ?? 0), 0)
      : (venues.find(v => v.id === formVenueId)?.base_price ?? 0)

    const nights = formPathway === 'room' && formCheckIn && formCheckOut
      ? Math.max(1, Math.ceil((new Date(formCheckOut).getTime() - new Date(formCheckIn).getTime()) / 86400000))
      : 1

    const base = bp * nights
    let breakfast = 0
    if (formPathway === 'room') {
      Object.values(formBreakfastQty).forEach(q => { breakfast += 200 * q })
    }
    let rentals = 0
    if (formPathway === 'venue') {
      rentals = formBigTable * 150 + formSmallTable * 100 + formChairs * 15 + formWater * 35
    }
    let addons = 0
    if (formPathway === 'venue') {
      if (formBand) addons += 2000
      if (formStage) addons += 2000
      if (formLedWall) addons += 5000
    }

    const total = base + breakfast + rentals + addons
    const down = Math.round(total * 0.5)
    const due = (total - down) + (formStatus === 'blocked' ? 0 : 500)

    return {
      basePrice: bp,
      estNights: nights,
      estBreakfast: breakfast,
      estRentals: rentals,
      estAddons: addons,
      estTotal: total,
      estDown: down,
      estDue: due
    }
  }, [formPathway, formRoomIds, formVenueId, formCheckIn, formCheckOut,
    formBreakfastQty, formBigTable, formSmallTable, formChairs, formWater,
    formBand, formStage, formLedWall, formStatus, rooms, venues])

  const hasAddons = estBreakfast > 0 || estRentals > 0 || estAddons > 0

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('')
    if (!formCheckIn || (formPathway === 'room' && !formCheckOut)) {
      setFormError('Please select active check-in and check-out dates.'); return
    }
    if (formStatus === 'confirmed' && !formGuestName) {
      setFormError('Guest name is required.'); return
    }
    setIsSubmitting(true)
    try {
      const breakfasts: BreakfastOrder[] = []
      if (formPathway === 'room') {
        Object.entries(formBreakfastQty).forEach(([meal, qty]) => {
          if (qty > 0) breakfasts.push({ option: meal as BreakfastOrder['option'], quantity: qty, withCoffee: true })
        })
      }
      if (formPathway === 'room') {
        const unavail = Array.from(formRoomIds).filter(id => !syncEngine.isRoomAvailable(id, formCheckIn, formCheckOut, bookings))
        if (unavail.length > 0) {
          setFormError(`${unavail.map(id => rooms.find(r => r.id === id)?.name || id).join(', ')} already booked for these dates.`)
          setIsSubmitting(false); return
        }
        for (const roomId of Array.from(formRoomIds)) {
          await createManualBooking({
            roomId, guestName: formGuestName, guestEmail: formGuestEmail,
            guestPhone: formGuestPhone, checkIn: formCheckIn, checkOut: formCheckOut,
            source: formSource, status: formStatus,
            breakfastOrders: breakfasts.length > 0 ? breakfasts : undefined,
            rateMultiplier: 1.0,
            companions: formCompanions.length > 0 ? formCompanions : undefined
          })
        }
      } else {
        await createManualBooking({
          venueId: formVenueId, guestName: formGuestName, guestEmail: formGuestEmail,
          guestPhone: formGuestPhone, checkIn: formCheckIn, checkOut: formCheckIn,
          source: formSource, status: formStatus,
          equipmentRentals: { bigTableCount: formBigTable, smallTableCount: formSmallTable, chairCount: formChairs, mineralWaterCount: formWater },
          eventAddons: { fullBandAndLights: formBand, stage: formStage, ledWall: formLedWall },
          rateMultiplier: 1.0
        })
      }
      onClose()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Booking failed — possible date overlap.')
      setIsSubmitting(false)
    }
  }

  // ── Counter Component ──
  const Counter = ({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) => (
    <div className="flex items-center gap-0.5 select-none">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer">−</button>
      <span className="font-mono w-6 text-center text-xs font-semibold text-slate-700">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)}
        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer">+</button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50" onClick={onClose}>
      <div className="w-full max-w-md md:max-w-4xl bg-white rounded-lg border border-slate-200 shadow-xl flex flex-col max-h-[92vh] md:max-h-[85vh] overflow-hidden transition-all duration-300" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 flex items-center justify-center bg-[#FDFBF7] border border-[#E5D5C0] rounded-md">
              {formPathway === 'room'
                ? <BedDouble className="w-3.5 h-3.5 text-[#B89251]" />
                : <PartyPopper className="w-3.5 h-3.5 text-[#B89251]" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">New Reservation</h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Step {formStep} of {formStatus === 'blocked' ? 2 : 3}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 -mr-1.5 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Step Progress Indicator ── */}
        <div className="flex items-center px-5 py-2.5 border-b border-slate-100 shrink-0 bg-slate-50/50">
          {[1, 2, 3].map(s => {
            // Blocks only have 2 steps (Resource + Blocking Details)
            if (s === 3 && formStatus === 'blocked') return null
            const isActive = formStep === s
            const isCompleted = formStep > s
            return (
              <React.Fragment key={s}>
                {s > 1 && (
                  <div className={`flex-1 h-0.5 transition-all duration-300 ${isCompleted ? 'bg-[#B89251]' : 'bg-slate-200'}`} />
                )}
                <button type="button" disabled={s > formStep} onClick={() => setFormStep(s)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#B89251] border-[#B89251] text-white shadow-sm'
                      : isCompleted
                        ? 'bg-[#FDFBF7] border-[#B89251] text-[#9A783E] font-semibold'
                        : 'bg-white border-slate-200 text-slate-400 disabled:cursor-not-allowed'
                  }`}>
                  {s}
                </button>
              </React.Fragment>
            )
          })}
        </div>

        {/* ── Scrollable Body ── */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 p-5 bg-slate-50/30">
            <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-6">

              {/* ── LEFT COLUMN: Progressive Wizard Fields ── */}
              <div className="space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2 rounded-md animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0" /><span>{formError}</span>
                  </div>
                )}

                {/* STEP 1: Resource Schedule & Type Selection */}
                {formStep === 1 && (
                  <div className="bg-white p-4 rounded-md border border-slate-200/60 shadow-sm space-y-3.5">
                    <h4 className="text-[9px] font-bold text-[#9A783E] tracking-widest uppercase border-b border-slate-100 pb-1.5">1. Resource &amp; Schedule</h4>
                    
                    {/* Pathway Segmented Toggle */}
                    <div className="flex bg-slate-100 rounded-md p-0.5 text-xs font-semibold">
                      <button type="button" onClick={() => { setFormPathway('room'); setFormRoomIds(new Set([rooms[0]?.id || 'room-1'])) }}
                        className={`flex-1 py-1.5 text-center rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${formPathway === 'room' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                        <BedDouble className="w-3.5 h-3.5 text-[#B89251]" /> Room Unit
                      </button>
                      <button type="button" onClick={() => { setFormPathway('venue'); setFormVenueId(venues[0]?.id || 'venue-gazebo') }}
                        className={`flex-1 py-1.5 text-center rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${formPathway === 'venue' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                        <PartyPopper className="w-3.5 h-3.5 text-[#B89251]" /> Event Venue
                      </button>
                    </div>

                    {/* Available Chips List */}
                    {formPathway === 'room' ? (
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">Select Room(s):</span>
                        <div className="flex flex-wrap gap-1.5">
                          {rooms.map(room => {
                            const sel = formRoomIds.has(room.id)
                            const avail = formCheckIn && formCheckOut ? syncEngine.isRoomAvailable(room.id, formCheckIn, formCheckOut, bookings) : true
                            return (
                              <button key={room.id} type="button" disabled={!avail && !sel}
                                onClick={() => {
                                  const n = new Set(formRoomIds)
                                  if (n.has(room.id)) { if (n.size > 1) n.delete(room.id) } else { n.add(room.id) }
                                  setFormRoomIds(n)
                                }}
                                className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all select-none cursor-pointer duration-100 ${
                                  !avail && !sel
                                    ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed line-through opacity-60'
                                    : sel
                                      ? 'bg-[#FDFBF7] border-[#B89251] text-[#9A783E] shadow-sm ring-1 ring-[#e6c280]'
                                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                }`}>
                                <span>Rm {room.room_number}</span>
                                <span className="text-[9px] font-mono ml-1.5 opacity-80">₱{room.base_price.toLocaleString()}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">Select Gazebo/Venue:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {venues.map(v => {
                            const sel = formVenueId === v.id
                            return (
                              <button key={v.id} type="button" onClick={() => setFormVenueId(v.id)}
                                className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all select-none cursor-pointer duration-100 ${
                                  sel ? 'bg-[#FDFBF7] border-[#B89251] text-[#9A783E] shadow-sm ring-1 ring-[#e6c280]' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                }`}>
                                {v.name} <span className="text-[9px] font-mono ml-1 opacity-80">₱{v.base_price.toLocaleString()}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Dates Segment */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-1">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-400" /> {formPathway === 'room' ? 'Check-in' : 'Event date'}
                        </label>
                        <input type="date" required value={formCheckIn} onChange={e => setFormCheckIn(e.target.value)}
                          className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 px-2.5 py-1.5 rounded text-xs font-mono focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] transition-all" />
                      </div>
                      {formPathway === 'room' && (
                        <div>
                          <label className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-1">
                            <CalendarDays className="w-3.5 h-3.5 text-slate-400" /> Check-out
                          </label>
                          <input type="date" required value={formCheckOut} onChange={e => setFormCheckOut(e.target.value)}
                            className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 px-2.5 py-1.5 rounded text-xs font-mono focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] transition-all" />
                        </div>
                      )}
                    </div>

                    {/* Channel & Status Types */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">Booking Channel</label>
                        <select value={formSource} onChange={e => setFormSource(e.target.value as BookingSource)}
                          className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] transition-all">
                          <option value="manual">Walk-in (Cash)</option>
                          <option value="facebook">Facebook Messenger</option>
                          <option value="google_maps">Google Maps</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">Status Type</label>
                        <div className="flex bg-slate-100 rounded rounded-md p-0.5 h-[32px]">
                          <button type="button" onClick={() => setFormStatus('confirmed')}
                            className={`flex-1 rounded text-xs font-semibold transition-all cursor-pointer ${formStatus === 'confirmed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                            Booking
                          </button>
                          <button type="button" onClick={() => setFormStatus('blocked')}
                            className={`flex-1 rounded text-xs font-semibold transition-all cursor-pointer ${formStatus === 'blocked' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                            Block
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: Guest Details & Companions */}
                {formStep === 2 && (
                  <div className="bg-white p-4 rounded-md border border-slate-200/60 shadow-sm space-y-3.5 animate-in fade-in duration-200">
                    <h4 className="text-[9px] font-bold text-[#9A783E] tracking-widest uppercase border-b border-slate-100 pb-1.5">2. Guest Registry</h4>
                    
                    {formStatus === 'confirmed' ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] text-slate-500 font-medium block mb-1">Primary Guest Name</label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="text" required placeholder="Guest full name" value={formGuestName} onChange={e => setFormGuestName(e.target.value)}
                              className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 pl-9 pr-3 py-1.5 rounded text-xs focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] transition-all font-medium" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-slate-500 font-medium block mb-1">Email Address</label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input type="email" placeholder="guest@domain.com" value={formGuestEmail} onChange={e => setFormGuestEmail(e.target.value)}
                                className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 pl-9 pr-3 py-1.5 rounded text-xs focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] transition-all font-medium" />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 font-medium block mb-1">Phone Number</label>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input type="text" placeholder="09xx-xxx-xxxx" value={formGuestPhone} onChange={e => setFormGuestPhone(e.target.value)}
                                className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-800 pl-9 pr-3 py-1.5 rounded text-xs focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280] transition-all font-medium" />
                          </div>
                        </div>
                        
                        {/* Companions Registry */}
                        <div className="pt-2 border-t border-slate-100 col-span-1 sm:col-span-2">
                          <button type="button" onClick={() => setShowCompanions(!showCompanions)}
                            className="flex items-center justify-between w-full text-[10px] text-slate-500 font-semibold uppercase tracking-wider hover:text-slate-700 transition-colors py-1 cursor-pointer">
                            <span className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-[#B89251]" /> Roommates / Companions
                              {formCompanions.length > 0 && (
                                <span className="bg-[#FDFBF7] border border-[#E5D5C0] text-[#9A783E] text-[9px] font-bold px-2 py-0.5 rounded ml-1">
                                  {formCompanions.length + 1} Guests
                                </span>
                              )}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showCompanions ? 'rotate-180' : ''}`} />
                          </button>

                          {showCompanions && (
                            <div className="space-y-2 pt-2 animate-in slide-in-from-top-1 duration-150">
                              {formCompanions.length === 0 && (
                                <p className="text-[10px] text-slate-400 py-3 italic text-center bg-slate-50/50 rounded border border-dashed border-slate-200">
                                  No registered roommates. Click below to add.
                                </p>
                              )}
                              {formCompanions.map((comp, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200/60">
                                  <input type="text" required placeholder="Full name" value={comp.name}
                                    onChange={e => { const u = [...formCompanions]; u[idx] = { ...u[idx], name: e.target.value }; setFormCompanions(u) }}
                                    className="flex-1 bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded text-[11px] focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280]" />
                                  <select value={comp.gender}
                                    onChange={e => { const u = [...formCompanions]; u[idx] = { ...u[idx], gender: e.target.value as 'male' | 'female' }; setFormCompanions(u) }}
                                    className="bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded text-[11px] focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#e6c280]">
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                  </select>
                                  <button type="button" onClick={() => setFormCompanions(formCompanions.filter((_, i) => i !== idx))}
                                    className="text-slate-400 hover:text-rose-500 transition-colors p-1.5 shrink-0 cursor-pointer">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                              <button type="button" onClick={() => setFormCompanions([...formCompanions, { name: '', gender: 'male' }])}
                                className="text-[10px] text-[#B89251] hover:text-[#9A783E] font-bold flex items-center gap-1 transition-colors mt-1 select-none cursor-pointer">
                                <Plus className="w-3.5 h-3.5" /> Add Companion Record
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded text-xs text-slate-500 space-y-1.5">
                      <p className="font-bold text-slate-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#B89251]" /> Maintenance / Date Block
                      </p>
                      <p className="text-[11px] leading-normal">This action places an administrative block on the schedule. No guests or invoice statements will be created.</p>
                    </div>
                  )}
                  </div>
                )}

                {/* STEP 3: Add-ons & Services */}
                {formStep === 3 && formStatus === 'confirmed' && (
                  <div className="bg-white p-4 rounded-md border border-slate-200/60 shadow-sm space-y-3.5 animate-in fade-in duration-200">
                    <h4 className="text-[9px] font-bold text-[#9A783E] tracking-widest uppercase border-b border-slate-100 pb-1.5">3. Amenities &amp; Services</h4>
                    
                    <button type="button" onClick={() => setShowAddons(!showAddons)}
                      className="flex items-center justify-between w-full text-[10px] text-slate-500 font-semibold uppercase tracking-wider hover:text-slate-700 transition-colors py-1 cursor-pointer">
                      <span className="flex items-center gap-1.5 font-bold">
                        {formPathway === 'room'
                          ? <><Coffee className="w-3.5 h-3.5 text-[#B89251]" /> Breakfast Orders</>
                          : <><Armchair className="w-3.5 h-3.5 text-[#B89251]" /> Equipment &amp; Event Add-ons</>}
                        {hasAddons && (
                          <span className="bg-[#FDFBF7] border border-[#E5D5C0] text-[#9A783E] text-[9px] font-bold px-2 py-0.5 rounded ml-1">
                            +₱{(estBreakfast + estRentals + estAddons).toLocaleString()}
                          </span>
                        )}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showAddons ? 'rotate-180' : ''}`} />
                    </button>

                    {showAddons && formPathway === 'room' && (
                      <div className="space-y-2 pt-1 animate-in slide-in-from-top-1 duration-150">
                        {Object.keys(formBreakfastQty).map(meal => (
                          <div key={meal} className="flex items-center justify-between bg-slate-50/60 px-3 py-1.5 rounded border border-slate-100">
                            <div>
                              <span className="text-xs font-semibold text-slate-700">{meal}</span>
                              <span className="text-[10px] text-slate-400 ml-2">₱200/set</span>
                            </div>
                            <Counter value={formBreakfastQty[meal]} onChange={v => setFormBreakfastQty(p => ({ ...p, [meal]: v }))} />
                          </div>
                        ))}
                      </div>
                    )}

                    {showAddons && formPathway === 'venue' && (
                      <div className="space-y-3.5 pt-1 animate-in slide-in-from-top-1 duration-150">
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'Big Table', value: formBigTable, set: setFormBigTable, price: 150 },
                            { label: 'Small Table', value: formSmallTable, set: setFormSmallTable, price: 100 },
                            { label: 'Chairs', value: formChairs, set: setFormChairs, price: 15 },
                            { label: 'Water Pot', value: formWater, set: setFormWater, price: 35 },
                          ].map(item => (
                            <div key={item.label} className="flex items-center justify-between bg-slate-50/60 px-3 py-1.5 rounded border border-slate-100">
                              <div>
                                <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                                <span className="text-[10px] text-slate-400 ml-1.5">₱{item.price}</span>
                              </div>
                              <Counter value={item.value} onChange={item.set} />
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t border-slate-100 text-xs">
                          {[
                            { label: 'Band & Lights', price: '₱2k', checked: formBand, set: setFormBand },
                            { label: 'Stage setup', price: '₱2k', checked: formStage, set: setFormStage },
                            { label: 'LED Wall 9x12', price: '₱5k', checked: formLedWall, set: setFormLedWall },
                          ].map(item => (
                            <label key={item.label} className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-semibold select-none">
                              <input type="checkbox" checked={item.checked} onChange={e => item.set(e.target.checked)} className="accent-[#B89251] rounded" />
                              {item.label} <span className="text-[10px] text-slate-400 font-mono">({item.price})</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Step-by-Step Navigation Buttons ── */}
                <div className="flex justify-between items-center pt-4 border-t border-slate-200/60 mt-5 shrink-0 bg-white">
                  {formStep > 1 ? (
                    <button type="button" onClick={() => setFormStep(formStep - 1)}
                      className="text-xs text-[#9A783E] hover:text-[#B89251] font-bold px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer">
                      &larr; Back
                    </button>
                  ) : <div />}
                  
                  {formStep === 1 && (
                    <button type="button" disabled={!formCheckIn || (formPathway === 'room' && !formCheckOut)} onClick={() => setFormStep(2)}
                      className="bg-[#B89251] hover:bg-[#9A783E] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-semibold px-6 py-2 rounded transition-all cursor-pointer shadow-sm">
                      Next &rarr;
                    </button>
                  )}

                  {formStep === 2 && formStatus === 'confirmed' && (
                    <button type="button" disabled={!formGuestName} onClick={() => setFormStep(3)}
                      className="bg-[#B89251] hover:bg-[#9A783E] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-semibold px-6 py-2 rounded transition-all cursor-pointer shadow-sm">
                      Next &rarr;
                    </button>
                  )}

                  {formStep === 2 && formStatus === 'blocked' && (
                    <button type="submit" disabled={isSubmitting}
                      className="bg-slate-700 hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-semibold px-6 py-2 rounded transition-all cursor-pointer shadow-sm">
                      {isSubmitting ? 'Creating...' : 'Create Block'}
                    </button>
                  )}

                  {formStep === 3 && (
                    <button type="submit" disabled={isSubmitting}
                      className="bg-[#B89251] hover:bg-[#9A783E] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-semibold px-6 py-2.5 rounded transition-all cursor-pointer shadow-sm">
                      {isSubmitting ? 'Creating...' : 'Confirm Booking'}
                    </button>
                  )}
                </div>
              </div>

              {/* ── RIGHT COLUMN: Invoice Receipt (Always visible on desktop landscape for immediate sync feedback) ── */}
              <div className="space-y-4">
                <h4 className="text-[9px] font-bold text-[#9A783E] tracking-widest uppercase md:block hidden pb-0.5 border-b border-slate-200/40">Statement Estimate</h4>
                
                {/* Monospace receipt card */}
                {formStatus === 'confirmed' ? (
                  <div className="bg-[#FDFBF7] border border-[#E5D5C0] p-5 rounded-md text-xs space-y-4 shadow-sm relative overflow-hidden text-[#9A783E]">
                    <div className="absolute top-0 inset-x-0 h-1.5 bg-[#B89251]" />
                    <div className="text-center border-b border-dashed border-[#E5D5C0] pb-4">
                      <div className="text-[9px] text-[#9A783E] font-bold tracking-widest uppercase mb-1">Estimated Invoice</div>
                      <h5 className="text-sm font-extrabold text-slate-800 tracking-tight uppercase">Daweez Pension House</h5>
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
                      
                      {/* Detailed breakdown of items */}
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

                      {/* Add-ons line items */}
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
                      <div className="text-[9px] text-slate-400 text-center pt-2 italic leading-normal">
                        Includes ₱500 refundable security deposit
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#FDFBF7] border border-[#E5D5C0] p-5 rounded-md text-xs space-y-2 text-[#9A783E]">
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

            </div>
          </div>
        </form>

      </div>
    </div>
  )
}
