import React, { useState, useEffect } from 'react'
import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useBookings } from '../hooks/useBookings'
import { DashboardDataContext } from './DashboardContext'
import {
  Sparkles, RefreshCw, LogOut, Home, LogIn, Users, TrendingUp,
  Calendar, ClipboardCheck, Settings
} from 'lucide-react'

const TABS = [
  { id: 'calendar',  label: 'Calendar',  Icon: Calendar, to: '/calendar' },
  { id: 'bookings',  label: 'Bookings',  Icon: ClipboardCheck, to: '/bookings' },
  { id: 'guests',    label: 'Guests',    Icon: Users, to: '/guests' },
  { id: 'settings',  label: 'Settings',  Icon: Settings, to: '/settings' },
]

export function DashboardLayout() {
  const navigate = useNavigate()
  const {
    rooms, venues, bookings, feeds,
    confirmBooking, cancelBooking, createManualBooking,
    triggerOTASync, updateFeedUrls, isLoading
  } = useBookings()

  const [syncSuccessMsg, setSyncSuccessMsg] = useState('')

  const handleLogout = () => {
    localStorage.removeItem('daweez_pms_auth')
    navigate({ to: '/login' })
  }

  const handleTriggerSync = async () => {
    try {
      const n = await triggerOTASync()
      setSyncSuccessMsg(`Sync complete — merged ${n} reservations.`)
      setTimeout(() => setSyncSuccessMsg(''), 5000)
    } catch { alert('Sync failed.') }
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
      rooms, venues, bookings, feeds, isLoading,
      confirmBooking, cancelBooking, createManualBooking,
      triggerOTASync, updateFeedUrls, onLogout: handleLogout
    }}>
      <div className="min-h-screen bg-slate-50 pb-20 md:pb-6">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 flex items-center justify-center bg-[#B89251] rounded-lg">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="leading-tight shrink-0">
                <h1 className="text-sm font-bold text-slate-900">Daweez PMS</h1>
                <p className="text-[10px] text-[#B89251] font-medium hidden sm:block">Property Management</p>
              </div>
            </div>

            {/* Inline Header Stats for tablet/desktop */}
            <div className="hidden sm:flex items-center gap-4 md:gap-6 text-xs border-l border-slate-200 pl-4 md:pl-6 my-1">
              <div className="flex items-center gap-1 shrink-0">
                <Home className="w-3.5 h-3.5 text-[#B89251]" />
                <span className="text-slate-400">Occ:</span>
                <span className="font-semibold text-slate-800">{roomOccupancyRate}%</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <LogIn className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-slate-400">In:</span>
                <span className="font-semibold text-slate-800">{arrivalsToday.length}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <LogOut className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-slate-400">Out:</span>
                <span className="font-semibold text-slate-800">{departuresToday.length}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-slate-400">Guests:</span>
                <span className="font-semibold text-slate-800">{currentGuests.length}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-slate-400">Rev:</span>
                <span className="font-semibold text-slate-800">₱{totalRevenue.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={handleTriggerSync} className="flex items-center gap-1.5 text-xs font-medium text-[#9A783E] border border-[#E5D5C0] bg-[#FDFBF7] hover:bg-[#B89251] hover:text-white hover:border-[#B89251] px-3 py-1.5 rounded-lg transition-all cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sync</span>
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
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-3">
            <div className="flex items-center gap-2 p-3 bg-[#FDFBF7] border border-[#E5D5C0] text-[#9A783E] text-xs font-medium rounded-lg">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{syncSuccessMsg}</span>
            </div>
          </div>
        )}

        {/* Mobile Stats Bar (Space efficient horizontal scroll below header) */}
        <div className="sm:hidden bg-[#FDFBF7] border-b border-[#E5D5C0]/65 px-4 py-1.5">
          <div className="flex items-center justify-between text-[10px] font-medium text-[#9A783E] overflow-x-auto no-scrollbar gap-4">
            <div className="flex items-center gap-1 shrink-0">
              <Home className="w-3 h-3 text-[#B89251]" />
              <span>Occ: <strong className="text-slate-800">{roomOccupancyRate}%</strong></span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <LogIn className="w-3 h-3 text-emerald-600" />
              <span>In: <strong className="text-slate-800">{arrivalsToday.length}</strong></span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <LogOut className="w-3 h-3 text-rose-600" />
              <span>Out: <strong className="text-slate-800">{departuresToday.length}</strong></span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Users className="w-3 h-3 text-blue-600" />
              <span>Guests: <strong className="text-slate-800">{currentGuests.length}</strong></span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <TrendingUp className="w-3 h-3 text-amber-600" />
              <span>Rev: <strong className="text-slate-800">₱{totalRevenue.toLocaleString()}</strong></span>
            </div>
          </div>
        </div>

        {/* Desktop tabs */}
        <div className="hidden md:block max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="flex border-b border-slate-200 gap-1">
            {TABS.map(t => (
              <Link key={t.id} to={t.to}
                className="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-all"
                activeProps={{ className: '!border-[#B89251] !text-[#9A783E]' }}>
                {t.label}{t.id === 'bookings' ? ` (${bookings.length})` : ''}
              </Link>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
          <Outlet />
        </div>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 md:hidden">
          <div className="flex">
            {TABS.map(t => {
              const Icon = t.Icon
              return (
                <Link key={t.id} to={t.to}
                  className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-slate-400 transition-all"
                  activeProps={{ className: '!text-[#9A783E]' }}>
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
