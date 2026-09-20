import React, { useState, useEffect } from 'react'
import { Link, Outlet, useNavigate, useLocation } from '@tanstack/react-router'
import { useBookings } from '../hooks/useBookings'
import { DashboardDataContext } from './DashboardContext'
import {
  Sparkles, RefreshCw, LogOut, BarChart3, TrendingUp,
  Calendar, Settings, Building, BookOpen, Tag, Boxes, Utensils
} from 'lucide-react'
import { ToastHost } from './Toast'
import { ConfirmHost } from './ConfirmDialog'

const TABS = [
  { id: 'calendar',  label: 'Calendar',  Icon: Calendar, to: '/calendar' },
  { id: 'bookings',  label: 'Bookings',  Icon: BookOpen, to: '/bookings' },
  { id: 'guests',    label: 'Corporate Partners', Icon: Building, to: '/guests' },
  { id: 'analytics', label: 'Analytics', Icon: BarChart3, to: '/analytics' },
  { id: 'expenses',  label: 'Expenses',  Icon: TrendingUp, to: '/expenses' },
  { id: 'housekeeping', label: 'Housekeeping', Icon: Boxes, to: '/housekeeping' },
  { id: 'restaurant', label: 'Restaurant', Icon: Utensils, to: '/restaurant' },
  { id: 'settings',  label: 'Settings',  Icon: Settings, to: '/settings' },
]

export function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    rooms, venues, bookings, feeds, partnerDeals, expenses, expenseCategories,
    confirmBooking, cancelBooking, createManualBooking, updateBooking,
    triggerOTASync, updateFeedUrls, updateRoomRate, updateRoomBeds, isLoading, isConfirmingBooking,
    createPartnerDeal, savePartnerDeals, deletePartnerDeal,
    createExpenseCategory, updateExpenseCategory, deleteExpenseCategory, createExpense, deleteExpense
  } = useBookings()

  const [syncSuccessMsg, setSyncSuccessMsg] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  // The promo ON/OFF switch is retired (card k128): there is ONE price now, so
  // there is nothing left to switch. A room's price is simply its price.

  const isCalendarTab = location.pathname === '/calendar' || location.pathname === '/'

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

  return (
    <DashboardDataContext.Provider value={{
      rooms, venues, bookings, feeds, partnerDeals, expenses, expenseCategories, isLoading,
      isConfirming: isConfirmingBooking,
      confirmBooking, cancelBooking, createManualBooking, updateBooking,
      triggerOTASync, updateFeedUrls, updateRoomRate, updateRoomBeds, createPartnerDeal, savePartnerDeals, deletePartnerDeal,
      createExpenseCategory, updateExpenseCategory, deleteExpenseCategory, createExpense, deleteExpense,
      onLogout: handleLogout
    }}>
      <div className={isCalendarTab ? "h-screen bg-background flex flex-col overflow-hidden pb-[56px] md:pb-0" : "min-h-screen bg-background pb-20 md:pb-6"}>
        <header className={`sticky top-0 z-40 bg-card border-b border-soft ${isCalendarTab ? 'flex-shrink-0' : ''}`}>
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-[56px] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 flex items-center justify-center bg-gold-400 rounded-xl ring-1 ring-gold-600/50">
                <Sparkles className="w-4 h-4 text-ink-900" />
              </div>
              <div className="leading-tight">
                <h1 className="text-[13px] font-bold tracking-tight text-main font-display">Daweez PMS</h1>
                <p className="text-[11px] text-muted font-medium hidden sm:block -mt-0.5">Pension House</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-1 p-1 bg-page/70 border border-soft rounded-xl">
              {TABS.map(t => (
                <Link key={t.id} to={t.to}
                  className="px-3.5 py-1.5 text-sm font-medium rounded-lg text-muted hover:text-brand-text hover:bg-card transition-colors"
                  activeProps={{ className: '!bg-gold-400 !text-ink-900 shadow-sm' }}>
                  {t.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-1.5">

              <button
                onClick={handleTriggerSync}
                disabled={isSyncing}
                className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold border rounded-xl px-3 py-1.5 transition-all cursor-pointer ${isSyncing ? 'bg-brand-primary/10 text-brand-text border-brand-primary/20' : 'bg-card border-soft text-main hover:bg-softbg'}`}>
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing' : 'Sync'}
              </button>
              <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-semibold text-muted border border-soft bg-card hover:bg-danger-50 hover:text-danger-600 hover:border-danger-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer">
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

        {/* Every "saved" / "could not save" message in the staff app lands here. */}
        <ToastHost />
        {/* Every "are you sure?" in the staff app lands here too. */}
        <ConfirmHost />


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