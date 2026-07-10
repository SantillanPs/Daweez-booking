import React, { useState, useEffect } from 'react'
import { Link, Outlet, useNavigate, useLocation } from '@tanstack/react-router'
import { useBookings } from '../hooks/useBookings'
import { DashboardDataContext } from './DashboardContext'
import {
  Sparkles, RefreshCw, LogOut, Home, LogIn, Users, TrendingUp, BarChart3,
  Calendar, Settings, Building, Moon, Sun
} from 'lucide-react'

const TABS = [
  { id: 'calendar',  label: 'Calendar',  Icon: Calendar, to: '/calendar' },
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
    confirmBooking, cancelBooking, createManualBooking,
    triggerOTASync, updateFeedUrls, isLoading, isConfirmingBooking,
    createPartnerDeal, savePartnerDeals, deletePartnerDeal,
    createExpenseCategory, updateExpenseCategory, deleteExpenseCategory, createExpense, deleteExpense
  } = useBookings()

  const [syncSuccessMsg, setSyncSuccessMsg] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('daweez_theme') === 'dark'
  })
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
      setSyncSuccessMsg(`Sync complete — merged ${n} reservations.`)
      setTimeout(() => setSyncSuccessMsg(''), 5000)
    } catch { 
      alert('Sync failed.') 
    } finally {
      setIsSyncing(false)
    }
  }

  // OTA background sync
  useEffect(() => {
    triggerOTASync().catch(() => {})
    const id = setInterval(() => { triggerOTASync().catch(() => {}) }, 60000)
    return () => clearInterval(id)
  }, [triggerOTASync])

  // Computed stats
  const todayStr = new Date().toISOString().split('T')[0]
  const arrivalsToday   = bookings.filter(b => b.check_in === todayStr && b.status !== 'blocked')
  const departuresToday = bookings.filter(b => b.check_out === todayStr && b.status !== 'blocked')
  const currentGuests   = bookings.filter(b => b.status === 'confirmed' && todayStr >= b.check_in && todayStr < b.check_out)
  const occupiedRoomIds = new Set(currentGuests.map(g => g.room_id).filter(Boolean))
  const roomOccupancyRate = Math.round((occupiedRoomIds.size / 10) * 100)
  const totalRevenue = bookings.filter(b => b.status === 'confirmed').reduce((s, b) => s + (b.downpayment_paid ?? 0) + ((b.balance_due ?? 0) - (b.security_deposit ?? 0)), 0)

  return (
    <DashboardDataContext.Provider value={{
      rooms, venues, bookings, feeds, partnerDeals, expenses, expenseCategories, isLoading,
      isConfirming: isConfirmingBooking,
      confirmBooking, cancelBooking, createManualBooking,
      triggerOTASync, updateFeedUrls, createPartnerDeal, savePartnerDeals, deletePartnerDeal,
      createExpenseCategory, updateExpenseCategory, deleteExpenseCategory, createExpense, deleteExpense,
      onLogout: handleLogout
    }}>
      <div className={isCalendarTab ? "h-screen bg-background flex flex-col overflow-hidden pb-[56px] md:pb-0" : "min-h-screen bg-background pb-20 md:pb-6"}>
        {/* Header */}
        <header className={`sticky top-0 z-40 bg-card border-b border-soft ${isCalendarTab ? 'flex-shrink-0' : ''}`}>
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 flex items-center justify-center bg-brand-primary rounded-lg">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="leading-tight shrink-0">
                <h1 className="text-sm font-bold text-main">Daweez PMS</h1>
                <p className="text-[10px] text-brand-primary font-medium hidden sm:block">Property Management</p>
              </div>
            </div>

            {/* Inline Header Stats for tablet/desktop */}
            <div className="hidden sm:flex items-center gap-4 md:gap-6 text-xs border-l border-soft pl-4 md:pl-6 my-1">
              <div className="flex items-center gap-1 shrink-0">
                <Home className="w-3.5 h-3.5 text-brand-primary" />
                <span className="text-muted">Occ:</span>
                <span className="font-semibold text-main">{roomOccupancyRate}%</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <LogIn className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-muted">In:</span>
                <span className="font-semibold text-main">{arrivalsToday.length}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <LogOut className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-muted">Out:</span>
                <span className="font-semibold text-main">{departuresToday.length}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-muted">Guests:</span>
                <span className="font-semibold text-main">{currentGuests.length}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-muted">Earned:</span>
                <span className="font-bold text-emerald-600">₱{totalRevenue.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)} 
                className="flex items-center justify-center w-8 h-8 text-slate-500 border border-slate-200 bg-white hover:bg-slate-100 rounded-lg transition-all cursor-pointer dark:bg-card dark:border-soft dark:text-muted dark:hover:text-main"
                title="Toggle Dark Mode"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button 
                onClick={handleTriggerSync} 
                disabled={isSyncing}
                className={`flex items-center gap-1.5 text-xs font-medium border px-3 py-1.5 rounded-lg transition-all ${
                  isSyncing 
                    ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20 cursor-not-allowed' 
                    : 'text-brand-text border-brand-border bg-brand-bg hover:bg-brand-primary hover:text-white hover:border-brand-primary cursor-pointer'
                }`}>
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
              </button>
              <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-medium text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-600 hover:text-white hover:border-rose-600 px-3 py-1.5 rounded-lg transition-all cursor-pointer">
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Sync toast */}
        {syncSuccessMsg && (
          <div className="fixed top-16 right-4 sm:right-6 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 px-4 py-3 bg-brand-bg border border-brand-primary/30 text-brand-text text-sm font-medium rounded-xl shadow-lg shadow-black/5">
              <Sparkles className="w-4 h-4 shrink-0 text-brand-primary" />
              <span>{syncSuccessMsg}</span>
            </div>
          </div>
        )}

        {/* Mobile Stats Bar (Space efficient horizontal scroll below header) */}
        <div className={`sm:hidden bg-brand-bg border-b border-soft px-4 py-1.5 ${isCalendarTab ? 'flex-shrink-0' : ''}`}>
          <div className="flex items-center justify-between text-[10px] font-medium text-brand-text overflow-x-auto no-scrollbar gap-4">
            <div className="flex items-center gap-1 shrink-0">
              <Home className="w-3 h-3 text-brand-primary" />
              <span>Occ: <strong className="text-main">{roomOccupancyRate}%</strong></span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <LogIn className="w-3 h-3 text-emerald-600" />
              <span>In: <strong className="text-main">{arrivalsToday.length}</strong></span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <LogOut className="w-3 h-3 text-rose-600" />
              <span>Out: <strong className="text-main">{departuresToday.length}</strong></span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Users className="w-3 h-3 text-blue-600" />
              <span>Guests: <strong className="text-main">{currentGuests.length}</strong></span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span>Earned: <strong className="text-emerald-600">₱{totalRevenue.toLocaleString()}</strong></span>
            </div>
          </div>
        </div>

        {/* Desktop tabs */}
        <div className={`hidden md:block max-w-[1600px] w-full mx-auto px-4 sm:px-6 ${isCalendarTab ? 'flex-shrink-0' : ''}`}>
          <div className="flex border-b border-soft gap-1">
            {TABS.map(t => (
              <Link key={t.id} to={t.to}
                className="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted hover:text-main transition-all"
                activeProps={{ className: '!border-brand-primary !text-brand-text' }}>
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className={isCalendarTab 
          ? "max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-4 flex-1 min-h-0 flex flex-col overflow-hidden" 
          : "max-w-[1600px] mx-auto px-4 sm:px-6 py-4"
        }>
          <Outlet />
        </div>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-card border-t border-soft md:hidden">
          <div className="flex">
            {TABS.map(t => {
              const Icon = t.Icon
              return (
                <Link key={t.id} to={t.to}
                  className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-muted transition-all"
                  activeProps={{ className: '!text-brand-text' }}>
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
