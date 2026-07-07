import React, { useState, useEffect, useMemo } from 'react'
import { Calendar, User, Mail, Phone, CheckCircle2, BedDouble, PartyPopper, Users, ArrowRight, Info, AlertCircle } from 'lucide-react'
import { Booking, Room, Venue, Companion } from '../types/booking'
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient'
import * as syncEngine from '../utils/syncEngine'

export function PublicReservePortal() {
  // --- State ---
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoadingBookings, setIsLoadingBookings] = useState(true)
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

  // Fetch active bookings from Supabase
  useEffect(() => {
    async function loadBookings() {
      try {
        if (isSupabaseConfigured) {
          const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .order('created_at', { ascending: false })
          if (error) throw error
          setBookings(data as Booking[])
        } else {
          // Fallback to local storage
          const data = localStorage.getItem('bookings_pms')
          if (data) {
            setBookings(JSON.parse(data))
          }
        }
      } catch (err) {
        console.error('Failed to load bookings:', err)
      } finally {
        setIsLoadingBookings(false)
      }
    }
    loadBookings()
  }, [])

  const nights = useMemo(() => {
    if (!checkIn || !checkOut || checkIn >= checkOut) return 0
    return Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
  }, [checkIn, checkOut])

  // Track availability maps
  const roomAvailability = useMemo(() => {
    const map: Record<string, boolean> = {}
    syncEngine.DEFAULT_ROOMS.forEach(r => {
      map[r.id] = (nights > 0 && checkIn && checkOut)
        ? syncEngine.isRoomAvailable(r.id, checkIn, checkOut, bookings)
        : true
    })
    return map
  }, [checkIn, checkOut, bookings, nights])

  const venueAvailability = useMemo(() => {
    const map: Record<string, boolean> = {}
    syncEngine.DEFAULT_VENUES.forEach(v => {
      map[v.id] = (nights > 0 && checkIn && checkOut)
        ? syncEngine.isVenueRangeAvailable(v.id, checkIn, checkOut, bookings)
        : true
    })
    return map
  }, [checkIn, checkOut, bookings, nights])

  const availableRooms = useMemo(() => {
    return syncEngine.DEFAULT_ROOMS
  }, [])

  const availableVenues = useMemo(() => {
    return syncEngine.DEFAULT_VENUES
  }, [])

  const selectedUnit = useMemo(() => {
    if (!selectedUnitId) return null
    if (selectedUnitType === 'room') {
      return syncEngine.DEFAULT_ROOMS.find(r => r.id === selectedUnitId)
    } else {
      return syncEngine.DEFAULT_VENUES.find(v => v.id === selectedUnitId)
    }
  }, [selectedUnitId, selectedUnitType])

  // Pricing calculations: Website bookings get 20% discount
  const pricing = useMemo(() => {
    if (!selectedUnit || nights <= 0) return { base: 0, discount: 0, subtotal: 0, deposit: 0, downpayment: 0, due: 0 }
    
    const originalRate = selectedUnit.base_price * nights
    const discount = Math.round(originalRate * 0.20) // 20% Direct/Website discount
    const subtotal = originalRate - discount
    const deposit = 500 // Flat ₱500 security deposit per unit
    const downpayment = Math.round(subtotal * 0.50)
    const due = (subtotal - downpayment) + deposit

    return {
      base: originalRate,
      discount,
      subtotal,
      deposit,
      downpayment,
      due
    }
  }, [selectedUnit, nights])

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
    if (!selectedUnit || nights <= 0) return
    if (!guestName || !guestEmail || !guestPhone || !paymentRef) {
      setErrorMessage('Please fill out all required fields, including the payment reference.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      // 1. Fetch fresh bookings from Supabase to prevent race condition
      let currentBookings: Booking[] = []
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.from('bookings').select('*')
        if (error) throw error
        currentBookings = data as Booking[]
      } else {
        const data = localStorage.getItem('bookings_pms')
        if (data) currentBookings = JSON.parse(data)
      }

      // 2. Perform one final collision check
      if (selectedUnitType === 'room') {
        if (!syncEngine.isRoomAvailable(selectedUnitId, checkIn, checkOut, currentBookings)) {
          throw new Error('This room was just booked by another guest. Please select a different room.')
        }
      } else {
        if (!syncEngine.isVenueRangeAvailable(selectedUnitId, checkIn, checkOut, currentBookings)) {
          throw new Error('This venue was just booked by another guest. Please select a different date or venue.')
        }
      }

      // 3. Assemble booking details
      const bookingId = `direct-${syncEngine.generateUUID()}`
      
      const newBooking: Booking = {
        id: bookingId,
        room_id: selectedUnitType === 'room' ? selectedUnitId : undefined,
        venue_id: selectedUnitType === 'venue' ? selectedUnitId : undefined,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        check_in: checkIn,
        check_out: checkOut,
        source: 'website',
        status: 'pending',
        downpayment_paid: pricing.downpayment,
        balance_due: pricing.due - pricing.deposit, // balance due without security deposit
        security_deposit: pricing.deposit,
        companions: companions.length > 0 ? companions : undefined,
        event_addons: { payment_reference: paymentRef },
        created_at: new Date().toISOString(),
        expires_at: null
      }

      // 4. Save to Database
      await syncEngine.insertBooking(newBooking)

      setSuccessBookingId(bookingId)
      setStep(3)
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while saving your reservation. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FCFAF6] font-sans pb-16">
      {/* Premium Header */}
      <header className="bg-white border-b border-[#EADFC9]/60 py-5 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center bg-[#FDFBF7] border border-[#B89251] rounded-lg">
              <span className="text-[#B89251] font-bold text-sm">DP</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 tracking-wide uppercase">Daweez Pension Hotel</h1>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Direct Reservation Portal</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] bg-[#FAF0DD] text-[#9A783E] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border border-[#E5D5C0]/40">
              ✓ 20% Direct Discount Applied
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 mt-8">
        {/* Step Progress Bar */}
        {step < 3 && (
          <div className="max-w-md mx-auto mb-8 bg-white border border-slate-200/60 p-4 rounded-xl shadow-sm flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-[#B89251] text-white' : 'bg-slate-100 text-slate-400'}`}>1</div>
              <span className={`font-semibold ${step === 1 ? 'text-slate-800' : 'text-slate-400'}`}>Select Dates & Unit</span>
            </div>
            <div className="h-[2px] bg-slate-200 flex-1 mx-3" />
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-[#B89251] text-white' : 'bg-slate-100 text-slate-400'}`}>2</div>
              <span className={`font-semibold ${step === 2 ? 'text-slate-800' : 'text-slate-400'}`}>Guest Details</span>
            </div>
          </div>
        )}

        {/* STEP 1: Search Dates and Filter available units */}
        {step === 1 && (
          <div className="space-y-8">
            {/* Search Card */}
            <div className="bg-white border border-[#EADFC9]/60 p-6 rounded-2xl shadow-sm max-w-3xl mx-auto space-y-4">
              <h3 className="text-sm font-bold text-slate-850 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#B89251]" /> Select Stay Dates
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-1">Check-in Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={checkIn}
                    onChange={e => {
                      setCheckIn(e.target.value)
                      setSelectedUnitId('')
                    }}
                    className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs outline-none focus:border-[#B89251] transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-1">Check-out Date</label>
                  <input
                    type="date"
                    min={checkIn ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                    value={checkOut}
                    onChange={e => {
                      setCheckOut(e.target.value)
                      setSelectedUnitId('')
                    }}
                    className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs outline-none focus:border-[#B89251] transition-all font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Availability Listings */}
            {nights > 0 ? (
              <div className="space-y-8 animate-in fade-in duration-300">
                {/* Available Rooms Section */}
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b border-[#EADFC9]/60 pb-2">
                    Available Pension Rooms
                  </h2>
                  {isLoadingBookings ? (
                    <div className="text-center py-6 text-xs text-slate-400">Verifying availability calendars...</div>
                  ) : availableRooms.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {availableRooms.map(room => {
                        const isAvailable = roomAvailability[room.id]
                        return (
                            <div key={room.id} className={`bg-white border rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all group ${isAvailable ? 'hover:border-[#B89251] border-slate-200/80' : 'opacity-70 grayscale-[20%] border-slate-200'}`}>
                              <div className="h-44 overflow-hidden relative">
                                <img src={room.image_url} alt={room.name} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-350" />
                                <span className="absolute top-3 left-3 bg-white/95 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                                  Room {room.room_number}
                                </span>
                                {isAvailable ? (
                                  <span className="absolute bottom-3 right-3 bg-[#B89251] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm uppercase tracking-wider">
                                    20% OFF
                                  </span>
                                ) : (
                                  <span className="absolute bottom-3 right-3 bg-rose-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm uppercase tracking-wider animate-in fade-in">
                                    Unavailable
                                  </span>
                                )}
                              </div>
                              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                                <div className="space-y-1.5">
                                  <h4 className="text-sm font-bold text-slate-800">{room.name}</h4>
                                  <p className="text-[11px] text-slate-400 leading-relaxed truncate">{room.description}</p>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                    <Users className="w-3.5 h-3.5 text-slate-400" /> Max Guests: {room.capacity}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between border-t border-slate-100 pt-3 shrink-0">
                                  <div>
                                    <span className="text-[10px] text-slate-400 line-through block font-mono">₱{room.base_price.toLocaleString()}</span>
                                    <span className="text-sm font-extrabold text-[#9A783E] font-mono">
                                      ₱{Math.round(room.base_price * 0.8).toLocaleString()}<span className="text-[10px] text-slate-500 font-normal">/night</span>
                                    </span>
                                  </div>
                                  {isAvailable ? (
                                    <button
                                      onClick={() => handleSelectUnit(room.id, 'room')}
                                      className="bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                      Reserve <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <button
                                      disabled
                                      className="bg-slate-100 text-slate-400 text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1 cursor-not-allowed border border-slate-200"
                                    >
                                      Unavailable
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        }
                      })}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200/50 p-6 rounded-2xl text-center text-xs text-slate-400">
                      No rooms are available for the selected dates.
                    </div>
                  )}
                </div>

                {/* Available Venues Section */}
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b border-[#EADFC9]/60 pb-2">
                    Available Event Venues
                  </h2>
                  {isLoadingBookings ? (
                    <div className="text-center py-6 text-xs text-slate-400">Verifying availability calendars...</div>
                  ) : availableVenues.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {availableVenues.map(venue => {
                        const isAvailable = venueAvailability[venue.id]
                        return (
                          <div key={venue.id} className={`bg-white border rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all group ${isAvailable ? 'hover:border-[#B89251] border-slate-200/80' : 'opacity-70 grayscale-[20%] border-slate-200'}`}>
                            <div className="h-44 overflow-hidden relative">
                              <img src={venue.image_url} alt={venue.name} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-350" />
                              <span className="absolute top-3 left-3 bg-white/95 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                                Venue
                              </span>
                              {isAvailable ? (
                                <span className="absolute bottom-3 right-3 bg-[#B89251] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm uppercase tracking-wider">
                                  20% OFF
                                </span>
                              ) : (
                                <span className="absolute bottom-3 right-3 bg-rose-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm uppercase tracking-wider animate-in fade-in">
                                  Unavailable
                                </span>
                              )}
                            </div>
                            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                              <div className="space-y-1.5">
                                <h4 className="text-sm font-bold text-slate-800">{venue.name}</h4>
                                <p className="text-[11px] text-slate-400 leading-relaxed truncate">{venue.description}</p>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                  <Users className="w-3.5 h-3.5 text-slate-400" /> Max Capacity: {venue.capacity}
                                </div>
                              </div>
                              <div className="flex items-center justify-between border-t border-slate-100 pt-3 shrink-0">
                                <div>
                                  <span className="text-[10px] text-slate-400 line-through block font-mono">₱{venue.base_price.toLocaleString()}</span>
                                  <span className="text-sm font-extrabold text-[#9A783E] font-mono">
                                    ₱{Math.round(venue.base_price * 0.8).toLocaleString()}<span className="text-[10px] text-slate-500 font-normal">/day</span>
                                  </span>
                                </div>
                                {isAvailable ? (
                                  <button
                                    onClick={() => handleSelectUnit(venue.id, 'venue')}
                                    className="bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    Reserve <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    disabled
                                    className="bg-slate-100 text-slate-400 text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1 cursor-not-allowed border border-slate-200"
                                  >
                                    Unavailable
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200/50 p-6 rounded-2xl text-center text-xs text-slate-400">
                      No venues are available for the selected dates.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200/60 p-12 rounded-2xl text-center shadow-sm max-w-md mx-auto space-y-2">
                <Info className="w-8 h-8 text-[#B89251] mx-auto animate-pulse" />
                <h4 className="text-xs font-bold text-slate-800">Select stay dates to view availability</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed">Available rooms and event venues with rates will display immediately after you choose date boundaries.</p>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Guest Details, invoice, & GCash reference number */}
        {step === 2 && selectedUnit && (
          <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-8 animate-in fade-in duration-300">
            {/* LEFT COLUMN: Input details */}
            <form onSubmit={handleSubmit} className="bg-white border border-slate-200/60 p-6 rounded-2xl shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800">Reservation Guest Details</h3>
                <p className="text-[10px] text-slate-400">Please provide your contact details and payment confirmation reference code.</p>
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
                    <label className="text-[10px] text-slate-500 font-medium block mb-1">Full Name *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                        placeholder="Juan Dela Cruz"
                        className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-700 pl-9 pr-3 py-2 rounded-lg text-xs outline-none focus:border-[#B89251]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-1">Email Address *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={guestEmail}
                        onChange={e => setGuestEmail(e.target.value)}
                        placeholder="juan@gmail.com"
                        className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-700 pl-9 pr-3 py-2 rounded-lg text-xs outline-none focus:border-[#B89251]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-1">Mobile Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={guestPhone}
                      onChange={e => setGuestPhone(e.target.value)}
                      placeholder="09171234567"
                      className="w-full bg-[#fcf9f5] border border-slate-200 text-slate-700 pl-9 pr-3 py-2 rounded-lg text-xs outline-none focus:border-[#B89251]"
                    />
                  </div>
                </div>

                {/* Companions Registry */}
                <div className="bg-slate-50 border border-slate-200/50 p-4 rounded-xl space-y-3.5">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Guest Companions ({companions.length + 1} total guests)
                  </div>
                  
                  {companions.length > 0 && (
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                      {companions.map((comp, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white border border-slate-100 px-3 py-1.5 rounded-lg">
                          <span className="font-semibold text-slate-700">{comp.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400 capitalize">{comp.gender}</span>
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
                      className="flex-1 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs outline-none focus:border-[#B89251]"
                    />
                    <select
                      value={newCompanionGender}
                      onChange={e => setNewCompanionGender(e.target.value as 'male' | 'female')}
                      className="bg-white border border-slate-200 text-slate-700 px-2 py-1.5 rounded-lg text-xs outline-none focus:border-[#B89251]"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddCompanion}
                      className="bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* GCash Instruction and reference box */}
                <div className="bg-[#FAF6EE] border border-[#EADFC9] p-5 rounded-xl space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-[#9A783E] uppercase tracking-wider">GCash / Bank Transfer Downpayment Instruction</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      To confirm your reservation slot, please send a 50% reservation downpayment of <strong className="text-[#9A783E] font-mono">₱{pricing.downpayment.toLocaleString()}</strong> to the GCash account below, then paste the transaction reference code in the input field.
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-[#EADFC9]/60 flex items-center justify-between text-xs font-mono text-slate-700 max-w-sm">
                    <div>
                      <span className="text-slate-400 text-[10px] block">GCash Account Name:</span>
                      <strong>DAWEEZ PENSION HOTEL</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">GCash Number:</span>
                      <strong className="text-[#9A783E]">0917-123-4567</strong>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#9A783E] font-bold block mb-1">GCash / Bank Transaction Reference Code *</label>
                    <input
                      type="text"
                      required
                      value={paymentRef}
                      onChange={e => setPaymentRef(e.target.value)}
                      placeholder="Enter 13-digit Reference Code"
                      className="w-full bg-white border border-[#EADFC9] text-slate-800 px-3.5 py-2.5 rounded-lg text-xs outline-none focus:border-[#B89251] font-mono placeholder-slate-300 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-650 text-xs font-semibold py-2.5 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  &larr; Change Dates / Unit
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-bold py-2.5 rounded-xl transition-colors shadow-sm disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
                >
                  {isSaving ? 'Submitting...' : 'Submit Reservation'}
                </button>
              </div>
            </form>

            {/* RIGHT COLUMN: Invoice summary */}
            <div className="bg-white border border-[#EADFC9]/60 p-6 rounded-2xl shadow-sm text-xs space-y-5 text-[#9A783E] h-fit">
              <div className="border-b border-[#EADFC9]/60 pb-3 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Invoice Summary</h3>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">{nights} Nights</span>
              </div>

              {/* Selected Unit Details */}
              <div className="space-y-2">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                    <img src={selectedUnit.image_url} alt={selectedUnit.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs leading-tight">{selectedUnit.name}</h4>
                    <span className="text-[10px] text-slate-400 block pt-0.5">
                      {selectedUnitType === 'room' ? `Room ${(selectedUnit as Room).room_number}` : 'Event Venue'}
                    </span>
                  </div>
                </div>
                <div className="bg-[#FAF6EE] p-2.5 rounded-lg border border-[#EADFC9]/40 text-[10px] text-slate-500 leading-relaxed font-medium">
                  {checkIn} &rarr; {checkOut}
                </div>
              </div>

              {/* Pricing breakdown */}
              <div className="border-t border-dashed border-[#E5D5C0] pt-4 space-y-2.5">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Original Rate:</span>
                  <span className="font-mono">₱{pricing.base.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-rose-600 font-semibold animate-in fade-in">
                  <span>Direct Website Discount (20%):</span>
                  <span className="font-mono">-₱{pricing.discount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Flat Security Deposit:</span>
                  <span className="font-mono">₱{pricing.deposit.toLocaleString()}</span>
                </div>

                <div className="flex justify-between text-slate-800 font-extrabold border-t border-dashed border-[#E5D5C0]/60 pt-2 text-xs">
                  <span>Total Amount:</span>
                  <span className="font-mono text-slate-900">₱{(pricing.subtotal + pricing.deposit).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-800 font-bold border-t border-dashed border-[#E5D5C0]/60 pt-2">
                  <span>Required Downpayment (50%):</span>
                  <span className="font-mono text-[#9A783E] text-sm font-extrabold">₱{pricing.downpayment.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-400 font-semibold">
                  <span>Balance Due upon Check-in:</span>
                  <span className="font-mono">₱{pricing.due.toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-[#FCFAF6] border border-slate-200/50 p-3 rounded-lg text-[10px] text-slate-400 leading-relaxed flex gap-2">
                <Info className="w-4 h-4 text-[#B89251] shrink-0 mt-0.5" />
                <span>Security deposit of ₱500 is fully refundable upon check-out after property inspection.</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Success Confirmation Screen */}
        {step === 3 && (
          <div className="max-w-xl mx-auto bg-white border border-[#EADFC9] p-8 rounded-2xl shadow-md text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-850">Reservation Request Submitted!</h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                Thank you, <strong>{guestName}</strong>! Your booking request has been entered into the reservation queue.
              </p>
            </div>

            {/* Booking Details Card */}
            <div className="bg-[#FAF6EE] border border-[#EADFC9] p-5 rounded-xl text-left text-xs text-slate-700 space-y-2.5 max-w-md mx-auto">
              <div className="flex justify-between border-b border-[#EADFC9]/50 pb-2">
                <span className="text-slate-400 font-medium">Booking ID:</span>
                <span className="font-mono font-bold text-[#9A783E]">{successBookingId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Selected Unit:</span>
                <span className="font-semibold text-slate-850">
                  {selectedUnit ? selectedUnit.name : 'Selected Room'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Stay Dates:</span>
                <span className="font-medium text-slate-800">{checkIn} &rarr; {checkOut} ({nights} Nights)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Payment Reference:</span>
                <span className="font-mono font-bold text-slate-800">{paymentRef}</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto border-t border-slate-100 pt-4">
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
              className="bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-colors cursor-pointer inline-block shadow-sm"
            >
              Make Another Reservation
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
