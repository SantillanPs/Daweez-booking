import React, { useState, useEffect } from 'react'
import { useBookings } from '../hooks/useBookings'
import { Room, Venue, Booking, SyncFeed, BookingSource, BreakfastOrder, EquipmentRental, EventAddons, GuestRecord } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { Calendar, User, Phone, Mail, Clock, RefreshCw, Key, Plus, Settings, ClipboardCheck, Trash2, CheckCircle2, AlertCircle, Sparkles, X, Eye, TrendingUp, Users, Home, LogIn, LogOut, Receipt } from 'lucide-react'

interface AdminPortalProps {
  onNavigateToGuest: () => void
}

export function AdminPortal({ onNavigateToGuest }: AdminPortalProps) {
  const { 
    rooms, 
    venues,
    bookings, 
    feeds, 
    confirmBooking, 
    cancelBooking, 
    createManualBooking, 
    triggerOTASync, 
    updateFeedUrls, 
    isLoading 
  } = useBookings()

  // 1. Authentication Gate State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [passcode, setPasscode] = useState<string>('')
  const [authError, setAuthError] = useState<string>('')

  // 2. Tab Navigation
  const [activeTab, setActiveTab] = useState<'pms' | 'scheduler' | 'bookings' | 'loyalty' | 'channels'>('pms')

  // 3. Date Scheduler Matrix Configs
  const [schedulerStartDate, setSchedulerStartDate] = useState<Date>(new Date())
  const [daysCount] = useState<number>(30)
  const [daysList, setDaysList] = useState<Date[]>([])

  // 4. Walk-in Booking Console State (Rooms & Venues)
  const [showManualForm, setShowManualForm] = useState<boolean>(false)
  const [formPathway, setFormPathway] = useState<'room' | 'venue'>('room')
  const [formRoomId, setFormRoomId] = useState<string>('room-1')
  const [formVenueId, setFormVenueId] = useState<string>('venue-gazebo')
  
  // Guest details
  const [formGuestName, setFormGuestName] = useState<string>('')
  const [formGuestEmail, setFormGuestEmail] = useState<string>('')
  const [formGuestPhone, setFormGuestPhone] = useState<string>('')
  const [formCheckIn, setFormCheckIn] = useState<string>('')
  const [formCheckOut, setFormCheckOut] = useState<string>('')
  const [formSource, setFormSource] = useState<BookingSource>('manual')
  const [formStatus, setFormStatus] = useState<'confirmed' | 'blocked'>('confirmed')
  const [formError, setFormError] = useState<string>('')

  // Add-ons
  const [formBreakfastQty, setFormBreakfastQty] = useState<{ [key: string]: number }>({ Bangsilog: 0, Lumpiasilog: 0, Cornsilog: 0, Hotsilog: 0 })
  const [formBigTable, setFormBigTable] = useState<number>(0)
  const [formSmallTable, setFormSmallTable] = useState<number>(0)
  const [formChairs, setFormChairs] = useState<number>(0)
  const [formWater, setFormWater] = useState<number>(0)
  const [formBand, setFormBand] = useState<boolean>(false)
  const [formStage, setFormStage] = useState<boolean>(false)
  const [formLedWall, setFormLedWall] = useState<boolean>(false)

  // 5. Channel Feeds Editing States
  const [editingFeeds, setEditingFeeds] = useState<SyncFeed[]>([])
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string>('')
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const [selectedReceiptData, setSelectedReceiptData] = useState<Booking | null>(null)

  // Generate 30 days list from schedulerStartDate
  useEffect(() => {
    const list: Date[] = []
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(schedulerStartDate)
      d.setDate(schedulerStartDate.getDate() + i)
      list.push(d)
    }
    setDaysList(list)
  }, [schedulerStartDate, daysCount])

  // Sync editingFeeds with query data when loaded
  useEffect(() => {
    if (feeds.length > 0 && editingFeeds.length === 0) {
      setEditingFeeds(feeds)
    }
  }, [feeds, editingFeeds])

  // Toggle admin-mode class on body for CSS overrides
  useEffect(() => {
    document.body.classList.add('admin-mode')
    return () => document.body.classList.remove('admin-mode')
  }, [])

  // Simple Passcode Verification
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (passcode === '12345') {
      setIsAuthenticated(true)
      setAuthError('')
    } else {
      setAuthError('Invalid administrator passcode. Hint: Use 12345.')
    }
  }

  // Handle open manual booking form from cell click
  const handleCellClick = (roomId: string, date: Date) => {
    const formattedDate = date.toISOString().split('T')[0]
    const tomorrow = new Date(date)
    tomorrow.setDate(date.getDate() + 1)
    const formattedTomorrow = tomorrow.toISOString().split('T')[0]
    
    setFormPathway('room')
    setFormRoomId(roomId)
    setFormCheckIn(formattedDate)
    setFormCheckOut(formattedTomorrow)
    setFormGuestName('')
    setFormGuestEmail('')
    setFormGuestPhone('')
    setFormSource('manual')
    setFormStatus('confirmed')
    setFormBreakfastQty({ Bangsilog: 0, Lumpiasilog: 0, Cornsilog: 0, Hotsilog: 0 })
    setFormError('')
    setShowManualForm(true)
  }

  // Handle Manual Booking Submission
  const handleManualBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!formCheckIn || (formPathway === 'room' && !formCheckOut)) {
      setFormError('Please select active date bounds.')
      return
    }

    try {
      const breakfasts: BreakfastOrder[] = []
      if (formPathway === 'room') {
        Object.entries(formBreakfastQty).forEach(([meal, qty]) => {
          if (qty > 0) {
            breakfasts.push({ option: meal as any, quantity: qty, withCoffee: true })
          }
        })
      }

      await createManualBooking({
        roomId: formPathway === 'room' ? formRoomId : undefined,
        venueId: formPathway === 'venue' ? formVenueId : undefined,
        guestName: formGuestName,
        guestEmail: formGuestEmail,
        guestPhone: formGuestPhone,
        checkIn: formCheckIn,
        checkOut: formPathway === 'room' ? formCheckOut : formCheckIn,
        source: formSource,
        status: formStatus,
        breakfastOrders: breakfasts.length > 0 ? breakfasts : undefined,
        equipmentRentals: formPathway === 'venue' ? {
          bigTableCount: formBigTable,
          smallTableCount: formSmallTable,
          chairCount: formChairs,
          mineralWaterCount: formWater
        } : undefined,
        eventAddons: formPathway === 'venue' ? {
          fullBandAndLights: formBand,
          stage: formStage,
          ledWall: formLedWall
        } : undefined
      })

      setShowManualForm(false)
    } catch (err: any) {
      setFormError(err.message || 'Overlap collision occurred. Try again.')
    }
  }

  // Settle sync
  const handleTriggerSync = async () => {
    setSyncSuccessMsg('')
    try {
      const addedCount = await triggerOTASync()
      setSyncSuccessMsg(`Bilateral sync complete! Merged ${addedCount} reservations from Booking.com & Airbnb channels.`)
      setTimeout(() => setSyncSuccessMsg(''), 6000)
    } catch (err) {
      alert('Sync failed.')
    }
  }

  // Save modified feeds
  const handleSaveFeeds = async () => {
    try {
      await updateFeedUrls(editingFeeds)
      alert('iCal subscription feeds saved successfully!')
    } catch (err) {
      alert('Failed to save URLs.')
    }
  }

  const handleFeedUrlChange = (feedId: string, url: string) => {
    setEditingFeeds(prev => prev.map(f => f.id === feedId ? { ...f, url } : f))
  }

  // Format Helpers
  const formatDateHeader = (date: Date) => {
    const day = date.getDate()
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 1)
    return { day, weekday }
  }

  const getBookingForDay = (roomId: string, date: Date): Booking | null => {
    const formatted = date.toISOString().split('T')[0]
    const list = bookings.filter(b => b.room_id === roomId)
    
    const match = list.find(b => {
      const start = b.check_in
      const end = b.check_out
      return formatted >= start && formatted < end
    })

    return match || null
  }

  const getBookingStyle = (booking: Booking) => {
    if (booking.status === 'pending') {
      return 'bg-amber-50 text-amber-800 border border-amber-200/60 animate-pulse cursor-pointer rounded-md'
    }

    switch (booking.source) {
      case 'airbnb':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold cursor-pointer rounded-md'
      case 'booking_com':
        return 'bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold cursor-pointer rounded-md'
      case 'facebook':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-semibold cursor-pointer rounded-md'
      case 'google_maps':
        return 'bg-orange-50 text-orange-700 border border-orange-200/60 font-semibold cursor-pointer rounded-md'
      case 'website':
        return 'bg-violet-50 text-violet-700 border border-violet-200/60 font-bold cursor-pointer rounded-md'
      default:
        return booking.status === 'blocked'
          ? 'bg-slate-100 text-slate-400 border border-slate-200 font-light cursor-pointer line-through rounded-md'
          : 'bg-slate-50 text-slate-700 border border-slate-200/80 font-medium cursor-pointer rounded-md'
    }
  }

  // ==========================================
  // DYNAMIC PMS CONCIERGE STATISTICS
  // ==========================================
  const todayStr = new Date().toISOString().split('T')[0]
  
  // A. Arrivals today
  const arrivalsToday = bookings.filter(b => b.check_in === todayStr && b.status !== 'blocked')
  
  // B. Departures today
  const departuresToday = bookings.filter(b => b.check_out === todayStr && b.status !== 'blocked')
  
  // C. Current Checked-in Guests
  const currentGuests = bookings.filter(b => b.status === 'confirmed' && todayStr >= b.check_in && todayStr < b.check_out)
  
  // D. Room Occupancy %
  const occupiedRoomIds = new Set(currentGuests.map(g => g.room_id).filter(Boolean))
  const roomOccupancyRate = Math.round((occupiedRoomIds.size / 10) * 100)

  // E. Estimated monthly revenue
  const totalRevenue = bookings
    .filter(b => b.status === 'confirmed')
    .reduce((sum, b) => sum + (b.downpayment_paid ?? 0) + ((b.balance_due ?? 0) - (b.security_deposit ?? 0)), 0)

  // F. Guest loyalty lists
  const loyaltyRecords = syncEngine.getGuestRecords()

  // Render Auth Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{background: '#FDFBF7'}}>
        <div className="w-full max-w-md bg-white border border-[#E5D5C0] shadow-2xl shadow-slate-100 p-8 space-y-6 rounded-2xl">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 flex items-center justify-center bg-[#B89251] mx-auto rounded-2xl shadow-lg shadow-[#B89251]/20">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Daweez Pension House</h1>
              <p className="text-xs text-[#9A783E] mt-0.5 font-semibold uppercase tracking-wider">Property Management System</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs flex items-center space-x-2 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="block text-xs text-slate-600 font-semibold">Admin Passcode</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="Enter passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-sm transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#B89251] hover:bg-[#9A783E] text-white font-semibold text-sm py-3 rounded-xl transition-colors shadow-sm shadow-[#B89251]/20"
            >
              Sign In to Dashboard
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-100">
            <button onClick={onNavigateToGuest} className="text-xs text-slate-400 hover:text-[#B89251] transition-colors font-medium">
              ← Return to Guest Portal
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-16 text-slate-800" style={{background: '#F8FAFC'}}>
      
      {/* 1. Header Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40" style={{boxShadow: '0 1px 3px rgba(15,23,42,0.06)'}}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 flex items-center justify-center bg-[#B89251] rounded-lg shadow-sm shadow-[#B89251]/20">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">Daweez Pension House</h1>
              <p className="text-[10px] text-[#B89251] font-semibold tracking-wide uppercase">Property Management System</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleTriggerSync}
              className="text-xs font-semibold text-[#9A783E] border border-[#E5D5C0] bg-[#FDFBF7] hover:bg-[#B89251] hover:text-white hover:border-[#B89251] px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-all duration-200"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>OTA Sync</span>
            </button>
            <button
              onClick={onNavigateToGuest}
              className="text-xs font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 rounded-lg transition-colors"
            >
              Concierge View
            </button>
          </div>
        </div>
      </header>

      {/* 2. Workspace Navigation tabs */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-6">
        {syncSuccessMsg && (
          <div className="mb-5 p-3.5 bg-[#FDFBF7] border border-[#E5D5C0]/80 text-[#9A783E] text-xs flex items-center space-x-2.5 rounded-xl">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#B89251]" />
            <span className="font-semibold">{syncSuccessMsg}</span>
          </div>
        )}

        <div className="flex border-b border-slate-200 space-x-1 overflow-x-auto pb-0">
          {(['pms', 'scheduler', 'bookings', 'loyalty', 'channels'] as const).map(tab => {
            const labels: Record<string, string> = {
              pms: 'PMS Dashboard',
              scheduler: 'Grid Scheduler',
              bookings: `Reservations (${bookings.length})`,
              loyalty: 'Guest Loyalty',
              channels: 'iCal Settings',
            }
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all duration-150 ${
                  isActive
                    ? 'border-[#B89251] text-[#9A783E] bg-[#FDFBF7]/60'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                } rounded-t-lg`}
              >
                {labels[tab]}
              </button>
            )
          })}
        </div>

        {/* 3. SWITCHER WORKSPACE CONTENT */}
        <div className="mt-6">
          
          {/* TAB A: CONCIERGE PMS WORKSPACE */}
          {activeTab === 'pms' && (
            <div className="space-y-6">

              {/* Analytics Meters */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Occupancy card */}
                <div className="bg-white rounded-xl border-t-[3px] border-t-indigo-500 border-x border-b border-slate-200/70 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                      <Home className="w-4 h-4 text-indigo-600" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{roomOccupancyRate}%</div>
                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">Room Occupancy</div>
                </div>
                {/* Arrivals card */}
                <div className="bg-white rounded-xl border-t-[3px] border-t-emerald-500 border-x border-b border-slate-200/70 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <LogIn className="w-4 h-4 text-emerald-600" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{arrivalsToday.length}</div>
                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">Arrivals Today</div>
                </div>
                {/* Departures card */}
                <div className="bg-white rounded-xl border-t-[3px] border-t-rose-500 border-x border-b border-slate-200/70 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-rose-50 rounded-lg flex items-center justify-center">
                      <LogOut className="w-4 h-4 text-rose-600" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{departuresToday.length}</div>
                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">Departures Today</div>
                </div>
                {/* Current guests card */}
                <div className="bg-white rounded-xl border-t-[3px] border-t-blue-500 border-x border-b border-slate-200/70 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{currentGuests.length}</div>
                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">Current Guests</div>
                </div>
                {/* Revenue card */}
                <div className="bg-white rounded-xl border-t-[3px] border-t-amber-500 border-x border-b border-slate-200/70 p-4 shadow-sm col-span-2 sm:col-span-1">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-amber-600" />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-slate-900">₱{totalRevenue.toLocaleString()}</div>
                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">Est. Revenue</div>
                </div>
              </div>

              {/* Arrivals & Departures Monitor queues */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                
                {/* 1. Arrivals table */}
                <div className="bg-white border border-slate-200/70 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-100 flex items-center space-x-2 bg-slate-50/50">
                    <div className="w-6 h-6 bg-emerald-100 rounded-md flex items-center justify-center">
                      <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Arrivals Today</h3>
                  </div>
                  <div className="p-5 space-y-3">

                  {arrivalsToday.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">No arrivals scheduled for today.</p>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {arrivalsToday.map(b => {
                        const room = rooms.find(r => r.id === b.room_id)
                        const venue = venues.find(v => v.id === b.venue_id)
                        
                        return (
                          <div key={b.id} className="flex justify-between items-start p-3 bg-slate-50/60 hover:bg-slate-100/50 border border-slate-200/60 transition-colors text-xs rounded-lg">
                            <div className="space-y-0.5">
                              <span className="font-semibold text-slate-900 block">{b.guest_name}</span>
                              <span className="text-[10px] text-slate-400 block">
                                {room ? `Room ${room.room_number}` : venue?.name} · #{b.id}
                              </span>
                              <span className="text-[10px] text-[#9A783E] font-semibold block">
                                Balance: ₱{(b.balance_due ?? 0).toLocaleString()}
                              </span>
                            </div>
                            
                            {b.status === 'pending' ? (
                              <button
                                onClick={() => confirmBooking(b.id)}
                                className="bg-[#B89251] hover:bg-[#9A783E] text-white font-semibold text-[9px] uppercase tracking-wider px-2.5 py-1.5 transition-colors rounded-md"
                              >
                                Check-in
                              </button>
                            ) : (
                              <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md font-bold uppercase tracking-wider">In-house</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  </div>
                </div>

                {/* 2. Departures table */}
                <div className="bg-white border border-slate-200/70 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-100 flex items-center space-x-2 bg-slate-50/50">
                    <div className="w-6 h-6 bg-rose-100 rounded-md flex items-center justify-center">
                      <LogOut className="w-3.5 h-3.5 text-rose-600" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Departures Today</h3>
                  </div>
                  <div className="p-5 space-y-3">

                  {departuresToday.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">No departures scheduled for today.</p>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {departuresToday.map(b => {
                        const room = rooms.find(r => r.id === b.room_id)
                        const venue = venues.find(v => v.id === b.venue_id)
                        
                        return (
                          <div key={b.id} className="flex justify-between items-start p-3 bg-slate-50/60 hover:bg-slate-100/50 border border-slate-200/60 transition-colors text-xs rounded-lg">
                            <div className="space-y-0.5">
                              <span className="font-semibold text-slate-900 block">{b.guest_name}</span>
                              <span className="text-[10px] text-slate-400 block">
                                {room ? `Room ${room.room_number}` : venue?.name} · #{b.id}
                              </span>
                              <span className="text-[10px] text-amber-600 block font-semibold">
                                Release ₱{b.security_deposit ?? 0} deposit
                              </span>
                            </div>
                            
                            <button
                              onClick={() => cancelBooking(b.id)}
                              className="bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 font-semibold text-[9px] uppercase tracking-wider px-2.5 py-1.5 transition-colors border border-slate-200 rounded-md"
                            >
                              Check-out
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  </div>
                </div>

              </div>

              {/* Concierge walk-in shortcut */}
              <div className="bg-[#B89251] rounded-xl p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" style={{background: 'linear-gradient(135deg, #9A783E 0%, #B89251 100%)'}}>
                <div>
                  <h4 className="text-sm font-bold text-white">Resort Walk-In Booking Console</h4>
                  <p className="text-xs text-[#FDFBF7]/80 mt-1 max-w-sm">
                    Create manual room blocks, event gazebo rentals, and walk-in cash payments.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setFormPathway('room')
                    setFormRoomId('room-1')
                    setFormCheckIn('')
                    setFormCheckOut('')
                    setFormGuestName('')
                    setFormGuestEmail('')
                    setFormGuestPhone('')
                    setFormSource('manual')
                    setFormStatus('confirmed')
                    setFormBreakfastQty({ Bangsilog: 0, Lumpiasilog: 0, Cornsilog: 0, Hotsilog: 0 })
                    setFormError('')
                    setShowManualForm(true)
                  }}
                  className="shrink-0 bg-white text-[#9A783E] hover:bg-[#FDFBF7] font-bold text-xs px-5 py-2.5 rounded-lg transition-colors shadow-sm"
                >
                  + New Walk-In Booking
                </button>
              </div>

            </div>
          )}

          {/* TAB B: INTERACTIVE GRID SCHEDULER */}
          {activeTab === 'scheduler' && (
            <div className="bg-white border border-slate-200/80 shadow-md overflow-hidden rounded-xl">
              <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-3">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Start Date:</span>
                  <input
                    type="date"
                    value={schedulerStartDate.toISOString().split('T')[0]}
                    onChange={(e) => setSchedulerStartDate(new Date(e.target.value))}
                    className="bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs"
                  />
                  <button
                    onClick={() => setSchedulerStartDate(new Date())}
                    className="text-[10px] border border-[#E5D5C0] bg-[#FDFBF7] text-[#9A783E] hover:bg-[#B89251] hover:text-white hover:border-[#B89251] px-3 py-1.5 rounded-lg transition-all duration-200 uppercase font-semibold"
                  >
                    Today
                  </button>
                </div>
                
                <button
                  onClick={() => {
                    setFormPathway('room')
                    setFormRoomId('room-1')
                    setFormCheckIn('')
                    setFormCheckOut('')
                    setFormGuestName('')
                    setFormGuestEmail('')
                    setFormGuestPhone('')
                    setFormSource('manual')
                    setFormStatus('confirmed')
                    setFormBreakfastQty({ Bangsilog: 0, Lumpiasilog: 0, Cornsilog: 0, Hotsilog: 0 })
                    setFormError('')
                    setShowManualForm(true)
                  }}
                  className="bg-[#B89251] hover:bg-[#9A783E] text-white font-bold uppercase tracking-wider text-[10px] px-4 py-2.5 rounded-lg transition-colors flex items-center space-x-1.5 shadow-sm shadow-[#B89251]/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Walk-in Booking</span>
                </button>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto relative">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="sticky left-0 z-20 bg-slate-50/95 border-b border-r border-slate-200 p-4 text-left text-[10px] uppercase tracking-wider text-slate-500 font-bold min-w-[200px]">
                        Rooms / Suites
                      </th>
                      {daysList.map((day, idx) => {
                        const { day: num, weekday } = formatDateHeader(day)
                        const isToday = day.toDateString() === new Date().toDateString()
                        return (
                          <th 
                            key={idx} 
                            className={`border-b border-slate-200/60 p-2 text-center text-[10px] min-w-[40px] font-mono ${isToday ? 'bg-[#FDFBF7] text-[#9A783E] font-bold' : 'text-slate-400'}`}
                          >
                            <div>{weekday}</div>
                            <div className={`text-xs font-bold mt-0.5 ${isToday ? 'border-b border-[#B89251] pb-0.5' : ''}`}>{num}</div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  
                  <tbody>
                    {rooms.map((room) => (
                      <tr key={room.id} className="hover:bg-slate-50/30 group border-b border-slate-100">
                        <td className="sticky left-0 z-20 bg-white border-r border-slate-200 p-4 text-left min-w-[200px]">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Suite {room.room_number}</span>
                          <span className="text-xs font-bold text-slate-900 font-sans block">{room.name}</span>
                          <span className="text-[10px] font-medium text-[#B89251]">₱{room.base_price.toLocaleString()}/night</span>
                        </td>
                        
                        {daysList.map((day, dIdx) => {
                          const booking = getBookingForDay(room.id, day)
                           
                          if (booking) {
                            const isCheckInDay = day.toISOString().split('T')[0] === booking.check_in
                            const tooltipId = `${room.id}-${dIdx}`
                            
                            return (
                              <td 
                                key={dIdx} 
                                className="p-0 border-r border-slate-100/80 relative align-middle"
                                onMouseEnter={() => setActiveTooltip(tooltipId)}
                                onMouseLeave={() => setActiveTooltip(null)}
                              >
                                <div className={`h-8 mx-0.5 flex items-center justify-center text-[9px] uppercase tracking-wider overflow-hidden rounded-sm select-none border transition-all ${getBookingStyle(booking)}`}>
                                  {isCheckInDay ? (
                                    <span className="px-1 truncate font-bold">{booking.guest_name.split(' ')[0]}</span>
                                  ) : (
                                    <span className="opacity-0">.</span>
                                  )}
                                </div>

                                {activeTooltip === tooltipId && (
                                  <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-30 w-56 bg-white border border-slate-200 p-4 shadow-xl rounded-lg text-xs space-y-2 pointer-events-none">
                                    <div className="font-bold border-b border-slate-100 pb-1 text-[#B89251] uppercase tracking-wider text-[9px]">
                                      {booking.source} reservation
                                    </div>
                                    <div className="font-bold text-slate-800">{booking.guest_name}</div>
                                    <div className="text-[10px] text-slate-400 font-medium font-mono">
                                      {booking.check_in} to {booking.check_out}
                                    </div>
                                    <div className="text-[10px] text-slate-600">
                                      Phone: {booking.guest_phone}<br />
                                      Email: {booking.guest_email}<br />
                                      Status: <span className={booking.status === 'confirmed' ? 'text-emerald-600 font-bold' : 'text-amber-600'}>{booking.status}</span>
                                    </div>
                                  </div>
                                )}
                              </td>
                            )
                          }

                          return (
                            <td 
                              key={dIdx} 
                              onClick={() => handleCellClick(room.id, day)}
                              className="border-r border-slate-100 p-0 h-10 hover:bg-[#FDFBF7]/60 cursor-cell transition-colors"
                            />
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB C: RESERVATION QUEUE */}
          {activeTab === 'bookings' && (
            <div className="space-y-8">
              
              {/* Queue A: Pending Approvals */}
              <div className="bg-white border border-slate-200/80 p-6 space-y-4 rounded-xl shadow-sm">
                <h3 className="text-xs uppercase tracking-wider text-slate-800 font-bold border-b border-slate-100 pb-2.5 flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
                  <span>Pending downpayment checks ({bookings.filter(b => b.status === 'pending').length})</span>
                </h3>

                {bookings.filter(b => b.status === 'pending').length === 0 ? (
                  <p className="text-xs text-slate-400 font-light italic">No pending client reservations at this moment.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-light text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Booking ID</th>
                          <th className="py-3 px-4">Resort Chamber/Venue</th>
                          <th className="py-3 px-4">Guest Details</th>
                          <th className="py-3 px-4">Reservation Dates</th>
                          <th className="py-3 px-4">50% Downpayment</th>
                          <th className="py-3 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.filter(b => b.status === 'pending').map((b) => {
                          const room = rooms.find(r => r.id === b.room_id)
                          const venue = venues.find(v => v.id === b.venue_id)
                          
                          return (
                            <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 px-4 font-mono text-[10px] text-[#9A783E] font-semibold">{b.id}</td>
                              <td className="py-4 px-4">
                                <span className="font-bold text-slate-900 block">
                                  {room ? `Room ${room.room_number}` : venue?.name}
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                  {room ? room.name : 'Event Venue Rental'}
                                </span>
                              </td>
                              <td className="py-4 px-4 space-y-0.5">
                                <span className="font-bold text-slate-900 block">{b.guest_name}</span>
                                <span className="text-[10px] text-slate-500 block">{b.guest_phone} | {b.guest_email}</span>
                              </td>
                              <td className="py-4 px-4 font-mono text-[10px] text-slate-600">
                                {b.check_in} {room ? `to ${b.check_out}` : ''}
                              </td>
                              <td className="py-4 px-4 font-bold text-emerald-600">₱{(b.downpayment_paid ?? 0).toLocaleString()}</td>
                              <td className="py-4 px-4 flex items-center space-x-3 pt-5">
                                <button
                                  onClick={() => setSelectedReceiptData(b)}
                                  className="text-xs text-[#9A783E] hover:text-[#B89251] font-medium hover:underline flex items-center space-x-1.5"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Verify Slip</span>
                                </button>
                                <button
                                  onClick={() => confirmBooking(b.id)}
                                  className="bg-[#B89251] hover:bg-[#9A783E] text-white font-bold text-[9px] uppercase tracking-wider px-3 py-1.5 transition-colors rounded-lg shadow-sm shadow-[#B89251]/10"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => cancelBooking(b.id)}
                                  className="text-[9px] uppercase tracking-wider text-rose-600 hover:text-rose-700 font-bold"
                                >
                                  Release
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Queue B: Confirmed Bookings */}
              <div className="bg-white border border-slate-200/80 p-6 space-y-4 rounded-xl shadow-sm">
                <h3 className="text-xs uppercase tracking-wider text-slate-800 font-bold border-b border-slate-100 pb-2.5 flex items-center space-x-2">
                  <ClipboardCheck className="w-5 h-5 text-emerald-500" />
                  <span>Active Confirmed Reservations ({bookings.filter(b => b.status === 'confirmed' || b.status === 'blocked').length})</span>
                </h3>

                {bookings.filter(b => b.status === 'confirmed' || b.status === 'blocked').length === 0 ? (
                  <p className="text-xs text-slate-400 font-light italic">No confirmed reservations in the database.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-light text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Room/Venue</th>
                          <th className="py-3 px-4">Guest Info</th>
                          <th className="py-3 px-4">Stay Date(s)</th>
                          <th className="py-3 px-4">Payment tracking</th>
                          <th className="py-3 px-4">Channel</th>
                          <th className="py-3 px-4">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.filter(b => b.status === 'confirmed' || b.status === 'blocked').map((b) => {
                          const room = rooms.find(r => r.id === b.room_id)
                          const venue = venues.find(v => v.id === b.venue_id)
                          const isSync = b.source === 'airbnb' || b.source === 'booking_com'
                          
                          return (
                            <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 px-4">
                                <span className="font-bold text-slate-900 block">
                                  {room ? `Room ${room.room_number}` : venue?.name}
                                </span>
                                <span className="text-[10px] text-slate-500 block">{room ? room.name : 'Event Venue'}</span>
                              </td>
                              <td className="py-4 px-4 space-y-0.5">
                                <span className="font-bold text-slate-900 block">{b.guest_name}</span>
                                <span className="text-[10px] text-slate-500 block">{b.guest_phone}</span>
                              </td>
                              <td className="py-4 px-4 font-mono text-[10px] text-slate-600">
                                {b.check_in} {room ? `to ${b.check_out}` : ''}
                              </td>
                              <td className="py-4 px-4 text-[10px] space-y-0.5">
                                <div><span className="text-slate-500">Downpayment Paid:</span> <span className="font-bold text-emerald-600">₱{(b.downpayment_paid ?? 0).toLocaleString()}</span></div>
                                {b.status !== 'blocked' && (
                                  <div><span className="text-slate-500">Due at Check-in:</span> <span className="font-bold text-[#9A783E]">₱{(b.balance_due ?? 0).toLocaleString()}</span></div>
                                )}
                              </td>
                              <td className="py-4 px-4 font-bold">
                                <span className={`px-2 py-1 uppercase text-[9px] tracking-wider font-semibold rounded-md border ${
                                  isSync ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-[#9A783E] bg-[#FDFBF7] border-[#E5D5C0]'
                                }`}>
                                  {b.source}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <button
                                  onClick={() => cancelBooking(b.id)}
                                  className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB D: CUSTOMER LOYALTY visit history logs */}
          {activeTab === 'loyalty' && (
            <div className="bg-white border border-slate-200/80 p-6 shadow-sm rounded-xl space-y-6">
              <div className="border-b border-slate-100 pb-3.5">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-[#B89251]" />
                  <span>Customer Loyalty & Visit History register</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-light leading-relaxed">
                  Daweez Pension House PMS silently matches guest email addresses during checkout. Stays with 1+ confirmed past stay are automatically flagged for a 10% automatic loyalty discount on nightly rates.
                </p>
              </div>

              {loyaltyRecords.length === 0 ? (
                <p className="text-xs text-slate-400 font-light italic">No confirmed guest records in database yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-light text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4">Guest Details</th>
                        <th className="py-3 px-4">Contact Phone</th>
                        <th className="py-3 px-4">Visits Count</th>
                        <th className="py-3 px-4">Last Stay Date</th>
                        <th className="py-3 px-4">Loyalty Status Badge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loyaltyRecords.map((r, rIdx) => (
                        <tr key={rIdx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-4">
                            <span className="font-bold text-slate-900 block">{r.name}</span>
                            <span className="text-[10px] text-slate-500 block">{r.email}</span>
                          </td>
                          <td className="py-4 px-4 font-mono text-[10px] text-slate-600">{r.phone}</td>
                          <td className="py-4 px-4 font-bold text-slate-900 text-center">{r.visit_count}</td>
                          <td className="py-4 px-4 font-mono text-[10px] text-slate-600">{r.last_visit.split('T')[0]}</td>
                          <td className="py-4 px-4">
                            <span className="bg-[#FDFBF7] border border-[#E5D5C0] text-[#9A783E] px-3 py-1 rounded-full text-[9px] uppercase tracking-wider font-bold shadow-sm">
                              ✓ 10% Auto Discount Active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB E: ICAL CHANNEL MANAGER */}
          {activeTab === 'channels' && (
            <div className="bg-white border border-slate-200/80 p-6 shadow-sm space-y-8 rounded-xl">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-slate-700" />
                  <span>Room iCal Feed Subscriptions Manager</span>
                </h3>
              </div>

              <div className="space-y-6">
                {rooms.map((room) => {
                  const roomFeeds = editingFeeds.filter(f => f.room_id === room.id)
                  const airbnbFeed = roomFeeds.find(f => f.channel === 'airbnb')
                  const bookingComFeed = roomFeeds.find(f => f.channel === 'booking_com')
                  
                  return (
                    <div key={room.id} className="border border-slate-100 bg-slate-50/30 p-5 space-y-4 rounded-xl">
                      <div className="flex items-center justify-between border-b border-slate-200/40 pb-2 text-xs">
                        <span className="font-bold text-slate-800">Suite {room.room_number}: {room.name}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center text-xs">
                        <span className="text-[10px] uppercase text-[#B89251] font-bold tracking-wider">Global Export URL:</span>
                        <input
                          type="text"
                          readOnly
                          value={`http://daweezpensionhouse.com/api/ical/room/${room.room_number}.ics`}
                          className="md:col-span-2 bg-slate-50 border border-slate-200 text-slate-500 p-2.5 rounded-lg select-all font-mono text-[10px] outline-none"
                        />
                      </div>

                      <div className="space-y-3">
                        {airbnbFeed && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center text-xs">
                            <span className="text-[10px] uppercase text-emerald-600 font-bold tracking-wider">Airbnb Import Feed:</span>
                            <input
                              type="text"
                              value={airbnbFeed.url}
                              onChange={(e) => handleFeedUrlChange(airbnbFeed.id, e.target.value)}
                              className="md:col-span-2 bg-white border border-slate-200 text-slate-800 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] font-mono text-[10px]"
                            />
                          </div>
                        )}

                        {bookingComFeed && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center text-xs">
                            <span className="text-[10px] uppercase text-blue-600 font-bold tracking-wider">Booking.com Import:</span>
                            <input
                              type="text"
                              value={bookingComFeed.url}
                              onChange={(e) => handleFeedUrlChange(bookingComFeed.id, e.target.value)}
                              className="md:col-span-2 bg-white border border-slate-200 text-slate-800 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] font-mono text-[10px]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-slate-100 pt-6 flex items-center justify-end">
                <button
                  onClick={handleSaveFeeds}
                  className="bg-[#B89251] hover:bg-[#9A783E] text-white font-bold uppercase tracking-wider text-xs px-6 py-3 rounded-lg transition-colors shadow-sm shadow-[#B89251]/10"
                >
                  Save Feed URLs
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 4. MODAL: Manual Entry Form Drawer (Walk-ins) */}
      {showManualForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg relative bg-white border border-slate-200 shadow-2xl p-6 max-h-[90vh] overflow-y-auto rounded-2xl">
            <button onClick={() => setShowManualForm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3.5 mb-6">
              Create Walk-in Reservation Block
            </h3>

            {/* Pathway toggles Room vs Venue manually */}
            <div className="flex p-1 text-[10px] uppercase font-bold tracking-wider bg-slate-100 rounded-xl mb-5 border border-slate-200">
              <button
                type="button"
                onClick={() => setFormPathway('room')}
                className={`flex-1 py-2 text-center transition-all duration-200 rounded-lg ${
                  formPathway === 'room' ? 'bg-[#B89251] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Book a Chamber
              </button>
              <button
                type="button"
                onClick={() => setFormPathway('venue')}
                className={`flex-1 py-2 text-center transition-all duration-200 rounded-lg ${
                  formPathway === 'venue' ? 'bg-[#B89251] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Rent Event Venue
              </button>
            </div>

            <form onSubmit={handleManualBookingSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center space-x-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* A. Selector options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formPathway === 'room' ? (
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Select Chamber</label>
                    <select
                      value={formRoomId}
                      onChange={(e) => setFormRoomId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs"
                    >
                      {rooms.map(room => (
                        <option key={room.id} value={room.id}>
                          Suite {room.room_number} - {room.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Select Event Venue</label>
                    <select
                      value={formVenueId}
                      onChange={(e) => setFormVenueId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs"
                    >
                      {venues.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name} (₱{v.base_price.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Reservation Source</label>
                  <select
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value as BookingSource)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs"
                  >
                    <option value="manual">Concierge Walk-in (Cash)</option>
                    <option value="facebook">Facebook Page Chat</option>
                    <option value="google_maps">Google Maps Chat</option>
                  </select>
                </div>
              </div>

              {/* B. Date bounds */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
                    {formPathway === 'room' ? 'Check-in Date' : 'Event Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={formCheckIn}
                    onChange={(e) => setFormCheckIn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs font-mono"
                  />
                </div>
                {formPathway === 'room' && (
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Check-out Date</label>
                    <input
                      type="date"
                      required
                      value={formCheckOut}
                      onChange={(e) => setFormCheckOut(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs font-mono"
                    />
                  </div>
                )}
              </div>

              {/* C. Guest details */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-700">Entry Type:</span>
                  <div className="flex space-x-4">
                    <label className="inline-flex items-center space-x-2 text-xs cursor-pointer text-slate-700">
                      <input
                        type="radio"
                        checked={formStatus === 'confirmed'}
                        onChange={() => setFormStatus('confirmed')}
                        className="accent-[#B89251]"
                      />
                      <span>Active Reservation</span>
                    </label>
                    <label className="inline-flex items-center space-x-2 text-xs cursor-pointer text-slate-700">
                      <input
                        type="radio"
                        checked={formStatus === 'blocked'}
                        onChange={() => setFormStatus('blocked')}
                        className="accent-[#B89251]"
                      />
                      <span>Maintenance Block</span>
                    </label>
                  </div>
                </div>

                {formStatus === 'confirmed' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="col-span-1">
                        <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Guest Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="Maria Clara"
                          value={formGuestName}
                          onChange={(e) => setFormGuestName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Email</label>
                        <input
                          type="email"
                          required
                          placeholder="maria@rizal.ph"
                          value={formGuestEmail}
                          onChange={(e) => setFormGuestEmail(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Phone</label>
                        <input
                          type="text"
                          required
                          placeholder="0917-123-4567"
                          value={formGuestPhone}
                          onChange={(e) => setFormGuestPhone(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs"
                        />
                      </div>
                    </div>

                    {/* Venue Add-ons manual toggles */}
                    {formPathway === 'venue' && (
                      <div className="space-y-4 bg-slate-50 p-4 text-xs rounded-xl border border-slate-200">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-700 block">Venue Equipments & Add-ons</span>
                        
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div>
                            <span className="text-[8px] uppercase text-slate-500 block mb-1">Big Tables</span>
                            <input
                              type="number"
                              min="0"
                              value={formBigTable}
                              onChange={(e) => setFormBigTable(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-12 text-center bg-white border border-slate-200 text-slate-800 font-mono py-1 rounded-md focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#B89251]"
                            />
                          </div>
                          <div>
                            <span className="text-[8px] uppercase text-slate-500 block mb-1">Small Tables</span>
                            <input
                              type="number"
                              min="0"
                              value={formSmallTable}
                              onChange={(e) => setFormSmallTable(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-12 text-center bg-white border border-slate-200 text-slate-800 font-mono py-1 rounded-md focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#B89251]"
                            />
                          </div>
                          <div>
                            <span className="text-[8px] uppercase text-slate-500 block mb-1">Chairs</span>
                            <input
                              type="number"
                              min="0"
                              value={formChairs}
                              onChange={(e) => setFormChairs(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-12 text-center bg-white border border-slate-200 text-slate-800 font-mono py-1 rounded-md focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#B89251]"
                            />
                          </div>
                          <div>
                            <span className="text-[8px] uppercase text-slate-500 block mb-1">Water</span>
                            <input
                              type="number"
                              min="0"
                              value={formWater}
                              onChange={(e) => setFormWater(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-12 text-center bg-white border border-slate-200 text-slate-800 font-mono py-1 rounded-md focus:outline-none focus:border-[#B89251] focus:ring-1 focus:ring-[#B89251]"
                            />
                          </div>
                        </div>

                        <div className="flex space-x-4 pt-3 border-t border-slate-200">
                          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700">
                            <input type="checkbox" checked={formBand} onChange={(e) => setFormBand(e.target.checked)} className="accent-[#B89251]" />
                            <span>Band & Lights</span>
                          </label>
                          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700">
                            <input type="checkbox" checked={formStage} onChange={(e) => setFormStage(e.target.checked)} className="accent-[#B89251]" />
                            <span>Stage Setup</span>
                          </label>
                          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700">
                            <input type="checkbox" checked={formLedWall} onChange={(e) => setFormLedWall(e.target.checked)} className="accent-[#B89251]" />
                            <span>LED Wall</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="submit"
                  className="bg-[#B89251] hover:bg-[#9A783E] text-white font-bold uppercase tracking-wider text-xs px-6 py-3.5 rounded-lg transition-colors shadow-sm shadow-[#B89251]/20 w-full sm:w-auto"
                >
                  Create Calendar Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: Receipt slip verification */}
      {selectedReceiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md relative bg-white border border-slate-200 shadow-2xl p-6 rounded-2xl">
            <button onClick={() => setSelectedReceiptData(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3.5 mb-4">
              GCash Downpayment Slip Verification
            </h3>

            <div className="bg-slate-50 border border-slate-100 p-6 space-y-4 rounded-xl font-mono text-xs">
              <div className="text-center border-b border-slate-200 pb-3">
                <div className="text-[10px] uppercase font-bold tracking-wider text-[#B89251]">Payment Verified</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">₱ {(selectedReceiptData.downpayment_paid ?? 0).toLocaleString()} PHP</div>
                <div className="text-[10px] text-slate-400">Equivalent to 50% reservation policy</div>
              </div>
              <div className="space-y-1.5 text-[10px] text-slate-600">
                <div><span className="text-slate-400">Booking ID:</span> {selectedReceiptData.id}</div>
                <div><span className="text-slate-400">Guest:</span> {selectedReceiptData.guest_name}</div>
                <div><span className="text-slate-400">Stay check-in:</span> {selectedReceiptData.check_in}</div>
                <div><span className="text-slate-400">Gcash Reference:</span> 9988-7766-5544</div>
              </div>
              <div className="border-t border-slate-200 pt-3 text-center text-[9px] font-bold uppercase tracking-wider text-[#9A783E]">
                ✓ Settle ₱{(selectedReceiptData.balance_due ?? 0).toLocaleString()} PHP at check-in
              </div>
            </div>

            <button
              onClick={() => setSelectedReceiptData(null)}
              className="w-full mt-6 bg-[#B89251] hover:bg-[#9A783E] text-white font-bold uppercase tracking-wider text-xs py-3.5 rounded-lg transition-colors shadow-sm shadow-[#B89251]/20"
            >
              Close Receipt Proof
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
