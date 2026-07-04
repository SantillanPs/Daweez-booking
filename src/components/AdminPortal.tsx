import React, { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBookings } from '../hooks/useBookings'
import { Room, Venue, Booking, SyncFeed, BookingSource, BreakfastOrder, Companion } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import {
  Calendar, User, Phone, Mail, Clock, RefreshCw, Plus, Settings,
  Trash2, AlertCircle, Sparkles, X, Eye, Users, LogIn, LogOut,
  ChevronLeft, ChevronRight, Filter, Home, TrendingUp,
  ClipboardCheck, LayoutGrid, Copy, Check
} from 'lucide-react'

/* ──────────────────────────────────────────────
   Room / Venue color tokens for calendar badges
   ────────────────────────────────────────────── */
const ROOM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'room-1':  { bg: 'bg-amber-50',   text: 'text-amber-800',   border: 'border-amber-200' },
  'room-2':  { bg: 'bg-yellow-50',  text: 'text-yellow-800',  border: 'border-yellow-200' },
  'room-3':  { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  'room-4':  { bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-200' },
  'room-5':  { bg: 'bg-rose-50',    text: 'text-rose-800',    border: 'border-rose-200' },
  'room-6':  { bg: 'bg-violet-50',  text: 'text-violet-800',  border: 'border-violet-200' },
  'room-7':  { bg: 'bg-teal-50',    text: 'text-teal-800',    border: 'border-teal-200' },
  'room-8':  { bg: 'bg-sky-50',     text: 'text-sky-800',     border: 'border-sky-200' },
  'room-9':  { bg: 'bg-orange-50',  text: 'text-orange-800',  border: 'border-orange-200' },
  'room-10': { bg: 'bg-slate-100',  text: 'text-slate-700',   border: 'border-slate-300' },
}
const VENUE_COLORS = { bg: 'bg-fuchsia-50', text: 'text-fuchsia-800', border: 'border-fuchsia-200' }

/* ──────────────────────────────────────────────
   Tab definitions
   ────────────────────────────────────────────── */
type TabId = 'calendar' | 'bookings' | 'guests' | 'settings'
const TABS: { id: TabId; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'calendar',  label: 'Calendar',  Icon: Calendar },
  { id: 'bookings',  label: 'Bookings',  Icon: ClipboardCheck },
  { id: 'guests',    label: 'Guests',    Icon: Users },
  { id: 'settings',  label: 'Settings',  Icon: Settings },
]

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */
interface AdminPortalProps { onLogout: () => void }

