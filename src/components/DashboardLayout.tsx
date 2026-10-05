import React, { useState, useEffect } from 'react'
import { Link, Outlet, useNavigate, useLocation } from '@tanstack/react-router'
import { useBookings } from '../hooks/useBookings'
import { DashboardDataContext } from './DashboardContext'
import {
  Sparkles, RefreshCw, LogOut, Settings, ConciergeBell, Utensils, Boxes, PhilippinePeso
} from 'lucide-react'
import { ToastHost } from './Toast'
import { ConfirmHost } from './ConfirmDialog'

/**
 * **Four tabs, and the screens inside each** (the owner's ruling, 2026-10-04 — it replaced the six-tab idea on
 * card k75).
 *
 * There used to be eight tabs in one row, one per screen. A tab is now a part of the hotel, and it opens on the
 * screen staff use most: the FIRST in its list. The other screens are sub-tabs under the top bar, one tap away.
 * A new screen goes inside its part — it never becomes a fifth tab, and it never goes in the bottom bar, which
 * holds these four and nothing else.
 *
 * The addresses did not move (`/guests` is still Agencies, `/expenses` Today's money, `/analytics` the Earnings
 * report, `/housekeeping` the stock room), so an old bookmark lands where it always did.
 *
 * A part with one screen shows no sub-tabs. Restaurant has two: Orders, where the order is taken, and Kitchen,
 * where the cook reads it (Sebastian, 2026-10-04). Every screen is open to every member of staff — they swap
 * places through the day, and nothing is off limits to them.
 */
const TABS = [
  {
    label: 'Front desk', Icon: ConciergeBell,
    screens: [
      { label: 'Calendar', to: '/calendar' },
      { label: 'Bookings', to: '/bookings' },
      { label: 'Agencies', to: '/guests' },
    ],
  },
  {
    label: 'Restaurant', Icon: Utensils,
    screens: [
      { label: 'Orders', to: '/restaurant' },
      { label: 'Kitchen', to: '/restaurant/kitchen' },
    ],
  },
  {
    label: 'Stock', Icon: Boxes,
    screens: [
      { label: 'Stock room', to: '/housekeeping' },
      { label: 'What a dish uses', to: '/housekeeping/dishes' },
      { label: 'Cleaning checklist', to: '/housekeeping/cleaning' },
    ],
  },
  {
    label: 'Money', Icon: PhilippinePeso,
    screens: [
      { label: "Today's money", to: '/expenses' },
      { label: 'Earnings report', to: '/analytics' },
    ],
  },
]

