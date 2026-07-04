import React, { useState, useMemo } from 'react'
import { useDashboardData } from './DashboardContext'
import { GuestRecord } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState
} from '@tanstack/react-table'
import { ArrowUpDown, Search } from 'lucide-react'

export function GuestsTab() {
  const { bookings } = useDashboardData()
  const loyaltyRecords = useMemo(() => syncEngine.getGuestRecords(bookings), [bookings])

  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const columnHelper = createColumnHelper<GuestRecord>()

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <button type="button" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center gap-1 hover:text-slate-700">
          <span>Guest</span>
          <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: info => (
        <div>
          <span className="font-medium text-slate-800 block">{info.getValue()}</span>
          <span className="text-[10px] text-slate-400">{info.row.original.email}</span>
        </div>
      )
    }),
    columnHelper.accessor('phone', {
      header: 'Phone',
      cell: info => <span className="font-mono text-[10px] text-slate-500">{info.getValue()}</span>
    }),
    columnHelper.accessor('visit_count', {
      header: ({ column }) => (
        <button type="button" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center gap-1 hover:text-slate-700 mx-auto">
          <span>Visits</span>
          <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: info => <div className="text-center font-medium text-slate-800">{info.getValue()}</div>
    }),
    columnHelper.accessor('last_visit', {
      header: ({ column }) => (
        <button type="button" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center gap-1 hover:text-slate-700">
          <span>Last Stay</span>
          <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: info => <span className="font-mono text-[10px] text-slate-500">{info.getValue().split('T')[0]}</span>
    }),
    columnHelper.display({
      id: 'status',
      header: 'Status',
      cell: () => (
        <span className="text-[10px] font-medium text-[#9A783E] bg-[#FDFBF7] border border-[#E5D5C0] px-2 py-0.5 rounded">
          10% Discount
        </span>
      )
    })
  ], [columnHelper])

  const table = useReactTable({
    data: loyaltyRecords,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const search = filterValue.toLowerCase()
      return (
        row.original.name.toLowerCase().includes(search) ||
        row.original.email.toLowerCase().includes(search) ||
        row.original.phone.toLowerCase().includes(search)
      )
    }
  })

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden space-y-4 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Guest Loyalty</h3>
          <p className="text-xs text-slate-400 mt-0.5">Guests with 1+ past stays get an automatic 10% loyalty discount.</p>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Search guests..."
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 pl-10 pr-3.5 py-2 rounded-lg text-xs outline-none focus:bg-white focus:border-[#B89251] transition-all"
          />
        </div>
      </div>

      {loyaltyRecords.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">No guest records yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
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
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-xs text-slate-400">
                    No matching guest records found.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="py-3 px-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
