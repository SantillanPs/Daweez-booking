import React, { useState, useMemo } from 'react'
import { useDashboardData } from './DashboardContext'
import { Search, Filter, CalendarDays, User, Building, MapPin, BadgeDollarSign, Calendar as CalendarIcon, CheckCircle2, XCircle, Clock, Edit } from 'lucide-react'
import { Booking } from '../types/booking'
import { EditBookingModal } from './EditBookingModal'

export function BookingsListTab() {
  const { bookings, rooms, venues, updateBooking } = useDashboardData()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<Booking['status'] | 'all'>('all')
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  
  const getUnitName = (booking: Booking) => {
    if (booking.room_id) {
      const r = rooms.find(r => r.id === booking.room_id)
      return r ? `Room ${r.room_number}: ${r.name}` : booking.room_id
    }
    if (booking.venue_id) {
      const v = venues.find(v => v.id === booking.venue_id)
      return v ? v.name : booking.venue_id
    }
    return 'Unknown'
  }

  const sortedAndFilteredBookings = useMemo(() => {
    return bookings
      .filter(b => {
        if (filterStatus !== 'all' && b.status !== filterStatus) return false
        if (searchTerm) {
          const search = searchTerm.toLowerCase()
          const guest = b.guest_name.toLowerCase()
          const inv = (b.invoice_number || '').toLowerCase()
          const unit = getUnitName(b).toLowerCase()
          return guest.includes(search) || inv.includes(search) || unit.includes(search)
        }
        return true
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [bookings, searchTerm, filterStatus, rooms, venues])

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-main flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-brand-primary" />
            All Bookings
          </h2>
          <p className="text-sm text-muted">Review and search all reservations</p>
        </div>
      </div>

      <div className="bg-card border border-soft rounded-2xl shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-soft flex flex-col sm:flex-row items-center gap-4 bg-brand-bg/50">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by guest, invoice, or room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-card border border-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all text-main"
            />
          </div>
          
          <div className="relative w-full sm:w-48 shrink-0">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-card border border-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all text-main appearance-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-brand-bg/80 text-muted uppercase text-[10px] tracking-wider border-b border-soft">
              <tr>
                <th className="px-6 py-4 font-semibold">Invoice / Source</th>
                <th className="px-6 py-4 font-semibold">Guest</th>
                <th className="px-6 py-4 font-semibold">Dates</th>
                <th className="px-6 py-4 font-semibold">Unit</th>
                <th className="px-6 py-4 font-semibold text-right">Financials</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-soft">
              {sortedAndFilteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    No bookings found matching your search.
                  </td>
                </tr>
              ) : (
                sortedAndFilteredBookings.map((b) => {
                  const isVenue = !!b.venue_id
                  
                  return (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs text-main bg-brand-bg px-2 py-1 rounded inline-block border border-soft/50">
                          {b.invoice_number || 'N/A'}
                        </div>
                        <div className="text-[10px] text-muted mt-1 uppercase tracking-wider font-semibold">
                          {b.source}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-brand-primary" />
                          </div>
                          <div>
                            <div className="font-semibold text-main">{b.guest_name}</div>
                            {b.guest_phone !== 'None' && (
                              <div className="text-xs text-muted mt-0.5">{b.guest_phone}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-main">
                          <CalendarIcon className="w-3.5 h-3.5 text-muted shrink-0" />
                          <span>{new Date(b.check_in).toLocaleDateString()} <span className="text-muted mx-1">→</span> {new Date(b.check_out).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isVenue ? (
                            <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <Building className="w-4 h-4 text-blue-500 shrink-0" />
                          )}
                          <span className="font-medium text-main">{getUnitName(b)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-medium text-main">
                          Paid: ₱{(b.downpayment_paid || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted mt-0.5">
                          Bal: ₱{(b.balance_due || 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                          b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' :
                          b.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400 border border-slate-200 dark:border-slate-500/20'
                        }`}>
                          {b.status === 'confirmed' && <CheckCircle2 className="w-3 h-3" />}
                          {b.status === 'pending' && <Clock className="w-3 h-3" />}
                          {b.status === 'blocked' && <XCircle className="w-3 h-3" />}
                          {b.status}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setEditingBooking(b)}
                          className="p-1.5 text-muted hover:text-brand-primary bg-page hover:bg-brand-bg rounded transition-colors cursor-pointer"
                          title="Edit Booking"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingBooking && (
        <EditBookingModal
          booking={editingBooking}
          onClose={() => setEditingBooking(null)}
          onSave={async (updated) => {
            await updateBooking(updated)
          }}
        />
      )}
    </div>
  )
}