export function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    rooms, venues, bookings, allBookings, feeds, partnerDeals, expenses, expenseCategories,
    confirmBooking, cancelBooking, deleteBooking, createManualBooking, updateBooking,
    triggerOTASync, updateFeedUrls, updateRoomRate, updateRoomBreakfastPrice, updateRoomHourPrices, isLoading, isConfirmingBooking,
    createPartnerDeal, savePartnerDeals, deletePartnerDeal,
    createExpenseCategory, updateExpenseCategory, deleteExpenseCategory, createExpense, deleteExpense
  } = useBookings()

  const [syncSuccessMsg, setSyncSuccessMsg] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  // The promo ON/OFF switch is retired (card k128): there is ONE price now, so
  // there is nothing left to switch. A room's price is simply its price.

  // Where the desk is now. The tab is found by the start of the address, so `/housekeeping/dishes` still lights
  // up Stock; the screen is the exact match, or the tab's first screen when the address names none.
  const here = location.pathname.replace(/\/+$/, '') || '/'
  const currentTab = TABS.find(tab => tab.screens.some(s => here === s.to || here.startsWith(s.to + '/')))
  const currentScreen = currentTab?.screens.find(s => s.to === here) ?? currentTab?.screens[0]
  const subTabs = currentTab && currentTab.screens.length > 1 ? currentTab.screens : null
  const isCalendarTab = here === '/calendar' || here === '/'
  const isSettings = here === '/settings'
  // The till is used on a tablet or a phone most of the time (Sebastian, 2026-10-04). It
  // fills the screen and scrolls only its menu, so who is being served and the order
  // itself stay in reach of a thumb — unless the screen is too short for that (a phone on
  // its side), where the page scrolls as it always did.
  const isTill = here === '/restaurant'

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
      rooms, venues, bookings, allBookings, feeds, partnerDeals, expenses, expenseCategories, isLoading,
      isConfirming: isConfirmingBooking,
      confirmBooking, cancelBooking, deleteBooking, createManualBooking, updateBooking,
      triggerOTASync, updateFeedUrls, updateRoomRate, updateRoomBreakfastPrice, updateRoomHourPrices, createPartnerDeal, savePartnerDeals, deletePartnerDeal,
      createExpenseCategory, updateExpenseCategory, deleteExpenseCategory, createExpense, deleteExpense,
      onLogout: handleLogout
    }}>
      <div className={isCalendarTab ? "h-screen bg-background flex flex-col overflow-hidden pb-[calc(57px+env(safe-area-inset-bottom,0px))] lg:pb-0"
        : isTill ? "min-h-[100dvh] tall:h-[100dvh] tall:min-h-0 tall:flex tall:flex-col tall:overflow-hidden bg-background pb-[calc(57px+env(safe-area-inset-bottom,0px))] lg:pb-0"
          : "min-h-screen bg-background pb-20 lg:pb-6"}>
        <header className={`sticky top-0 z-40 bg-card border-b border-soft ${isCalendarTab || isTill ? 'flex-shrink-0' : ''}`}>
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

            <nav aria-label="Main" className="hidden lg:flex items-center gap-1 p-1 bg-page/70 border border-soft rounded-xl">
              {TABS.map(tab => {
                const isOn = tab === currentTab
                return (
                  <Link key={tab.label} to={tab.screens[0].to} activeOptions={{ exact: true }}
                    aria-current={isOn ? (currentScreen === tab.screens[0] ? 'page' : 'true') : undefined}
                    // A tablet held sideways is as wide as a PC and gets this bar too, so it is
                    // finger-sized (44px) unless there is a mouse.
                    className={'flex items-center gap-1.5 px-3.5 min-h-11 mouse:min-h-8 text-sm font-medium rounded-lg transition-colors ' +
                      (isOn ? 'bg-gold-400 text-ink-900 shadow-sm' : 'text-muted hover:text-brand-text hover:bg-card')}>
                    <tab.Icon className="w-4 h-4" aria-hidden="true" />
                    {tab.label}
                  </Link>
                )
              })}
            </nav>

            {/* Settings is the gear, and Logout sits past a divider: neither is one of the four tabs. They are
                finger-sized (44px) unless there is a mouse. */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleTriggerSync}
                disabled={isSyncing}
                className={`hidden sm:flex items-center gap-1.5 h-11 mouse:h-8 text-xs font-semibold border rounded-xl px-3 transition-all cursor-pointer ${isSyncing ? 'bg-brand-primary/10 text-brand-text border-brand-primary/20' : 'bg-card border-soft text-main hover:bg-softbg'}`}>
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing' : 'Sync'}
              </button>
              <Link to="/settings" activeOptions={{ exact: true }} aria-label="Settings" title="Settings"
                className={'flex items-center justify-center w-11 h-11 mouse:w-8 mouse:h-8 border rounded-xl transition-colors ' +
                  (isSettings ? 'bg-gold-400 border-gold-400 text-ink-900' : 'bg-card border-soft text-muted hover:text-main hover:bg-softbg')}>
                <Settings className="w-4 h-4" aria-hidden="true" />
              </Link>
              <span className="w-px h-5 bg-soft mx-1" aria-hidden="true" />
              <button onClick={handleLogout} aria-label="Logout" className="flex items-center justify-center gap-1.5 w-11 sm:w-auto h-11 mouse:h-8 text-xs font-semibold text-muted border border-soft bg-card hover:bg-danger-50 hover:text-danger-600 hover:border-danger-200 sm:px-3 rounded-xl transition-colors cursor-pointer">
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>

          {subTabs && (
            <nav aria-label={currentTab?.label} className="border-t border-soft">
              <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar">
                {subTabs.map(s => {
                  const isOn = s === currentScreen
                  return (
                    <Link key={s.to} to={s.to} activeOptions={{ exact: true }}
                      aria-current={isOn ? 'page' : undefined}
                      className={'flex items-center h-11 mouse:h-10 border-b-2 text-[13px] sm:text-sm font-medium whitespace-nowrap transition-colors ' +
                        (isOn ? 'border-gold-600 text-main' : 'border-transparent text-muted hover:text-main')}>
                      {s.label}
                    </Link>
                  )
                })}
              </div>
            </nav>
          )}

          {/* Hangs under the header, however tall it is — with or without the sub-tabs. */}
          {syncSuccessMsg && (
            <div className="absolute top-full right-4 mt-2 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-card border border-soft text-sm font-medium rounded-xl shadow-soft">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {syncSuccessMsg}
              </div>
            </div>
          )}
        </header>

        {/* Every "saved" / "could not save" message in the staff app lands here. */}
        <ToastHost />
        {/* Every "are you sure?" in the staff app lands here too. */}
        <ConfirmHost />


        <div className={isCalendarTab
          ? "max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-4 flex-1 min-h-0 flex flex-col overflow-hidden"
          : isTill ? "max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-3 lg:py-4 tall:flex-1 tall:min-h-0 tall:flex tall:flex-col"
            : "max-w-[1600px] mx-auto px-4 sm:px-6 py-4"
        }>
          <Outlet />
        </div>

        {/* Tablet and phone: the four tabs, and only the four. A tab's other screens are the sub-tabs at the top. */}
        <nav aria-label="Main" className="fixed bottom-0 inset-x-0 z-40 bg-card border-t border-soft lg:hidden safe-bottom">
          <div className="flex h-14">
            {TABS.map(tab => {
              const isOn = tab === currentTab
              return (
                <Link key={tab.label} to={tab.screens[0].to} activeOptions={{ exact: true }}
                  aria-current={isOn ? (currentScreen === tab.screens[0] ? 'page' : 'true') : undefined}
                  className={'flex-1 flex flex-col items-center justify-center gap-0.5 border-t-2 -mt-px text-xs transition-colors ' +
                    (isOn ? 'border-gold-600 font-semibold text-brand-text' : 'border-transparent font-medium text-muted')}>
                  <tab.Icon className="w-5 h-5" aria-hidden="true" />
                  <span>{tab.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </DashboardDataContext.Provider>
  )
}