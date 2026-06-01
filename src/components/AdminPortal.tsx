import React, { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBookings } from '../hooks/useBookings'
import { Room, Venue, Booking, SyncFeed, BookingSource, BreakfastOrder, EquipmentRental, EventAddons, GuestRecord } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { Calendar, User, Phone, Mail, Clock, RefreshCw, Key, Plus, Settings, ClipboardCheck, Trash2, CheckCircle2, AlertCircle, Sparkles, X, Eye, TrendingUp, Users, Home, LogIn, LogOut, Receipt, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react'

const ROOM_COLOR_SCHEMES: Record<string, { bg: string; text: string; border: string; badgeBg: string }> = {
  'room-1': { bg: 'bg-amber-50/70', text: 'text-amber-800', border: 'border-amber-200/50', badgeBg: 'bg-amber-200/50' },
  'room-2': { bg: 'bg-[#FDFBF7]', text: 'text-[#9A783E]', border: 'border-[#E5D5C0]/50', badgeBg: 'bg-[#E5D5C0]/50' },
  'room-3': { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200/50', badgeBg: 'bg-emerald-200/50' },
  'room-4': { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200/50', badgeBg: 'bg-blue-200/50' },
  'room-5': { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200/50', badgeBg: 'bg-rose-200/50' },
  'room-6': { bg: 'bg-violet-50', text: 'text-violet-850', border: 'border-violet-200/50', badgeBg: 'bg-violet-200/50' },
  'room-7': { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200/50', badgeBg: 'bg-teal-200/50' },
  'room-8': { bg: 'bg-sky-50', text: 'text-sky-850', border: 'border-sky-200/50', badgeBg: 'bg-sky-200/50' },
  'room-9': { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200/50', badgeBg: 'bg-orange-200/50' },
  'room-10': { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-300/50', badgeBg: 'bg-slate-300/50' },
}

const VENUE_COLOR_SCHEME = { bg: 'bg-fuchsia-50', text: 'text-fuchsia-800', border: 'border-fuchsia-200/50', badgeBg: 'bg-fuchsia-200/50' }

interface AdminPortalProps {
  onNavigateToGuest: () => void
}

export function AdminPortal({ onNavigateToGuest }: AdminPortalProps) {
  const queryClient = useQueryClient()
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
  const [activeTab, setActiveTab] = useState<'scheduler' | 'bookings' | 'loyalty' | 'channels'>('scheduler')

  // 2b. Usability & Revenue Management States
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [housekeepingStates, setHousekeepingStates] = useState<Record<string, 'Clean' | 'Dirty' | 'Inspected'>>(() => {
    try {
      const saved = localStorage.getItem('daweez_pms_housekeeping')
      return saved ? JSON.parse(saved) : {
        'room-1': 'Clean',
        'room-2': 'Clean',
        'room-3': 'Dirty',
        'room-4': 'Inspected',
        'room-5': 'Clean',
        'room-6': 'Clean',
        'room-7': 'Dirty',
        'room-8': 'Clean',
        'room-9': 'Clean',
        'room-10': 'Inspected'
      }
    } catch {
      return {}
    }
  })
  const [formStep, setFormStep] = useState<number>(1)
  const [applySuggestedRate, setApplySuggestedRate] = useState<boolean>(true)

  // 2c. Month Calendar & Filtering States
  const [schedulerMode, setSchedulerMode] = useState<'timeline' | 'month'>('month') // Default to Month view
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date())
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set())

  // Extension management modal states
  const [selectedExtendBooking, setSelectedExtendBooking] = useState<Booking | null>(null)
  const [extendCheckoutDate, setExtendCheckoutDate] = useState<string>('')
  const [extendError, setExtendError] = useState<string>('')

  // Populate all room IDs as selected by default when rooms are fetched
  useEffect(() => {
    if (rooms && rooms.length > 0 && selectedRoomIds.size === 0) {
      setSelectedRoomIds(new Set(rooms.map(r => r.id)))
    }
  }, [rooms])

  // 3. Date Scheduler Matrix Configs
  const [schedulerStartDate, setSchedulerStartDate] = useState<Date>(new Date())
  const [daysCount] = useState<number>(30)
  const [daysList, setDaysList] = useState<Date[]>([])

  // 4. Walk-in Booking Console State (Rooms & Venues)
  const [showManualForm, setShowManualForm] = useState<boolean>(false)
  const [formPathway, setFormPathway] = useState<'room' | 'venue'>('room')
  const [formRoomIds, setFormRoomIds] = useState<Set<string>>(new Set(['room-1']))
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

  // Trigger automatic seeding of future mock bookings (June to Dec) on admin login
  useEffect(() => {
    if (isAuthenticated) {
      syncEngine.seedFutureMockData().then((count) => {
        if (count > 0) {
          queryClient.invalidateQueries({ queryKey: ['bookings'] })
          console.log(`Successfully seeded ${count} future mock bookings for June to December 2026!`)
        }
      })
    }
  }, [isAuthenticated])

  const handleToggleHousekeeping = (roomId: string) => {
    const current = housekeepingStates[roomId] || 'Clean'
    const nextMap: Record<'Clean' | 'Dirty' | 'Inspected', 'Clean' | 'Dirty' | 'Inspected'> = {
      'Clean': 'Dirty',
      'Dirty': 'Inspected',
      'Inspected': 'Clean'
    }
    const next = nextMap[current]
    const updated = { ...housekeepingStates, [roomId]: next }
    setHousekeepingStates(updated)
    localStorage.setItem('daweez_pms_housekeeping', JSON.stringify(updated))
  }

  // Handle open manual booking form from cell click
  const handleCellClick = (roomId: string, date: Date) => {
    const formattedDate = date.toISOString().split('T')[0]
    const tomorrow = new Date(date)
    tomorrow.setDate(date.getDate() + 1)
    const formattedTomorrow = tomorrow.toISOString().split('T')[0]

    setFormPathway('room')
    setFormRoomIds(new Set([roomId]))
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

      // Calculate dynamic price multiplier based on occupancy
      let localMultiplier = 1.0
      if (applySuggestedRate) {
        if (roomOccupancyRate < 40) {
          localMultiplier = 0.90
        } else if (roomOccupancyRate >= 80) {
          localMultiplier = 1.15
        }
      }

      if (formPathway === 'room') {
        // Validate availability for all rooms before creating any bookings
        const unavailableRooms = Array.from(formRoomIds).filter(roomId => {
          return !syncEngine.isRoomAvailable(roomId, formCheckIn, formCheckOut, bookings)
        })
        if (unavailableRooms.length > 0) {
          const names = unavailableRooms.map(id => rooms.find(r => r.id === id)?.name || id).join(', ')
          setFormError(`Overlap collision! The following rooms are already booked or blocked: ${names}`)
          return
        }

        // Loop over the Set of room IDs and create booking sequentially
        for (const roomId of Array.from(formRoomIds)) {
          await createManualBooking({
            roomId,
            guestName: formGuestName,
            guestEmail: formGuestEmail,
            guestPhone: formGuestPhone,
            checkIn: formCheckIn,
            checkOut: formCheckOut,
            source: formSource,
            status: formStatus,
            breakfastOrders: breakfasts.length > 0 ? breakfasts : undefined,
            rateMultiplier: localMultiplier
          })
        }
      } else {
        await createManualBooking({
          venueId: formVenueId,
          guestName: formGuestName,
          guestEmail: formGuestEmail,
          guestPhone: formGuestPhone,
          checkIn: formCheckIn,
          checkOut: formCheckIn,
          source: formSource,
          status: formStatus,
          equipmentRentals: {
            bigTableCount: formBigTable,
            smallTableCount: formSmallTable,
            chairCount: formChairs,
            mineralWaterCount: formWater
          },
          eventAddons: {
            fullBandAndLights: formBand,
            stage: formStage,
            ledWall: formLedWall
          },
          rateMultiplier: localMultiplier
        })
      }

      setShowManualForm(false)
    } catch (err: any) {
      setFormError(err.message || 'Overlap collision occurred. Try again.')
    }
  }

  // Handle stay extension update
  const handleExtendStaySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setExtendError('')
    if (!selectedExtendBooking || !extendCheckoutDate) return

    try {
      const isAvail = syncEngine.isRoomAvailable(
        selectedExtendBooking.room_id!,
        selectedExtendBooking.check_in,
        extendCheckoutDate,
        bookings,
        selectedExtendBooking.id
      )

      if (!isAvail) {
        setExtendError('Overlap Collision! This room is already reserved or blocked during these dates.')
        return
      }

      // Calculate pricing
      const pricing = syncEngine.calculatePricing({
        roomId: selectedExtendBooking.room_id,
        checkIn: selectedExtendBooking.check_in,
        checkOut: extendCheckoutDate,
        guestEmail: selectedExtendBooking.guest_email,
        breakfastOrders: selectedExtendBooking.breakfast_orders,
        bookingsList: bookings
      })

      const current = await syncEngine.getBookings()
      const updated = current.map(b => {
        if (b.id === selectedExtendBooking.id) {
          return {
            ...b,
            check_out: extendCheckoutDate,
            balance_due: pricing.balanceDue
          }
        }
        return b
      })

      await syncEngine.saveBookings(updated)
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setSelectedExtendBooking(null)
      alert('Chamber stay has been successfully extended!')
    } catch (err: any) {
      setExtendError(err.message || 'Overlap collision occurred.')
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

  const getMonthGridDates = (baseDate: Date) => {
    const year = baseDate.getFullYear()
    const month = baseDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const startDayOfWeek = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const grid: (Date | null)[] = []

    // Prefix empty slots
    for (let i = 0; i < startDayOfWeek; i++) {
      grid.push(null)
    }

    // Month days
    for (let d = 1; d <= daysInMonth; d++) {
      grid.push(new Date(year, month, d))
    }

    // Suffix empty slots to make it perfect multiple of 7
    while (grid.length % 7 !== 0) {
      grid.push(null)
    }

    return grid
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
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#FDFBF7' }}>
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

  // ==========================================
  // DYNAMIC ESTIMATES FOR MANUAL WALK-IN WIZARD
  // ==========================================
  const currentOccupancy = roomOccupancyRate
  let rateStatus: 'low' | 'normal' | 'peak' = 'normal'
  let rateMultiplier = 1.0
  let rateRecommendationText = ''

  if (currentOccupancy < 40) {
    rateStatus = 'low'
    rateMultiplier = 0.90
    rateRecommendationText = 'Low occupancy (<40%). Suggesting a last-minute perishable rate adjustment of -10%.'
  } else if (currentOccupancy >= 80) {
    rateStatus = 'peak'
    rateMultiplier = 1.15
    rateRecommendationText = 'High demand / Peak occupancy (≥80%). Suggesting a dynamic peak surge adjustment of +15%.'
  } else {
    rateStatus = 'normal'
    rateMultiplier = 1.0
    rateRecommendationText = 'Normal demand levels. Standard baseline pricing applies.'
  }

  const baseRoomOrVenuePrice = formPathway === 'room'
    ? Array.from(formRoomIds).reduce((sum, id) => sum + (rooms.find(r => r.id === id)?.base_price ?? 0), 0)
    : (venues.find(v => v.id === formVenueId)?.base_price ?? 0)

  const estNights = formPathway === 'room' && formCheckIn && formCheckOut
    ? Math.max(1, Math.ceil((new Date(formCheckOut).getTime() - new Date(formCheckIn).getTime()) / (1000 * 60 * 60 * 24)))
    : 1

  const activeMultiplier = applySuggestedRate ? rateMultiplier : 1.0
  const estBase = baseRoomOrVenuePrice * estNights * activeMultiplier

  // Breakfast total estimate
  let estBreakfastTotal = 0
  if (formPathway === 'room') {
    Object.values(formBreakfastQty).forEach(qty => {
      estBreakfastTotal += 200 * qty
    })
  }

  // Equipment rental total estimate
  let estRentalsTotal = 0
  if (formPathway === 'venue') {
    estRentalsTotal += (formBigTable * 150)
    estRentalsTotal += (formSmallTable * 100)
    estRentalsTotal += (formChairs * 15)
    estRentalsTotal += (formWater * 35)
  }

  // Event add-ons estimate
  let estAddonsTotal = 0
  if (formPathway === 'venue') {
    if (formBand) estAddonsTotal += 2000
    if (formStage) estAddonsTotal += 2000
    if (formLedWall) estAddonsTotal += 5000
  }

  const estGrandTotal = estBase + estBreakfastTotal + estRentalsTotal + estAddonsTotal
  const estDownpayment = Math.round(estGrandTotal * 0.5)
  const estBalanceDue = (estGrandTotal - estDownpayment) + (formStatus === 'blocked' ? 0 : 500)

  return (
    <div className="min-h-screen pb-16 text-slate-800" style={{ background: '#F8FAFC' }}>

      {/* 1. Header Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40" style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
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
          {(['scheduler', 'bookings', 'loyalty', 'channels'] as const).map(tab => {
            const labels: Record<string, string> = {
              scheduler: 'Grid Scheduler',
              bookings: `Reservations (${bookings.length})`,
              loyalty: 'Guest Loyalty',
              channels: 'iCal Settings',
            }
            const isActive = activeTab === tab as any
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all duration-150 ${isActive
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
          {(activeTab as any) === 'pms' && (
            <div className="space-y-6">

              {/* Instant Search Bar */}
              <div className="bg-white rounded-xl border border-slate-200/70 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Quick search today's operations by guest name, room number, or venue..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-850 pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-[#B89251] font-semibold"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="text-right text-[10px] text-slate-400 font-medium">
                  Active Filter: <span className="text-[#9A783E] font-bold">{searchQuery ? `"${searchQuery}"` : 'None'}</span>
                </div>
              </div>

              {/* Analytics Meters */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Occupancy card */}
                <div className="bg-white rounded-xl border-t-[3px] border-t-[#B89251] border-x border-b border-slate-200/70 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 bg-[#FDFBF7] rounded-lg flex items-center justify-center border border-[#E5D5C0]/60">
                      <Home className="w-4 h-4 text-[#B89251]" />
                    </div>
                    {roomOccupancyRate >= 80 ? (
                      <span className="text-[8px] uppercase tracking-wider font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100 animate-pulse">
                        Peak Load
                      </span>
                    ) : roomOccupancyRate < 40 ? (
                      <span className="text-[8px] uppercase tracking-wider font-extrabold text-[#9A783E] bg-[#FDFBF7] px-2 py-0.5 rounded-full border border-[#E5D5C0]">
                        Low Load
                      </span>
                    ) : (
                      <span className="text-[8px] uppercase tracking-wider font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        Normal
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{roomOccupancyRate}%</div>
                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">Room Occupancy</div>

                  {/* Luxury Visual Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${roomOccupancyRate >= 80
                        ? 'bg-rose-500'
                        : roomOccupancyRate < 40
                          ? 'bg-[#B89251]'
                          : 'bg-emerald-500'
                        }`}
                      style={{ width: `${Math.min(100, Math.max(0, roomOccupancyRate))}%` }}
                    />
                  </div>
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

              {/* Rooms & Housekeeping Registry Panel */}
              <div className="bg-white border border-slate-200/70 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-[#FDFBF7] border border-[#E5D5C0]/60 rounded-md flex items-center justify-center">
                      <Settings className="w-3.5 h-3.5 text-[#B89251]" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Rooms & Housekeeping Registry</h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium italic">Click housekeeping badge to cycle status</span>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {rooms.map(room => {
                      const todayStr = new Date().toISOString().split('T')[0]
                      const activeBooking = bookings.find(b => b.room_id === room.id && b.status === 'confirmed' && todayStr >= b.check_in && todayStr < b.check_out)
                      const isOccupied = Boolean(activeBooking)
                      const cleanStatus = housekeepingStates[room.id] || 'Clean'

                      return (
                        <div key={room.id} className="p-3.5 bg-slate-50/50 border border-slate-200/60 hover:border-[#E5D5C0] rounded-xl transition-all duration-200 space-y-3">
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Suite {room.room_number}</span>
                            <span className="text-xs font-bold text-slate-900 block truncate" title={room.name}>{room.name}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${isOccupied
                              ? 'bg-amber-50 text-amber-850 border-amber-200/40'
                              : 'bg-slate-100 text-slate-500 border-slate-200/55'
                              }`}>
                              {isOccupied ? 'Occupied' : 'Vacant'}
                            </span>

                            <button
                              onClick={() => handleToggleHousekeeping(room.id)}
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center space-x-1 transition-all ${cleanStatus === 'Clean'
                                ? 'bg-emerald-50 text-emerald-750 border-emerald-200/40 hover:bg-emerald-100/50'
                                : cleanStatus === 'Dirty'
                                  ? 'bg-rose-50 text-rose-750 border-rose-200/40 hover:bg-rose-100/50 animate-pulse'
                                  : 'bg-amber-50 text-amber-750 border-amber-200/40 hover:bg-amber-100/50'
                                }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${cleanStatus === 'Clean' ? 'bg-emerald-500' : cleanStatus === 'Dirty' ? 'bg-rose-500' : 'bg-amber-500'
                                }`} />
                              <span>{cleanStatus}</span>
                            </button>
                          </div>
                          {isOccupied && activeBooking && (
                            <div className="text-[9px] text-slate-400 truncate font-medium">
                              Guest: {activeBooking.guest_name}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
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
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Arrivals Today ({arrivalsToday.filter(b => {
                        const term = searchQuery.toLowerCase()
                        if (!term) return true
                        const room = rooms.find(r => r.id === b.room_id)
                        const venue = venues.find(v => v.id === b.venue_id)
                        return b.guest_name.toLowerCase().includes(term) ||
                          (room && `room ${room.room_number}`.includes(term)) ||
                          (venue && venue.name.toLowerCase().includes(term))
                      }).length})
                    </h3>
                  </div>
                  <div className="p-5 space-y-3">

                    {arrivalsToday.filter(b => {
                      const term = searchQuery.toLowerCase()
                      if (!term) return true
                      const room = rooms.find(r => r.id === b.room_id)
                      const venue = venues.find(v => v.id === b.venue_id)
                      return b.guest_name.toLowerCase().includes(term) ||
                        (room && `room ${room.room_number}`.includes(term)) ||
                        (venue && venue.name.toLowerCase().includes(term))
                    }).length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4 text-center">
                        {searchQuery ? 'No matching arrivals found.' : 'No arrivals scheduled for today.'}
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {arrivalsToday.filter(b => {
                          const term = searchQuery.toLowerCase()
                          if (!term) return true
                          const room = rooms.find(r => r.id === b.room_id)
                          const venue = venues.find(v => v.id === b.venue_id)
                          return b.guest_name.toLowerCase().includes(term) ||
                            (room && `room ${room.room_number}`.includes(term)) ||
                            (venue && venue.name.toLowerCase().includes(term))
                        }).map(b => {
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
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Departures Today ({departuresToday.filter(b => {
                        const term = searchQuery.toLowerCase()
                        if (!term) return true
                        const room = rooms.find(r => r.id === b.room_id)
                        const venue = venues.find(v => v.id === b.venue_id)
                        return b.guest_name.toLowerCase().includes(term) ||
                          (room && `room ${room.room_number}`.includes(term)) ||
                          (venue && venue.name.toLowerCase().includes(term))
                      }).length})
                    </h3>
                  </div>
                  <div className="p-5 space-y-3">

                    {departuresToday.filter(b => {
                      const term = searchQuery.toLowerCase()
                      if (!term) return true
                      const room = rooms.find(r => r.id === b.room_id)
                      const venue = venues.find(v => v.id === b.venue_id)
                      return b.guest_name.toLowerCase().includes(term) ||
                        (room && `room ${room.room_number}`.includes(term)) ||
                        (venue && venue.name.toLowerCase().includes(term))
                    }).length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4 text-center">
                        {searchQuery ? 'No matching departures found.' : 'No departures scheduled for today.'}
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {departuresToday.filter(b => {
                          const term = searchQuery.toLowerCase()
                          if (!term) return true
                          const room = rooms.find(r => r.id === b.room_id)
                          const venue = venues.find(v => v.id === b.venue_id)
                          return b.guest_name.toLowerCase().includes(term) ||
                            (room && `room ${room.room_number}`.includes(term)) ||
                            (venue && venue.name.toLowerCase().includes(term))
                        }).map(b => {
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
              <div className="bg-[#B89251] rounded-xl p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" style={{ background: 'linear-gradient(135deg, #9A783E 0%, #B89251 100%)' }}>
                <div>
                  <h4 className="text-sm font-bold text-white">Resort Walk-In Booking Console</h4>
                  <p className="text-xs text-[#FDFBF7]/80 mt-1 max-w-sm">
                    Create manual room blocks, event gazebo rentals, and walk-in cash payments.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setFormPathway('room')
                    setFormRoomIds(new Set(['room-1']))
                    setFormCheckIn('')
                    setFormCheckOut('')
                    setFormGuestName('')
                    setFormGuestEmail('')
                    setFormGuestPhone('')
                    setFormSource('manual')
                    setFormStatus('confirmed')
                    setFormBreakfastQty({ Bangsilog: 0, Lumpiasilog: 0, Cornsilog: 0, Hotsilog: 0 })
                    setFormStep(1)
                    setApplySuggestedRate(true)
                    setFormError('')
                    setShowManualForm(true)
                  }}
                  className="shrink-0 bg-white text-[#9A783E] hover:bg-[#FDFBF7] font-bold text-xs px-5 py-2.5 rounded-lg transition-colors shadow-sm"
                >
                  + Walk-In Booking
                </button>
              </div>

            </div>
          )}

          {/* TAB B: INTERACTIVE GRID & MONTH SCHEDULER */}
          {activeTab === 'scheduler' && (
            <div className="space-y-6">

              {/* Scheduler Controls and View Toggles */}
              <div className="bg-white border border-slate-200/80 shadow-sm rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
                  <div className="flex p-0.5 bg-slate-100 border border-slate-200/60 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                    <button
                      onClick={() => setSchedulerMode('month')}
                      className={`px-4 py-2.5 rounded-lg transition-all duration-200 ${schedulerMode === 'month'
                        ? 'bg-[#B89251] text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                      Month Calendar
                    </button>
                    <button
                      onClick={() => setSchedulerMode('timeline')}
                      className={`px-4 py-2.5 rounded-lg transition-all duration-200 ${schedulerMode === 'timeline'
                        ? 'bg-[#B89251] text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                      Grid Timeline
                    </button>
                  </div>

                  {schedulerMode === 'month' && (
                    <div className="flex items-center space-x-1.5 ml-4">
                      <button
                        onClick={() => {
                          const prev = new Date(currentMonthDate)
                          prev.setMonth(currentMonthDate.getMonth() - 1)
                          setCurrentMonthDate(prev)
                        }}
                        className="p-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-slate-850 px-2 min-w-[100px] text-center uppercase tracking-wider">
                        {currentMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                      <button
                        onClick={() => {
                          const next = new Date(currentMonthDate)
                          next.setMonth(currentMonthDate.getMonth() + 1)
                          setCurrentMonthDate(next)
                        }}
                        className="p-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentMonthDate(new Date())}
                        className="text-[9px] font-extrabold uppercase tracking-wider text-[#9A783E] border border-[#E5D5C0] bg-[#FDFBF7] hover:bg-[#B89251] hover:text-white px-2.5 py-1.5 rounded-lg ml-2 transition-all"
                      >
                        This Month
                      </button>
                    </div>
                  )}

                  {schedulerMode === 'timeline' && (
                    <div className="flex items-center space-x-3 ml-4">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Start Date:</span>
                      <input
                        type="date"
                        value={schedulerStartDate.toISOString().split('T')[0]}
                        onChange={(e) => setSchedulerStartDate(new Date(e.target.value))}
                        className="bg-white border border-slate-200 text-slate-850 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs font-semibold"
                      />
                      <button
                        onClick={() => setSchedulerStartDate(new Date())}
                        className="text-[9px] border border-[#E5D5C0] bg-[#FDFBF7] text-[#9A783E] hover:bg-[#B89251] hover:text-white hover:border-[#B89251] px-3 py-1.5 rounded-lg transition-all duration-200 uppercase font-semibold"
                      >
                        Today
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setFormPathway('room')
                    setFormRoomIds(new Set(['room-1']))
                    setFormCheckIn('')
                    setFormCheckOut('')
                    setFormGuestName('')
                    setFormGuestEmail('')
                    setFormGuestPhone('')
                    setFormSource('manual')
                    setFormStatus('confirmed')
                    setFormBreakfastQty({ Bangsilog: 0, Lumpiasilog: 0, Cornsilog: 0, Hotsilog: 0 })
                    setFormError('')
                    setFormStep(1)
                    setShowManualForm(true)
                  }}
                  className="bg-[#B89251] pl-2 pr-2 hover:bg-[#9A783E] justify-center text-white font-bold uppercase tracking-wider text-[10px] px-4.5 py-2.5 rounded-lg transition-colors flex items-center space-x-1.5 shadow-sm shadow-[#B89251]/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Walk-in Booking</span>
                </button>
              </div>

              {/* MONTH CALENDAR VIEW */}
              {schedulerMode === 'month' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                  {/* Left Column: Interactive Room Multi-Filters */}
                  <div className="lg:col-span-1 bg-white border border-slate-200/80 shadow-sm rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                        <Filter className="w-4 h-4 text-[#B89251]" />
                        <span>Filter Suites</span>
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold font-mono">
                        {selectedRoomIds.size} / {rooms.length} Checked
                      </span>
                    </div>

                    <div className="flex space-x-2 text-[9px] uppercase tracking-wider font-extrabold pb-1">
                      <button
                        onClick={() => setSelectedRoomIds(new Set(rooms.map(r => r.id)))}
                        className="flex-1 bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 py-1.5 rounded-md transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => setSelectedRoomIds(new Set())}
                        className="flex-1 bg-slate-50 border border-slate-200 text-rose-600 hover:text-rose-700 py-1.5 rounded-md transition-colors"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {rooms.map(room => {
                        const isChecked = selectedRoomIds.has(room.id)
                        const scheme = ROOM_COLOR_SCHEMES[room.id] || { badgeBg: 'bg-slate-150', text: 'text-slate-700' }
                        return (
                          <label
                            key={room.id}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${isChecked
                              ? 'bg-[#FDFBF7]/40 border-[#E5D5C0] hover:bg-[#FDFBF7]/60'
                              : 'bg-slate-50/50 border-slate-200 text-slate-400 hover:bg-slate-50'
                              }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  const next = new Set(selectedRoomIds)
                                  if (next.has(room.id)) {
                                    next.delete(room.id)
                                  } else {
                                    next.add(room.id)
                                  }
                                  setSelectedRoomIds(next)
                                }}
                                className="accent-[#B89251] w-4 h-4 rounded"
                              />
                              <span className="font-bold text-slate-800">Suite {room.room_number}</span>
                            </div>
                            <span className={`text-[8px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${scheme.badgeBg} ${scheme.text}`}>
                              {room.name.split(' ')[0]}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* Right Column: Month Calendar Grid */}
                  <div className="lg:col-span-3 bg-white border border-slate-200/80 shadow-md rounded-xl p-5 overflow-hidden">

                    {/* Calendar Grid Header */}
                    <div className="grid grid-cols-7 text-center border-b border-slate-150 pb-2 text-[9px] uppercase tracking-wider font-extrabold text-slate-400">
                      <div>Sun</div>
                      <div>Mon</div>
                      <div>Tue</div>
                      <div>Wed</div>
                      <div>Thu</div>
                      <div>Fri</div>
                      <div>Sat</div>
                    </div>

                    {/* Days Blocks */}
                    <div className="grid grid-cols-7 gap-1.5 mt-2">
                      {(() => {
                        const gridDates = getMonthGridDates(currentMonthDate)
                        return gridDates.map((date, idx) => {
                          if (!date) {
                            return (
                              <div key={idx} className="bg-slate-50/30 border border-slate-100 rounded-lg min-h-[90px] opacity-40" />
                            )
                          }

                          const formattedDate = date.toISOString().split('T')[0]
                          const isToday = date.toDateString() === new Date().toDateString()
                          const dayBookings = bookings.filter(b => {
                            const start = b.check_in
                            const end = b.check_out

                            // Check multi-filter
                            if (b.room_id && !selectedRoomIds.has(b.room_id)) {
                              return false
                            }

                            if (b.room_id) {
                              return formattedDate >= start && formattedDate < end
                            }
                            if (b.venue_id && b.check_in === formattedDate) {
                              return true
                            }
                            return false
                          })

                          return (
                            <div
                              key={idx}
                              className={`group min-h-[95px] p-1.5 border rounded-lg flex flex-col justify-between transition-all duration-200 relative ${isToday
                                ? 'bg-[#FDFBF7] border-[#B89251] shadow-inner'
                                : 'bg-white border-slate-200/60 hover:bg-slate-50/30 hover:border-slate-300'
                                }`}
                            >
                              {/* Day Header Row */}
                              <div className="flex items-center justify-between mb-1.5">
                                <span className={`text-[10px] font-mono font-bold ${isToday ? 'bg-[#B89251] text-white w-5 h-5 flex items-center justify-center rounded-full shadow-sm' : 'text-slate-500'
                                  }`}>
                                  {date.getDate()}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormPathway('room')
                                    setFormRoomIds(new Set([rooms[0]?.id || 'room-1']))
                                    setFormCheckIn(formattedDate)
                                    const nextD = new Date(date)
                                    nextD.setDate(date.getDate() + 1)
                                    setFormCheckOut(nextD.toISOString().split('T')[0])
                                    setFormGuestName('')
                                    setFormGuestEmail('')
                                    setFormGuestPhone('')
                                    setFormSource('manual')
                                    setFormStatus('confirmed')
                                    setFormBreakfastQty({ Bangsilog: 0, Lumpiasilog: 0, Cornsilog: 0, Hotsilog: 0 })
                                    setFormStep(1)
                                    setFormError('')
                                    setShowManualForm(true)
                                  }}
                                  className="opacity-0 group-hover:opacity-100 w-4.5 h-4.5 bg-slate-100 text-slate-500 hover:bg-[#B89251] hover:text-white rounded flex items-center justify-center transition-all duration-150 text-[10px]"
                                  title="Add Booking"
                                >
                                  +
                                </button>
                              </div>

                              {/* Booking List inside day square */}
                              <div className="space-y-1 overflow-y-auto max-h-[70px] flex-1">
                                {dayBookings.slice(0, 3).map(b => {
                                  const room = rooms.find(r => r.id === b.room_id)
                                  const scheme = b.room_id
                                    ? ROOM_COLOR_SCHEMES[b.room_id] || { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200' }
                                    : VENUE_COLOR_SCHEME

                                  return (
                                    <div
                                      key={b.id}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (b.status !== 'blocked') {
                                          setSelectedExtendBooking(b)
                                          setExtendCheckoutDate(b.check_out)
                                          setExtendError('')
                                        }
                                      }}
                                      className={`text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded border leading-tight truncate cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-sm ${scheme.bg} ${scheme.text} ${scheme.border}`}
                                      title={`${room ? `Suite ${room.room_number}` : 'Venue'} - ${b.guest_name}`}
                                    >
                                      {room ? `S-${room.room_number}` : 'VN'} · {b.guest_name.split(' ')[0]}
                                    </div>
                                  )
                                })}

                                {dayBookings.length > 3 && (
                                  <div className="text-[7px] text-slate-400 font-extrabold uppercase text-center py-0.5 bg-slate-50 border border-slate-100 rounded leading-none">
                                    + {dayBookings.length - 3} more
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* TIMELINE GRID VIEW */}
              {schedulerMode === 'timeline' && (
                <div className="bg-white border border-slate-200/80 shadow-md overflow-hidden rounded-xl">
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
                              const formattedStr = day.toISOString().split('T')[0]
                              const roomList = bookings.filter(b => b.room_id === room.id)
                              const booking = roomList.find(b => formattedStr >= b.check_in && formattedStr < b.check_out)

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

              {/* INLINE DETAILS & STAY EXTENSION DRAWER */}
              {selectedExtendBooking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm">
                  <div className="w-full max-w-md relative bg-white border border-slate-200 shadow-2xl p-6 rounded-2xl">
                    <button
                      onClick={() => setSelectedExtendBooking(null)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="border-b border-slate-100 pb-3 mb-4">
                      <span className="text-[8px] uppercase tracking-wider text-[#9A783E] font-bold block">Reservation Detailer</span>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        {selectedExtendBooking.guest_name}
                      </h3>
                    </div>

                    <div className="space-y-4 text-xs font-medium">
                      {extendError && (
                        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-[10px] flex items-center space-x-2 rounded-lg">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{extendError}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200/50 rounded-xl">
                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-bold">Chamber Suite</span>
                          <span className="text-slate-800 font-bold">
                            {rooms.find(r => r.id === selectedExtendBooking.room_id)?.name || 'Event Venue'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-bold">Booking Source</span>
                          <span className="text-slate-800 font-bold uppercase">{selectedExtendBooking.source}</span>
                        </div>
                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-bold">Phone Number</span>
                          <span className="text-slate-800 font-mono font-bold">{selectedExtendBooking.guest_phone}</span>
                        </div>
                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-bold">Email Address</span>
                          <span className="text-slate-850 truncate block font-bold" title={selectedExtendBooking.guest_email}>
                            {selectedExtendBooking.guest_email}
                          </span>
                        </div>
                      </div>

                      {/* Stay Extension Form */}
                      <form onSubmit={handleExtendStaySubmit} className="space-y-3.5 border-t border-slate-100 pt-4">
                        <span className="text-[9px] uppercase tracking-wider text-[#9A783E] font-bold block mb-1">
                          Extend Stay Duration
                        </span>

                        <div className="grid grid-cols-2 gap-3 items-center">
                          <div>
                            <span className="text-[8px] uppercase text-slate-400 block font-bold">Check-in Reference</span>
                            <input
                              type="date"
                              readOnly
                              value={selectedExtendBooking.check_in}
                              className="w-full bg-slate-100 border border-slate-200 text-slate-500 px-3 py-2 rounded-lg text-xs font-mono font-bold outline-none cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <span className="text-[8px] uppercase text-[#B89251] block font-bold">Extend Checkout Date</span>
                            <input
                              type="date"
                              required
                              min={selectedExtendBooking.check_in}
                              value={extendCheckoutDate}
                              onChange={(e) => setExtendCheckoutDate(e.target.value)}
                              className="w-full bg-white border border-slate-200 text-slate-850 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs font-mono font-bold"
                            />
                          </div>
                        </div>

                        {/* Stay extension cost dynamic feedback */}
                        {extendCheckoutDate && extendCheckoutDate !== selectedExtendBooking.check_out && (
                          <div className="p-3.5 bg-[#FDFBF7] border border-[#E5D5C0] rounded-xl text-[10px] space-y-1.5 leading-relaxed text-[#9A783E] font-bold">
                            <span className="uppercase text-[8px] tracking-wider block font-extrabold">Proposed Extension Summary</span>
                            <div className="flex justify-between">
                              <span>Nights extended:</span>
                              <span className="font-mono">
                                {Math.max(
                                  0,
                                  Math.ceil(
                                    (new Date(extendCheckoutDate).getTime() - new Date(selectedExtendBooking.check_out).getTime()) /
                                    (1000 * 60 * 60 * 24)
                                  )
                                )}{' '}
                                additional night(s)
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-800">
                              <span>Updated Balance Due:</span>
                              <span className="font-mono">
                                ₱
                                {(() => {
                                  try {
                                    const pricing = syncEngine.calculatePricing({
                                      roomId: selectedExtendBooking.room_id,
                                      checkIn: selectedExtendBooking.check_in,
                                      checkOut: extendCheckoutDate,
                                      guestEmail: selectedExtendBooking.guest_email,
                                      breakfastOrders: selectedExtendBooking.breakfast_orders,
                                      bookingsList: bookings
                                    })
                                    return pricing.balanceDue.toLocaleString()
                                  } catch {
                                    return '0'
                                  }
                                })()}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex space-x-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setSelectedExtendBooking(null)}
                            className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px] py-3 rounded-lg border border-slate-200 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={extendCheckoutDate === selectedExtendBooking.check_out}
                            className="flex-1 bg-[#B89251] hover:bg-[#9A783E] disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold uppercase tracking-wider text-[10px] py-3 rounded-lg transition-colors shadow-sm shadow-[#B89251]/10"
                          >
                            ✓ Save Extension
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}

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
                          <th className="py-3 px-4">Resort Room/Venue</th>
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
                                <span className={`px-2 py-1 uppercase text-[9px] tracking-wider font-semibold rounded-md border ${isSync ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-[#9A783E] bg-[#FDFBF7] border-[#E5D5C0]'
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
            <button
              type="button"
              onClick={() => setShowManualForm(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-100 pb-3 mb-5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Resort Walk-In Booking Console
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Wizard-guided manual entry & revenue optimizer</p>
            </div>

            {/* Stepper indicators */}
            <div className="flex items-center justify-between px-6 mb-6">
              {[
                { step: 1, label: 'Stay & Price' },
                { step: 2, label: 'Guest Profile' },
                { step: 3, label: 'Add-ons & Invoice' }
              ].map((s, idx) => {
                const isActive = formStep === s.step
                const isCompleted = formStep > s.step
                return (
                  <React.Fragment key={s.step}>
                    {idx > 0 && (
                      <div className={`flex-1 h-0.5 mx-2 ${formStep > idx ? 'bg-[#B89251]' : 'bg-slate-100'}`} />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        // Let them jump backward only, or forward if validated
                        if (s.step < formStep) {
                          setFormStep(s.step)
                        }
                      }}
                      className="flex flex-col items-center focus:outline-none"
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${isActive
                        ? 'bg-[#B89251] border-[#B89251] text-white ring-4 ring-[#B89251]/10'
                        : isCompleted
                          ? 'bg-[#FDFBF7] border-[#B89251] text-[#9A783E]'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}>
                        {s.step}
                      </div>
                      <span className={`text-[8px] font-bold uppercase tracking-wider mt-1.5 whitespace-nowrap ${isActive ? 'text-[#9A783E]' : 'text-slate-400'
                        }`}>
                        {s.label}
                      </span>
                    </button>
                  </React.Fragment>
                )
              })}
            </div>

            <form onSubmit={handleManualBookingSubmit} className="space-y-5">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center space-x-2 rounded-lg animate-pulse">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* STEP 1: Dates & Dynamic Revenue Pricing Recommendation */}
              {formStep === 1 && (
                <div className="space-y-4">
                  {/* Pathway toggles Room vs Venue manually */}
                  <div className="flex p-1 text-[9px] uppercase font-bold tracking-wider bg-slate-100 border border-slate-200 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setFormPathway('room')
                        setFormRoomIds(new Set([rooms[0]?.id || 'room-1']))
                      }}
                      className={`flex-1 py-2 text-center transition-all duration-200 rounded-lg ${formPathway === 'room' ? 'bg-[#B89251] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      Book a Room
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormPathway('venue')
                        setFormVenueId(venues[0]?.id || 'venue-gazebo')
                      }}
                      className={`flex-1 py-2 text-center transition-all duration-200 rounded-lg ${formPathway === 'venue' ? 'bg-[#B89251] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      Rent Event Venue
                    </button>
                  </div>

                  {/* Visual Interactive Room/Venue Selector Cards Grid */}
                  <div className="space-y-2">
                    <label className="block text-[8px] uppercase tracking-wider text-slate-500 font-extrabold">
                      {formPathway === 'room' ? 'Select Suite / Room' : 'Select Event Venue'}
                    </label>

                    {formPathway === 'room' ? (
                      <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto p-1 bg-slate-50/50 rounded-xl border border-slate-200/60 scrollbar-thin">
                        {rooms.map(room => {
                          const isSelected = formRoomIds.has(room.id)
                          return (
                            <div
                              key={room.id}
                              onClick={() => {
                                const next = new Set(formRoomIds)
                                if (next.has(room.id)) {
                                  if (next.size > 1) {
                                    next.delete(room.id)
                                  }
                                } else {
                                  next.add(room.id)
                                }
                                setFormRoomIds(next)
                              }}
                              className={`p-2.5 rounded-xl border cursor-pointer select-none transition-all flex flex-col justify-between text-left space-y-1.5 ${isSelected
                                ? 'bg-[#FDFBF7] border-[#B89251] ring-2 ring-[#B89251]/10 shadow-sm'
                                : 'bg-white border-slate-200/80 text-slate-500 hover:border-slate-300 hover:bg-slate-50/30'
                                }`}
                            >
                              <div className="flex justify-between items-start">
                                <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${isSelected ? 'bg-[#E5D5C0]/50 text-[#9A783E]' : 'bg-slate-100 text-slate-400'
                                  }`}>
                                  Suite {room.room_number}
                                </span>
                                {isSelected && (
                                  <span className="text-[#B89251] text-xs font-bold font-sans">✓</span>
                                )}
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-800 block truncate leading-none mb-0.5">{room.name}</span>
                                <span className="text-[9px] font-bold text-[#9A783E] block leading-none font-mono">₱{room.base_price.toLocaleString()}/night</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 p-1 bg-slate-50/50 rounded-xl border border-slate-200/60">
                        {venues.map(v => {
                          const isSelected = formVenueId === v.id
                          return (
                            <div
                              key={v.id}
                              onClick={() => setFormVenueId(v.id)}
                              className={`p-2.5 rounded-xl border cursor-pointer select-none transition-all flex flex-col justify-between text-left space-y-1.5 ${isSelected
                                ? 'bg-[#FDFBF7] border-[#B89251] ring-2 ring-[#B89251]/10 shadow-sm'
                                : 'bg-white border-slate-200/80 text-slate-500 hover:border-slate-300 hover:bg-slate-50/30'
                                }`}
                            >
                              <div className="flex justify-between items-start">
                                <span className="opacity-0">.</span>
                                {isSelected && (
                                  <span className="text-[#B89251] text-xs font-bold">✓</span>
                                )}
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-800 block truncate leading-none mb-0.5">{v.name}</span>
                                <span className="text-[9px] font-bold text-[#9A783E] block leading-none font-mono">₱{v.base_price.toLocaleString()}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Reservation Source</label>
                      <select
                        value={formSource}
                        onChange={(e) => setFormSource(e.target.value as BookingSource)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs font-semibold"
                      >
                        <option value="manual">Concierge Walk-in (Cash)</option>
                        <option value="facebook">Facebook Page Chat</option>
                        <option value="google_maps">Google Maps Chat</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
                        {formPathway === 'room' ? 'Check-in Date' : 'Event Date'}
                      </label>
                      <input
                        type="date"
                        required
                        value={formCheckIn}
                        onChange={(e) => setFormCheckIn(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs font-mono font-semibold"
                      />
                    </div>
                    {formPathway === 'room' && (
                      <div>
                        <label className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Check-out Date</label>
                        <input
                          type="date"
                          required
                          value={formCheckOut}
                          onChange={(e) => setFormCheckOut(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs font-mono font-semibold"
                        />
                      </div>
                    )}
                  </div>

                  {/* Revenue Optimizer Suggestion Panel */}
                  <div className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2.5 transition-all ${roomOccupancyRate < 40
                    ? 'bg-amber-50/50 border-amber-200/60 text-amber-900'
                    : roomOccupancyRate >= 80
                      ? 'bg-rose-50/50 border-rose-200/60 text-rose-900'
                      : 'bg-[#FDFBF7] border-[#E5D5C0]/85 text-slate-800'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 font-bold uppercase tracking-wider text-[9px]">
                        <Sparkles className={`w-4 h-4 ${roomOccupancyRate >= 80 ? 'text-rose-500' : 'text-[#B89251]'}`} />
                        <span>Dynamic Revenue Optimizer suggestion</span>
                      </div>
                      <span className="text-[8px] font-bold bg-[#FDFBF7]/80 border border-[#E5D5C0]/60 text-[#9A783E] px-2 py-0.5 rounded-full">
                        Occupancy: {roomOccupancyRate}%
                      </span>
                    </div>

                    <p className="text-[10px] leading-relaxed text-slate-500 font-medium">
                      {roomOccupancyRate < 40
                        ? 'Low occupancy (<40%) detected today. Suggesting a last-minute perishable rate adjustment of -10% to fill vacant rooms and cover fixed costs.'
                        : roomOccupancyRate >= 80
                          ? 'High demand / Peak occupancy (≥80%) detected today. Suggesting a dynamic peak demand rate adjustment of +15% to capture maximum margin.'
                          : 'Normal occupancy load levels detected. Standard baseline reference pricing applies.'
                      }
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-2">
                      <label className="inline-flex items-center space-x-2 text-[10px] text-slate-700 cursor-pointer font-bold select-none">
                        <input
                          type="checkbox"
                          checked={applySuggestedRate}
                          onChange={(e) => setApplySuggestedRate(e.target.checked)}
                          className="accent-[#B89251] w-3.5 h-3.5"
                        />
                        <span>Apply optimization recommendation</span>
                      </label>
                      <div className="text-[10px] font-bold text-slate-900">
                        Suggest: <span className="text-[#9A783E] font-mono">
                          ₱{(roomOccupancyRate < 40
                            ? Math.round(baseRoomOrVenuePrice * 0.90)
                            : roomOccupancyRate >= 80
                              ? Math.round(baseRoomOrVenuePrice * 1.15)
                              : baseRoomOrVenuePrice
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3">
                    <button
                      type="button"
                      disabled={!formCheckIn || (formPathway === 'room' && !formCheckOut)}
                      onClick={() => setFormStep(2)}
                      className="bg-[#B89251] hover:bg-[#9A783E] disabled:bg-slate-150 disabled:text-slate-400 text-white font-bold uppercase tracking-wider text-[10px] px-5 py-2.5 rounded-lg transition-colors shadow-sm"
                    >
                      Next: Guest Info →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Guest Details & Stay Category */}
              {formStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200/50 mb-3">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-600">Console Block Type:</span>
                    <div className="flex space-x-4">
                      <label className="inline-flex items-center space-x-1.5 text-xs cursor-pointer text-slate-700 font-semibold">
                        <input
                          type="radio"
                          checked={formStatus === 'confirmed'}
                          onChange={() => setFormStatus('confirmed')}
                          className="accent-[#B89251]"
                        />
                        <span>Active Booking</span>
                      </label>
                      <label className="inline-flex items-center space-x-1.5 text-xs cursor-pointer text-slate-700 font-semibold">
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

                  {formStatus === 'blocked' ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs leading-relaxed text-slate-500 font-medium">
                      <p className="font-bold text-slate-800">🛠️ Maintenance / Calendar Block Mode</p>
                      <p>
                        This will completely block off the chamber/venue calendar for housekeeping, repairs, or private closures. Guest information is omitted.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="space-y-1">
                        <label className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Guest Full Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            required
                            placeholder="Maria Clara"
                            value={formGuestName}
                            onChange={(e) => setFormGuestName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-850 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs font-semibold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Email Address</label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="email"
                              required
                              placeholder="maria@rizal.ph"
                              value={formGuestEmail}
                              onChange={(e) => setFormGuestEmail(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 text-slate-850 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs font-semibold"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Mobile Phone</label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              required
                              placeholder="0917-123-4567"
                              value={formGuestPhone}
                              onChange={(e) => setFormGuestPhone(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 text-slate-855 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B89251]/20 focus:border-[#B89251] text-xs font-semibold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setFormStep(1)}
                      className="text-[10px] text-slate-500 hover:text-slate-700 font-bold uppercase tracking-wider"
                    >
                      ← Back
                    </button>
                    {formStatus === 'blocked' ? (
                      <button
                        type="submit"
                        className="bg-slate-700 hover:bg-slate-800 text-white font-bold uppercase tracking-wider text-[10px] px-6 py-2.5 rounded-lg transition-colors shadow-sm"
                      >
                        Create Calendar Block
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!formGuestName && formStatus === 'confirmed'}
                        onClick={() => setFormStep(3)}
                        className="bg-[#B89251] hover:bg-[#9A783E] disabled:bg-slate-150 disabled:text-slate-400 text-white font-bold uppercase tracking-wider text-[10px] px-5 py-2.5 rounded-lg transition-colors shadow-sm"
                      >
                        Next: Add-ons & Receipt →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: Add-ons & Live Billing Summary */}
              {formStep === 3 && (
                <div className="space-y-4">

                  {/* Chamber Add-ons (Breakfasts) */}
                  {formPathway === 'room' && (
                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-[#9A783E] block mb-1 flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Optional Gourmet Breakfast Selections (₱200/set)</span>
                      </span>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {Object.keys(formBreakfastQty).map((meal) => (
                          <div key={meal} className="flex items-center justify-between bg-white border border-slate-100 p-2 rounded-lg">
                            <span className="font-semibold text-slate-700">{meal}</span>
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => setFormBreakfastQty(prev => ({ ...prev, [meal]: Math.max(0, prev[meal] - 1) }))}
                                className="w-5 h-5 bg-slate-100 rounded flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200"
                              >
                                -
                              </button>
                              <span className="font-mono font-bold w-4 text-center">{formBreakfastQty[meal]}</span>
                              <button
                                type="button"
                                onClick={() => setFormBreakfastQty(prev => ({ ...prev, [meal]: prev[meal] + 1 }))}
                                className="w-5 h-5 bg-slate-100 rounded flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Venue Add-ons & Rentals */}
                  {formPathway === 'venue' && (
                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-[#9A783E] block mb-1">
                        Venue Equipments & Add-ons (Optional)
                      </span>

                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="bg-white border border-slate-100 p-2 rounded-lg">
                          <span className="text-[8px] uppercase text-slate-400 block mb-1 font-bold">Big Table</span>
                          <input
                            type="number"
                            min="0"
                            value={formBigTable}
                            onChange={(e) => setFormBigTable(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-10 text-center bg-slate-50 border border-slate-200 text-slate-800 font-mono py-0.5 rounded focus:outline-none focus:border-[#B89251] font-bold"
                          />
                          <span className="text-[7px] text-slate-400 block mt-1">₱150/pc</span>
                        </div>
                        <div className="bg-white border border-slate-100 p-2 rounded-lg">
                          <span className="text-[8px] uppercase text-slate-400 block mb-1 font-bold">Sm Table</span>
                          <input
                            type="number"
                            min="0"
                            value={formSmallTable}
                            onChange={(e) => setFormSmallTable(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-10 text-center bg-slate-50 border border-slate-200 text-slate-800 font-mono py-0.5 rounded focus:outline-none focus:border-[#B89251] font-bold"
                          />
                          <span className="text-[7px] text-slate-400 block mt-1">₱100/pc</span>
                        </div>
                        <div className="bg-white border border-slate-100 p-2 rounded-lg">
                          <span className="text-[8px] uppercase text-slate-400 block mb-1 font-bold">Chairs</span>
                          <input
                            type="number"
                            min="0"
                            value={formChairs}
                            onChange={(e) => setFormChairs(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-10 text-center bg-slate-50 border border-slate-200 text-slate-800 font-mono py-0.5 rounded focus:outline-none focus:border-[#B89251] font-bold"
                          />
                          <span className="text-[7px] text-slate-400 block mt-1">₱15/pc</span>
                        </div>
                        <div className="bg-white border border-slate-100 p-2 rounded-lg">
                          <span className="text-[8px] uppercase text-slate-400 block mb-1 font-bold">Water Disp</span>
                          <input
                            type="number"
                            min="0"
                            value={formWater}
                            onChange={(e) => setFormWater(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-10 text-center bg-slate-50 border border-slate-200 text-slate-800 font-mono py-0.5 rounded focus:outline-none focus:border-[#B89251] font-bold"
                          />
                          <span className="text-[7px] text-slate-400 block mt-1">₱35/pc</span>
                        </div>
                      </div>

                      <div className="flex justify-around pt-2.5 border-t border-slate-200/40 text-xs">
                        <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700 font-bold">
                          <input type="checkbox" checked={formBand} onChange={(e) => setFormBand(e.target.checked)} className="accent-[#B89251]" />
                          <span>Band & Lights (₱2,000)</span>
                        </label>
                        <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700 font-bold">
                          <input type="checkbox" checked={formStage} onChange={(e) => setFormStage(e.target.checked)} className="accent-[#B89251]" />
                          <span>Stage Setup (₱2,000)</span>
                        </label>
                        <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700 font-bold">
                          <input type="checkbox" checked={formLedWall} onChange={(e) => setFormLedWall(e.target.checked)} className="accent-[#B89251]" />
                          <span>LED Wall (₱5,000)</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Real-time Dynamic Invoice Receipt Slip */}
                  <div className="bg-slate-900 text-[#FDFBF7] p-5 rounded-2xl space-y-3.5 font-mono text-[10px] border border-slate-800 shadow-xl">
                    <div className="text-center border-b border-slate-800 pb-3">
                      <div className="text-[8px] uppercase tracking-wider text-[#B89251] font-bold">Live Billing Summary</div>
                      <div className="text-sm font-bold mt-0.5 text-white">DAWEEZ PENSION HOUSE PMS</div>
                    </div>

                    <div className="space-y-1 text-slate-350">
                      <div className="flex justify-between">
                        <span>Room/Venue rate:</span>
                        <span>₱{baseRoomOrVenuePrice.toLocaleString()} / night</span>
                      </div>

                      {estNights > 1 && (
                        <div className="flex justify-between">
                          <span>Nights count:</span>
                          <span>{estNights} nights</span>
                        </div>
                      )}

                      {applySuggestedRate && rateMultiplier !== 1.0 && (
                        <div className="flex justify-between text-[#B89251] font-bold">
                          <span>Revenue suggestion adjustment:</span>
                          <span>{rateMultiplier === 1.15 ? '+15% Peak surge' : '-10% Low filler'}</span>
                        </div>
                      )}

                      {estBreakfastTotal > 0 && (
                        <div className="flex justify-between">
                          <span>Breakfast selections:</span>
                          <span>₱{estBreakfastTotal.toLocaleString()}</span>
                        </div>
                      )}

                      {estRentalsTotal > 0 && (
                        <div className="flex justify-between">
                          <span>Equipment rentals:</span>
                          <span>₱{estRentalsTotal.toLocaleString()}</span>
                        </div>
                      )}

                      {estAddonsTotal > 0 && (
                        <div className="flex justify-between">
                          <span>Stage & lights:</span>
                          <span>₱{estAddonsTotal.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-800 pt-3 space-y-1.5">
                      <div className="flex justify-between font-bold text-white text-xs">
                        <span>Downpayment Due (50%):</span>
                        <span className="text-emerald-400">₱{estDownpayment.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-white text-xs">
                        <span>Settle at Check-in:</span>
                        <span className="text-[#B89251]">₱{estBalanceDue.toLocaleString()}</span>
                      </div>
                      <div className="text-[8px] text-slate-500 text-center pt-2 italic">
                        Includes ₱500 refundable security deposit
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setFormStep(2)}
                      className="text-[10px] text-slate-500 hover:text-slate-700 font-bold uppercase tracking-wider"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      className="bg-[#B89251] hover:bg-[#9A783E] text-white font-bold uppercase tracking-wider text-[10px] px-6 py-3 rounded-lg transition-colors shadow-sm shadow-[#B89251]/20"
                    >
                      ✓ Create Walk-In Booking
                    </button>
                  </div>
                </div>
              )}
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