export function AdminPortal({ onLogout }: AdminPortalProps) {
  const queryClient = useQueryClient()
  const {
    rooms, venues, bookings, feeds,
    confirmBooking, cancelBooking, createManualBooking,
    triggerOTASync, updateFeedUrls, isLoading
  } = useBookings()

  // ── Navigation ──
  const [activeTab, setActiveTab] = useState<TabId>('calendar')

  // ── Calendar state ──
  const [schedulerMode, setSchedulerMode] = useState<'month' | 'timeline'>('month')
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date())
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set())
  const [showRoomFilter, setShowRoomFilter] = useState(false)
  const [selectedPreviewDate, setSelectedPreviewDate] = useState<Date | null>(null)

  // ── Timeline state ──
  const [schedulerStartDate, setSchedulerStartDate] = useState<Date>(new Date())
  const [daysCount] = useState<number>(30)
  const [daysList, setDaysList] = useState<Date[]>([])
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)

  // ── Booking detail / extension modal ──
  const [selectedExtendBooking, setSelectedExtendBooking] = useState<Booking | null>(null)
  const [extendCheckoutDate, setExtendCheckoutDate] = useState<string>('')
  const [extendError, setExtendError] = useState<string>('')

  // ── Walk‑in form wizard ──
  const [showManualForm, setShowManualForm] = useState(false)
  const [formStep, setFormStep] = useState(1)
  const [formPathway, setFormPathway] = useState<'room' | 'venue'>('room')
  const [formRoomIds, setFormRoomIds] = useState<Set<string>>(new Set(['room-1']))
  const [formVenueId, setFormVenueId] = useState<string>('venue-gazebo')
  const [formGuestName, setFormGuestName] = useState('')
  const [formGuestEmail, setFormGuestEmail] = useState('')
  const [formGuestPhone, setFormGuestPhone] = useState('')
  const [formCheckIn, setFormCheckIn] = useState('')
  const [formCheckOut, setFormCheckOut] = useState('')
  const [formSource, setFormSource] = useState<BookingSource>('manual')
  const [formStatus, setFormStatus] = useState<'confirmed' | 'blocked'>('confirmed')
  const [formError, setFormError] = useState('')
  const [applySuggestedRate, setApplySuggestedRate] = useState(true)
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

  // ── Channel feeds editing ──
  const [editingFeeds, setEditingFeeds] = useState<SyncFeed[]>([])
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('')
  const [copiedFeedId, setCopiedFeedId] = useState<string | null>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedFeedId(id)
      setTimeout(() => setCopiedFeedId(null), 1500)
    })
  }

  // ── Receipt modal ──
  const [selectedReceiptData, setSelectedReceiptData] = useState<Booking | null>(null)

  /* ─── Effects ─── */

  // Auto‑select all rooms when they load
  useEffect(() => {
    if (rooms.length > 0 && selectedRoomIds.size === 0) {
      setSelectedRoomIds(new Set(rooms.map(r => r.id)))
    }
  }, [rooms])

  // Build timeline day list
  useEffect(() => {
    const list: Date[] = []
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(schedulerStartDate)
      d.setDate(schedulerStartDate.getDate() + i)
      list.push(d)
    }
    setDaysList(list)
  }, [schedulerStartDate, daysCount])

  // Sync feed edits with loaded data
  useEffect(() => {
    if (feeds.length > 0 && editingFeeds.length === 0) setEditingFeeds(feeds)
  }, [feeds, editingFeeds])

  // Admin‑mode body class
  useEffect(() => {
    document.body.classList.add('admin-mode')
    return () => document.body.classList.remove('admin-mode')
  }, [])

  // Seed mock data
  useEffect(() => {
    syncEngine.seedFutureMockData().then(count => {
      if (count > 0) {
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
      }
    })
  }, [])

  // OTA background sync
  useEffect(() => {
    triggerOTASync().catch(() => {})
    const id = setInterval(() => { triggerOTASync().catch(() => {}) }, 60000)
    return () => clearInterval(id)
  }, [triggerOTASync])

  /* ─── Handlers ─── */

  const resetAndOpenManualForm = (pathway: 'room' | 'venue', roomIds: Set<string>, checkIn = '', checkOut = '') => {
    setFormPathway(pathway); setFormRoomIds(roomIds)
    setFormCheckIn(checkIn); setFormCheckOut(checkOut)
    setFormGuestName(''); setFormGuestEmail(''); setFormGuestPhone('')
    setFormSource('manual'); setFormStatus('confirmed')
    setFormBreakfastQty({ Bangsilog: 0, Lumpiasilog: 0, Cornsilog: 0, Hotsilog: 0 })
    setFormBigTable(0); setFormSmallTable(0); setFormChairs(0); setFormWater(0)
    setFormBand(false); setFormStage(false); setFormLedWall(false)
    setFormStep(1); setApplySuggestedRate(true); setFormError('')
    setFormCompanions([])
    setShowManualForm(true)
  }

  const handleCellClick = (roomId: string, date: Date) => {
    const d = date.toISOString().split('T')[0]
    const next = new Date(date); next.setDate(date.getDate() + 1)
    resetAndOpenManualForm('room', new Set([roomId]), d, next.toISOString().split('T')[0])
  }

  const handleManualBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('')
    if (!formCheckIn || (formPathway === 'room' && !formCheckOut)) {
      setFormError('Please select active date bounds.'); return
    }
    try {
      const breakfasts: BreakfastOrder[] = []
      if (formPathway === 'room') {
        Object.entries(formBreakfastQty).forEach(([meal, qty]) => {
          if (qty > 0) breakfasts.push({ option: meal as any, quantity: qty, withCoffee: true })
        })
      }
      let localMultiplier = 1.0
      if (applySuggestedRate) {
        if (roomOccupancyRate < 40) localMultiplier = 0.90
        else if (roomOccupancyRate >= 80) localMultiplier = 1.15
      }
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
      setShowManualForm(false)
    } catch (err: any) { setFormError(err.message || 'Overlap collision occurred.') }
  }

  const handleExtendStaySubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setExtendError('')
    if (!selectedExtendBooking || !extendCheckoutDate) return
    try {
      if (!syncEngine.isRoomAvailable(selectedExtendBooking.room_id!, selectedExtendBooking.check_in, extendCheckoutDate, bookings, selectedExtendBooking.id)) {
        setExtendError('Overlap collision — room already reserved.'); return
      }
      const pricing = syncEngine.calculatePricing({
        roomId: selectedExtendBooking.room_id, checkIn: selectedExtendBooking.check_in,
        checkOut: extendCheckoutDate, guestEmail: selectedExtendBooking.guest_email,
        breakfastOrders: selectedExtendBooking.breakfast_orders, bookingsList: bookings
      })
      const current = await syncEngine.getBookings()
      const updated = current.map(b => b.id === selectedExtendBooking.id ? { ...b, check_out: extendCheckoutDate, balance_due: pricing.balanceDue } : b)
      await syncEngine.saveBookings(updated)
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setSelectedExtendBooking(null)
      alert('Stay extended successfully!')
    } catch (err: any) { setExtendError(err.message || 'Overlap collision.') }
  }

  const handleTriggerSync = async () => {
    setSyncSuccessMsg('')
    try {
      const n = await triggerOTASync()
      setSyncSuccessMsg(`Sync complete — merged ${n} reservations.`)
      setTimeout(() => setSyncSuccessMsg(''), 5000)
    } catch { alert('Sync failed.') }
  }

  const handleSaveFeeds = async () => {
    try { await updateFeedUrls(editingFeeds); alert('Feed URLs saved!') }
    catch { alert('Failed to save URLs.') }
  }

  const handleFeedUrlChange = (feedId: string, url: string) => {
    setEditingFeeds(prev => prev.map(f => f.id === feedId ? { ...f, url } : f))
  }

  /* ─── Helpers ─── */

  const formatDateHeader = (date: Date) => ({
    day: date.getDate(),
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 1),
  })

  const getMonthGridDates = (base: Date) => {
    const y = base.getFullYear(), m = base.getMonth()
    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0)
    const grid: (Date | null)[] = []
    for (let i = 0; i < first.getDay(); i++) grid.push(null)
    for (let d = 1; d <= last.getDate(); d++) grid.push(new Date(y, m, d))
    while (grid.length % 7 !== 0) grid.push(null)
    return grid
  }

  const getBookingStyle = (b: Booking) => {
    if (b.status === 'pending') return 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse'
    if (b.status === 'blocked') return 'bg-slate-100 text-slate-400 border-slate-200 line-through'
    switch (b.source) {
      case 'airbnb':      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'booking_com': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'facebook':    return 'bg-indigo-50 text-indigo-700 border-indigo-200'
      case 'google_maps': return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'website':     return 'bg-violet-50 text-violet-700 border-violet-200'
      default:            return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  /* ─── Computed stats ─── */

  const todayStr = new Date().toISOString().split('T')[0]
  const arrivalsToday   = bookings.filter(b => b.check_in === todayStr && b.status !== 'blocked')
  const departuresToday = bookings.filter(b => b.check_out === todayStr && b.status !== 'blocked')
  const currentGuests   = bookings.filter(b => b.status === 'confirmed' && todayStr >= b.check_in && todayStr < b.check_out)
  const occupiedRoomIds = new Set(currentGuests.map(g => g.room_id).filter(Boolean))
  const roomOccupancyRate = Math.round((occupiedRoomIds.size / 10) * 100)
  const totalRevenue = bookings.filter(b => b.status === 'confirmed').reduce((s, b) => s + (b.downpayment_paid ?? 0) + ((b.balance_due ?? 0) - (b.security_deposit ?? 0)), 0)
  const loyaltyRecords = syncEngine.getGuestRecords()

  /* ─── Form pricing estimates ─── */

  let rateMultiplier = 1.0
  if (roomOccupancyRate < 40) rateMultiplier = 0.90
  else if (roomOccupancyRate >= 80) rateMultiplier = 1.15

  const basePrice = formPathway === 'room'
    ? Array.from(formRoomIds).reduce((s, id) => s + (rooms.find(r => r.id === id)?.base_price ?? 0), 0)
    : (venues.find(v => v.id === formVenueId)?.base_price ?? 0)

  const estNights = formPathway === 'room' && formCheckIn && formCheckOut
    ? Math.max(1, Math.ceil((new Date(formCheckOut).getTime() - new Date(formCheckIn).getTime()) / 86400000))
    : 1

  const activeMultiplier = applySuggestedRate ? rateMultiplier : 1.0
  const estBase = basePrice * estNights * activeMultiplier

  let estBreakfast = 0
  if (formPathway === 'room') Object.values(formBreakfastQty).forEach(q => { estBreakfast += 200 * q })
  let estRentals = 0
  if (formPathway === 'venue') { estRentals = formBigTable * 150 + formSmallTable * 100 + formChairs * 15 + formWater * 35 }
  let estAddons = 0
  if (formPathway === 'venue') { if (formBand) estAddons += 2000; if (formStage) estAddons += 2000; if (formLedWall) estAddons += 5000 }

  const estTotal = estBase + estBreakfast + estRentals + estAddons
  const estDown  = Math.round(estTotal * 0.5)
  const estDue   = (estTotal - estDown) + (formStatus === 'blocked' ? 0 : 500)

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-6">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center bg-[#B89251] rounded-lg">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-bold text-slate-900">Daweez PMS</h1>
              <p className="text-[10px] text-[#B89251] font-medium hidden sm:block">Property Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleTriggerSync} className="flex items-center gap-1.5 text-xs font-medium text-[#9A783E] border border-[#E5D5C0] bg-[#FDFBF7] hover:bg-[#B89251] hover:text-white hover:border-[#B89251] px-3 py-1.5 rounded-lg transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sync</span>
            </button>
            <button onClick={onLogout} className="flex items-center gap-1.5 text-xs font-medium text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-600 hover:text-white hover:border-rose-600 px-3 py-1.5 rounded-lg transition-all cursor-pointer">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Sync toast ── */}
      {syncSuccessMsg && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
          <div className="flex items-center gap-2 p-3 bg-[#FDFBF7] border border-[#E5D5C0] text-[#9A783E] text-xs font-medium rounded-lg">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{syncSuccessMsg}</span>
          </div>
        </div>
      )}

      {/* ── Stats bar ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center gap-5 sm:gap-8 overflow-x-auto text-sm no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            <Home className="w-3.5 h-3.5 text-[#B89251]" />
            <span className="text-slate-400 text-xs">Occ.</span>
            <span className="font-semibold text-slate-800">{roomOccupancyRate}%</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <LogIn className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-slate-400 text-xs">In</span>
            <span className="font-semibold text-slate-800">{arrivalsToday.length}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <LogOut className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-slate-400 text-xs">Out</span>
            <span className="font-semibold text-slate-800">{departuresToday.length}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Users className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-slate-400 text-xs">Guests</span>
            <span className="font-semibold text-slate-800">{currentGuests.length}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-slate-400 text-xs">Rev.</span>
            <span className="font-semibold text-slate-800">₱{totalRevenue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ── Desktop tabs ── */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex border-b border-slate-200 gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.id ? 'border-[#B89251] text-[#9A783E]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.label}{t.id === 'bookings' ? ` (${bookings.length})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">

        {/* ═══ CALENDAR TAB ═══ */}
        {activeTab === 'calendar' && (
          <div className="space-y-4">

            {/* Controls bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Mode toggle */}
                <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs font-medium">
                  <button onClick={() => setSchedulerMode('month')}
                    className={`px-3 py-1.5 rounded-md transition-all ${schedulerMode === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    Month
                  </button>
                  <button onClick={() => setSchedulerMode('timeline')}
                    className={`px-3 py-1.5 rounded-md transition-all ${schedulerMode === 'timeline' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    Timeline
                  </button>
                </div>

                {/* Timeline date controls */}
                {schedulerMode === 'timeline' && (
                  <div className="flex items-center gap-2">
                    <input type="date" value={schedulerStartDate.toISOString().split('T')[0]}
                      onChange={e => setSchedulerStartDate(new Date(e.target.value))}
                      className="bg-white border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[#B89251]" />
                    <button onClick={() => setSchedulerStartDate(new Date())}
                      className="text-xs font-medium text-[#9A783E] border border-[#E5D5C0] bg-[#FDFBF7] hover:bg-[#B89251] hover:text-white px-2.5 py-1.5 rounded-lg transition-all">
                      Today
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {schedulerMode === 'month' && (
                  <button onClick={() => setShowRoomFilter(!showRoomFilter)}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${showRoomFilter ? 'bg-[#FDFBF7] border-[#E5D5C0] text-[#9A783E]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    <Filter className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Rooms</span>
                    <span className="text-[10px] opacity-60">{selectedRoomIds.size}/{rooms.length}</span>
                  </button>
                )}
                <button onClick={() => resetAndOpenManualForm('room', new Set(['room-1']))}
                  className="flex items-center gap-1.5 bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New Booking</span>
                </button>
              </div>
            </div>

            {/* Room filter panel (collapsible) */}
            {schedulerMode === 'month' && showRoomFilter && (
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">Filter by room</span>
                  <div className="flex gap-3 text-xs">
                    <button onClick={() => setSelectedRoomIds(new Set(rooms.map(r => r.id)))} className="text-[#9A783E] font-medium hover:underline">All</button>
                    <button onClick={() => setSelectedRoomIds(new Set())} className="text-slate-400 font-medium hover:underline">None</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {rooms.map(room => {
                    const on = selectedRoomIds.has(room.id)
                    const c = ROOM_COLORS[room.id] || ROOM_COLORS['room-10']
                    return (
                      <label key={room.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition-all ${on ? `${c.bg} ${c.border} ${c.text} font-medium` : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                        <input type="checkbox" checked={on} className="accent-[#B89251] w-3.5 h-3.5"
                          onChange={() => { const n = new Set(selectedRoomIds); n.has(room.id) ? n.delete(room.id) : n.add(room.id); setSelectedRoomIds(n) }} />
                        Room {room.room_number}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ─── MONTH CALENDAR VIEW ─── */}
            {schedulerMode === 'month' && (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                {/* Month header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-800">
                    {currentMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { const p = new Date(currentMonthDate); p.setMonth(p.getMonth() - 1); setCurrentMonthDate(p) }}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => { const n = new Date(currentMonthDate); n.setMonth(n.getMonth() + 1); setCurrentMonthDate(n) }}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => setCurrentMonthDate(new Date())}
                      className="text-xs font-medium text-[#9A783E] px-2 py-1 hover:bg-[#FDFBF7] rounded-lg transition-colors ml-1">
                      Today
                    </button>
                  </div>
                </div>

                {/* Week‑day header */}
                <div className="grid grid-cols-7 text-center border-b border-slate-100 text-[10px] uppercase tracking-wider font-semibold text-slate-400 py-2">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7">
                  {getMonthGridDates(currentMonthDate).map((date, idx) => {
                    if (!date) return <div key={idx} className="min-h-[80px] sm:min-h-[100px] bg-slate-50/40 border-b border-r border-slate-100" />

                    const fmtDate = date.toISOString().split('T')[0]
                    const isToday = date.toDateString() === new Date().toDateString()
                    const dayBookings = bookings.filter(b => {
                      if (b.room_id && !selectedRoomIds.has(b.room_id)) return false
                      if (b.room_id) return fmtDate >= b.check_in && fmtDate < b.check_out
                      if (b.venue_id && b.check_in === fmtDate) return true
                      return false
                    })

                    return (
                      <div key={idx} onClick={() => setSelectedPreviewDate(date)}
                        className={`group min-h-[80px] sm:min-h-[100px] p-1 sm:p-1.5 border-b border-r border-slate-100 flex flex-col cursor-pointer transition-colors ${isToday ? 'bg-[#FDFBF7]' : 'hover:bg-slate-50'}`}>
                        {/* Day number + quick add */}
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium ${isToday ? 'bg-[#B89251] text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold' : 'text-slate-500'}`}>
                            {date.getDate()}
                          </span>
                          <button type="button"
                            onClick={e => { e.stopPropagation(); const t = new Date(date); t.setDate(t.getDate() + 1); resetAndOpenManualForm('room', new Set([rooms[0]?.id || 'room-1']), fmtDate, t.toISOString().split('T')[0]) }}
                            className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-[10px] text-slate-400 hover:bg-[#B89251] hover:text-white rounded transition-all cursor-pointer">
                            +
                          </button>
                        </div>
                        {/* Booking chips */}
                        <div className="space-y-0.5 overflow-hidden flex-1">
                          {dayBookings.slice(0, 3).map(b => {
                            const room = rooms.find(r => r.id === b.room_id)
                            const c = b.room_id ? (ROOM_COLORS[b.room_id] || ROOM_COLORS['room-10']) : VENUE_COLORS
                            return (
                              <div key={b.id}
                                onClick={e => { e.stopPropagation(); if (b.status !== 'blocked') { setSelectedExtendBooking(b); setExtendCheckoutDate(b.check_out); setExtendError('') } }}
                                className={`text-[8px] sm:text-[9px] font-semibold px-1 py-0.5 rounded border truncate cursor-pointer ${c.bg} ${c.text} ${c.border}`}
                                title={`${room ? `Room ${room.room_number}` : 'Venue'} – ${b.guest_name}`}>
                                {room ? `R${room.room_number}` : 'VN'} · {b.guest_name.split(' ')[0]}
                              </div>
                            )
                          })}
                          {dayBookings.length > 3 && (
                            <div className="text-[8px] text-slate-400 font-medium text-center">+{dayBookings.length - 3} more</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ─── TIMELINE GRID VIEW ─── */}
            {schedulerMode === 'timeline' && (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="sticky left-0 z-20 bg-slate-50 border-b border-r border-slate-200 p-3 text-left text-xs text-slate-500 font-medium min-w-[160px]">
                          Room
                        </th>
                        {daysList.map((day, i) => {
                          const { day: num, weekday } = formatDateHeader(day)
                          const isToday = day.toDateString() === new Date().toDateString()
                          return (
                            <th key={i} className={`border-b border-slate-200 p-1.5 text-center text-[10px] min-w-[38px] font-mono ${isToday ? 'bg-[#FDFBF7] text-[#9A783E] font-semibold' : 'text-slate-400'}`}>
                              <div>{weekday}</div>
                              <div className={`text-xs font-semibold mt-0.5 ${isToday ? 'border-b border-[#B89251] pb-0.5' : ''}`}>{num}</div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {rooms.map(room => (
                        <tr key={room.id} className="border-b border-slate-100 hover:bg-slate-50/30">
                          <td className="sticky left-0 z-20 bg-white border-r border-slate-200 p-3 min-w-[160px]">
                            <span className="text-xs font-semibold text-slate-800 block">Room {room.room_number}</span>
                            <span className="text-[10px] text-[#B89251]">₱{room.base_price.toLocaleString()}/night</span>
                          </td>
                          {daysList.map((day, dIdx) => {
                            const fmtStr = day.toISOString().split('T')[0]
                            const booking = bookings.filter(b => b.room_id === room.id).find(b => fmtStr >= b.check_in && fmtStr < b.check_out)
                            if (booking) {
                              const isStart = fmtStr === booking.check_in
                              const tipId = `${room.id}-${dIdx}`
                              return (
                                <td key={dIdx} className="p-0 border-r border-slate-100 relative"
                                  onMouseEnter={() => setActiveTooltip(tipId)} onMouseLeave={() => setActiveTooltip(null)}>
                                  <div className={`h-7 mx-0.5 flex items-center justify-center text-[9px] font-semibold rounded-sm border cursor-pointer select-none ${getBookingStyle(booking)}`}>
                                    {isStart ? <span className="px-0.5 truncate">{booking.guest_name.split(' ')[0]}</span> : <span className="opacity-0">.</span>}
                                  </div>
                                  {activeTooltip === tipId && (
                                    <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-30 w-52 bg-white border border-slate-200 p-3 shadow-lg rounded-lg text-xs space-y-1.5 pointer-events-none">
                                      <div className="font-semibold text-slate-800">{booking.guest_name}</div>
                                      <div className="text-[10px] text-slate-400 font-mono">{booking.check_in} → {booking.check_out}</div>
                                      <div className="text-[10px] text-slate-500">
                                        {booking.guest_phone}<br />
                                        <span className={booking.status === 'confirmed' ? 'text-emerald-600 font-medium' : 'text-amber-600'}>{booking.status}</span>
                                        {' · '}{booking.source}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              )
                            }
                            return (
                              <td key={dIdx} onClick={() => handleCellClick(room.id, day)}
                                className="border-r border-slate-100 p-0 h-8 hover:bg-[#FDFBF7]/60 cursor-cell transition-colors" />
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ BOOKINGS TAB ═══ */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">

            {/* Pending queue */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-800">Pending ({bookings.filter(b => b.status === 'pending').length})</h3>
              </div>
              <div className="p-4">
                {bookings.filter(b => b.status === 'pending').length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No pending reservations.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-500 text-[10px] uppercase tracking-wider font-medium">
                          <th className="py-2 px-3">ID</th><th className="py-2 px-3">Room</th><th className="py-2 px-3">Guest</th>
                          <th className="py-2 px-3">Dates</th><th className="py-2 px-3">Downpay</th><th className="py-2 px-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.filter(b => b.status === 'pending').map(b => {
                          const room = rooms.find(r => r.id === b.room_id)
                          const venue = venues.find(v => v.id === b.venue_id)
                          return (
                            <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                              <td className="py-3 px-3 font-mono text-[10px] text-[#9A783E]">{b.id}</td>
                              <td className="py-3 px-3">
                                <span className="font-medium text-slate-800">{room ? `Room ${room.room_number}` : venue?.name}</span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-medium text-slate-800 block">{b.guest_name}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-slate-400">{b.guest_phone}</span>
                                  {b.companions && b.companions.length > 0 && (
                                    <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200/60 px-1.5 py-0.25 rounded font-medium shrink-0">
                                      {b.companions.length + 1} Guests
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 font-mono text-[10px] text-slate-500">{b.check_in} {room ? `→ ${b.check_out}` : ''}</td>
                              <td className="py-3 px-3 font-medium text-emerald-600">₱{(b.downpayment_paid ?? 0).toLocaleString()}</td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setSelectedReceiptData(b)} className="text-[#9A783E] hover:underline flex items-center gap-1">
                                    <Eye className="w-3 h-3" /><span>Verify</span>
                                  </button>
                                  <button onClick={() => confirmBooking(b.id)}
                                    className="bg-[#B89251] hover:bg-[#9A783E] text-white font-medium text-[10px] uppercase px-2 py-1 rounded-lg transition-colors">
                                    Confirm
                                  </button>
                                  <button onClick={() => cancelBooking(b.id)} className="text-rose-500 hover:text-rose-700 font-medium">Release</button>
                                </div>
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

            {/* Confirmed reservations */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-slate-800">Confirmed ({bookings.filter(b => b.status === 'confirmed' || b.status === 'blocked').length})</h3>
              </div>
              <div className="p-4">
                {bookings.filter(b => b.status === 'confirmed' || b.status === 'blocked').length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No confirmed reservations.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-500 text-[10px] uppercase tracking-wider font-medium">
                          <th className="py-2 px-3">Room</th><th className="py-2 px-3">Guest</th><th className="py-2 px-3">Dates</th>
                          <th className="py-2 px-3">Payment</th><th className="py-2 px-3">Source</th><th className="py-2 px-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.filter(b => b.status === 'confirmed' || b.status === 'blocked').map(b => {
                          const room = rooms.find(r => r.id === b.room_id)
                          const venue = venues.find(v => v.id === b.venue_id)
                          return (
                            <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                              <td className="py-3 px-3">
                                <span className="font-medium text-slate-800">{room ? `Room ${room.room_number}` : venue?.name}</span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-medium text-slate-800 block">{b.guest_name}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-slate-400">{b.guest_phone}</span>
                                  {b.companions && b.companions.length > 0 && (
                                    <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200/60 px-1.5 py-0.25 rounded font-medium shrink-0">
                                      {b.companions.length + 1} Guests
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 font-mono text-[10px] text-slate-500">{b.check_in} {room ? `→ ${b.check_out}` : ''}</td>
                              <td className="py-3 px-3 text-[10px] space-y-0.5">
                                <div><span className="text-slate-400">Paid:</span> <span className="font-medium text-emerald-600">₱{(b.downpayment_paid ?? 0).toLocaleString()}</span></div>
                                {b.status !== 'blocked' && <div><span className="text-slate-400">Due:</span> <span className="font-medium text-[#9A783E]">₱{(b.balance_due ?? 0).toLocaleString()}</span></div>}
                              </td>
                              <td className="py-3 px-3">
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${b.source === 'airbnb' || b.source === 'booking_com' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-[#9A783E] bg-[#FDFBF7] border-[#E5D5C0]'}`}>
                                  {b.source}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <button onClick={() => cancelBooking(b.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-1">
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
          </div>
        )}

        {/* ═══ GUESTS TAB ═══ */}
        {activeTab === 'guests' && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">Guest Loyalty</h3>
              <p className="text-xs text-slate-400 mt-0.5">Guests with 1+ past stays get an automatic 10% loyalty discount.</p>
            </div>
            <div className="p-4">
              {loyaltyRecords.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No guest records yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500 text-[10px] uppercase tracking-wider font-medium">
                        <th className="py-2 px-3">Guest</th><th className="py-2 px-3">Phone</th>
                        <th className="py-2 px-3">Visits</th><th className="py-2 px-3">Last Stay</th><th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loyaltyRecords.map((r, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="py-3 px-3">
                            <span className="font-medium text-slate-800 block">{r.name}</span>
                            <span className="text-[10px] text-slate-400">{r.email}</span>
                          </td>
                          <td className="py-3 px-3 font-mono text-[10px] text-slate-500">{r.phone}</td>
                          <td className="py-3 px-3 font-medium text-slate-800 text-center">{r.visit_count}</td>
                          <td className="py-3 px-3 font-mono text-[10px] text-slate-500">{r.last_visit.split('T')[0]}</td>
                          <td className="py-3 px-3">
                            <span className="text-[10px] font-medium text-[#9A783E] bg-[#FDFBF7] border border-[#E5D5C0] px-2 py-0.5 rounded">
                              10% Discount
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ SETTINGS TAB ═══ */}
        {activeTab === 'settings' && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">iCal Feed Subscriptions</h3>
            </div>
            <div className="p-4 space-y-5">
              {rooms.map(room => {
                const rf = editingFeeds.filter(f => f.room_id === room.id)
                const air = rf.find(f => f.channel === 'airbnb')
                const bk  = rf.find(f => f.channel === 'booking_com')
                return (
                  <div key={room.id} className="border border-slate-100 rounded-lg p-4 space-y-3">
                    <div className="text-xs font-semibold text-slate-800 border-b border-slate-100 pb-2">
                      Room {room.room_number}: {room.name}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-2 items-center text-xs">
                      <span className="text-[10px] text-[#B89251] font-medium">Export URL</span>
                      <input readOnly value={`https://daweez-booking.vercel.app/api/ical/room/${room.room_number}.ics`}
                        className="bg-slate-50 border border-slate-200 text-slate-500 p-2 rounded-lg font-mono text-[10px] w-full select-all outline-none" />
                      <button onClick={() => copyToClipboard(`https://daweez-booking.vercel.app/api/ical/room/${room.room_number}.ics`, `export-${room.id}`)}
                        className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-lg border transition-all ${copiedFeedId === `export-${room.id}` ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                        {copiedFeedId === `export-${room.id}` ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                      </button>
                    </div>
                    {air && (
                      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-2 items-center text-xs">
                        <span className="text-[10px] text-emerald-600 font-medium">Airbnb Feed</span>
                        <input value={air.url} onChange={e => handleFeedUrlChange(air.id, e.target.value)}
                          className="bg-white border border-slate-200 text-slate-700 p-2 rounded-lg font-mono text-[10px] w-full focus:outline-none focus:border-[#B89251]" />
                        <button onClick={() => copyToClipboard(air.url, `air-${room.id}`)}
                          className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-lg border transition-all ${copiedFeedId === `air-${room.id}` ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                          {copiedFeedId === `air-${room.id}` ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                        </button>
                      </div>
                    )}
                    {bk && (
                      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-2 items-center text-xs">
                        <span className="text-[10px] text-blue-600 font-medium">Booking.com</span>
                        <input value={bk.url} onChange={e => handleFeedUrlChange(bk.id, e.target.value)}
                          className="bg-white border border-slate-200 text-slate-700 p-2 rounded-lg font-mono text-[10px] w-full focus:outline-none focus:border-[#B89251]" />
                        <button onClick={() => copyToClipboard(bk.url, `bk-${room.id}`)}
                          className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-lg border transition-all ${copiedFeedId === `bk-${room.id}` ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                          {copiedFeedId === `bk-${room.id}` ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button onClick={handleSaveFeeds}
                  className="bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-medium px-5 py-2.5 rounded-lg transition-colors">
                  Save Feed URLs
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 md:hidden">
        <div className="flex">
          {TABS.map(t => {
            const Icon = t.Icon
            const active = activeTab === t.id
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${active ? 'text-[#9A783E]' : 'text-slate-400'}`}>
                <Icon className="w-5 h-5" />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* ═══════════════════════════════════════════
          MODALS
          ═══════════════════════════════════════════ */}

      {/* ── Day preview modal ── */}
      {selectedPreviewDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div>
                <span className="text-[10px] text-[#9A783E] font-medium block">Day Overview</span>
                <h3 className="text-sm font-semibold text-slate-800">
                  {selectedPreviewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
              </div>
              <button onClick={() => setSelectedPreviewDate(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-2.5 max-h-[50vh] overflow-y-auto">
              {(() => {
                const fd = selectedPreviewDate.toISOString().split('T')[0]
                const db = bookings.filter(b => {
                  if (b.room_id && !selectedRoomIds.has(b.room_id)) return false
                  if (b.room_id) return fd >= b.check_in && fd < b.check_out
                  if (b.venue_id && b.check_in === fd) return true
                  return false
                })
                if (db.length === 0) return <p className="text-xs text-slate-400 text-center py-6">No bookings on this day.</p>
                return db.map(b => {
                  const room = rooms.find(r => r.id === b.room_id)
                  const c = b.room_id ? (ROOM_COLORS[b.room_id] || ROOM_COLORS['room-10']) : VENUE_COLORS
                  return (
                    <div key={b.id} className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${c.bg} ${c.border}`}>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold ${c.text}`}>{room ? `Room ${room.room_number}` : 'Event Venue'}</span>
                          <span className="text-xs font-medium text-slate-800">{b.guest_name}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {b.guest_phone} · {b.check_in} → {b.check_out} · {b.source}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {b.status !== 'blocked' && (
                          <button onClick={() => { setSelectedPreviewDate(null); setSelectedExtendBooking(b); setExtendCheckoutDate(b.check_out); setExtendError('') }}
                            className="text-[10px] font-medium px-2.5 py-1 bg-[#B89251] hover:bg-[#9A783E] text-white rounded-lg transition-colors cursor-pointer">
                            Manage
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100">
              <button onClick={() => setSelectedPreviewDate(null)} className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 cursor-pointer">Close</button>
              <button onClick={() => {
                const d = selectedPreviewDate.toISOString().split('T')[0]; const t = new Date(selectedPreviewDate); t.setDate(t.getDate() + 1)
                setSelectedPreviewDate(null); resetAndOpenManualForm('room', new Set([rooms[0]?.id || 'room-1']), d, t.toISOString().split('T')[0])
              }} className="flex items-center gap-1 bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                <Plus className="w-3.5 h-3.5" />Add Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Booking detail / extension modal ── */}
      {selectedExtendBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div>
                <span className="text-[10px] text-[#9A783E] font-medium block">Reservation Detail</span>
                <h3 className="text-sm font-semibold text-slate-800">{selectedExtendBooking.guest_name}</h3>
              </div>
              <button onClick={() => setSelectedExtendBooking(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {extendError && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" /><span>{extendError}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Room</span>
                  <span className="font-medium text-slate-800">{rooms.find(r => r.id === selectedExtendBooking.room_id)?.name || 'Event Venue'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Source</span>
                  <span className="font-medium text-slate-800">{selectedExtendBooking.source}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Phone</span>
                  <span className="font-medium text-slate-800 font-mono">{selectedExtendBooking.guest_phone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Email</span>
                  <span className="font-medium text-slate-800 truncate block" title={selectedExtendBooking.guest_email}>{selectedExtendBooking.guest_email}</span>
                </div>
              </div>

              {/* Companions Registry Display */}
              {selectedExtendBooking.companions && selectedExtendBooking.companions.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#B89251]" /> Companions ({selectedExtendBooking.companions.length + 1} total guests)
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
                    {selectedExtendBooking.companions.map((comp, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded border border-slate-200/40">
                        <span className="font-medium text-slate-800">{comp.name}</span>
                        <span className="text-[9px] uppercase font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{comp.gender}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleExtendStaySubmit} className="space-y-3 border-t border-slate-100 pt-4">
                <span className="text-xs font-medium text-[#9A783E] block">Extend Stay</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Check-in</span>
                    <input type="date" readOnly value={selectedExtendBooking.check_in}
                      className="w-full bg-slate-100 border border-slate-200 text-slate-500 px-2.5 py-2 rounded-lg text-xs font-mono cursor-not-allowed outline-none" />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#B89251] block mb-1 font-medium">New checkout</span>
                    <input type="date" required min={selectedExtendBooking.check_in} value={extendCheckoutDate}
                      onChange={e => setExtendCheckoutDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-800 px-2.5 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-[#B89251]" />
                  </div>
                </div>
                {extendCheckoutDate && extendCheckoutDate !== selectedExtendBooking.check_out && (
                  <div className="p-3 bg-[#FDFBF7] border border-[#E5D5C0] rounded-lg text-[10px] text-[#9A783E] font-medium space-y-1">
                    <div className="flex justify-between">
                      <span>Extra nights:</span>
                      <span className="font-mono">{Math.max(0, Math.ceil((new Date(extendCheckoutDate).getTime() - new Date(selectedExtendBooking.check_out).getTime()) / 86400000))}</span>
                    </div>
                    <div className="flex justify-between text-slate-800">
                      <span>Updated balance:</span>
                      <span className="font-mono">₱{(() => { try { return syncEngine.calculatePricing({ roomId: selectedExtendBooking.room_id, checkIn: selectedExtendBooking.check_in, checkOut: extendCheckoutDate, guestEmail: selectedExtendBooking.guest_email, breakfastOrders: selectedExtendBooking.breakfast_orders, bookingsList: bookings }).balanceDue.toLocaleString() } catch { return '0' } })()}</span>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setSelectedExtendBooking(null)}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium py-2.5 rounded-lg border border-slate-200 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={extendCheckoutDate === selectedExtendBooking.check_out}
                    className="flex-1 bg-[#B89251] hover:bg-[#9A783E] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-medium py-2.5 rounded-lg transition-colors">
                    Save Extension
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Walk-in booking form wizard ── */}
      {showManualForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">New Booking</h3>
                <p className="text-[10px] text-slate-400">Step {formStep} of 3</p>
              </div>
              <button onClick={() => setShowManualForm(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
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
                            <div key={room.id} onClick={() => { const n = new Set(formRoomIds); n.has(room.id) ? (n.size > 1 && n.delete(room.id)) : n.add(room.id); setFormRoomIds(n) }}
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

                  {/* Revenue optimizer */}
                  <div className={`p-3 rounded-lg border text-xs space-y-2 ${roomOccupancyRate < 40 ? 'bg-amber-50/50 border-amber-200 text-amber-900' : roomOccupancyRate >= 80 ? 'bg-rose-50/50 border-rose-200 text-rose-900' : 'bg-[#FDFBF7] border-[#E5D5C0] text-slate-700'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium text-[10px]">
                        <Sparkles className="w-3.5 h-3.5 text-[#B89251]" />
                        <span>Rate suggestion</span>
                      </div>
                      <span className="text-[10px] font-mono opacity-60">{roomOccupancyRate}% occ.</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {roomOccupancyRate < 40 ? 'Low occupancy — suggesting -10% discount.' : roomOccupancyRate >= 80 ? 'Peak demand — suggesting +15% surge.' : 'Normal occupancy — standard pricing.'}
                    </p>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <label className="flex items-center gap-1.5 text-[10px] cursor-pointer font-medium">
                        <input type="checkbox" checked={applySuggestedRate} onChange={e => setApplySuggestedRate(e.target.checked)} className="accent-[#B89251] w-3.5 h-3.5" />
                        Apply suggestion
                      </label>
                      <span className="text-[10px] font-mono font-medium text-[#9A783E]">
                        ₱{(roomOccupancyRate < 40 ? Math.round(basePrice * 0.90) : roomOccupancyRate >= 80 ? Math.round(basePrice * 1.15) : basePrice).toLocaleString()}
                      </span>
                    </div>
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
                      {applySuggestedRate && rateMultiplier !== 1.0 && (
                        <div className="flex justify-between text-[#B89251]"><span>Rate adj.:</span><span>{rateMultiplier === 1.15 ? '+15%' : '-10%'}</span></div>
                      )}
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
      )}

      {/* ── Receipt verification modal ── */}
      {selectedReceiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">Payment Verification</h3>
              <button onClick={() => setSelectedReceiptData(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              <div className="bg-slate-50 border border-slate-100 p-5 rounded-lg font-mono text-xs space-y-3">
                <div className="text-center border-b border-slate-200 pb-3">
                  <div className="text-[10px] text-[#B89251] font-medium">PAYMENT VERIFIED</div>
                  <div className="text-lg font-semibold text-slate-800 mt-0.5">₱{(selectedReceiptData.downpayment_paid ?? 0).toLocaleString()}</div>
                  <div className="text-[10px] text-slate-400">50% reservation deposit</div>
                </div>
                <div className="space-y-1 text-[10px] text-slate-600">
                  <div><span className="text-slate-400">ID:</span> {selectedReceiptData.id}</div>
                  <div><span className="text-slate-400">Guest:</span> {selectedReceiptData.guest_name}</div>
                  <div><span className="text-slate-400">Check-in:</span> {selectedReceiptData.check_in}</div>
                  <div><span className="text-slate-400">Ref:</span> 9988-7766-5544</div>
                </div>
                <div className="border-t border-slate-200 pt-2 text-center text-[10px] font-medium text-[#9A783E]">
                  Balance due: ₱{(selectedReceiptData.balance_due ?? 0).toLocaleString()} at check-in
                </div>
              </div>
              <button onClick={() => setSelectedReceiptData(null)}
                className="w-full mt-4 bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-medium py-2.5 rounded-lg transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
