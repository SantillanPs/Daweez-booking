import React, { useState, useMemo, useEffect } from 'react'
import { AnimatedNumber } from './AnimatedNumber'
import { AnimatedRect } from './AnimatedRect'
import { useDashboardData } from './DashboardContext'
import { calculatePricing } from '../utils/syncEngine'
import { Booking } from '../types/booking'
import { 
  TrendingUp, DollarSign, Calendar, Info, 
  ChevronRight, ChevronDown, ToggleLeft, ToggleRight, Sparkles,
  Table, BarChart2
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
  const { bookings, rooms, venues, expenses, isLoading } = useDashboardData()

  // 1. Timeframe Filter state
  const [viewMode, setViewMode] = useState<'spreadsheet' | 'visuals'>('visuals')
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
  const [includePending, setIncludePending] = useState<boolean>(false)
  
  // Accordion state
  const [isPensionExpanded, setIsPensionExpanded] = useState<boolean>(false)

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

  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    // Small delay ensures the browser paints the initial 0 state before animating to target
    const timer = setTimeout(() => setIsMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

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
    const statusSet = includePending ? ['confirmed', 'pending'] : ['confirmed']
    const relevantBookings = bookings.filter(b => statusSet.includes(b.status))

    let totalRevenue = 0
    let totalPensionBase = 0
    let totalPensionBreakfast = 0
    let totalPensionRentals = 0
    
    let totalVacationHouse = 0
    let totalGardenArea = 0
    let totalGazebo = 0
    let totalAddonsRentals = 0
    
    let totalExpenses = 0

    // Individual room revenues
    const roomRevenues: Record<string, { id: string, name: string, base: number, breakfast: number, rentals: number, total: number }> = {}
    rooms.forEach(r => {
      roomRevenues[r.id] = { id: r.id, name: r.name, base: 0, breakfast: 0, rentals: 0, total: 0 }
    })

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
        companions: b.companions,
        source: b.source
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
            
            if (roomRevenues[b.room_id]) {
              roomRevenues[b.room_id].base += nightlyBase
              roomRevenues[b.room_id].breakfast += nightlyBreakfast
              roomRevenues[b.room_id].rentals += nightlyRentals
              roomRevenues[b.room_id].total += nightlyTotal
            }
          } else if (b.venue_id) {
            const vid = b.venue_id.toLowerCase()
            if (vid.includes('vacation')) {
              category = 'vacationHouse'
              totalVacationHouse += nightlyTotal
            } else if (vid.includes('garden')) {
              category = 'gardenArea'
              totalGardenArea += nightlyTotal
            } else if (vid.includes('gazebo')) {
              category = 'gazebo'
              totalGazebo += nightlyTotal
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

    // 2. Calculate expenses in range
    expenses.forEach(e => {
      if (isDateBetween(e.expense_date, dateRange.start, dateRange.end)) {
        totalExpenses += e.amount
      }
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
      totalExpenses: Math.round(totalExpenses),
      netProfit: Math.round(totalRevenue - totalExpenses),
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
      trendSlots,
      roomRevenues: Object.values(roomRevenues).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    }
  }, [isLoading, bookings, venues, rooms, expenses, dateRange, includePending, timeframe])

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

    let exactCumulative = 0
    return segments.map(seg => {
      const exactPercent = (seg.value / sum) * 100
      const roundedPercent = Math.round(exactPercent)
      const item = {
        ...seg,
        percentage: roundedPercent,
        renderPercent: exactPercent,
        renderStartPercent: exactCumulative
      }
      exactCumulative += exactPercent
      return item
    })
  }, [calculations])

  if (isLoading || !calculations) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-muted">
        <Sparkles className="w-8 h-8 text-brand-primary animate-spin" />
        <p className="text-xs font-medium">Analyzing PMS profits & records...</p>
      </div>
    )
  }

  // Find max value in trendSlots for SVG height scaling
  // We check the max of individual bars, not the sum, since they are grouped side-by-side
  const maxTrendVal = Math.max(
    1000, 
    ...calculations.trendSlots.map(s => Math.max(s.pension, s.vacationHouse, s.gardenArea, s.gazebo))
  )

  return (
    <div className="space-y-6">
      {/* Filters Toolbar */}
      <div className="bg-card border border-soft rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        
        {/* Left Side: Timeframes and Dates */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Timeframe selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider cursor-pointer transition-all shrink-0 ${
                  timeframe === t 
                    ? 'bg-brand-primary text-white' 
                    : 'bg-page hover:bg-softbg text-muted'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Dynamic Custom Date Inputs */}
          {timeframe === 'custom' && (
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-brand-primary shrink-0" />
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="text-xs font-medium bg-page border border-soft rounded px-2.5 py-1.5 focus:outline-none focus:border-brand-primary"
              />
              <span className="text-muted text-xs">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="text-xs font-medium bg-page border border-soft rounded px-2.5 py-1.5 focus:outline-none focus:border-brand-primary"
              />
            </div>
          )}
        </div>

        {/* Right Side: View Mode Toggle & Status Toggle */}
        <div className="flex flex-wrap items-center gap-4 xl:justify-end">
          {/* View Mode Toggle */}
          <button
            onClick={() => setViewMode(prev => prev === 'spreadsheet' ? 'visuals' : 'spreadsheet')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest cursor-pointer transition-all bg-white border-2 border-slate-100 hover:border-brand-primary/30 hover:bg-slate-50 text-slate-600 shadow-sm"
          >
            {viewMode === 'spreadsheet' ? (
              <>
                <BarChart2 className="w-4 h-4 text-brand-primary" />
                Switch to Visuals
              </>
            ) : (
              <>
                <Table className="w-4 h-4 text-brand-primary" />
                Switch to Spreadsheet
              </>
            )}
          </button>

          {/* Status Toggle */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs font-medium text-muted whitespace-nowrap">
              Include Pending Bookings
            </span>
            <button 
              onClick={() => setIncludePending(prev => !prev)}
              className="text-muted hover:text-brand-primary transition-all cursor-pointer"
            >
              {includePending ? (
                <ToggleRight className="w-8 h-8 text-brand-primary" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-muted" />
              )}
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'visuals' && (
        <>
          {/* Main Income Breakdown Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pension Income */}
        <div className="bg-card border border-soft rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider">Pension (Rms 1-10)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-brand-primary"></span>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-600"><AnimatedNumber prefix="₱" value={calculations.totalPension} /></h3>
            <p className="text-[10px] text-muted mt-1">
              Base: ₱{calculations.totalPensionBase.toLocaleString()} | Breakfast: ₱{calculations.totalPensionBreakfast.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Card 2: Vacation House Income */}
        <div className="bg-card border border-soft rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider">Vacation House</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#4A90E2]"></span>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-600"><AnimatedNumber prefix="₱" value={calculations.totalVacationHouse} /></h3>
            <p className="text-[10px] text-muted mt-1">Property Rental + Add-ons</p>
          </div>
        </div>

        {/* Card 3: Garden Area Income */}
        <div className="bg-card border border-soft rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider">Garden Area</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#2ECC71]"></span>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-600"><AnimatedNumber prefix="₱" value={calculations.totalGardenArea} /></h3>
            <p className="text-[10px] text-muted mt-1">Event Venue + Equipment</p>
          </div>
        </div>

        {/* Card 4: Gazebo Income */}
        <div className="bg-card border border-soft rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider">Gazebo</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#F39C12]"></span>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-600"><AnimatedNumber prefix="₱" value={calculations.totalGazebo} /></h3>
            <p className="text-[10px] text-muted mt-1">Event Venue + Equipment</p>
          </div>
        </div>
      </div>


      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Bar Chart */}
        <div className="bg-card border border-soft rounded-xl p-4 lg:col-span-2 flex flex-col justify-between relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-main">Income Over Time</h4>
              <p className="text-[10px] text-muted">Daily earnings breakdown</p>
            </div>
            <div className="flex gap-2.5 text-[9px] font-semibold text-muted">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-brand-primary"></span>Pension</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#4A90E2]"></span>House</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#2ECC71]"></span>Garden</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#F39C12]"></span>Gazebo</span>
            </div>
          </div>

          {/* SVG Bar Chart */}
          <div className="relative flex-1 w-full min-h-[250px] mt-4">
            <svg width="100%" height="100%" className="overflow-visible">
              {/* Y Grid Lines & Labels */}
              {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
                const yPct = 90 - ratio * 88 // From 90% (bottom) to 2% (top)
                const val = Math.round(maxTrendVal * ratio)
                return (
                  <g key={idx} className="opacity-40">
                    <line x1="45" y1={`${yPct}%`} x2="100%" y2={`${yPct}%`} stroke="var(--border-soft)" strokeDasharray="3,3" />
                    <text x="35" y={`${yPct}%`} dy="3" textAnchor="end" className="text-[9px] fill-current text-muted font-semibold font-mono">
                      ₱{val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                    </text>
                  </g>
                )
              })}

              {/* X Grid Labels & Grouped Columns */}
              <svg x="50" y="2%" width="calc(100% - 50px)" height="88%" className="overflow-visible">
                {calculations.trendSlots.map((slot, slotIdx) => {
                  const totalSlots = calculations.trendSlots.length
                  const slotWidth = 100 / totalSlots // width in %
                  const xCenter = slotIdx * slotWidth + slotWidth / 2

                  // Calculate heights in percentages (0 to 100%)
                  const pHeightPct = (slot.pension / maxTrendVal) * 100 || 0
                  const vHeightPct = (slot.vacationHouse / maxTrendVal) * 100 || 0
                  const gHeightPct = (slot.gardenArea / maxTrendVal) * 100 || 0
                  const zHeightPct = (slot.gazebo / maxTrendVal) * 100 || 0

                  // Bar X coordinates in %
                  const barSpacing = slotWidth > 15 ? 1 : 0.5
                  const barW = Math.max(1, (slotWidth - 4) / 4)

                  const px = xCenter - (barW * 2 + barSpacing * 1.5)
                  const vx = xCenter - (barW + barSpacing * 0.5)
                  const gx = xCenter + barSpacing * 0.5
                  const zx = xCenter + barW + barSpacing * 1.5

                  return (
                    <g key={slotIdx}>
                      {/* Pension Bar */}
                      <AnimatedRect
                        x={`${px}%`}
                        targetY={100 - pHeightPct}
                        width={`${barW}%`}
                        targetHeight={pHeightPct}
                        fill="#B89251"
                        rx="2"
                        className="cursor-pointer transition-opacity hover:opacity-85"
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
                      <AnimatedRect
                        x={`${vx}%`}
                        targetY={100 - vHeightPct}
                        width={`${barW}%`}
                        targetHeight={vHeightPct}
                        fill="#4A90E2"
                        rx="2"
                        className="cursor-pointer transition-opacity hover:opacity-85"
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
                      <AnimatedRect
                        x={`${gx}%`}
                        targetY={100 - gHeightPct}
                        width={`${barW}%`}
                        targetHeight={gHeightPct}
                        fill="#2ECC71"
                        rx="2"
                        className="cursor-pointer transition-opacity hover:opacity-85"
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
                      <AnimatedRect
                        x={`${zx}%`}
                        targetY={100 - zHeightPct}
                        width={`${barW}%`}
                        targetHeight={zHeightPct}
                        fill="#F39C12"
                        rx="2"
                        className="cursor-pointer transition-opacity hover:opacity-85"
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
              </svg>

              {/* X Labels (placed at 90% downwards) */}
              <svg x="50" y="90%" width="calc(100% - 50px)" height="10%" className="overflow-visible">
                {calculations.trendSlots.map((slot, slotIdx) => {
                  const totalSlots = calculations.trendSlots.length
                  const slotWidth = 100 / totalSlots
                  const xCenter = slotIdx * slotWidth + slotWidth / 2
                  
                  return (
                    <text key={slotIdx} x={`${xCenter}%`} y="20" textAnchor="middle" className="text-[9px] font-semibold fill-current text-muted">
                      {slot.label}
                    </text>
                  )
                })}
              </svg>

              {/* Baseline */}
              <line x1="45" y1="90%" x2="100%" y2="90%" stroke="var(--border-soft)" strokeWidth="1" />
            </svg>
          </div>

          {/* Interactive Tooltip Portal */}
          {hoveredBar && (
            <div 
              className="absolute z-50 bg-[#1E293B] text-white p-2.5 rounded-lg text-[10px] space-y-1 shadow-xl leading-normal w-40 pointer-events-none border border-white/10"
              style={{
                left: `${hoveredBar.x - window.innerWidth / 12}px`,
                top: `30px`
              }}
            >
              <div className="font-bold border-b border-white/10 pb-1 mb-1 text-[#E5D5C0]">{hoveredBar.label}</div>
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
        <div className="bg-card border border-soft rounded-xl p-4 flex flex-col justify-between">
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-main">Earnings Share</h4>
            <p className="text-[10px] text-muted">Breakdown of where your money comes from</p>
          </div>

          <div className="flex items-center justify-center py-4 relative">
            {donutSegments.length === 0 ? (
              <p className="text-muted text-xs font-semibold">No earnings data</p>
            ) : (
              <div className="relative w-48 h-48 sm:w-56 sm:h-56">
                <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                  {donutSegments.map((seg, idx) => {
                    const radius = 80
                    const circumference = 2 * Math.PI * radius
                    const dashArray = isMounted ? `${seg.renderPercent * (circumference / 100)} ${circumference}` : `0 ${circumference}`
                    const dashOffset = `-${seg.renderStartPercent * (circumference / 100)}`

                    return (
                      <circle
                        key={idx}
                        cx="100"
                        cy="100"
                        r={radius}
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="28"
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                        className="cursor-pointer transition-all duration-1000 ease-out hover:stroke-[34]"
                        onMouseEnter={() => setHoveredDonutSegment(seg.name)}
                        onMouseLeave={() => setHoveredDonutSegment(null)}
                      />
                    );
                  })}
                </svg>
                {/* Text overlay in the middle of donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] uppercase tracking-wider text-muted font-bold">
                    {hoveredDonutSegment ? hoveredDonutSegment.split(' ')[0] : 'Total'}
                  </span>
                  <span className="text-lg sm:text-xl font-extrabold text-emerald-600 mt-0.5">
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
          <div className="space-y-1.5 border-t border-soft pt-3">
            {donutSegments.map((seg, idx) => (
              <div key={idx} className="flex items-center justify-between text-[10px] font-medium">
                <div className="flex items-center gap-1.5 text-muted">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }}></span>
                  <span>{seg.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold"><AnimatedNumber prefix="₱" value={seg.value} /></span>
                  <span className="font-semibold text-muted">{seg.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
        </>
      )}

      {viewMode === 'spreadsheet' && (
        <div className="bg-card border border-soft rounded-xl overflow-hidden">
        <div className="p-4 border-b border-soft flex items-center justify-between">
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-main">Earnings Report</h4>
            <p className="text-[10px] text-muted">Detailed breakdown of where your money comes from</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100/50 border-b-2 border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
                <th className="py-4 px-5">Area / Room</th>
                <th className="py-4 px-5 text-right">Room Rate</th>
                <th className="py-4 px-5 text-right">Breakfast</th>
                <th className="py-4 px-5 text-right">Extras</th>
                <th className="py-4 px-5 text-right">% of Total</th>
                <th className="py-4 px-5 text-right text-slate-800">Total Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-main text-sm">
              {/* Row 1: Pension */}
              <tr 
                className="cursor-pointer hover:bg-slate-50 transition-colors group"
                onClick={() => setIsPensionExpanded(!isPensionExpanded)}
              >
                <td className="py-4 px-5 font-semibold flex items-center gap-3">
                  <div className="p-1 rounded bg-slate-100 group-hover:bg-slate-200 transition-colors">
                    {isPensionExpanded ? <ChevronDown className="w-4 h-4 text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-600" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand-primary"></span>
                    <span className="text-slate-800">Pension <span className="text-slate-500 font-normal">(Rooms 1-10)</span></span>
                  </div>
                </td>
                <td className="py-4 px-5 text-right font-mono font-bold text-slate-800">₱{calculations.totalPensionBase.toLocaleString()}</td>
                <td className="py-4 px-5 text-right font-mono font-bold text-slate-800">₱{calculations.totalPensionBreakfast.toLocaleString()}</td>
                <td className="py-4 px-5 text-right font-mono font-bold text-slate-800">₱{calculations.totalPensionRentals.toLocaleString()}</td>
                <td className="py-4 px-5 text-right font-mono font-bold text-brand-primary">
                  {calculations.totalRevenue > 0 ? Math.round((calculations.totalPension / calculations.totalRevenue) * 100) : 0}%
                </td>
                <td className="py-4 px-5 text-right font-mono font-bold text-emerald-700"><AnimatedNumber prefix="₱" value={calculations.totalPension} /></td>
              </tr>

              {/* Pension Individual Rooms */}
              {isPensionExpanded && calculations.roomRevenues.map((room, idx) => (
                <tr key={room.id} className={`hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}`}>
                  <td className="py-3 px-5 pl-[52px] text-[13px] font-semibold text-slate-800 flex items-center gap-2 relative">
                    <div className="absolute left-[30px] top-0 bottom-0 w-px bg-slate-200"></div>
                    <div className="absolute left-[30px] top-1/2 w-3 h-px bg-slate-200"></div>
                    {room.name}
                  </td>
                  <td className="py-3 px-5 text-right font-mono text-[13px] font-semibold text-slate-800">
                    {room.base > 0 ? `₱${Math.round(room.base).toLocaleString()}` : <span className="text-slate-300 font-normal">-</span>}
                  </td>
                  <td className="py-3 px-5 text-right font-mono text-[13px] font-semibold text-slate-800">
                    {room.breakfast > 0 ? `₱${Math.round(room.breakfast).toLocaleString()}` : <span className="text-slate-300 font-normal">-</span>}
                  </td>
                  <td className="py-3 px-5 text-right font-mono text-[13px] font-semibold text-slate-800">
                    {room.rentals > 0 ? `₱${Math.round(room.rentals).toLocaleString()}` : <span className="text-slate-300 font-normal">-</span>}
                  </td>
                  <td className="py-3 px-5 text-right font-mono font-medium text-[13px] text-slate-500">
                    {calculations.totalRevenue > 0 && room.total > 0 ? `${Math.round((room.total / calculations.totalRevenue) * 100)}%` : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="py-3 px-5 text-right font-mono font-bold text-[13px] text-emerald-700">
                    {room.total > 0 ? <AnimatedNumber prefix="₱" value={room.total} /> : <span className="text-slate-300 font-normal">-</span>}
                  </td>
                </tr>
              ))}

              {/* Row 2: Vacation House */}
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-5 font-semibold flex items-center gap-2 pl-[44px]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4A90E2]"></span>
                  <span className="text-slate-800">Vacation House</span>
                </td>
                <td className="py-4 px-5 text-right font-mono font-bold text-slate-800">
                  ₱{Math.round(calculations.totalVacationHouse).toLocaleString()}
                </td>
                <td className="py-4 px-5 text-right font-mono font-medium text-slate-300">-</td>
                <td className="py-4 px-5 text-right font-mono font-semibold text-slate-500 text-xs italic">Included</td>
                <td className="py-4 px-5 text-right font-mono font-bold text-[#4A90E2]">
                  {calculations.totalRevenue > 0 ? Math.round((calculations.totalVacationHouse / calculations.totalRevenue) * 100) : 0}%
                </td>
                <td className="py-4 px-5 text-right font-mono font-bold text-emerald-700">
                  <AnimatedNumber prefix="₱" value={calculations.totalVacationHouse} />
                </td>
              </tr>

              {/* Row 3: Garden Area */}
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-5 font-semibold flex items-center gap-2 pl-[44px]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2ECC71]"></span>
                  <span className="text-slate-800">Garden Area</span>
                </td>
                <td className="py-4 px-5 text-right font-mono font-bold text-slate-800">
                  ₱{Math.round(calculations.totalGardenArea).toLocaleString()}
                </td>
                <td className="py-4 px-5 text-right font-mono font-medium text-slate-300">-</td>
                <td className="py-4 px-5 text-right font-mono font-semibold text-slate-500 text-xs italic">Included</td>
                <td className="py-4 px-5 text-right font-mono font-bold text-[#2ECC71]">
                  {calculations.totalRevenue > 0 ? Math.round((calculations.totalGardenArea / calculations.totalRevenue) * 100) : 0}%
                </td>
                <td className="py-4 px-5 text-right font-mono font-bold text-emerald-700">
                  <AnimatedNumber prefix="₱" value={calculations.totalGardenArea} />
                </td>
              </tr>

              {/* Row 4: Gazebo */}
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-5 font-semibold flex items-center gap-2 pl-[44px]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F39C12]"></span>
                  <span className="text-slate-800">Gazebo</span>
                </td>
                <td className="py-4 px-5 text-right font-mono font-bold text-slate-800">
                  ₱{Math.round(calculations.totalGazebo).toLocaleString()}
                </td>
                <td className="py-4 px-5 text-right font-mono font-medium text-slate-300">-</td>
                <td className="py-4 px-5 text-right font-mono font-semibold text-slate-500 text-xs italic">Included</td>
                <td className="py-4 px-5 text-right font-mono font-bold text-[#F39C12]">
                  {calculations.totalRevenue > 0 ? Math.round((calculations.totalGazebo / calculations.totalRevenue) * 100) : 0}%
                </td>
                <td className="py-4 px-5 text-right font-mono font-bold text-emerald-700">
                  <AnimatedNumber prefix="₱" value={calculations.totalGazebo} />
                </td>
              </tr>

            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 text-slate-800">
                <td className="py-5 px-5 font-bold text-[13px] uppercase tracking-wider">Total Money In</td>
                <td className="py-5 px-5 text-right font-mono font-bold">
                  ₱{(calculations.totalPensionBase + calculations.totalVacationHouse + calculations.totalGardenArea + calculations.totalGazebo).toLocaleString()}
                </td>
                <td className="py-5 px-5 text-right font-mono font-bold text-slate-500">₱{calculations.totalPensionBreakfast.toLocaleString()}</td>
                <td className="py-5 px-5 text-right font-mono font-bold text-slate-500">₱{calculations.totalPensionRentals.toLocaleString()}</td>
                <td className="py-5 px-5 text-right font-mono font-black text-brand-primary text-[17px]">100%</td>
                <td className="py-5 px-5 text-right font-mono font-black text-emerald-700 text-[17px]"><AnimatedNumber prefix="₱" value={calculations.totalRevenue} /></td>
              </tr>
              <tr className="border-t border-slate-200 bg-rose-50/50 text-rose-800">
                <td className="py-4 px-5 font-bold text-[13px] uppercase tracking-wider text-rose-600" colSpan={4}>Total Money Out (Expenses)</td>
                <td className="py-4 px-5 text-right"></td>
                <td className="py-4 px-5 text-right font-mono font-black text-rose-600 text-[17px]">
                  -<AnimatedNumber prefix="₱" value={calculations.totalExpenses} />
                </td>
              </tr>
              <tr className="bg-slate-900 text-white shadow-xl relative overflow-hidden">
                <td className="py-6 px-6 font-black tracking-widest text-[15px] uppercase relative z-10" colSpan={4}>
                  Your Profit <span className="font-medium text-slate-400 text-xs ml-2 tracking-normal">(Money In - Money Out)</span>
                </td>
                <td className="py-6 px-6 text-right relative z-10"></td>
                <td className="py-6 px-6 text-right font-mono font-black text-3xl text-emerald-400 relative z-10">
                  <AnimatedNumber prefix="₱" value={calculations.netProfit} />
                </td>
                {/* Decorative background element for the profit row */}
                <div className="absolute top-0 right-0 bottom-0 w-1/2 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none"></div>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      )}
    </div>
  )
}
