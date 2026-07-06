import React, { useState, useMemo } from 'react'
import { useDashboardData } from './DashboardContext'
import { calculatePricing } from '../utils/syncEngine'
import { Booking } from '../types/booking'
import { 
  TrendingUp, Home, DollarSign, Calendar, Info, 
  ChevronRight, ToggleLeft, ToggleRight, Sparkles 
} from 'lucide-react'

// Helper: check if a date is within start and end strings (YYYY-MM-DD)
function isDateBetween(dStr: string, startStr: string, endStr: string): boolean {
  return dStr >= startStr && dStr <= endStr
}

// Helper: get array of dates between checkIn and checkOut (checkIn inclusive, checkOut exclusive)
function getStayDates(checkIn: string, checkOut: string): string[] {
  const dates: string[] = []
  let curr = new Date(checkIn)
  const end = new Date(checkOut)
  while (curr < end) {
    dates.push(curr.toISOString().split('T')[0])
    curr.setDate(curr.getDate() + 1)
  }
  return dates
}

export function AnalyticsTab() {
  const { bookings, rooms, venues, isLoading } = useDashboardData()

  // 1. Timeframe Filter state
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('monthly')
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date()
    d.setDate(1) // Start of month
    return d.toISOString().split('T')[0]
  })
  const [customEnd, setCustomEnd] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // 2. Booking Status Filter state
  const [confirmedOnly, setConfirmedOnly] = useState<boolean>(true)

  // 3. Hover state for tooltips
  const [hoveredBar, setHoveredBar] = useState<{
    label: string
    pension: number
    vacationHouse: number
    gardenArea: number
    gazebo: number
    x: number
    y: number
  } | null>(null)

  const [hoveredDonutSegment, setHoveredDonutSegment] = useState<string | null>(null)

  // 4. Resolve date ranges based on chosen timeframe
  const dateRange = useMemo(() => {
    const today = new Date()
    let startStr = ''
    let endStr = ''

    if (timeframe === 'daily') {
      // Daily shows last 7 days ending today for trend view
      const start = new Date(today)
      start.setDate(today.getDate() - 6)
      startStr = start.toISOString().split('T')[0]
      endStr = today.toISOString().split('T')[0]
    } else if (timeframe === 'weekly') {
      // Current week (Mon-Sun)
      const day = today.getDay()
      const diff = today.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
      const start = new Date(today.setDate(diff))
      startStr = start.toISOString().split('T')[0]
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      endStr = end.toISOString().split('T')[0]
    } else if (timeframe === 'monthly') {
      // Current calendar month
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      startStr = start.toISOString().split('T')[0]
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      endStr = end.toISOString().split('T')[0]
    } else if (timeframe === 'yearly') {
      // Current calendar year
      startStr = `${today.getFullYear()}-01-01`
      endStr = `${today.getFullYear()}-12-31`
    } else {
      startStr = customStart
      endStr = customEnd
    }

    return { start: startStr, end: endStr }
  }, [timeframe, customStart, customEnd])

  // 5. Apportion bookings and aggregate revenues
  const calculations = useMemo(() => {
    if (isLoading) return null

    // Filter relevant bookings based on status
    const statusSet = confirmedOnly ? ['confirmed'] : ['confirmed', 'pending']
    const relevantBookings = bookings.filter(b => statusSet.includes(b.status))

    let totalRevenue = 0
    let totalPensionBase = 0
    let totalPensionBreakfast = 0
    let totalPensionRentals = 0
    
    let totalVacationHouse = 0
    let totalGardenArea = 0
    let totalGazebo = 0
    let totalAddonsRentals = 0

    // For room occupancy: count booked room-nights
    let roomNightsBooked = 0

    // Construct array of all calendar dates in selected range to build trend chart slots
    const rangeStart = new Date(dateRange.start)
    const rangeEnd = new Date(dateRange.end)
    const allRangeDates: string[] = []
    let curr = new Date(rangeStart)
    while (curr <= rangeEnd) {
      allRangeDates.push(curr.toISOString().split('T')[0])
      curr.setDate(curr.getDate() + 1)
    }

    // Initialize trend slots based on timeframe grouping
    let trendSlots: { label: string; start: string; end: string; pension: number; vacationHouse: number; gardenArea: number; gazebo: number }[] = []

    if (timeframe === 'daily' || (timeframe === 'custom' && allRangeDates.length <= 7)) {
      trendSlots = allRangeDates.map(d => ({
        label: new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        start: d,
        end: d,
        pension: 0,
        vacationHouse: 0,
        gardenArea: 0,
        gazebo: 0
      }))
    } else if (timeframe === 'weekly' || (timeframe === 'custom' && allRangeDates.length <= 14)) {
      trendSlots = allRangeDates.map(d => ({
        label: new Date(d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
        start: d,
        end: d,
        pension: 0,
        vacationHouse: 0,
        gardenArea: 0,
        gazebo: 0
      }))
    } else if (timeframe === 'monthly' || (timeframe === 'custom' && allRangeDates.length <= 60)) {
      // Group by weeks
      const numWeeks = Math.ceil(allRangeDates.length / 7)
      for (let i = 0; i < numWeeks; i++) {
        const startIdx = i * 7
        const endIdx = Math.min(startIdx + 6, allRangeDates.length - 1)
        const wStart = allRangeDates[startIdx]
        const wEnd = allRangeDates[endIdx]
        
        const labelStr = `W${i + 1} (${new Date(wStart).getDate()}-${new Date(wEnd).getDate()})`
        trendSlots.push({
          label: labelStr,
          start: wStart,
          end: wEnd,
          pension: 0,
          vacationHouse: 0,
          gardenArea: 0,
          gazebo: 0
        })
      }
    } else {
      // Group by months (for yearly or long custom range)
      const monthsSet = new Set<string>()
      allRangeDates.forEach(d => monthsSet.add(d.substring(0, 7))) // YYYY-MM
      
      const months = Array.from(monthsSet).sort()
      trendSlots = months.map(m => {
        const [year, month] = m.split('-')
        const labelStr = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('en-US', { month: 'short' })
        
        // Find exact start/end date for this month inside range
        const monthDates = allRangeDates.filter(d => d.startsWith(m))
        return {
          label: `${labelStr} ${year.substring(2)}`,
          start: monthDates[0],
          end: monthDates[monthDates.length - 1],
          pension: 0,
          vacationHouse: 0,
          gardenArea: 0,
          gazebo: 0
        }
      })
    }

    // Process each booking
    relevantBookings.forEach(b => {
      // 1. Calculate pricing details
      const priceResult = calculatePricing({
        roomId: b.room_id,
        venueId: b.venue_id,
        checkIn: b.check_in,
        checkOut: b.check_out,
        guestEmail: b.guest_email,
        breakfastOrders: b.breakfast_orders,
        equipmentRentals: b.equipment_rentals,
        eventAddons: b.event_addons,
        bookingsList: bookings,
        companions: b.companions
      })

      // Stay details
      const stayDates = getStayDates(b.check_in, b.check_out)
      const totalNights = stayDates.length || 1

      // Distribute revenue night-by-night
      stayDates.forEach(date => {
        // Only count if this night is within the selected calendar range
        if (isDateBetween(date, dateRange.start, dateRange.end)) {
          // Nightly apportioned values
          const nightlyBase = priceResult.subtotal / totalNights
          const nightlyBreakfast = priceResult.breakfastTotal / totalNights
          const nightlyRentals = priceResult.rentalsTotal / totalNights
          const nightlyAddons = priceResult.addonsTotal / totalNights
          const nightlyTotal = priceResult.grandTotal / totalNights

          // Add to aggregate values
          totalRevenue += nightlyTotal
          totalAddonsRentals += nightlyRentals + nightlyAddons

          // Categorize
          let category: 'pension' | 'vacationHouse' | 'gardenArea' | 'gazebo' = 'pension'

          if (b.room_id) {
            category = 'pension'
            totalPensionBase += nightlyBase
            totalPensionBreakfast += nightlyBreakfast
            totalPensionRentals += nightlyRentals
            roomNightsBooked++
          } else if (b.venue_id) {
            const venue = venues.find(v => v.id === b.venue_id)
            if (venue) {
              if (venue.name === 'Vacation House') {
                category = 'vacationHouse'
                totalVacationHouse += nightlyTotal
              } else if (venue.name === 'Garden Area') {
                category = 'gardenArea'
                totalGardenArea += nightlyTotal
              } else if (venue.name === 'Gazebo') {
                category = 'gazebo'
                totalGazebo += nightlyTotal
              }
            }
          }

          // Add to trend slots
          trendSlots.forEach(slot => {
            if (isDateBetween(date, slot.start, slot.end)) {
              slot[category] += nightlyTotal
            }
          })
        }
      })
    })

    // Calculate room occupancy rate (10 rooms available per night)
    const numDays = allRangeDates.length
    const totalAvailableRoomNights = numDays * 10
    const roomOccupancyRate = totalAvailableRoomNights > 0 
      ? Math.round((roomNightsBooked / totalAvailableRoomNights) * 100) 
      : 0

    // Average Daily Rate (ADR) = Pension Revenue / Room-Nights Booked
    const totalPensionRevenue = totalPensionBase + totalPensionBreakfast + totalPensionRentals
    const adr = roomNightsBooked > 0 
      ? Math.round(totalPensionRevenue / roomNightsBooked) 
      : 0

    // RevPAR = Pension Revenue / Total Available Room-Nights
    const revpar = totalAvailableRoomNights > 0 
      ? Math.round(totalPensionRevenue / totalAvailableRoomNights) 
      : 0

    return {
      totalRevenue: Math.round(totalRevenue),
      totalPension: Math.round(totalPensionRevenue),
      totalPensionBase: Math.round(totalPensionBase),
      totalPensionBreakfast: Math.round(totalPensionBreakfast),
      totalPensionRentals: Math.round(totalPensionRentals),
      totalVacationHouse: Math.round(totalVacationHouse),
      totalGardenArea: Math.round(totalGardenArea),
      totalGazebo: Math.round(totalGazebo),
      totalAddonsRentals: Math.round(totalAddonsRentals),
      roomOccupancyRate,
      adr,
      revpar,
      trendSlots
    }
  }, [isLoading, bookings, venues, dateRange, confirmedOnly, timeframe])

  // Custom donut calculations
  const donutSegments = useMemo(() => {
    if (!calculations) return []
    const { totalPension, totalVacationHouse, totalGardenArea, totalGazebo } = calculations
    const sum = totalPension + totalVacationHouse + totalGardenArea + totalGazebo
    if (sum === 0) return []

    const segments = [
      { name: 'Pension (Rooms 1-10)', value: totalPension, color: '#B89251' },
      { name: 'Vacation House', value: totalVacationHouse, color: '#4A90E2' },
      { name: 'Garden Area', value: totalGardenArea, color: '#2ECC71' },
      { name: 'Gazebo', value: totalGazebo, color: '#F39C12' }
    ]

    let cumulativePercentage = 0
    return segments.map(seg => {
      const percentage = seg.value / sum
      const item = {
        ...seg,
        percentage: Math.round(percentage * 100),
        startPercent: cumulativePercentage
      }
      cumulativePercentage += percentage
      return item
    })
  }, [calculations])

  if (isLoading || !calculations) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-slate-500">
        <Sparkles className="w-8 h-8 text-[#B89251] animate-spin" />
        <p className="text-xs font-medium">Analyzing PMS profits & records...</p>
      </div>
    )
  }

  // Find max value in trendSlots for SVG height scaling
  const maxTrendVal = Math.max(
    1000, 
    ...calculations.trendSlots.map(s => s.pension + s.vacationHouse + s.gardenArea + s.gazebo)
  )

  return (
    <div className="space-y-6">
      {/* Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:flex items-center justify-between gap-4">
        {/* Timeframe selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-100 sm:border-0 pb-3 sm:pb-0">
          {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider cursor-pointer transition-all shrink-0 ${
                timeframe === t 
                  ? 'bg-[#B89251] text-white' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Dynamic Custom Date Inputs */}
        {timeframe === 'custom' && (
          <div className="flex items-center gap-2 my-3 sm:my-0">
            <Calendar className="w-3.5 h-3.5 text-[#B89251] shrink-0" />
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#B89251]"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#B89251]"
            />
          </div>
        )}

        {/* Status Toggle */}
        <div className="flex items-center gap-2.5 justify-end">
          <span className="text-xs font-medium text-slate-500">
            {confirmedOnly ? 'Confirmed Bookings Only' : 'Include Pending Projections'}
          </span>
          <button 
            onClick={() => setConfirmedOnly(prev => !prev)}
            className="text-slate-600 hover:text-[#B89251] transition-all cursor-pointer"
          >
            {confirmedOnly ? (
              <ToggleLeft className="w-8 h-8 text-slate-400" />
            ) : (
              <ToggleRight className="w-8 h-8 text-[#B89251]" />
            )}
          </button>
        </div>
      </div>

      {/* Statistics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Sales */}
        <div className="bg-[#FDFBF7]/80 backdrop-blur-sm border border-[#E5D5C0] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold text-[#9A783E] uppercase tracking-wider">Gross Sales</span>
            <DollarSign className="w-4 h-4 text-[#B89251]" />
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">₱{calculations.totalRevenue.toLocaleString()}</h3>
            <p className="text-[10px] text-slate-400 mt-1">Confirmed + Add-ons</p>
          </div>
        </div>

        {/* Card 2: Pension Sales */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Pension (Rms 1-10)</span>
            <Home className="w-4 h-4 text-[#B89251]" />
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">₱{calculations.totalPension.toLocaleString()}</h3>
            <p className="text-[10px] text-slate-400 mt-1">
              Base: ₱{calculations.totalPensionBase.toLocaleString()} | Bf: ₱{calculations.totalPensionBreakfast.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Card 3: Venue Sales */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Venue Rentals</span>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              ₱{(calculations.totalVacationHouse + calculations.totalGardenArea + calculations.totalGazebo).toLocaleString()}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              VH: ₱{calculations.totalVacationHouse.toLocaleString()} | Gdns: ₱{calculations.totalGardenArea.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Card 4: Addons & Extras */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Add-ons & Rentals</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">₱{calculations.totalAddonsRentals.toLocaleString()}</h3>
            <p className="text-[10px] text-slate-400 mt-1">Foams, Pillows, bands, LED</p>
          </div>
        </div>
      </div>

      {/* Sub-KPI stats (ADR, Occupancy, RevPAR) */}
      <div className="grid grid-cols-3 gap-4 bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
        <div>
          <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Occupancy Rate</span>
          <p className="text-sm sm:text-base font-bold text-slate-800 mt-0.5">{calculations.roomOccupancyRate}%</p>
        </div>
        <div className="border-x border-slate-200">
          <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider font-semibold">ADR (Rooms)</span>
          <p className="text-sm sm:text-base font-bold text-slate-800 mt-0.5">₱{calculations.adr.toLocaleString()}</p>
        </div>
        <div>
          <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider font-semibold">RevPAR</span>
          <p className="text-sm sm:text-base font-bold text-slate-800 mt-0.5">₱{calculations.revpar.toLocaleString()}</p>
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 lg:col-span-2 flex flex-col justify-between relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">Revenue Split Over Time</h4>
              <p className="text-[10px] text-slate-400">Nightly apportioned profit breakdown</p>
            </div>
            <div className="flex gap-2.5 text-[9px] font-semibold text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#B89251]"></span>Pension</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#4A90E2]"></span>House</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#2ECC71]"></span>Garden</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#F39C12]"></span>Gazebo</span>
            </div>
          </div>

          {/* SVG Bar Chart */}
          <div className="relative h-64 w-full">
            <svg viewBox="0 0 600 240" className="w-full h-full overflow-visible">
              {/* Y Grid Lines & Labels */}
              {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
                const y = 200 - ratio * 180
                const val = Math.round(maxTrendVal * ratio)
                return (
                  <g key={idx} className="opacity-40">
                    <line x1="45" y1={y} x2="580" y2={y} stroke="#E2E8F0" strokeDasharray="3,3" />
                    <text x="35" y={y + 3} textAnchor="end" className="text-[9px] fill-slate-400 font-semibold font-mono">
                      ₱{val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                    </text>
                  </g>
                )
              })}

              {/* X Grid Labels & Grouped Columns */}
              {calculations.trendSlots.map((slot, slotIdx) => {
                const totalSlots = calculations.trendSlots.length
                const slotWidth = 500 / totalSlots
                const xStart = 50 + slotIdx * slotWidth
                const xCenter = xStart + slotWidth / 2

                // Calculate heights
                const maxBarHeight = 170
                const pHeight = (slot.pension / maxTrendVal) * maxBarHeight
                const vHeight = (slot.vacationHouse / maxTrendVal) * maxBarHeight
                const gHeight = (slot.gardenArea / maxTrendVal) * maxBarHeight
                const zHeight = (slot.gazebo / maxTrendVal) * maxBarHeight

                // Bar X coordinates (grouped together inside the slot)
                const barSpacing = slotWidth > 60 ? 4 : 1
                const barW = Math.max(2, (slotWidth - 20) / 4)

                const px = xCenter - (barW * 2 + barSpacing * 1.5)
                const vx = xCenter - (barW + barSpacing * 0.5)
                const gx = xCenter + barSpacing * 0.5
                const zx = xCenter + barW + barSpacing * 1.5

                return (
                  <g key={slotIdx}>
                    {/* X Label */}
                    <text x={xCenter} y="220" textAnchor="middle" className="text-[9px] font-semibold fill-slate-400">
                      {slot.label}
                    </text>

                    {/* Pension Bar */}
                    <rect
                      x={px}
                      y={200 - pHeight}
                      width={barW}
                      height={pHeight}
                      fill="#B89251"
                      rx="1"
                      className="cursor-pointer transition-all hover:opacity-85"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setHoveredBar({
                          label: slot.label,
                          pension: slot.pension,
                          vacationHouse: slot.vacationHouse,
                          gardenArea: slot.gardenArea,
                          gazebo: slot.gazebo,
                          x: rect.left + rect.width / 2,
                          y: rect.top - 80
                        })
                      }}
                      onMouseLeave={() => setHoveredBar(null)}
                    />

                    {/* Vacation House Bar */}
                    <rect
                      x={vx}
                      y={200 - vHeight}
                      width={barW}
                      height={vHeight}
                      fill="#4A90E2"
                      rx="1"
                      className="cursor-pointer transition-all hover:opacity-85"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setHoveredBar({
                          label: slot.label,
                          pension: slot.pension,
                          vacationHouse: slot.vacationHouse,
                          gardenArea: slot.gardenArea,
                          gazebo: slot.gazebo,
                          x: rect.left + rect.width / 2,
                          y: rect.top - 80
                        })
                      }}
                      onMouseLeave={() => setHoveredBar(null)}
                    />

                    {/* Garden Area Bar */}
                    <rect
                      x={gx}
                      y={200 - gHeight}
                      width={barW}
                      height={gHeight}
                      fill="#2ECC71"
                      rx="1"
                      className="cursor-pointer transition-all hover:opacity-85"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setHoveredBar({
                          label: slot.label,
                          pension: slot.pension,
                          vacationHouse: slot.vacationHouse,
                          gardenArea: slot.gardenArea,
                          gazebo: slot.gazebo,
                          x: rect.left + rect.width / 2,
                          y: rect.top - 80
                        })
                      }}
                      onMouseLeave={() => setHoveredBar(null)}
                    />

                    {/* Gazebo Bar */}
                    <rect
                      x={zx}
                      y={200 - zHeight}
                      width={barW}
                      height={zHeight}
                      fill="#F39C12"
                      rx="1"
                      className="cursor-pointer transition-all hover:opacity-85"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setHoveredBar({
                          label: slot.label,
                          pension: slot.pension,
                          vacationHouse: slot.vacationHouse,
                          gardenArea: slot.gardenArea,
                          gazebo: slot.gazebo,
                          x: rect.left + rect.width / 2,
                          y: rect.top - 80
                        })
                      }}
                      onMouseLeave={() => setHoveredBar(null)}
                    />
                  </g>
                )
              })}

              {/* Baseline */}
              <line x1="45" y1="200" x2="580" y2="200" stroke="#CBD5E1" strokeWidth="1" />
            </svg>
          </div>

          {/* Interactive Tooltip Portal */}
          {hoveredBar && (
            <div 
              className="absolute z-50 bg-[#1E293B] text-white p-2.5 rounded-lg text-[10px] space-y-1 shadow-xl leading-normal w-40 pointer-events-none"
              style={{
                left: `${hoveredBar.x - window.innerWidth / 12}px`,
                top: `30px`
              }}
            >
              <div className="font-bold border-b border-slate-700 pb-1 mb-1 text-[#E5D5C0]">{hoveredBar.label}</div>
              <div className="flex justify-between">
                <span>Pension:</span>
                <span className="font-mono font-bold">₱{Math.round(hoveredBar.pension).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Vacation House:</span>
                <span className="font-mono font-bold text-[#60A5FA]">₱{Math.round(hoveredBar.vacationHouse).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Garden Area:</span>
                <span className="font-mono font-bold text-[#4ADE80]">₱{Math.round(hoveredBar.gardenArea).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Gazebo:</span>
                <span className="font-mono font-bold text-[#FBBF24]">₱{Math.round(hoveredBar.gazebo).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-1 mt-1 font-bold text-emerald-400">
                <span>Total:</span>
                <span>₱{Math.round(hoveredBar.pension + hoveredBar.vacationHouse + hoveredBar.gardenArea + hoveredBar.gazebo).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Contribution Donut Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">Profit Share</h4>
            <p className="text-[10px] text-slate-400">Percentage split of hotel revenues</p>
          </div>

          <div className="flex items-center justify-center py-4 relative">
            {donutSegments.length === 0 ? (
              <p className="text-slate-400 text-xs font-semibold">No revenue data</p>
            ) : (
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                  {donutSegments.map((seg, idx) => {
                    const radius = 70
                    const circumference = 2 * Math.PI * radius
                    const dashArray = `${seg.percentage * (circumference / 100)} ${circumference}`
                    const dashOffset = `-${seg.startPercent * (circumference / 100)}`

                    return (
                      <circle
                        key={idx}
                        cx="100"
                        cy="100"
                        r={radius}
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="24"
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                        className="cursor-pointer transition-all hover:stroke-[28]"
                        onMouseEnter={() => setHoveredDonutSegment(seg.name)}
                        onMouseLeave={() => setHoveredDonutSegment(null)}
                      />
                    );
                  })}
                </svg>
                {/* Text overlay in the middle of donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                    {hoveredDonutSegment ? hoveredDonutSegment.split(' ')[0] : 'Total'}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-slate-800 mt-0.5">
                    {hoveredDonutSegment 
                      ? `${donutSegments.find(s => s.name === hoveredDonutSegment)?.percentage}%`
                      : '100%'
                    }
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Donut Legend */}
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            {donutSegments.map((seg, idx) => (
              <div key={idx} className="flex items-center justify-between text-[10px] font-medium">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }}></span>
                  <span>{seg.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">₱{Math.round(seg.value).toLocaleString()}</span>
                  <span className="font-bold text-slate-800">{seg.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Revenue Table (Aggregated Breakdown) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">Financial Breakdown Statement</h4>
            <p className="text-[10px] text-slate-400">Itemized revenue calculations split by property category</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="p-3">Category Name</th>
                <th className="p-3 text-right">Apportioned Sales</th>
                <th className="p-3 text-right">Breakfast Share</th>
                <th className="p-3 text-right">Add-ons & Rentals</th>
                <th className="p-3 text-right">Total Net Revenue</th>
                <th className="p-3 text-right">Revenue share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {/* Row 1: Pension */}
              <tr>
                <td className="p-3 font-semibold text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#B89251] shrink-0"></span>
                  Pension (Rooms 1-10)
                </td>
                <td className="p-3 text-right font-mono">₱{calculations.totalPensionBase.toLocaleString()}</td>
                <td className="p-3 text-right font-mono text-slate-500">₱{calculations.totalPensionBreakfast.toLocaleString()}</td>
                <td className="p-3 text-right font-mono text-slate-500">₱{calculations.totalPensionRentals.toLocaleString()}</td>
                <td className="p-3 text-right font-mono text-slate-950 font-bold">₱{calculations.totalPension.toLocaleString()}</td>
                <td className="p-3 text-right font-mono font-bold text-[#B89251]">
                  {calculations.totalRevenue > 0 ? Math.round((calculations.totalPension / calculations.totalRevenue) * 100) : 0}%
                </td>
              </tr>

              {/* Row 2: Vacation House */}
              <tr>
                <td className="p-3 font-semibold text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4A90E2] shrink-0"></span>
                  Vacation House
                </td>
                <td className="p-3 text-right font-mono">
                  ₱{Math.round(calculations.totalVacationHouse).toLocaleString()}
                </td>
                <td className="p-3 text-right font-mono text-slate-400">₱0</td>
                <td className="p-3 text-right font-mono text-slate-400">Apportioned</td>
                <td className="p-3 text-right font-mono text-slate-950 font-bold">
                  ₱{calculations.totalVacationHouse.toLocaleString()}
                </td>
                <td className="p-3 text-right font-mono font-bold text-[#4A90E2]">
                  {calculations.totalRevenue > 0 ? Math.round((calculations.totalVacationHouse / calculations.totalRevenue) * 100) : 0}%
                </td>
              </tr>

              {/* Row 3: Garden Area */}
              <tr>
                <td className="p-3 font-semibold text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2ECC71] shrink-0"></span>
                  Garden Area
                </td>
                <td className="p-3 text-right font-mono">
                  ₱{Math.round(calculations.totalGardenArea).toLocaleString()}
                </td>
                <td className="p-3 text-right font-mono text-slate-400">₱0</td>
                <td className="p-3 text-right font-mono text-slate-400">Apportioned</td>
                <td className="p-3 text-right font-mono text-slate-950 font-bold">
                  ₱{calculations.totalGardenArea.toLocaleString()}
                </td>
                <td className="p-3 text-right font-mono font-bold text-[#2ECC71]">
                  {calculations.totalRevenue > 0 ? Math.round((calculations.totalGardenArea / calculations.totalRevenue) * 100) : 0}%
                </td>
              </tr>

              {/* Row 4: Gazebo */}
              <tr>
                <td className="p-3 font-semibold text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F39C12] shrink-0"></span>
                  Gazebo
                </td>
                <td className="p-3 text-right font-mono">
                  ₱{Math.round(calculations.totalGazebo).toLocaleString()}
                </td>
                <td className="p-3 text-right font-mono text-slate-400">₱0</td>
                <td className="p-3 text-right font-mono text-slate-400">Apportioned</td>
                <td className="p-3 text-right font-mono text-slate-950 font-bold">
                  ₱{calculations.totalGazebo.toLocaleString()}
                </td>
                <td className="p-3 text-right font-mono font-bold text-[#F39C12]">
                  {calculations.totalRevenue > 0 ? Math.round((calculations.totalGazebo / calculations.totalRevenue) * 100) : 0}%
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                <td className="p-3 font-bold">Total Summary</td>
                <td className="p-3 text-right font-mono">
                  ₱{(calculations.totalPensionBase + calculations.totalVacationHouse + calculations.totalGardenArea + calculations.totalGazebo).toLocaleString()}
                </td>
                <td className="p-3 text-right font-mono text-slate-600">₱{calculations.totalPensionBreakfast.toLocaleString()}</td>
                <td className="p-3 text-right font-mono text-slate-600">₱{calculations.totalAddonsRentals.toLocaleString()}</td>
                <td className="p-3 text-right font-mono text-slate-950 text-sm font-extrabold">₱{calculations.totalRevenue.toLocaleString()}</td>
                <td className="p-3 text-right font-mono text-[#9A783E] text-sm font-extrabold">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
