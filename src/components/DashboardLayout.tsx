import React, { useState, useEffect, useMemo } from 'react'
import { Link, Outlet, useNavigate, useLocation } from '@tanstack/react-router'
import { useBookings } from '../hooks/useBookings'
import { DashboardDataContext } from './DashboardContext'
import {
  Sparkles, RefreshCw, LogOut, Home, Users, TrendingUp, BarChart3,
  Calendar, Settings, Building, Moon, Sun, BookOpen, Tag
} from 'lucide-react'
import { isPromoActive, setPromoActive } from '../utils/promoMode'

const TABS = [
  { id: 'calendar',  label: 'Calendar',  Icon: Calendar, to: '/calendar' },
  { id: 'bookings',  label: 'Bookings',  Icon: BookOpen, to: '/bookings' },
  { id: 'guests',    label: 'Corporate Partners', Icon: Building, to: '/guests' },
  { id: 'analytics', label: 'Analytics', Icon: BarChart3, to: '/analytics' },
  { id: 'expenses',  label: 'Expenses',  Icon: TrendingUp, to: '/expenses' },
  { id: 'settings',  label: 'Settings',  Icon: Settings, to: '/settings' },
]

export function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    rooms, venues, bookings, feeds, partnerDeals, expenses, expenseCategories,
    confirmBooking, cancelBooking, createManualBooking, updateBooking,
    triggerOTASync, updateFeedUrls, isLoading, isConfirmingBooking,
    createPartnerDeal, savePartnerDeals, deletePartnerDeal,
    createExpenseCategory, updateExpenseCategory, deleteExpenseCategory, createExpense, deleteExpense
  } = useBookings()

  const [syncSuccessMsg, setSyncSuccessMsg] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('daweez_theme') === 'dark')
  const [promoActive, setPromoActiveState] = useState(() => isPromoActive())
  useEffect(() => {
    const sync = () => setPromoActiveState(isPromoActive())
    const onStorage = (e: StorageEvent) => { if (e.key === 'daweez_promo_active') sync() }
    const onPromoToggle = () => sync()
    window.addEventListener('storage', onStorage)
    window.addEventListener('promo-toggle' as never, onPromoToggle as never)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('promo-toggle' as never, onPromoToggle as never)
    }
  }, [])
  const togglePromo = () => {
    const next = !promoActive
    setPromoActive(next)
    setPromoActiveState(next)
  }
  const isCalendarTab = location.pathname === '/calendar' || location.pathname === '/'

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('daweez_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('daweez_theme', 'light')
    }
  }, [isDarkMode])

  const handleLogout = () => {
    localStorage.removeItem('daweez_pms_auth')
    navigate({ to: '/login' })
  }

  const handleTriggerSync = async () => {
    if (isSyncing) return
    try {
      setIsSyncing(true)
      const n = await triggerOTASync()
      setSyncSuccessMsg(`Sync done — added ${n} bookings.`)
      setTimeout(() => setSyncSuccessMsg(''), 4000)
    } catch {
      setSyncSuccessMsg('Sync failed. Try again.')
      setTimeout(() => setSyncSuccessMsg(''), 3000)
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    triggerOTASync().catch(() => {})
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') triggerOTASync().catch(() => {})
    }, 300000)
    return () => clearInterval(id)
  }, [triggerOTASync])

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    const arrivalsToday = bookings.filter(b => b.check_in === todayStr && b.status !== 'blocked')
    const departuresToday = bookings.filter(b => b.check_out === todayStr && b.status !== 'blocked')
    const currentGuests = bookings.filter(b => b.status === 'confirmed' && todayStr >= b.check_in && todayStr < b.check_out)
    const occupiedRoomIds = new Set(currentGuests.map(g => g.room_id).filter(Boolean))
    const totalRooms = rooms.length || 10
    const roomOccupancyRate = Math.round((occupiedRoomIds.size / totalRooms) * 100)
    const totalRevenue = bookings.filter(b => b.status === 'confirmed').reduce((s, b) => s + (b.downpayment_paid ?? 0) + ((b.balance_due ?? 0) - (b.security_deposit ?? 0)), 0)
    return { arrivalsToday: arrivalsToday.length, departuresToday: departuresToday.length, currentGuests: currentGuests.length, roomOccupancyRate, totalRevenue }
  }, [bookings, rooms.length])

  return (
    <DashboardDataContext.Provider value={{
      rooms, venues, bookings, feeds, partnerDeals, expenses, expenseCategories, isLoading,
      isConfirming: isConfirmingBooking,
      confirmBooking, cancelBooking, createManualBooking, updateBooking,
      triggerOTASync, updateFeedUrls, createPartnerDeal, savePartnerDeals, deletePartnerDeal,
      createExpenseCategory, updateExpenseCategory, deleteExpenseCategory, createExpense, deleteExpense,
      onLogout: handleLogout
    }}>
      <div className={isCalendarTab ? "h-screen bg-background flex flex-col overflow-hidden pb-[56px] md:pb-0" : "min-h-screen bg-background pb-20 md:pb-6"}>
        <header className={`sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-soft ${isCalendarTab ? 'flex-shrink-0' : ''}`}>
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-[56px] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 flex items-center justify-center bg-brand-primary rounded-xl shadow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="leading-tight">
                <h1 className="text-[13px] font-bold tracking-tight text-main font-display">Daweez PMS</h1>
                <p className="text-[11px] text-muted font-medium hidden sm:block -mt-0.5">Pension House</p>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full bg-softbg border border-soft px-1.5 py-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-main bg-card border border-soft rounded-full px-2.5 py-1">
                  <Home className="w-3.5 h-3.5 text-brand-primary" /> {stats.roomOccupancyRate}% full
                </span>
                <span className="text-xs font-medium text-muted px-2">In <strong className="text-main">{stats.arrivalsToday}</strong></span>
                <span className="w-px h-4 bg-soft" />
                <span className="text-xs font-medium text-muted px-2">Out <strong className="text-main">{stats.departuresToday}</strong></span>
                <span className="w-px h-4 bg-soft" />
                <span className="text-xs font-medium text-muted px-2 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> <strong className="text-main">{stats.currentGuests}</strong></span>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700">₱{stats.totalRevenue.toLocaleString()}</span>
                <span className="text-[10px] font-medium text-emerald-600">earned</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Promo sale toggle — lives here on the main dashboard per owner's request */}
              <button
                type="button"
                onClick={togglePromo}
                title={promoActive ? 'Promo ON — guests pay promo price. Click to end promo.' : 'Promo OFF — guests pay regular price. Click to start promo.'}
                className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold rounded-xl px-3 py-1.5 border transition-colors cursor-pointer ${
                  promoActive
                    ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                    : 'bg-card text-muted border-soft hover:bg-softbg hover:text-main'
                }`}
              >
                <Tag className={`w-3.5 h-3.5 ${promoActive ? 'text-white' : ''}`} />
                <span className="hidden xl:inline">{promoActive ? 'Promo ON' : 'Promo OFF'}</span>
                <span className="xl:hidden">{promoActive ? 'ON' : 'OFF'}</span>
              </button>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-soft bg-card text-muted hover:text-main hover:bg-softbg transition-colors cursor-pointer"
                title="Toggle theme"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={handleTriggerSync}
                disabled={isSyncing}
                className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold border rounded-xl px-3 py-1.5 transition-all cursor-pointer ${isSyncing ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20' : 'bg-card border-soft text-main hover:bg-softbg'}`}>
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing' : 'Sync'}
              </button>
              <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-semibold text-muted border border-soft bg-card hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer">
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {syncSuccessMsg && (
          <div className="fixed top-[64px] right-4 z-50 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-card border border-soft text-sm font-medium rounded-xl shadow-soft">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {syncSuccessMsg}
            </div>
          </div>
        )}

        <div className={`lg:hidden bg-softbg border-b border-soft px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs ${isCalendarTab ? 'flex-shrink-0' : ''}`}>
          <span className="shrink-0 font-semibold text-main">{stats.roomOccupancyRate}% full</span>
          <span className="w-px h-3 bg-soft shrink-0" />
          <span className="shrink-0 text-muted">In <strong className="text-main">{stats.arrivalsToday}</strong></span>
          <span className="shrink-0 text-muted">Out <strong className="text-main">{stats.departuresToday}</strong></span>
          <span className="shrink-0 text-muted">Guests <strong className="text-main">{stats.currentGuests}</strong></span>
          <span className="ml-auto shrink-0 font-bold text-emerald-600">₱{stats.totalRevenue.toLocaleString()}</span>
        </div>

        <div className={`hidden md:block max-w-[1600px] w-full mx-auto px-4 sm:px-6 pt-3 ${isCalendarTab ? 'flex-shrink-0' : ''}`}>
          <div className="flex gap-1 p-1 bg-softbg border border-soft rounded-xl w-fit">
            {TABS.map(t => (
              <Link key={t.id} to={t.to}
                className="px-3.5 py-1.5 text-sm font-medium rounded-lg text-muted hover:text-main hover:bg-card transition-colors"
                activeProps={{ className: '!bg-card !text-main shadow-sm border border-soft' }}>
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        <div className={isCalendarTab
          ? "max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-4 flex-1 min-h-0 flex flex-col overflow-hidden"
          : "max-w-[1600px] mx-auto px-4 sm:px-6 py-4"
        }>
          <Outlet />
        </div>

        <nav className="fixed bottom-0 inset-x-0 z-40 bg-card border-t border-soft md:hidden safe-bottom">
          <div className="flex">
            {TABS.map(t => {
              const Icon = t.Icon
              return (
                <Link key={t.id} to={t.to}
                  className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted"
                  activeProps={{ className: '!text-brand-primary' }}>
                  <Icon className="w-5 h-5" />
                  <span>{t.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </DashboardDataContext.Provider>
  )
}
