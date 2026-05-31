import React, { useState, useEffect } from 'react'
import { useBookings } from '../hooks/useBookings'
import { Room, Venue, Booking, BreakfastOrder, EquipmentRental, EventAddons } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { Calendar, User, Phone, Mail, Clock, ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight, X, Sparkles, Coffee, Music, Settings, Info, Tag } from 'lucide-react'

interface GuestPortalProps {
  onNavigateToAdmin: () => void
}

export function GuestPortal({ onNavigateToAdmin }: GuestPortalProps) {
  const { rooms, venues, bookings, createPendingBooking, isLoading } = useBookings()
  
  // 1. General States
  const getTomorrowStr = (offset = 1) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return d.toISOString().split('T')[0]
  }

  const [activePathway, setActivePathway] = useState<'rooms' | 'venues'>('rooms')
  
  // Dates
  const [checkIn, setCheckIn] = useState<string>(getTomorrowStr(1))
  const [checkOut, setCheckOut] = useState<string>(getTomorrowStr(2))
  const [guestCount, setGuestCount] = useState<number>(2)

  // 2. Booking Modal Flow States
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [showBookingModal, setShowBookingModal] = useState<boolean>(false)
  const [bookingStep, setBookingStep] = useState<'details' | 'payment' | 'completed'>('details')
  const [errorMsg, setErrorMsg] = useState<string>('')

  // 3. Guest Form States
  const [guestName, setGuestName] = useState<string>('')
  const [guestEmail, setGuestEmail] = useState<string>('')
  const [guestPhone, setGuestPhone] = useState<string>('')

  // 4. Add-ons States
  // A. Breakfast Orders (₱200/set)
  const [breakfastQty, setBreakfastQty] = useState<{ [key: string]: number }>({
    Bangsilog: 0,
    Lumpiasilog: 0,
    Cornsilog: 0,
    Hotsilog: 0
  })
  const [breakfastCoffee, setBreakfastCoffee] = useState<{ [key: string]: boolean }>({
    Bangsilog: false,
    Lumpiasilog: false,
    Cornsilog: false,
    Hotsilog: false
  })

  // B. Equipment Rentals (Big Table ₱150, Small Table ₱100, Chair ₱15, Water ₱35)
  const [bigTableCount, setBigTableCount] = useState<number>(0)
  const [smallTableCount, setSmallTableCount] = useState<number>(0)
  const [chairCount, setChairCount] = useState<number>(0)
  const [mineralWaterCount, setMineralWaterCount] = useState<number>(0)

  // C. Event Add-ons (Full Band ₱2000, Stage ₱2000, LED Wall ₱5000)
  const [fullBandAndLights, setFullBandAndLights] = useState<boolean>(false)
  const [stage, setStage] = useState<boolean>(false)
  const [ledWall, setLedWall] = useState<boolean>(false)

  // 5. Loyalty State
  const [isLoyalGuest, setIsLoyalGuest] = useState<boolean>(false)

  // 6. Active Locked Reservation details
  const [activeLockBooking, setActiveLockBooking] = useState<Booking | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(1800)
  const [simulatedReceiptUploaded, setSimulatedReceiptUploaded] = useState<boolean>(false)

  // Silent Loyalty Recognition Effect
  useEffect(() => {
    if (guestEmail.includes('@')) {
      const loyal = syncEngine.checkGuestLoyalty(guestEmail)
      setIsLoyalGuest(loyal)
    } else {
      setIsLoyalGuest(false)
    }
  }, [guestEmail])

  // Countdown timer for 30 min lockout
  useEffect(() => {
    if (bookingStep !== 'payment' || !activeLockBooking?.expires_at) return

    const timer = setInterval(() => {
      const expiry = new Date(activeLockBooking.expires_at!).getTime()
      const now = new Date().getTime()
      const diff = Math.max(0, Math.floor((expiry - now) / 1000))
      
      setTimeLeft(diff)
      
      if (diff <= 0) {
        clearInterval(timer)
        setActiveLockBooking(null)
        setBookingStep('details')
        setShowBookingModal(false)
        alert('Your 30-minute reservation lock has expired. The dates have been released.')
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [bookingStep, activeLockBooking])

  // Open modal handlers
  const handleOpenRoomBooking = (room: Room) => {
    setSelectedRoom(room)
    setSelectedVenue(null)
    setGuestName('')
    setGuestEmail('')
    setGuestPhone('')
    setBreakfastQty({ Bangsilog: 0, Lumpiasilog: 0, Cornsilog: 0, Hotsilog: 0 })
    setBookingStep('details')
    setSimulatedReceiptUploaded(false)
    setErrorMsg('')
    setShowBookingModal(true)
  }

  const handleOpenVenueBooking = (venue: Venue) => {
    setSelectedVenue(venue)
    setSelectedRoom(null)
    setGuestName('')
    setGuestEmail('')
    setGuestPhone('')
    setBigTableCount(0)
    setSmallTableCount(0)
    setChairCount(0)
    setMineralWaterCount(0)
    setFullBandAndLights(false)
    setStage(false)
    setLedWall(false)
    setBookingStep('details')
    setSimulatedReceiptUploaded(false)
    setErrorMsg('')
    setShowBookingModal(true)
  }

  // Handle Checkout submission (Securing Lock)
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!guestName || !guestEmail || !guestPhone) {
      setErrorMsg('Please input all guest details to secure checkout.')
      return
    }

    try {
      // Assemble breakfast orders if room stay
      const breakfastOrders: BreakfastOrder[] = []
      if (selectedRoom) {
        Object.entries(breakfastQty).forEach(([meal, qty]) => {
          if (qty > 0) {
            breakfastOrders.push({
              option: meal as any,
              quantity: qty,
              withCoffee: breakfastCoffee[meal] || false
            })
          }
        })
      }

      // Assemble rentals & addons if venue stay
      const rentals: EquipmentRental | undefined = selectedVenue ? {
        bigTableCount,
        smallTableCount,
        chairCount,
        mineralWaterCount
      } : undefined

      const addons: EventAddons | undefined = selectedVenue ? {
        fullBandAndLights,
        stage,
        ledWall
      } : undefined

      // Perform atomic database block lock
      const pendingBooking = await createPendingBooking({
        roomId: selectedRoom?.id,
        venueId: selectedVenue?.id,
        guestName,
        guestEmail,
        guestPhone,
        checkIn: activePathway === 'rooms' ? checkIn : checkIn, // Event venues use single day (checkIn)
        checkOut: activePathway === 'rooms' ? checkOut : checkIn,
        breakfastOrders: breakfastOrders.length > 0 ? breakfastOrders : undefined,
        equipmentRentals: rentals,
        eventAddons: addons
      })

      setActiveLockBooking(pendingBooking)
      setBookingStep('payment')
      const expiry = new Date(pendingBooking.expires_at!).getTime()
      const now = new Date().getTime()
      setTimeLeft(Math.max(0, Math.floor((expiry - now) / 1000)))
    } catch (err: any) {
      setErrorMsg(err.message || 'Collisions occurred. Please select alternative dates.')
    }
  }

  // Settle lock simulation
  const handleReceiptProofSettle = (e: React.FormEvent) => {
    e.preventDefault()
    setBookingStep('completed')
  }

  // Formats
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Dynamic values for display in the form before lock is created
  const getSimulatedPricing = () => {
    const breakfastOrders: BreakfastOrder[] = []
    Object.entries(breakfastQty).forEach(([meal, qty]) => {
      if (qty > 0) {
        breakfastOrders.push({
          option: meal as any,
          quantity: qty,
          withCoffee: breakfastCoffee[meal] || false
        })
      }
    })

    return syncEngine.calculatePricing({
      roomId: selectedRoom?.id,
      venueId: selectedVenue?.id,
      checkIn,
      checkOut: activePathway === 'rooms' ? checkOut : checkIn,
      guestEmail,
      breakfastOrders: breakfastOrders.length > 0 ? breakfastOrders : undefined,
      equipmentRentals: selectedVenue ? { bigTableCount, smallTableCount, chairCount, mineralWaterCount } : undefined,
      eventAddons: selectedVenue ? { fullBandAndLights, stage, ledWall } : undefined
    })
  }

  const getWhatsAppLink = () => {
    if (!activeLockBooking) return '#'
    const itemName = selectedRoom ? `Room ${selectedRoom.room_number}` : selectedVenue?.name
    const message = encodeURIComponent(
      `Hello Daweez Pension House! I just secured ${itemName} for stay on ${activeLockBooking.check_in}.\n\nBooking ID: ${activeLockBooking.id}\nGuest name: ${activeLockBooking.guest_name}\nDownpayment due (50%): ₱${(activeLockBooking.downpayment_paid ?? 0).toLocaleString()}\n\nAttached is my payment transaction proof. Please confirm my stay. Salamat!`
    )
    return `https://wa.me/639171234567?text=${message}`
  }

  const pricing = selectedRoom || selectedVenue ? getSimulatedPricing() : null

  return (
    <div className="min-h-screen pb-16 bg-slate-50 text-slate-800">
      
      {/* 1. Header Bar */}
      <header className="border-b border-slate-200/80 sticky top-0 z-40 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 flex items-center justify-center bg-[#B89251] rounded-xl shadow-md shadow-[#B89251]/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-widest text-slate-900 uppercase">Daweez Pension House</h1>
              <p className="text-[10px] tracking-widest text-[#B89251] uppercase -mt-1 font-bold">Resort & Event Venues</p>
            </div>
          </div>
          <button
            onClick={onNavigateToAdmin}
            className="text-xs border border-[#E5D5C0] bg-[#FDFBF7] text-[#9A783E] hover:bg-[#B89251] hover:text-white hover:border-[#B89251] font-semibold px-4 py-2.5 rounded-lg transition-all duration-200 uppercase tracking-wider shadow-sm"
          >
            PMS Staff Panel
          </button>
        </div>
      </header>

      {/* 2. Brand Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-10 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center space-x-2 bg-[#FDFBF7] border border-[#E5D5C0] px-3.5 py-1.5 rounded-full text-xs text-[#9A783E] font-medium">
            <Info className="w-3.5 h-3.5 text-[#B89251] shrink-0 mr-0.5" />
            <span>Standard Stay: Check-In: <span className="font-semibold text-[#8c672b]">2:00 PM</span> | Check-Out: <span className="font-semibold text-[#8c672b]">12:00 PM</span></span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 font-sans">
            Daweez Pension House
          </h2>
          <p className="text-slate-500 text-sm sm:text-base font-light max-w-2xl mx-auto leading-relaxed">
            Book our comfortable rooms or rent one of our event spaces like the Gazebo, Vacation House, or Garden. You can also order breakfast and rent extra tables or chairs.
          </p>
        </div>

        {/* Pathway Tabs Navigation */}
        <div className="mt-12 flex justify-center">
          <div className="bg-slate-100 p-1.5 border border-slate-200 flex space-x-2 text-xs uppercase tracking-wider font-bold rounded-xl shadow-sm">
            <button
              onClick={() => setActivePathway('rooms')}
              className={`px-6 py-2.5 transition-all duration-300 rounded-lg ${activePathway === 'rooms' ? 'bg-white text-[#9A783E] shadow-sm border border-slate-200/50 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Book a Stay
            </button>
            <button
              onClick={() => setActivePathway('venues')}
              className={`px-6 py-2.5 transition-all duration-300 rounded-lg ${activePathway === 'venues' ? 'bg-white text-[#9A783E] shadow-sm border border-slate-200/50 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Rent Event Venue
            </button>
          </div>
        </div>

        {/* 3. Availability Filter Search */}
        <div className="mt-8 max-w-4xl mx-auto bg-white border border-slate-200 shadow-md p-6 relative z-10 rounded-2xl">
          <h3 className="text-xs uppercase tracking-wider text-[#B89251] font-bold mb-5 flex items-center space-x-2">
            <Calendar className="w-4 h-4" />
            <span>Search Available Dates</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
                {activePathway === 'rooms' ? 'Check-in Date' : 'Event Date'}
              </label>
              <input
                type="date"
                min={getTomorrowStr(0)}
                value={checkIn}
                onChange={(e) => {
                  setCheckIn(e.target.value)
                  if (e.target.value >= checkOut) {
                    const nextDay = new Date(e.target.value)
                    nextDay.setDate(nextDay.getDate() + 1)
                    setCheckOut(nextDay.toISOString().split('T')[0])
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-sm font-sans"
              />
            </div>
            {activePathway === 'rooms' ? (
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Check-out Date</label>
                <input
                  type="date"
                  min={checkIn}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-sm font-sans"
                />
              </div>
            ) : (
              <div className="bg-[#FDFBF7] border border-[#E5D5C0]/50 p-4 text-[11px] text-[#9A783E] font-medium flex items-center justify-center leading-relaxed rounded-xl">
                <Info className="w-4 h-4 text-[#B89251] shrink-0 mr-2" />
                <span>Venues booked at flat 1-day promo slots</span>
              </div>
            )}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Guests Capacity</label>
              <select
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-sm font-sans"
              >
                {[1, 2, 5, 10, 20, 50].map((num) => (
                  <option key={num} value={num} className="bg-white text-slate-800">
                    {num} {num === 1 ? 'Guest' : 'Guests'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Checkout Rules extensions Warning banner */}
          <div className="mt-6 border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10px] text-slate-500 leading-relaxed font-light">
            <div className="space-y-1">
              <span className="font-bold text-[#9A783E] uppercase tracking-wider block text-[9px]">Arriving Early (Check-In)</span>
              <div>• Between 12:00 AM and 5:00 AM: <span className="text-slate-800 font-medium">Pay for one full night</span></div>
              <div>• Between 5:00 AM and 10:00 AM: <span className="text-slate-800 font-medium">Pay half of the daily price</span></div>
            </div>
            <div className="space-y-1">
              <span className="font-bold text-[#9A783E] uppercase tracking-wider block text-[9px]">Leaving Late (Check-Out)</span>
              <div>• Up to 2:00 PM: <span className="text-emerald-600 font-semibold">Free (if the room is not booked)</span></div>
              <div>• Up to 4:00 PM: <span className="text-slate-800 font-medium">Pay half of the daily price</span> | After 4:00 PM: <span className="text-slate-800 font-medium">Pay for one full night</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Display Listings Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-2 border-champagne-300 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-sm text-plum-400 tracking-widest uppercase">Loading Listings...</p>
          </div>
        ) : activePathway === 'rooms' ? (
          
          /* Rooms Display */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rooms.map((room) => {
              const available = syncEngine.isRoomAvailable(room.id, checkIn, checkOut)
              const suitable = room.capacity >= guestCount
              
              return (
                <div 
                  key={room.id} 
                  className={`flex flex-col bg-white border transition-all duration-300 overflow-hidden relative group rounded-2xl ${
                    available && suitable 
                      ? 'border-slate-200/80 hover:border-[#B89251]/40 shadow-md hover:shadow-lg shadow-slate-100 hover:shadow-[#B89251]/5' 
                      : 'border-slate-200 opacity-60'
                  }`}
                >
                  <div className="relative h-52 overflow-hidden">
                    <img src={room.image_url} alt={room.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-90" />
                    <div className="absolute top-4 left-4 z-10">
                      {available ? (
                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-[9px] tracking-wider uppercase font-bold shadow-sm">Available</span>
                      ) : (
                        <span className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-lg text-[9px] tracking-wider uppercase font-bold shadow-sm">Booked</span>
                      )}
                    </div>
                    <div className="absolute bottom-4 left-4">
                      <span className="text-[9px] tracking-widest text-[#E3C8A1] font-bold uppercase">Suite {room.room_number}</span>
                      <h4 className="text-base font-bold text-white font-sans">{room.name}</h4>
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <p className="text-[11px] text-slate-500 leading-relaxed font-light flex-1">{room.description}</p>
                    <div className="flex items-center justify-between text-[11px] border-y border-slate-100 py-2.5 text-slate-600">
                      <span>Up to {room.capacity} Guests</span>
                      {!suitable && <span className="text-amber-600 font-bold">Capacity mismatch</span>}
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Nightly Price</span>
                        <span className="text-xl font-bold text-[#9A783E]">₱{room.base_price.toLocaleString()} <span className="text-xs font-light text-slate-400">PHP</span></span>
                      </div>
                      <button
                        disabled={!available || !suitable}
                        onClick={() => handleOpenRoomBooking(room)}
                        className={`text-[10px] uppercase tracking-wider font-bold px-4 py-2.5 transition-all border rounded-xl ${
                          available && suitable ? 'bg-[#B89251] border-[#B89251] text-white hover:bg-[#A37E43] shadow-sm shadow-[#B89251]/10' : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        Book chamber
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          
          /* Venues Display */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {venues.map((venue) => {
              const available = syncEngine.isVenueAvailable(venue.id, checkIn)
              const suitable = venue.capacity >= guestCount
              
              return (
                <div 
                  key={venue.id} 
                  className={`flex flex-col bg-white border transition-all duration-300 overflow-hidden relative group rounded-2xl ${
                    available && suitable 
                      ? 'border-slate-200/80 hover:border-[#B89251]/40 shadow-md hover:shadow-lg shadow-slate-100 hover:shadow-[#B89251]/5' 
                      : 'border-slate-200 opacity-60'
                  }`}
                >
                  <div className="relative h-52 overflow-hidden">
                    <img src={venue.image_url} alt={venue.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-90" />
                    <div className="absolute top-4 left-4 z-10">
                      {available ? (
                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-[9px] tracking-wider uppercase font-bold shadow-sm">Available Date</span>
                      ) : (
                        <span className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-lg text-[9px] tracking-wider uppercase font-bold shadow-sm">Reserved</span>
                      )}
                    </div>
                    <div className="absolute bottom-4 left-4">
                      <span className="text-[9px] tracking-widest text-[#E3C8A1] font-bold uppercase">Resort Venue</span>
                      <h4 className="text-base font-bold text-white font-sans">{venue.name}</h4>
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <p className="text-[11px] text-slate-500 leading-relaxed font-light flex-1">{venue.description}</p>
                    <div className="flex flex-wrap gap-2 py-2 text-[10px] text-[#9A783E] font-mono">
                      {venue.details.extras.map((ex, exIdx) => (
                        <span key={exIdx} className="bg-[#FDFBF7] border border-[#E5D5C0]/50 px-2 py-0.5 rounded-md text-[#9A783E]">{ex}</span>
                      ))}
                    </div>

                    <div className="flex items-end justify-between border-t border-slate-100 pt-3">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Day Rent Promo</span>
                        <span className="text-xl font-bold text-slate-900">₱{venue.base_price.toLocaleString()} <span className="text-xs font-light text-slate-400">PHP</span></span>
                      </div>
                      <button
                        disabled={!available || !suitable}
                        onClick={() => handleOpenVenueBooking(venue)}
                        className={`text-[10px] uppercase tracking-wider font-bold px-4 py-2.5 transition-all border rounded-xl ${
                          available && suitable ? 'bg-[#B89251] border-[#B89251] text-white hover:bg-[#A37E43] shadow-sm shadow-[#B89251]/10' : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        Rent Venue
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 5. Concierge Contacts Footer */}
      <footer className="mt-20 max-w-4xl mx-auto border-t border-slate-200 pt-10 px-4 text-center space-y-4">
        <h4 className="text-xs uppercase tracking-wider text-[#B89251] font-bold">Daweez Pension House Reservations</h4>
        <p className="text-xs text-slate-500 font-light leading-relaxed">
          Call us: <span className="text-slate-900 font-semibold">+63 2 8123 4567</span> or <span className="text-slate-900 font-semibold">0917-123-4567</span> <br />
          Email: <span className="text-slate-900 font-semibold">concierge@daweezpensionhouse.com</span> | We are here to help you!
        </p>
      </footer>

      {/* 6. MODAL CHECKOUT FLOW */}
      {showBookingModal && (selectedRoom || selectedVenue) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white border border-slate-200 shadow-2xl relative max-h-[90vh] overflow-y-auto rounded-2xl">
            {bookingStep !== 'payment' && (
              <button onClick={() => setShowBookingModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Header stay details */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <span className="text-[10px] tracking-wider text-[#B89251] font-bold uppercase block">Confirm Checkout</span>
              <h3 className="text-lg font-bold text-slate-900">
                {selectedRoom ? `Chamber ${selectedRoom.room_number}: ${selectedRoom.name}` : `Resort Venue: ${selectedVenue?.name}`}
              </h3>
              
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500 font-light">
                <div>Date: <span className="text-slate-800 font-semibold">{checkIn} {selectedRoom ? `to ${checkOut}` : ''}</span></div>
                {selectedRoom && (
                  <div>Nights: <span className="text-slate-800 font-semibold">
                    {Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))}
                  </span></div>
                )}
              </div>
            </div>

            {/* Core Modal content */}
            <div className="p-6 space-y-6">

              {/* STEP 1: Details & Add-ons */}
              {bookingStep === 'details' && (
                <form onSubmit={handleCheckoutSubmit} className="space-y-6">
                  {errorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center space-x-2 rounded-xl">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* A. Guest form fields */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase tracking-wider text-[#B89251] font-bold border-b border-slate-100 pb-1.5">1. Guest Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="Juan Dela Cruz"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">Email Address</label>
                        <input
                          type="email"
                          required
                          placeholder="juan@gmail.com"
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">Mobile No.</label>
                        <input
                          type="tel"
                          required
                          placeholder="0917-123-4567"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs"
                        />
                      </div>
                    </div>

                    {isLoyalGuest && (
                      <div className="p-3 bg-[#FDFBF7] border border-[#E5D5C0] text-[#9A783E] text-xs flex items-center space-x-2 rounded-xl animate-shimmer">
                        <Tag className="w-4 h-4 text-[#B89251] shrink-0" />
                        <span>👑 <strong>Loyal Guest Recognized!</strong> Silently applying a pre-set 10% discount on your stay nightly rate. Welcome back!</span>
                      </div>
                    )}
                  </div>

                  {/* B. Specialized Add-ons pathway */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase tracking-wider text-[#B89251] font-bold border-b border-slate-100 pb-1.5">
                      {selectedRoom ? '2. Gourmet Breakfast Add-ons (₱200 per meal)' : '2. Venue Equipments & Add-ons'}
                    </h4>

                    {/* Room pathway breakfast lists */}
                    {selectedRoom && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        {['Bangsilog', 'Lumpiasilog', 'Cornsilog', 'Hotsilog'].map((meal) => (
                          <div key={meal} className="flex items-center justify-between bg-slate-50/50 p-3 border border-slate-200/60 rounded-xl">
                            <div>
                              <span className="font-bold text-slate-800 block">{meal}</span>
                              <label className="inline-flex items-center space-x-1.5 text-[10px] text-slate-500 mt-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={breakfastCoffee[meal] || false}
                                  onChange={(e) => setBreakfastCoffee(prev => ({ ...prev, [meal]: e.target.checked }))}
                                  className="accent-[#B89251] w-3 h-3"
                                />
                                <span>Include Hot Coffee</span>
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => setBreakfastQty(prev => ({ ...prev, [meal]: Math.max(0, prev[meal] - 1) }))}
                                className="w-6 h-6 border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500 text-sm font-bold rounded-md"
                              >
                                -
                              </button>
                              <span className="w-6 text-center font-mono font-bold text-slate-900">{breakfastQty[meal]}</span>
                              <button
                                type="button"
                                onClick={() => setBreakfastQty(prev => ({ ...prev, [meal]: prev[meal] + 1 }))}
                                className="w-6 h-6 border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500 text-sm font-bold rounded-md"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Venue pathway equipment rentals & addons */}
                    {selectedVenue && (
                      <div className="space-y-4 text-xs">
                        {/* Equipment rentals grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                          <div className="bg-slate-50/50 p-3 border border-slate-200/60 rounded-xl space-y-2">
                            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Big Tables (₱150)</span>
                            <input
                              type="number"
                              min="0"
                              value={bigTableCount}
                              onChange={(e) => setBigTableCount(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 bg-white border border-slate-200 text-center text-slate-800 font-mono text-xs py-1 rounded-md focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#B89251]"
                            />
                          </div>
                          <div className="bg-slate-50/50 p-3 border border-slate-200/60 rounded-xl space-y-2">
                            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Small Tables (₱100)</span>
                            <input
                              type="number"
                              min="0"
                              value={smallTableCount}
                              onChange={(e) => setSmallTableCount(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 bg-white border border-slate-200 text-center text-slate-800 font-mono text-xs py-1 rounded-md focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#B89251]"
                            />
                          </div>
                          <div className="bg-slate-50/50 p-3 border border-slate-200/60 rounded-xl space-y-2">
                            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Extra Chairs (₱15)</span>
                            <input
                              type="number"
                              min="0"
                              value={chairCount}
                              onChange={(e) => setChairCount(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 bg-white border border-slate-200 text-center text-slate-800 font-mono text-xs py-1 rounded-md focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#B89251]"
                            />
                          </div>
                          <div className="bg-slate-50/50 p-3 border border-slate-200/60 rounded-xl space-y-2">
                            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Mineral Water (₱35)</span>
                            <input
                              type="number"
                              min="0"
                              value={mineralWaterCount}
                              onChange={(e) => setMineralWaterCount(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 bg-white border border-slate-200 text-center text-slate-800 font-mono text-xs py-1 rounded-md focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#B89251]"
                            />
                          </div>
                        </div>

                        {/* Event Add-ons */}
                        <div className="bg-slate-50/50 p-4 border border-slate-200/60 rounded-xl space-y-3">
                          <span className="text-[10px] uppercase text-[#B89251] font-bold tracking-wider block">Premium Event Add-ons</span>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-slate-100/50 rounded-lg">
                              <input
                                type="checkbox"
                                checked={fullBandAndLights}
                                onChange={(e) => setFullBandAndLights(e.target.checked)}
                                className="accent-[#B89251] w-4 h-4"
                              />
                              <span>Full Band & Lights (+₱2,000)</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-slate-100/50 rounded-lg">
                              <input
                                type="checkbox"
                                checked={stage}
                                onChange={(e) => setStage(e.target.checked)}
                                className="accent-[#B89251] w-4 h-4"
                              />
                              <span>Stage Setup (+₱2,000)</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-slate-100/50 rounded-lg">
                              <input
                                type="checkbox"
                                checked={ledWall}
                                onChange={(e) => setLedWall(e.target.checked)}
                                className="accent-[#B89251] w-4 h-4"
                              />
                              <span>LED Wall (+₱5,000)</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* C. Dynamic Pricing Summary invoice box */}
                  {pricing && (
                    <div className="bg-slate-50 border border-slate-200 p-5 text-xs space-y-3 font-light rounded-xl">
                      <h4 className="text-[10px] uppercase tracking-wider text-[#B89251] font-bold border-b border-slate-100 pb-1.5">3. Invoice breakdown</h4>
                      
                      <div className="flex justify-between text-slate-700">
                        <span>Stay Base Subtotal:</span>
                        <span className="font-semibold text-slate-900">₱{pricing.subtotal.toLocaleString()}</span>
                      </div>
                      
                      {pricing.breakfastTotal > 0 && (
                        <div className="flex justify-between text-slate-700">
                          <span>Silog Breakfast Orders ({Object.values(breakfastQty).reduce((a, b) => a + b, 0)} meals):</span>
                          <span className="font-semibold text-slate-900">+₱{pricing.breakfastTotal.toLocaleString()}</span>
                        </div>
                      )}

                      {pricing.rentalsTotal > 0 && (
                        <div className="flex justify-between text-slate-700">
                          <span>Equipment Rentals subtotal:</span>
                          <span className="font-semibold text-slate-900">+₱{pricing.rentalsTotal.toLocaleString()}</span>
                        </div>
                      )}

                      {pricing.addonsTotal > 0 && (
                        <div className="flex justify-between text-slate-700">
                          <span>Event Add-ons subtotal:</span>
                          <span className="font-semibold text-slate-900">+₱{pricing.addonsTotal.toLocaleString()}</span>
                        </div>
                      )}

                      <div className="flex justify-between border-y border-slate-200 py-2 font-bold text-slate-900">
                        <span>Grand Total:</span>
                        <span className="text-[#9A783E] font-extrabold text-sm">₱{pricing.grandTotal.toLocaleString()}</span>
                      </div>

                      {/* Philippine Payment Splitting Rules */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div className="bg-emerald-50 border border-emerald-200 p-3 text-center space-y-1 rounded-xl">
                          <span className="text-[9px] uppercase text-emerald-800 font-bold block tracking-wider">50% Downpayment Required (To Lock)</span>
                          <span className="text-lg font-extrabold text-emerald-700">₱{pricing.downpayment.toLocaleString()}</span>
                        </div>
                        <div className="bg-[#FDFBF7] border border-[#E5D5C0] p-3 text-center space-y-1 rounded-xl">
                          <span className="text-[9px] uppercase text-[#9A783E] font-bold block tracking-wider">Remaining Balance due at Check-in</span>
                          <span className="text-lg font-extrabold text-[#9A783E]">₱{pricing.balanceDue.toLocaleString()}</span>
                          <span className="text-[8px] text-slate-400 block font-light leading-none">(Includes ₱{pricing.securityDeposit} security deposit)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-6 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#B89251]" />
                      <span>50% downpayment lock policy</span>
                    </span>
                    
                    <button
                      type="submit"
                      className="bg-[#B89251] hover:bg-[#A37E43] text-white font-bold uppercase tracking-wider text-xs px-6 py-3.5 transition-colors rounded-xl shadow-sm shadow-[#B89251]/20"
                    >
                      Verify Invoice & Lock Dates
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: GCash countdown screen */}
              {bookingStep === 'payment' && activeLockBooking && (
                <div className="space-y-6">
                  {/* Countdown lock panel */}
                  <div className="bg-[#FDFBF7] border border-[#E5D5C0] p-5 text-center rounded-xl space-y-3">
                    <span className="text-[9px] uppercase tracking-wider text-[#9A783E] font-bold block">Resort slot lock active</span>
                    
                    <div className="inline-flex items-center space-x-2 text-3xl font-extrabold text-[#B89251] font-mono tracking-widest border border-[#E5D5C0] px-4 py-2 bg-white rounded-xl shadow-sm">
                      <Clock className="w-6 h-6 text-[#B89251] animate-pulse" />
                      <span>{formatTime(timeLeft)}</span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed font-light max-w-md mx-auto">
                      These dates have been blocked on our central master calendar. The system has automatically reserved this room/venue for you. Other channels (Airbnb/Booking.com) cannot double-book this slot.
                    </p>
                  </div>

                  {/* Philippine GCash/Maya & Local Banks transfer details */}
                  <div className="bg-slate-50 border border-slate-200 p-5 space-y-4 rounded-xl">
                    <h4 className="text-xs uppercase tracking-wider text-[#9A783E] font-bold border-b border-slate-100 pb-2">
                      Settle 50% downpayment to confirm stay: <span className="text-emerald-600">₱{activeLockBooking.downpayment_paid.toLocaleString()} PHP</span>
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-light">
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase text-slate-500 font-bold block tracking-wider">GCash or Maya Wallet</span>
                        <div className="bg-white p-3 border border-slate-200 font-mono text-slate-700 rounded-lg shadow-sm">
                          GCash Name: Daweez Pension House<br />
                          GCash No: 0917-123-4567<br />
                          Maya Name: Daweez Pension House
                        </div>
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase text-slate-500 font-bold block tracking-wider">Bank Transfer</span>
                        <div className="bg-white p-3 border border-slate-200 font-mono text-slate-700 rounded-lg shadow-sm">
                          Bank Name: BDO (Banco de Oro)<br />
                          Account Name: Daweez Pension House Inc.<br />
                          Account No: 1029-3847-5645<br />
                          BPI Account: 9876-5432-10
                        </div>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleReceiptProofSettle} className="space-y-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Upload payment transaction slip</label>
                      <div className="flex items-center space-x-4">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={() => setSimulatedReceiptUploaded(true)}
                          className="text-xs file:bg-slate-100 file:border file:border-slate-300 file:text-slate-600 file:px-4 file:py-2 file:rounded-lg file:cursor-pointer hover:file:bg-slate-200 text-slate-600"
                        />
                        {simulatedReceiptUploaded && (
                          <span className="text-emerald-600 text-xs font-semibold flex items-center space-x-1">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>Proof receipt file attached!</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                      <a
                        href={getWhatsAppLink()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider text-xs px-6 py-3.5 text-center transition-colors flex items-center justify-center space-x-2 rounded-xl shadow-sm shadow-emerald-600/20"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Send Proof via WhatsApp</span>
                      </a>
                      
                      <button
                        type="submit"
                        disabled={!simulatedReceiptUploaded}
                        className={`font-bold uppercase tracking-wider text-xs px-6 py-3.5 border transition-colors rounded-xl ${
                          simulatedReceiptUploaded
                            ? 'bg-[#B89251] border-[#B89251] text-white hover:bg-[#A37E43] shadow-sm shadow-[#B89251]/20'
                            : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        Confirm downpayment slip
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* STEP 3: Complete Reservation lock */}
              {bookingStep === 'completed' && activeLockBooking && (
                <div className="py-8 text-center space-y-6">
                  <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="text-xl font-bold text-slate-900">Transaction Receipt Uploaded!</h4>
                    <p className="text-xs text-slate-500 font-light max-w-md mx-auto leading-relaxed">
                      Your 50% reservation downpayment of <span className="font-bold text-[#9A783E]">₱{activeLockBooking.downpayment_paid.toLocaleString()} PHP</span> has been submitted for validation.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 max-w-sm mx-auto text-left space-y-2 text-xs font-light rounded-xl">
                    <div><span className="text-slate-400 font-bold">Booking ID:</span> <span className="font-mono text-[#9A783E]">{activeLockBooking.id}</span></div>
                    <div><span className="text-slate-400 font-bold">Resort Item:</span> {selectedRoom ? `Room ${selectedRoom.room_number}` : selectedVenue?.name}</div>
                    <div><span className="text-slate-400 font-bold">Stay Date:</span> {activeLockBooking.check_in} {selectedRoom ? `to ${activeLockBooking.check_out}` : ''}</div>
                    <div className="border-t border-slate-200 pt-2 font-bold flex justify-between text-slate-900">
                      <span>Balance due at check-in:</span>
                      <span className="text-[#9A783E] font-extrabold">₱{activeLockBooking.balance_due.toLocaleString()} PHP</span>
                    </div>
                    <div className="text-[8px] text-slate-400 italic leading-none">(Includes ₱{activeLockBooking.security_deposit} refundable security deposit)</div>
                  </div>

                  <div className="pt-4 max-w-sm mx-auto">
                    <p className="text-[10px] text-slate-500 leading-relaxed font-light mb-6">
                      An administrator will verify your downpayment slip shortly and finalize your confirmed status. A copy has been locked in our PMS calendar database!
                    </p>
                    <button
                      onClick={() => {
                        setShowBookingModal(false)
                        setActiveLockBooking(null)
                      }}
                      className="w-full bg-[#B89251] hover:bg-[#A37E43] text-white font-bold uppercase tracking-wider text-xs py-3.5 rounded-xl transition-colors shadow-sm shadow-[#B89251]/20 border-transparent"
                    >
                      Return to Website
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
