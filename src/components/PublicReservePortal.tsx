import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, User, Mail, Phone, CheckCircle2, Users, ArrowRight, Info, AlertCircle, Tag } from 'lucide-react'
import { Booking, Room, Venue, Companion } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { isPromoActive, getEffectiveNightlyPrice } from '../utils/promoMode'

export function PublicReservePortal() {
  // --- State ---
  const [step, setStep] = useState(1) // 1: Date & Unit, 2: Guest Details, 3: Success

  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState<string>('')
  const [selectedUnitType, setSelectedUnitType] = useState<'room' | 'venue' | null>(null)

  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [paymentRef, setPaymentRef] = useState('')
  const [companions, setCompanions] = useState<Companion[]>([])
  const [newCompanionName, setNewCompanionName] = useState('')
  const [newCompanionGender, setNewCompanionGender] = useState<'male' | 'female'>('male')

  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successBookingId, setSuccessBookingId] = useState('')

  const queryClient = useQueryClient()

  // Shared data via React Query — same cache as the dashboard, no duplicate
  // fetch, and availability stays fresh after staff confirm/cancel bookings.
  const { data: bookings = [], isLoading: isLoadingBookings } = useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: () => syncEngine.getBookings(),
    staleTime: 30_000,
  })
  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: () => syncEngine.getRooms(),
    staleTime: 5 * 60 * 1000,
  })
  const { data: venues = [] } = useQuery<Venue[]>({
    queryKey: ['venues'],
    queryFn: () => syncEngine.getVenues(),
    staleTime: 5 * 60 * 1000,
  })

  const [promoOn, setPromoOn] = useState<boolean>(() => isPromoActive())
  useEffect(() => {
    const sync = () => setPromoOn(isPromoActive())
    const onStorage = (e: StorageEvent) => { if (e.key === 'daweez_promo_active') sync() }
    const onPromoToggle = () => sync()
    window.addEventListener('storage', onStorage)
    window.addEventListener('promo-toggle' as never, onPromoToggle as never)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('promo-toggle' as never, onPromoToggle as never)
    }
  }, [])

  const nights = useMemo(() => {
    if (!checkIn || !checkOut || checkIn >= checkOut) return 0
    return Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
  }, [checkIn, checkOut])

  // Track availability maps (live rooms/venues, not hardcoded defaults)
  const roomAvailability = useMemo(() => {
    const map: Record<string, boolean> = {}
    rooms.forEach(r => {
      map[r.id] = (nights > 0 && checkIn && checkOut)
        ? syncEngine.isRoomAvailable(r.id, checkIn, checkOut, bookings)
        : true
    })
    return map
  }, [checkIn, checkOut, bookings, nights, rooms])

  const venueAvailability = useMemo(() => {
    const map: Record<string, boolean> = {}
    venues.forEach(v => {
      map[v.id] = (nights > 0 && checkIn && checkOut)
        ? syncEngine.isVenueRangeAvailable(v.id, checkIn, checkOut, bookings)
        : true
    })
    return map
  }, [checkIn, checkOut, bookings, nights, venues])

  const selectedUnit = useMemo(() => {
    if (!selectedUnitId) return null
    if (selectedUnitType === 'room') {
      return rooms.find(r => r.id === selectedUnitId)
    }
    return venues.find(v => v.id === selectedUnitId)
  }, [selectedUnitId, selectedUnitType, rooms, venues])

  // Pricing: website charges promo only while the global promo is ON.
  const pricing = useMemo(() => {
    if (!selectedUnit || nights <= 0) return null
    const usePromo = promoOn
    return syncEngine.calculatePricing({
      roomId: selectedUnitType === 'room' ? selectedUnitId : undefined,
      venueId: selectedUnitType === 'venue' ? selectedUnitId : undefined,
      checkIn,
      checkOut,
      guestEmail,
      source: 'website',
      breakfastEnabled: false, // the portal does not sell breakfast
      rooms,
      venues,
      usePromo,
    })
  }, [selectedUnit, selectedUnitType, selectedUnitId, nights, checkIn, checkOut, guestEmail, rooms, venues, promoOn])

  // Handle unit selection
  const handleSelectUnit = (id: string, type: 'room' | 'venue') => {
    setSelectedUnitId(id)
    setSelectedUnitType(type)
    setStep(2)
  }

  // Add Companion
  const handleAddCompanion = () => {
    if (!newCompanionName.trim()) return
    setCompanions([...companions, { name: newCompanionName.trim(), gender: newCompanionGender }])
    setNewCompanionName('')
    setNewCompanionGender('male')
  }

  // Remove Companion
  const handleRemoveCompanion = (idx: number) => {
    setCompanions(companions.filter((_, i) => i !== idx))
  }

  // Submit booking
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUnit || nights <= 0 || !pricing) return
    if (!guestName || !guestEmail || !guestPhone || !paymentRef) {
      setErrorMessage('Please fill out all required fields, including the payment reference.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      // 1. Final collision check against the shared cache. (The server-side RPC
      //    + exclusion constraint are the hard backstop if two guests race.)
      if (selectedUnitType === 'room') {
        if (!syncEngine.isRoomAvailable(selectedUnitId, checkIn, checkOut, bookings)) {
          throw new Error('This room was just booked by another guest. Please select a different room.')
        }
      } else {
        if (!syncEngine.isVenueRangeAvailable(selectedUnitId, checkIn, checkOut, bookings)) {
          throw new Error('This venue was just booked by another guest. Please select a different date or venue.')
        }
      }

      // 2. Assemble the booking with a 30-minute hold so abandoned reservations
      //    expire and free the room, plus the unified pricing model.
      const now = new Date()
      const newBooking: Booking = {
        id: `direct-${syncEngine.generateUUID()}`,
        room_id: selectedUnitType === 'room' ? selectedUnitId : undefined,
        venue_id: selectedUnitType === 'venue' ? selectedUnitId : undefined,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        check_in: checkIn,
        check_out: checkOut,
        source: 'website',
        status: 'pending',
        payment_status: 'downpayment',
        payment_method: 'gcash',
        payment_reference: paymentRef,
        downpayment_paid: pricing.downpayment,
        balance_due: pricing.balanceDue,
        security_deposit: pricing.securityDeposit,
        companions: companions.length > 0 ? companions : undefined,
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 30 * 60000).toISOString()
      }

      // 3. Save via the shared layer and reflect it in the shared cache.
      const saved = await syncEngine.insertBooking(newBooking)
      queryClient.setQueryData<Booking[]>(['bookings'], old =>
        old ? [...old.filter(b => !b.id.startsWith('__optimistic__')), saved] : [saved]
      )

      setSuccessBookingId(saved.id)
      setStep(3)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred while saving your reservation. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FCFAF6] font-sans pb-16">
      {/* Premium Header */}
      <header className="bg-card border-b border-[#EADFC9]/60 py-5 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center bg-brand-bg border border-brand-primary rounded-lg">
              <span className="text-brand-primary font-bold text-sm">DP</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-main tracking-wide uppercase">Daweez Pension Hotel</h1>
              <p className="text-[10px] text-muted font-semibold uppercase tracking-wider">Direct Reservation Portal</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] bg-[#FAF0DD] text-brand-text font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border border-brand-border/40">
              ✓ 20% Direct Discount Applied
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 mt-8">
        {/* Step Progress Bar */}
        {step < 3 && (
          <div className="max-w-md mx-auto mb-8 bg-card border border-soft/60 p-4 rounded-xl shadow-sm flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-brand-primary text-white' : 'bg-softbg text-muted'}`}>1</div>
              <span className={`font-semibold ${step === 1 ? 'text-main' : 'text-muted'}`}>Select Dates & Unit</span>
            </div>
            <div className="h-[2px] bg-soft flex-1 mx-3" />
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-brand-primary text-white' : 'bg-softbg text-muted'}`}>2</div>
              <span className={`font-semibold ${step === 2 ? 'text-main' : 'text-muted'}`}>Guest Details</span>
            </div>
          </div>
        )}

        {/* STEP 1: Search Dates and Filter available units */}
        {step === 1 && (
          <div className="space-y-8">
            {/* Search Card */}
            <div className="bg-card border border-[#EADFC9]/60 p-6 rounded-2xl shadow-sm max-w-3xl mx-auto space-y-4">
              <h3 className="text-sm font-bold text-main flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-primary" /> Select Stay Dates
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-muted font-medium block mb-1">Check-in Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={checkIn}
                    onChange={e => {
                      setCheckIn(e.target.value)
                      setSelectedUnitId('')
                    }}
                    className="w-full bg-brand-bg border border-soft text-main px-3 py-2 rounded-lg text-xs outline-none focus:border-brand-primary transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted font-medium block mb-1">Check-out Date</label>
                  <input
                    type="date"
                    min={checkIn ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                    value={checkOut}
                    onChange={e => {
                      setCheckOut(e.target.value)
                      setSelectedUnitId('')
                    }}
                    className="w-full bg-brand-bg border border-soft text-main px-3 py-2 rounded-lg text-xs outline-none focus:border-brand-primary transition-all font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Availability Listings */}
            {nights > 0 ? (
              <div className="space-y-8 animate-in fade-in duration-300">
                {/* Available Rooms Section */}
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-main uppercase tracking-widest border-b border-[#EADFC9]/60 pb-2">
                    Available Pension Rooms
                  </h2>
                  {isLoadingBookings ? (
                    <div className="text-center py-6 text-xs text-muted">Verifying availability calendars...</div>
                  ) : rooms.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {rooms.map(room => {
                        const isAvailable = roomAvailability[room.id]
                        const roomPromoOn = promoOn && room.promo_price != null
                        const displayPrice = getEffectiveNightlyPrice(room.base_price, room.promo_price, promoOn)
                        return (
                            <div key={room.id} className={`bg-card border rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all group ${isAvailable ? 'hover:border-brand-primary border-soft/80' : 'opacity-70 grayscale-[20%] border-soft'}`}>
                              <div className="h-44 overflow-hidden relative">
                                <img src={room.image_url} alt={room.name} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-350" />
                                <span className="absolute top-3 left-3 bg-card/95 text-main text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                                  Room {room.room_number}
                                </span>
                                {isAvailable && roomPromoOn && (
                                  <span className="absolute bottom-3 right-3 bg-brand-primary text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm uppercase tracking-wider flex items-center gap-1">
                                    <Tag className="w-3 h-3" /> PROMO
                                  </span>
                                )}
                                {!isAvailable && (
                                  <span className="absolute bottom-3 right-3 bg-rose-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm uppercase tracking-wider animate-in fade-in">
                                    Occupied
                                  </span>
                                )}
                              </div>
                              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                                <div className="space-y-1.5">
                                  <h4 className="text-sm font-bold text-main">{room.name}</h4>
                                  <p className="text-[11px] text-muted leading-relaxed truncate">{room.description}</p>
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted font-medium">
                                    <Users className="w-3.5 h-3.5 text-muted" /> Max Guests: {room.capacity}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between border-t border-soft pt-3 shrink-0">
                                  <div>
                                    {roomPromoOn ? (
                                      <>
                                        <span className="text-[10px] text-muted line-through block font-mono">₱{room.base_price.toLocaleString()}</span>
                                        <span className="text-sm font-extrabold text-brand-text font-mono">
                                          ₱{displayPrice.toLocaleString()}<span className="text-[10px] text-muted font-normal">/night</span>
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-sm font-extrabold text-brand-text font-mono">
                                        ₱{(room.base_price).toLocaleString()}<span className="text-[10px] text-muted font-normal">/night</span>
                                      </span>
                                    )}
                                  </div>
                                  {isAvailable ? (
                                    <button
                                      onClick={() => handleSelectUnit(room.id, 'room')}
                                      className="bg-brand-primary hover:bg-brand-text text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                      Reserve <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <button
                                      disabled
                                      className="bg-softbg text-muted text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1 cursor-not-allowed border border-soft"
                                    >
                                      Occupied
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <div className="bg-page border border-soft/50 p-6 rounded-2xl text-center text-xs text-muted">
                      No rooms are available for the selected dates.
                    </div>
                  )}
                </div>

                {/* Available Venues Section */}
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-main uppercase tracking-widest border-b border-[#EADFC9]/60 pb-2">
                    Available Event Venues
                  </h2>
                  {isLoadingBookings ? (
                    <div className="text-center py-6 text-xs text-muted">Verifying availability calendars...</div>
                  ) : venues.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {venues.map(venue => {
                        const isAvailable = venueAvailability[venue.id]
                        const venuePromoOn = promoOn && venue.promo_price != null
                        const venueDisplayPrice = getEffectiveNightlyPrice(venue.base_price, venue.promo_price, promoOn)
                        return (
                          <div key={venue.id} className={`bg-card border rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all group ${isAvailable ? 'hover:border-brand-primary border-soft/80' : 'opacity-70 grayscale-[20%] border-soft'}`}>
                            <div className="h-44 overflow-hidden relative">
                              <img src={venue.image_url} alt={venue.name} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-350" />
                              <span className="absolute top-3 left-3 bg-card/95 text-main text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                                Venue
                              </span>
                              {isAvailable && venuePromoOn && (
                                <span className="absolute bottom-3 right-3 bg-brand-primary text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm uppercase tracking-wider flex items-center gap-1">
                                  <Tag className="w-3 h-3" /> PROMO
                                </span>
                              )}
                              {!isAvailable && (
                                <span className="absolute bottom-3 right-3 bg-rose-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm uppercase tracking-wider animate-in fade-in">
                                  Occupied
                                </span>
                              )}
                            </div>
                            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                              <div className="space-y-1.5">
                                <h4 className="text-sm font-bold text-main">{venue.name}</h4>
                                <p className="text-[11px] text-muted leading-relaxed truncate">{venue.description}</p>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted font-medium">
                                  <Users className="w-3.5 h-3.5 text-muted" /> Max Capacity: {venue.capacity}
                                </div>
                              </div>
                              <div className="flex items-center justify-between border-t border-soft pt-3 shrink-0">
                                <div>
                                  {venuePromoOn ? (
                                    <>
                                      <span className="text-[10px] text-muted line-through block font-mono">₱{venue.base_price.toLocaleString()}</span>
                                      <span className="text-sm font-extrabold text-brand-text font-mono">
                                        ₱{venueDisplayPrice.toLocaleString()}<span className="text-[10px] text-muted font-normal">/day</span>
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-sm font-extrabold text-brand-text font-mono">
                                      ₱{venue.base_price.toLocaleString()}<span className="text-[10px] text-muted font-normal">/day</span>
                                    </span>
                                  )}
                                </div>
                                {isAvailable ? (
                                  <button
                                    onClick={() => handleSelectUnit(venue.id, 'venue')}
                                    className="bg-brand-primary hover:bg-brand-text text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    Reserve <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    disabled
                                    className="bg-softbg text-muted text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1 cursor-not-allowed border border-soft"
                                  >
                                    Occupied
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="bg-page border border-soft/50 p-6 rounded-2xl text-center text-xs text-muted">
                      No venues are available for the selected dates.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-card border border-soft/60 p-12 rounded-2xl text-center shadow-sm max-w-md mx-auto space-y-2">
                <Info className="w-8 h-8 text-brand-primary mx-auto animate-pulse" />
                <h4 className="text-xs font-bold text-main">Select stay dates to view availability</h4>
                <p className="text-[10px] text-muted leading-relaxed">Available rooms and event venues with rates will display immediately after you choose date boundaries.</p>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Guest Details, invoice, & GCash reference number */}
        {step === 2 && selectedUnit && (
          <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-8 animate-in fade-in duration-300">
            {/* LEFT COLUMN: Input details */}
            <form onSubmit={handleSubmit} className="bg-card border border-soft/60 p-6 rounded-2xl shadow-sm space-y-6">
              <div className="border-b border-soft pb-4">
                <h3 className="text-sm font-bold text-main">Reservation Guest Details</h3>
                <p className="text-[10px] text-muted">Please provide your contact details and payment confirmation reference code.</p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2 rounded-lg animate-in fade-in">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Form Input fields */}
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-muted font-medium block mb-1">Full Name *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                      <input
                        type="text"
                        required
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                        placeholder="Juan Dela Cruz"
                        className="w-full bg-brand-bg border border-soft text-main pl-9 pr-3 py-2 rounded-lg text-xs outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted font-medium block mb-1">Email Address *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                      <input
                        type="email"
                        required
                        value={guestEmail}
                        onChange={e => setGuestEmail(e.target.value)}
                        placeholder="juan@gmail.com"
                        className="w-full bg-brand-bg border border-soft text-main pl-9 pr-3 py-2 rounded-lg text-xs outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-muted font-medium block mb-1">Mobile Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                    <input
                      type="tel"
                      required
                      value={guestPhone}
                      onChange={e => setGuestPhone(e.target.value)}
                      placeholder="09171234567"
                      className="w-full bg-brand-bg border border-soft text-main pl-9 pr-3 py-2 rounded-lg text-xs outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                {/* Companions Registry */}
                <div className="bg-page border border-soft/50 p-4 rounded-xl space-y-3.5">
                  <div className="text-[10px] text-muted font-bold uppercase tracking-wider">
                    Guest Companions ({companions.length + 1} total guests)
                  </div>
                  
                  {companions.length > 0 && (
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                      {companions.map((comp, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-card border border-soft px-3 py-1.5 rounded-lg">
                          <span className="font-semibold text-main">{comp.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-muted capitalize">{comp.gender}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCompanion(idx)}
                              className="text-rose-500 hover:text-rose-700 font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCompanionName}
                      onChange={e => setNewCompanionName(e.target.value)}
                      placeholder="Companion Name"
                      className="flex-1 bg-card border border-soft text-main px-3 py-1.5 rounded-lg text-xs outline-none focus:border-brand-primary"
                    />
                    <select
                      value={newCompanionGender}
                      onChange={e => setNewCompanionGender(e.target.value as 'male' | 'female')}
                      className="bg-card border border-soft text-main px-2 py-1.5 rounded-lg text-xs outline-none focus:border-brand-primary"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddCompanion}
                      className="bg-brand-primary hover:bg-brand-text text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* GCash Instruction and reference box */}
                <div className="bg-[#FAF6EE] border border-[#EADFC9] p-5 rounded-xl space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-brand-text uppercase tracking-wider">GCash / Bank Transfer Downpayment Instruction</h4>
                    <p className="text-[10px] text-muted leading-relaxed">
                      To confirm your reservation slot, please send a 50% reservation downpayment of <strong className="text-brand-text font-mono">₱{(pricing?.downpayment ?? 0).toLocaleString()}</strong> to the GCash account below, then paste the transaction reference code in the input field.
                    </p>
                  </div>

                  <div className="bg-card p-3 rounded-lg border border-[#EADFC9]/60 flex items-center justify-between text-xs font-mono text-main max-w-sm">
                    <div>
                      <span className="text-muted text-[10px] block">GCash Account Name:</span>
                      <strong>DAWEEZ PENSION HOTEL</strong>
                    </div>
                    <div>
                      <span className="text-muted text-[10px] block">GCash Number:</span>
                      <strong className="text-brand-text">0917-123-4567</strong>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-brand-text font-bold block mb-1">GCash / Bank Transaction Reference Code *</label>
                    <input
                      type="text"
                      required
                      value={paymentRef}
                      onChange={e => setPaymentRef(e.target.value)}
                      placeholder="Enter 13-digit Reference Code"
                      className="w-full bg-card border border-[#EADFC9] text-main px-3.5 py-2.5 rounded-lg text-xs outline-none focus:border-brand-primary font-mono placeholder:text-muted placeholder:opacity-50 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="flex gap-3 pt-4 border-t border-soft">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 bg-page hover:bg-softbg text-muted text-xs font-semibold py-2.5 rounded-xl border border-soft transition-colors cursor-pointer"
                >
                  &larr; Change Dates / Unit
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-brand-primary hover:bg-brand-text text-white text-xs font-bold py-2.5 rounded-xl transition-colors shadow-sm disabled:bg-softbg disabled:text-muted cursor-pointer"
                >
                  {isSaving ? 'Submitting...' : 'Submit Reservation'}
                </button>
              </div>
            </form>

            {/* RIGHT COLUMN: Invoice summary */}
            <div className="bg-card border border-[#EADFC9]/60 p-6 rounded-2xl shadow-sm text-xs space-y-5 text-brand-text h-fit">
              <div className="border-b border-[#EADFC9]/60 pb-3 flex items-center justify-between">
                <h3 className="font-bold text-main">Invoice Summary</h3>
                <span className="text-[9px] uppercase tracking-wider text-muted font-semibold">{nights} Nights</span>
              </div>

              {/* Selected Unit Details */}
              <div className="space-y-2">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                    <img src={selectedUnit.image_url} alt={selectedUnit.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="font-bold text-main text-xs leading-tight">{selectedUnit.name}</h4>
                    <span className="text-[10px] text-muted block pt-0.5">
                      {selectedUnitType === 'room' ? `Room ${(selectedUnit as Room).room_number}` : 'Event Venue'}
                    </span>
                  </div>
                </div>
                <div className="bg-[#FAF6EE] p-2.5 rounded-lg border border-[#EADFC9]/40 text-[10px] text-muted leading-relaxed font-medium">
                  {checkIn} &rarr; {checkOut}
                </div>
              </div>

              {/* Pricing breakdown (unified with the staff invoice engine) */}
              {pricing && (
                <div className="border-t border-dashed border-brand-border pt-4 space-y-2.5">
                  <div className="flex justify-between text-muted font-medium">
                    <span>{pricing.discountAmount > 0 ? 'Regular Rate:' : 'Room Rate:'}</span>
                    <span className="font-mono">₱{pricing.undiscountedSubtotal.toLocaleString()}</span>
                  </div>
                  {pricing.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold animate-in fade-in">
                      <span>Promo Price{pricing.discountPercent ? ` (-${pricing.discountPercent}%)` : ''}:</span>
                      <span className="font-mono">-₱{pricing.discountAmount.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-main font-extrabold border-t border-dashed border-brand-border/60 pt-2 text-xs">
                    <span>Total Amount:</span>
                    <span className="font-mono text-main">₱{pricing.grandTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-main font-bold border-t border-dashed border-brand-border/60 pt-2">
                    <span>Required Downpayment (50%):</span>
                    <span className="font-mono text-brand-text text-sm font-extrabold">₱{pricing.downpayment.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted font-semibold">
                    <span>Balance Due upon Check-in:</span>
                    <span className="font-mono">₱{pricing.balanceDue.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div className="bg-[#FCFAF6] border border-soft/50 p-3 rounded-lg text-[10px] text-muted leading-relaxed flex gap-2">
                <Info className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
                <span>The 50% downpayment secures your reservation. The remaining balance is payable upon check-in.</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Success Confirmation Screen */}
        {step === 3 && (
          <div className="max-w-xl mx-auto bg-card border border-[#EADFC9] p-8 rounded-2xl shadow-md text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-main">Reservation Request Submitted!</h2>
              <p className="text-xs text-muted leading-relaxed max-w-md mx-auto">
                Thank you, <strong>{guestName}</strong>! Your booking request has been entered into the reservation queue.
              </p>
            </div>

            {/* Booking Details Card */}
            <div className="bg-[#FAF6EE] border border-[#EADFC9] p-5 rounded-xl text-left text-xs text-main space-y-2.5 max-w-md mx-auto">
              <div className="flex justify-between border-b border-[#EADFC9]/50 pb-2">
                <span className="text-muted font-medium">Booking ID:</span>
                <span className="font-mono font-bold text-brand-text">{successBookingId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted font-medium">Selected Unit:</span>
                <span className="font-semibold text-main">
                  {selectedUnit ? selectedUnit.name : 'Selected Room'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted font-medium">Stay Dates:</span>
                <span className="font-medium text-main">{checkIn} &rarr; {checkOut} ({nights} Nights)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted font-medium">Payment Reference:</span>
                <span className="font-mono font-bold text-main">{paymentRef}</span>
              </div>
            </div>

            <div className="text-xs text-muted leading-relaxed max-w-md mx-auto border-t border-soft pt-4">
              Our front desk will verify your payment reference code with the GCash log. Once validated, your booking status will be updated from **Pending** to **Confirmed**, and a notification will be sent to your email.
            </div>

            <button
              onClick={() => {
                setStep(1)
                setCheckIn('')
                setCheckOut('')
                setSelectedUnitId('')
                setSelectedUnitType(null)
                setGuestName('')
                setGuestEmail('')
                setGuestPhone('')
                setPaymentRef('')
                setCompanions([])
              }}
              className="bg-brand-primary hover:bg-brand-text text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-colors cursor-pointer inline-block shadow-sm"
            >
              Make Another Reservation
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
