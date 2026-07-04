import React, { useState, useMemo } from 'react'
import { Room, Venue, Booking, BookingSource, BreakfastOrder, Companion, EquipmentRental, EventAddons } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import {
  User, Phone, Mail, Plus, Trash2, AlertCircle, X, Users
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
  const [formStep, setFormStep] = useState(1)
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

  // Add‑ons
  const [formBreakfastQty, setFormBreakfastQty] = useState<Record<string, number>>({ Bangsilog: 0, Lumpiasilog: 0, Cornsilog: 0, Hotsilog: 0 })
  const [formBigTable, setFormBigTable] = useState(0)
  const [formSmallTable, setFormSmallTable] = useState(0)
  const [formChairs, setFormChairs] = useState(0)
  const [formWater, setFormWater] = useState(0)
  const [formBand, setFormBand] = useState(false)
  const [formStage, setFormStage] = useState(false)
  const [formLedWall, setFormLedWall] = useState(false)

  /* ─── Form pricing estimates ─── */
  const { basePrice, estNights, estBreakfast, estRentals, estAddons, estDown, estDue } = useMemo(() => {
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
      estBase: base,
      estBreakfast: breakfast,
      estRentals: rentals,
      estAddons: addons,
      estTotal: total,
      estDown: down,
      estDue: due
    }
  }, [
    formPathway,
    formRoomIds,
    formVenueId,
    formCheckIn,
    formCheckOut,
    formBreakfastQty,
    formBigTable,
    formSmallTable,
    formChairs,
    formWater,
    formBand,
    formStage,
    formLedWall,
    formStatus,
    rooms,
    venues
  ])

  const handleManualBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('')
    if (!formCheckIn || (formPathway === 'room' && !formCheckOut)) {
      setFormError('Please select active date bounds.'); return
    }
    try {
      const breakfasts: BreakfastOrder[] = []
      if (formPathway === 'room') {
        Object.entries(formBreakfastQty).forEach(([meal, qty]) => {
          if (qty > 0) breakfasts.push({ option: meal as BreakfastOrder['option'], quantity: qty, withCoffee: true })
        })
      }
      const localMultiplier = 1.0
      if (formPathway === 'room') {
        const unavail = Array.from(formRoomIds).filter(id => !syncEngine.isRoomAvailable(id, formCheckIn, formCheckOut, bookings))
        if (unavail.length > 0) {
          setFormError(`Overlap collision! ${unavail.map(id => rooms.find(r => r.id === id)?.name || id).join(', ')} already booked.`); return
        }
        for (const roomId of Array.from(formRoomIds)) {
          await createManualBooking({
            roomId, guestName: formGuestName, guestEmail: formGuestEmail,
            guestPhone: formGuestPhone, checkIn: formCheckIn, checkOut: formCheckOut,
            source: formSource, status: formStatus,
            breakfastOrders: breakfasts.length > 0 ? breakfasts : undefined,
            rateMultiplier: localMultiplier,
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
          rateMultiplier: localMultiplier
        })
      }
      onClose()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Overlap collision occurred.'
      setFormError(errMsg)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">New Booking</h3>
            <p className="text-[10px] text-slate-400">Step {formStep} of 3</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center px-5 py-3 gap-2">
          {[1,2,3].map(s => (
            <React.Fragment key={s}>
              {s > 1 && <div className={`flex-1 h-px ${formStep >= s ? 'bg-[#B89251]' : 'bg-slate-200'}`} />}
              <button type="button" onClick={() => { if (s < formStep) setFormStep(s) }}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold border transition-all ${
                  formStep === s ? 'bg-[#B89251] border-[#B89251] text-white' : formStep > s ? 'bg-[#FDFBF7] border-[#B89251] text-[#9A783E]' : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>{s}</button>
            </React.Fragment>
          ))}
        </div>

        <form onSubmit={handleManualBookingSubmit} className="px-5 pb-5 space-y-4">
          {formError && (
            <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" /><span>{formError}</span>
            </div>
          )}

          {/* STEP 1: Room/Venue + Dates + Pricing */}
          {formStep === 1 && (
            <div className="space-y-4">
              {/* Pathway toggle */}
              <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs font-medium">
                <button type="button" onClick={() => { setFormPathway('room'); setFormRoomIds(new Set([rooms[0]?.id || 'room-1'])) }}
                  className={`flex-1 py-2 text-center rounded-md transition-all ${formPathway === 'room' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                  Room
                </button>
                <button type="button" onClick={() => { setFormPathway('venue'); setFormVenueId(venues[0]?.id || 'venue-gazebo') }}
                  className={`flex-1 py-2 text-center rounded-md transition-all ${formPathway === 'venue' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                  Event Venue
                </button>
              </div>

              {/* Room / Venue selector */}
              <div>
                <label className="text-[10px] text-slate-500 font-medium block mb-1.5">
                  {formPathway === 'room' ? 'Select room(s)' : 'Select venue'}
                </label>
                {formPathway === 'room' ? (
                  <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto p-1 bg-slate-50 rounded-lg border border-slate-200">
                    {rooms.map(room => {
                      const sel = formRoomIds.has(room.id)
                      return (
                        <div key={room.id} onClick={() => {
                          const n = new Set(formRoomIds)
                          if (n.has(room.id)) {
                            if (n.size > 1) n.delete(room.id)
                          } else {
                            n.add(room.id)
                          }
                          setFormRoomIds(n)
                        }}
                          className={`p-2 rounded-lg border cursor-pointer select-none text-xs transition-all ${sel ? 'bg-[#FDFBF7] border-[#B89251]' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-slate-800">Room {room.room_number}</span>
                            {sel && <span className="text-[#B89251] text-xs">✓</span>}
                          </div>
                          <span className="text-[10px] text-[#9A783E] font-mono">₱{room.base_price.toLocaleString()}/night</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-50 rounded-lg border border-slate-200">
                    {venues.map(v => {
                      const sel = formVenueId === v.id
                      return (
                        <div key={v.id} onClick={() => setFormVenueId(v.id)}
                          className={`p-2 rounded-lg border cursor-pointer select-none text-xs transition-all ${sel ? 'bg-[#FDFBF7] border-[#B89251]' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                          <span className="font-medium text-slate-800 block truncate">{v.name}</span>
                          <span className="text-[10px] text-[#9A783E] font-mono">₱{v.base_price.toLocaleString()}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Source */}
              <div>
                <label className="text-[10px] text-slate-500 font-medium block mb-1.5">Booking source</label>
                <select value={formSource} onChange={e => setFormSource(e.target.value as BookingSource)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-[#B89251]">
                  <option value="manual">Walk-in (Cash)</option>
                  <option value="facebook">Facebook</option>
                  <option value="google_maps">Google Maps</option>
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-1.5">{formPathway === 'room' ? 'Check-in' : 'Event date'}</label>
                  <input type="date" required value={formCheckIn} onChange={e => setFormCheckIn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-[#B89251]" />
                </div>
                {formPathway === 'room' && (
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-1.5">Check-out</label>
                    <input type="date" required value={formCheckOut} onChange={e => setFormCheckOut(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-[#B89251]" />
                  </div>
                )}
              </div>



              <div className="flex justify-end pt-2">
                <button type="button" disabled={!formCheckIn || (formPathway === 'room' && !formCheckOut)} onClick={() => setFormStep(2)}
                  className="bg-[#B89251] hover:bg-[#9A783E] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-medium px-5 py-2 rounded-lg transition-colors">
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Guest details */}
          {formStep === 2 && (
            <div className="space-y-4">
              {/* Block type */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-500 font-medium">Type:</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer font-medium text-slate-700">
                    <input type="radio" checked={formStatus === 'confirmed'} onChange={() => setFormStatus('confirmed')} className="accent-[#B89251]" /> Booking
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer font-medium text-slate-700">
                    <input type="radio" checked={formStatus === 'blocked'} onChange={() => setFormStatus('blocked')} className="accent-[#B89251]" /> Block
                  </label>
                </div>
              </div>

              {formStatus === 'blocked' ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 space-y-1">
                  <p className="font-medium text-slate-700">Maintenance / Calendar Block</p>
                  <p>Blocks this room for housekeeping, repairs, or private closures.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-1.5">Guest name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" required placeholder="Full name" value={formGuestName} onChange={e => setFormGuestName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 pl-10 pr-3 py-2 rounded-lg text-xs focus:outline-none focus:border-[#B89251]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-1.5">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="email" required placeholder="email@example.com" value={formGuestEmail} onChange={e => setFormGuestEmail(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-700 pl-10 pr-3 py-2 rounded-lg text-xs focus:outline-none focus:border-[#B89251]" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-1.5">Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" required placeholder="0917-xxx-xxxx" value={formGuestPhone} onChange={e => setFormGuestPhone(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-700 pl-10 pr-3 py-2 rounded-lg text-xs focus:outline-none focus:border-[#B89251]" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Companion Registry */}
                  <div className="pt-3 border-t border-slate-200/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[#B89251]" /> Companions / Roommates
                      </span>
                      <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        Guest Count: {formCompanions.length + 1}
                      </span>
                    </div>
                    
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {formCompanions.length === 0 ? (
                        <p className="text-[10px] text-slate-400 py-2 italic text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">No companions registered yet.</p>
                      ) : (
                        formCompanions.map((comp, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                            <input 
                              type="text" 
                              required 
                              placeholder="Companion full name" 
                              value={comp.name} 
                              onChange={e => {
                                const updated = [...formCompanions]
                                updated[idx].name = e.target.value
                                setFormCompanions(updated)
                              }} 
                              className="flex-1 bg-white border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded focus:outline-none focus:border-[#B89251] text-[11px]" 
                            />
                            <select 
                              value={comp.gender} 
                              onChange={e => {
                                const updated = [...formCompanions]
                                updated[idx].gender = e.target.value as 'male' | 'female'
                                setFormCompanions(updated)
                              }} 
                              className="bg-white border border-slate-200 text-slate-700 px-2 py-1.5 rounded focus:outline-none focus:border-[#B89251] text-[11px]"
                            >
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                            </select>
                            <button 
                              type="button" 
                              onClick={() => setFormCompanions(formCompanions.filter((_, i) => i !== idx))} 
                              className="text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <button 
                      type="button" 
                      onClick={() => setFormCompanions([...formCompanions, { name: '', gender: 'male' }])} 
                      className="mt-2 text-[10px] text-[#B89251] hover:text-[#9A783E] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Companion
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setFormStep(1)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">← Back</button>
                {formStatus === 'blocked' ? (
                  <button type="submit" className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-medium px-5 py-2 rounded-lg transition-colors">
                    Create Block
                  </button>
                ) : (
                  <button type="button" disabled={!formGuestName} onClick={() => setFormStep(3)}
                    className="bg-[#B89251] hover:bg-[#9A783E] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-medium px-5 py-2 rounded-lg transition-colors">
                    Next →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Add‑ons + Invoice */}
          {formStep === 3 && (
            <div className="space-y-4">
              {/* Breakfast (rooms) */}
              {formPathway === 'room' && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                  <span className="text-[10px] text-[#9A783E] font-medium block">Breakfast (₱200/set)</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.keys(formBreakfastQty).map(meal => (
                      <div key={meal} className="flex items-center justify-between bg-white border border-slate-100 p-2 rounded-lg">
                        <span className="text-slate-700 font-medium">{meal}</span>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => setFormBreakfastQty(p => ({ ...p, [meal]: Math.max(0, p[meal] - 1) }))}
                            className="w-5 h-5 bg-slate-100 rounded flex items-center justify-center text-slate-600 hover:bg-slate-200 font-bold">-</button>
                          <span className="font-mono w-4 text-center font-semibold">{formBreakfastQty[meal]}</span>
                          <button type="button" onClick={() => setFormBreakfastQty(p => ({ ...p, [meal]: p[meal] + 1 }))}
                            className="w-5 h-5 bg-slate-100 rounded flex items-center justify-center text-slate-600 hover:bg-slate-200 font-bold">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Venue equipment + add‑ons */}
              {formPathway === 'venue' && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-3">
                  <span className="text-[10px] text-[#9A783E] font-medium block">Equipment & Add-ons</span>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    {[
                      { label: 'Big Table', value: formBigTable, set: setFormBigTable, price: 150 },
                      { label: 'Sm Table', value: formSmallTable, set: setFormSmallTable, price: 100 },
                      { label: 'Chairs', value: formChairs, set: setFormChairs, price: 15 },
                      { label: 'Water', value: formWater, set: setFormWater, price: 35 },
                    ].map(item => (
                      <div key={item.label} className="bg-white border border-slate-100 p-2 rounded-lg">
                        <span className="text-[9px] text-slate-400 block mb-1">{item.label}</span>
                        <input type="number" min="0" value={item.value} onChange={e => item.set(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-10 text-center bg-slate-50 border border-slate-200 text-slate-700 font-mono py-0.5 rounded focus:outline-none focus:border-[#B89251] text-xs" />
                        <span className="text-[8px] text-slate-400 block mt-1">₱{item.price}/pc</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-200/40 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                      <input type="checkbox" checked={formBand} onChange={e => setFormBand(e.target.checked)} className="accent-[#B89251]" /> Band (₱2k)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                      <input type="checkbox" checked={formStage} onChange={e => setFormStage(e.target.checked)} className="accent-[#B89251]" /> Stage (₱2k)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                      <input type="checkbox" checked={formLedWall} onChange={e => setFormLedWall(e.target.checked)} className="accent-[#B89251]" /> LED Wall (₱5k)
                    </label>
                  </div>
                </div>
              )}

              {/* Invoice summary */}
              <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-[11px] space-y-2">
                <div className="text-center border-b border-slate-700 pb-2">
                  <div className="text-[9px] text-[#B89251] font-semibold tracking-wide">BILLING SUMMARY</div>
                  <div className="text-sm font-semibold text-white mt-0.5">DAWEEZ PENSION HOUSE</div>
                </div>
                <div className="space-y-1 text-slate-400">
                  <div className="flex justify-between"><span>Rate:</span><span>₱{basePrice.toLocaleString()}/night</span></div>
                  {estNights > 1 && <div className="flex justify-between"><span>Nights:</span><span>{estNights}</span></div>}


                  {estBreakfast > 0 && <div className="flex justify-between"><span>Breakfast:</span><span>₱{estBreakfast.toLocaleString()}</span></div>}
                  {estRentals > 0 && <div className="flex justify-between"><span>Rentals:</span><span>₱{estRentals.toLocaleString()}</span></div>}
                  {estAddons > 0 && <div className="flex justify-between"><span>Add-ons:</span><span>₱{estAddons.toLocaleString()}</span></div>}
                </div>
                <div className="border-t border-slate-700 pt-2 space-y-1">
                  <div className="flex justify-between text-white font-semibold text-xs">
                    <span>Downpayment (50%):</span><span className="text-emerald-400">₱{estDown.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-white font-semibold text-xs">
                    <span>Due at check-in:</span><span className="text-[#B89251]">₱{estDue.toLocaleString()}</span>
                  </div>
                  <div className="text-[9px] text-slate-500 text-center pt-1">Includes ₱500 refundable deposit</div>
                </div>
              </div>

              <div className="flex justify-between pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setFormStep(2)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">← Back</button>
                <button type="submit"
                  className="bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-medium px-5 py-2.5 rounded-lg transition-colors">
                  Create Booking
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
