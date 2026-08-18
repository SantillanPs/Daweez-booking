import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useDashboardData } from './DashboardContext'
import { Search, CalendarDays, User, MapPin, Building, Printer, FileText } from 'lucide-react'
import { Booking } from '../types/booking'
import { PrintInvoiceModal } from './billing/PrintInvoiceModal'
import { BookingDetailsModal } from './billing/BookingDetailsModal'
import { PaymentStatusSelect } from './billing/PaymentStatusSelect'
import { getPaymentView, isOwed, PAYMENT_BADGE_CLASSES } from '../utils/bookingMoney'

type MoneyFilter = 'all' | 'owes' | 'paid'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function BookingsListTab() {
  const { bookings, rooms, venues, updateBooking } = useDashboardData()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [moneyFilter, setMoneyFilter] = useState<MoneyFilter>('all')
  const [printBooking, setPrintBooking] = useState<Booking | null>(null)
  const [detailsBooking, setDetailsBooking] = useState<Booking | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm), 200)
    return () => clearTimeout(id)
  }, [searchTerm])

  const getUnitName = useCallback((booking: Booking) => {
    if (booking.room_id) {
      const r = rooms.find(r => r.id === booking.room_id)
      return r ? `Room ${r.room_number}: ${r.name}` : booking.room_id
    }
    if (booking.venue_id) {
      const v = venues.find(v => v.id === booking.venue_id)
      return v ? v.name : booking.venue_id
    }
    return 'Unknown'
  }, [rooms, venues])

  // Today in the same YYYY-MM-DD form as check_in / check_out.
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  const visibleBookings = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return bookings
      .filter(b => {
        if (moneyFilter === 'owes' && !isOwed(b)) return false
        if (moneyFilter === 'paid' && (b.payment_status !== 'paid' || b.status === 'blocked')) return false
        if (q) {
          const guest = b.guest_name.toLowerCase()
          const inv = (b.invoice_number || '').toLowerCase()
          const unit = getUnitName(b).toLowerCase()
          if (!guest.includes(q) && !inv.includes(q) && !unit.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        const aUpcoming = a.check_in >= todayStr
        const bUpcoming = b.check_in >= todayStr
        if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1
        return aUpcoming
          ? a.check_in.localeCompare(b.check_in)
          : b.check_in.localeCompare(a.check_in)
      })
  }, [bookings, debouncedSearch, moneyFilter, getUnitName, todayStr])

  // The number staff ask for most: how much is still owed, right now.
  const owesSummary = useMemo(() => {
    const owed = bookings.filter(b => isOwed(b))
    return {
      count: owed.length,
      total: owed.reduce((sum, b) => sum + (b.balance_due || 0), 0)
    }
  }, [bookings])

  const handlePaymentStatusChange = useCallback(async (booking: Booking, status: 'unpaid' | 'downpayment' | 'paid') => {
    try {
      await updateBooking({ ...booking, payment_status: status, balance_due: status === 'paid' ? 0 : booking.balance_due })
    } catch {
      window.alert('Could not update the payment. Please try again.')
    }
  }, [updateBooking])

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-main flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-brand-primary" />
            Bookings
          </h2>
          <p className="text-sm text-muted">Find a stay, print an invoice, or see who still owes</p>
        </div>
      </div>

      <div className="bg-card border border-soft rounded-2xl shadow-sm overflow-hidden">
        {/* Search + one-tap money filters */}
        <div className="p-4 border-b border-soft flex flex-col gap-3 bg-brand-bg/50">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by guest name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-card border border-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all text-main"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'owes', 'paid'] as MoneyFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setMoneyFilter(f)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  moneyFilter === f
                    ? 'bg-brand-primary text-white'
                    : 'bg-page text-muted border border-soft hover:bg-brand-bg'
                }`}
              >
                {f === 'all' ? 'All stays' : f === 'owes' ? 'Who owes' : 'Paid'}
              </button>
            ))}
          </div>
        </div>

        {/* Who-owes headline */}
        <div className="px-4 sm:px-6 py-3 border-b border-soft flex items-center justify-between gap-3 bg-brand-bg/30">
          <span className={`text-sm font-extrabold ${owesSummary.count === 0 ? 'text-emerald-600' : 'text-main'}`}>
            {owesSummary.count === 0
              ? 'Everyone has paid 🎉'
              : `Who owes right now: ${owesSummary.count} ${owesSummary.count === 1 ? 'stay' : 'stays'} · ₱${owesSummary.total.toLocaleString()}`}
          </span>
          <span className="text-[10px] text-muted hidden sm:block">Upcoming stays first</span>
        </div>

        {/* Booking list */}
        {visibleBookings.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-semibold text-main">
              {moneyFilter === 'owes'
                ? 'Nothing owed right now. 🎉'
                : debouncedSearch
                  ? `No bookings found for “${debouncedSearch}”.`
                  : 'No bookings yet.'}
            </p>
            <p className="text-xs text-muted mt-1">
              {debouncedSearch
                ? 'Try a different name, or clear the search.'
                : moneyFilter === 'owes'
                  ? 'Check the “All stays” filter to see every booking.'
                  : 'Add a stay from the Calendar or the New Booking button.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-soft">
            {visibleBookings.map(b => {
              const pay = getPaymentView(b)
              const isVenue = !!b.venue_id
              return (
                <div key={b.id} className="px-4 sm:px-6 py-4 flex flex-col gap-2.5 hover:bg-brand-bg/30 transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-brand-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-main truncate">{b.guest_name}</div>
                        {b.guest_phone !== 'None' && (
                          <div className="text-xs text-muted truncate">{b.guest_phone}</div>
                        )}
                      </div>
                    </div>
                    {b.status !== 'blocked' && (
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-extrabold whitespace-nowrap ${PAYMENT_BADGE_CLASSES[pay.tone]}`}>
                        {pay.label}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
                    <span className="text-main font-medium">
                      {fmtDate(b.check_in)} <span className="text-muted mx-0.5">→</span> {fmtDate(b.check_out)}
                    </span>
                    <span className="flex items-center gap-1">
                      {isVenue
                        ? <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                        : <Building className="w-3.5 h-3.5 text-blue-500" />}
                      {getUnitName(b)}
                    </span>
                    {b.invoice_number && (
                      <span className="font-mono text-[10px] bg-brand-bg border border-soft/50 px-1.5 py-0.5 rounded">
                        {b.invoice_number}
                      </span>
                    )}
                    {b.status === 'pending' && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Not confirmed
                      </span>
                    )}
                    {b.status === 'blocked' && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        Blocked
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setPrintBooking(b)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-soft bg-card text-main hover:bg-page transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-brand-primary" /> Print invoice
                    </button>
                    {b.status !== 'blocked' && (
                      <PaymentStatusSelect booking={b} onChange={handlePaymentStatusChange} />
                    )}
                    <button
                      onClick={() => setDetailsBooking(b)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-soft bg-card text-main hover:bg-page transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-brand-primary" /> Details
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {printBooking && (
        <PrintInvoiceModal
          booking={printBooking}
          rooms={rooms}
          venues={venues}
          bookingsList={bookings}
          onClose={() => setPrintBooking(null)}
        />
      )}
      {detailsBooking && (
        <BookingDetailsModal
          booking={detailsBooking}
          rooms={rooms}
          venues={venues}
          bookingsList={bookings}
          onClose={() => setDetailsBooking(null)}
          onPaymentStatusChange={handlePaymentStatusChange}
        />
      )}
    </div>
  )
}
