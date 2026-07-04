import React, { useState, useMemo } from 'react'
import { useDashboardData } from './DashboardContext'
import { Booking } from '../types/booking'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState
} from '@tanstack/react-table'
import {
  Clock, ClipboardCheck, Eye, Trash2, X, ArrowUpDown
} from 'lucide-react'

export function BookingsTab() {
  const { rooms, venues, bookings, confirmBooking, cancelBooking } = useDashboardData()
  const [selectedReceiptData, setSelectedReceiptData] = useState<Booking | null>(null)

  // 1. Filter bookings
  const pendingBookings = useMemo(() => bookings.filter(b => b.status === 'pending'), [bookings])
  const confirmedBookings = useMemo(() => bookings.filter(b => b.status === 'confirmed' || b.status === 'blocked'), [bookings])

  // 2. Define TanStack table sorting states
  const [pendingSorting, setPendingSorting] = useState<SortingState>([])
  const [confirmedSorting, setConfirmedSorting] = useState<SortingState>([])

  // 3. Setup column helper
  const columnHelper = createColumnHelper<Booking>()

  // Columns for Pending Reservations
  const pendingColumns = useMemo(() => [
    columnHelper.accessor('id', {
      header: ({ column }) => (
        <button type="button" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center gap-1 hover:text-slate-700">
          <span>ID</span>
          <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: info => <span className="font-mono text-[10px] text-[#9A783E]">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: 'roomVenue',
      header: 'Room/Venue',
      cell: props => {
        const b = props.row.original
        const room = rooms.find(r => r.id === b.room_id)
        const venue = venues.find(v => v.id === b.venue_id)
        return <span className="font-medium text-slate-800">{room ? `Room ${room.room_number}` : venue?.name}</span>
      }
    }),
    columnHelper.accessor('guest_name', {
      header: ({ column }) => (
        <button type="button" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center gap-1 hover:text-slate-700">
          <span>Guest</span>
          <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: info => {
        const b = info.row.original
        return (
          <div>
            <span className="font-medium text-slate-800 block">{info.getValue()}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-slate-400">{b.guest_phone}</span>
              {b.companions && b.companions.length > 0 && (
                <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200/60 px-1.5 py-0.25 rounded font-medium shrink-0">
                  {b.companions.length + 1} Guests
                </span>
              )}
            </div>
          </div>
        )
      }
    }),
    columnHelper.accessor('check_in', {
      header: ({ column }) => (
        <button type="button" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center gap-1 hover:text-slate-700">
          <span>Dates</span>
          <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: info => {
        const b = info.row.original
        const hasCheckOut = rooms.some(r => r.id === b.room_id)
        return <span className="font-mono text-[10px] text-slate-500">{b.check_in} {hasCheckOut ? `→ ${b.check_out}` : ''}</span>
      }
    }),
    columnHelper.accessor('downpayment_paid', {
      header: 'Downpay',
      cell: info => <span className="font-medium text-emerald-600">₱{(info.getValue() ?? 0).toLocaleString()}</span>
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: props => {
        const b = props.row.original
        return (
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedReceiptData(b)} className="text-[#9A783E] hover:underline flex items-center gap-1 cursor-pointer">
              <Eye className="w-3 h-3" /><span>Verify</span>
            </button>
            <button onClick={() => confirmBooking(b.id)}
              className="bg-[#B89251] hover:bg-[#9A783E] text-white font-medium text-[10px] uppercase px-2 py-1 rounded-lg transition-colors cursor-pointer">
              Confirm
            </button>
            <button onClick={() => cancelBooking(b.id)} className="text-rose-500 hover:text-rose-700 font-medium cursor-pointer">Release</button>
          </div>
        )
      }
    })
  ], [rooms, venues, columnHelper, confirmBooking, cancelBooking])

  // Columns for Confirmed Reservations
  const confirmedColumns = useMemo(() => [
    columnHelper.display({
      id: 'roomVenue',
      header: 'Room/Venue',
      cell: props => {
        const b = props.row.original
        const room = rooms.find(r => r.id === b.room_id)
        const venue = venues.find(v => v.id === b.venue_id)
        return <span className="font-medium text-slate-800">{room ? `Room ${room.room_number}` : venue?.name}</span>
      }
    }),
    columnHelper.accessor('guest_name', {
      header: ({ column }) => (
        <button type="button" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center gap-1 hover:text-slate-700">
          <span>Guest</span>
          <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: info => {
        const b = info.row.original
        return (
          <div>
            <span className="font-medium text-slate-800 block">{info.getValue()}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-slate-400">{b.guest_phone}</span>
              {b.companions && b.companions.length > 0 && (
                <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200/60 px-1.5 py-0.25 rounded font-medium shrink-0">
                  {b.companions.length + 1} Guests
                </span>
              )}
            </div>
          </div>
        )
      }
    }),
    columnHelper.accessor('check_in', {
      header: ({ column }) => (
        <button type="button" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center gap-1 hover:text-slate-700">
          <span>Dates</span>
          <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: info => {
        const b = info.row.original
        const hasCheckOut = rooms.some(r => r.id === b.room_id)
        return <span className="font-mono text-[10px] text-slate-500">{b.check_in} {hasCheckOut ? `→ ${b.check_out}` : ''}</span>
      }
    }),
    columnHelper.display({
      id: 'payment',
      header: 'Payment',
      cell: props => {
        const b = props.row.original
        return (
          <div className="text-[10px] space-y-0.5">
            <div><span className="text-slate-400">Paid:</span> <span className="font-medium text-emerald-600">₱{(b.downpayment_paid ?? 0).toLocaleString()}</span></div>
            {b.status !== 'blocked' && <div><span className="text-slate-400">Due:</span> <span className="font-medium text-[#9A783E]">₱{(b.balance_due ?? 0).toLocaleString()}</span></div>}
          </div>
        )
      }
    }),
    columnHelper.accessor('source', {
      header: ({ column }) => (
        <button type="button" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center gap-1 hover:text-slate-700">
          <span>Source</span>
          <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: info => {
        const source = info.getValue()
        return (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded border uppercase ${source === 'airbnb' || source === 'booking_com' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-[#9A783E] bg-[#FDFBF7] border-[#E5D5C0]'}`}>
            {source}
          </span>
        )
      }
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: props => {
        const b = props.row.original
        return (
          <button onClick={() => cancelBooking(b.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-1 cursor-pointer">
            <Trash2 className="w-4 h-4" />
          </button>
        )
      }
    })
  ], [rooms, venues, columnHelper, cancelBooking])

  // Initialize TanStack Tables
  const pendingTable = useReactTable({
    data: pendingBookings,
    columns: pendingColumns,
    state: {
      sorting: pendingSorting,
    },
    onSortingChange: setPendingSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const confirmedTable = useReactTable({
    data: confirmedBookings,
    columns: confirmedColumns,
    state: {
      sorting: confirmedSorting,
    },
    onSortingChange: setConfirmedSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="space-y-6">
      {/* Pending queue */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-800">Pending ({pendingBookings.length})</h3>
        </div>
        <div className="p-4">
          {pendingBookings.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No pending reservations.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  {pendingTable.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id} className="border-b border-slate-100 text-slate-500 text-[10px] uppercase tracking-wider font-medium">
                      {headerGroup.headers.map(header => (
                        <th key={header.id} className="py-2 px-3">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {pendingTable.getRowModel().rows.map(row => (
                    <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="py-3 px-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
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
          <h3 className="text-sm font-semibold text-slate-800">Confirmed ({confirmedBookings.length})</h3>
        </div>
        <div className="p-4">
          {confirmedBookings.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No confirmed reservations.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  {confirmedTable.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id} className="border-b border-slate-100 text-slate-500 text-[10px] uppercase tracking-wider font-medium">
                      {headerGroup.headers.map(header => (
                        <th key={header.id} className="py-2 px-3">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {confirmedTable.getRowModel().rows.map(row => (
                    <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="py-3 px-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Receipt verification modal ── */}
      {selectedReceiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
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
                  {rooms.some(r => r.id === selectedReceiptData.room_id) && <div><span className="text-slate-400">Check-in:</span> {selectedReceiptData.check_in}</div>}
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
