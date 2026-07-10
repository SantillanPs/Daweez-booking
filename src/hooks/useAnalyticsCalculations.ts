import { useMemo } from 'react'
import { Booking, Room, Venue, Expense } from '../types/booking'
import { calculatePricing } from '../utils/syncEngine'

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

interface UseAnalyticsCalculationsProps {
  bookings: Booking[]
  rooms: Room[]
  venues: Venue[]
  expenses: Expense[]
  isLoading: boolean
  timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
  customStart: string
  customEnd: string
  includePending: boolean
}

export function useAnalyticsCalculations({
  bookings,
  rooms,
  venues,
  expenses,
  isLoading,
  timeframe,
  customStart,
  customEnd,
  includePending
}: UseAnalyticsCalculationsProps) {
  // 1. Resolve date ranges based on chosen timeframe
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

  // 2. Apportion bookings and aggregate revenues
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

  return {
    dateRange,
    calculations,
    donutSegments
  }
}
