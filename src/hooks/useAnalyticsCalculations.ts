import { useMemo } from 'react'
import { Booking, Room, Venue } from '../types/booking'
import { TabLine } from '../types/tab'
import { Expense } from '../types/expense'
import { calculatePricing } from '../utils/syncEngine'
import { getRateConfig } from '../utils/rateConfig'
import { foodMoneyIn } from '../utils/tabRevenue'
import { dateToString } from '../utils/helpers'

// Helper: check if a date is within start and end strings (YYYY-MM-DD)
function isDateBetween(dStr: string, startStr: string, endStr: string): boolean {
  return dStr >= startStr && dStr <= endStr
}

// Helper: get array of dates between checkIn and checkOut (checkIn inclusive, checkOut exclusive)
function getStayDates(checkIn: string, checkOut: string): string[] {
  const dates: string[] = []
  const curr = new Date(checkIn)
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
  /** Every food and bar line on every tab, for the restaurant's own line in the report (k69, part E). */
  tabLines: TabLine[]
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
  tabLines,
  isLoading,
  timeframe,
  customStart,
  customEnd,
  includePending
}: UseAnalyticsCalculationsProps) {
  // 1. Resolve date ranges based on chosen timeframe
  //
  // **`daily` is ONE DAY** (the owner, 2026-09-30: *"this is supposed to be daily. why is this doing weekly?"*).
  // It used to reach back six days — `// Daily shows last 7 days ending today for trend view` — so the DAILY
  // chip reported a week's money and its own range badge read `Sep 24 – Sep 30`. The chip IS the period; a day
  // is a day. The trend chart simply gets one slot, which is what a day looks like.
  //
  // **Every range is built from LOCAL date parts** (`dateToString`), never `.toISOString().split('T')[0]`:
  // a locally-built midnight converted to UTC lands on the **previous** day everywhere east of Greenwich, so
  // `monthly` began on 31 August and every range was a day short for the first eight hours of a UTC+8 morning.
  // This is the standing rule for booking dates (`docs/why/money.md`), and the Earnings Report reads the same clock.
  const dateRange = useMemo(() => {
    const today = new Date()

    if (timeframe === 'daily') {
      const day = dateToString(today)
      return { start: day, end: day }
    }

    if (timeframe === 'weekly') {
      // Monday to Sunday, the week as the hotel lives it. `setDate` mutates, so it is applied to a copy — the
      // old code moved `today` itself and then read it again for the end of the range.
      const start = new Date(today)
      const weekday = start.getDay()
      start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1))
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return { start: dateToString(start), end: dateToString(end) }
    }

    if (timeframe === 'monthly') {
      // The whole calendar month: the 1st to its last day.
      return {
        start: dateToString(new Date(today.getFullYear(), today.getMonth(), 1)),
        end: dateToString(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
      }
    }

    if (timeframe === 'yearly') {
      return {
        start: dateToString(new Date(today.getFullYear(), 0, 1)),
        end: dateToString(new Date(today.getFullYear(), 11, 31)),
      }
    }

    return { start: customStart, end: customEnd }
  }, [timeframe, customStart, customEnd])

  // 2. Apportion bookings and aggregate revenues
  const calculations = useMemo(() => {
    if (isLoading) return null

    // Filter relevant bookings based on status
    const statusSet = includePending ? ['confirmed', 'pending'] : ['confirmed']
    const relevantBookings = bookings.filter(b => statusSet.includes(b.status))

    let totalPensionBase = 0
    let totalPensionBreakfast = 0
    let totalPensionRentals = 0
    
    let totalVacationHouse = 0
    let totalGardenArea = 0
    let totalGazebo = 0
    let totalAddonsRentals = 0
    
    let totalExpenses = 0

    // Food and bar money ordered in this period (k69, part E). It is its own line
    // in the report — the restaurant is a business of its own, not a room extra.
    const food = foodMoneyIn(tabLines, dateRange.start, dateRange.end)

    // Individual room revenues
    const roomRevenues: Record<string, { id: string, room_number: number, name: string, base: number, breakfast: number, rentals: number, total: number }> = {}
    rooms.forEach(r => {
      roomRevenues[r.id] = { id: r.id, room_number: r.room_number, name: r.name, base: 0, breakfast: 0, rentals: 0, total: 0 }
    })

    // For room occupancy: count booked room-nights
    let roomNightsBooked = 0

    // Construct array of all calendar dates in selected range to build trend chart slots
    const rangeStart = new Date(dateRange.start)
    const rangeEnd = new Date(dateRange.end)
    const allRangeDates: string[] = []
    const curr = new Date(rangeStart)
    while (curr <= rangeEnd) {
      allRangeDates.push(curr.toISOString().split('T')[0])
      curr.setDate(curr.getDate() + 1)
    }

    // Initialize trend slots based on timeframe grouping
    let trendSlots: { label: string; start: string; end: string; pension: number; vacationHouse: number; gardenArea: number; gazebo: number; restaurant?: number }[] = []

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

    // Food money lands in the slot it was ordered in — a lunch is earned on the
    // day it was eaten, not spread across the stay it belonged to.
    Object.entries(food.byDay).forEach(([day, amount]) => {
      trendSlots.forEach(slot => {
        if (isDateBetween(day, slot.start, slot.end)) slot.restaurant = (slot.restaurant || 0) + amount
      })
    })

    // Process each booking — honors whatever the booking actually charged (promo_applied).
    relevantBookings.forEach(b => {
      // 1. Calculate pricing details — use the booking's stored choice (promo vs. regular)
      const priceResult = calculatePricing({
        roomId: b.room_id,
        venueId: b.venue_id,
        checkIn: b.check_in,
        checkOut: b.check_out,
        guestEmail: b.guest_email,
        equipmentRentals: b.equipment_rentals,
        eventAddons: b.event_addons,
        bookingsList: bookings,
        breakfastIncluded: b.breakfast_included === true,
        contractRateOverride: b.contract_rate_override,
        // A short stay earns its hours price, not a night's.
        shortStayHours: b.stay_hours,
        rooms,
        venues
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

    const parseISO = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }
    const fmtMdy = (iso: string) => parseISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const periodLabel = timeframe === 'monthly'
      ? parseISO(dateRange.start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : timeframe === 'yearly'
        ? dateRange.start.slice(0, 4)
        : `${fmtMdy(dateRange.start)} – ${fmtMdy(dateRange.end)}, ${dateRange.end.slice(0, 4)}`

    const cfg = getRateConfig()
    const pensionExtras = cfg.accommodationExtras
    const vacationExtras = cfg.accommodationExtras
    const gardenExtras = cfg.venueExtras
    const gazeboExtras = cfg.venueExtras
    const totalExtras = pensionExtras + vacationExtras + gardenExtras + gazeboExtras
    const reportPension = Math.round(totalPensionBase + totalPensionBreakfast + pensionExtras)
    const reportVacation = Math.round(totalVacationHouse + vacationExtras)
    const reportGarden = Math.round(totalGardenArea + gardenExtras)
    const reportGazebo = Math.round(totalGazebo + gazeboExtras)
    const restaurantTotal = Math.round(food.total)
    const reportRevenue = reportPension + reportVacation + reportGarden + reportGazebo + restaurantTotal

    return {
      periodLabel,
      totalRevenue: reportRevenue,
      pensionExtras,
      vacationExtras,
      gardenExtras,
      gazeboExtras,
      totalExtras,
      totalExpenses: Math.round(totalExpenses),
      netProfit: reportRevenue - Math.round(totalExpenses),
      totalPension: reportPension,
      totalPensionBase: Math.round(totalPensionBase),
      totalPensionBreakfast: Math.round(totalPensionBreakfast),
      totalPensionRentals: pensionExtras,
      totalVacationHouse: Math.round(totalVacationHouse),
      vacationTotal: reportVacation,
      totalGardenArea: Math.round(totalGardenArea),
      gardenTotal: reportGarden,
      totalGazebo: Math.round(totalGazebo),
      gazeboTotal: reportGazebo,
      restaurantTotal,
      totalAddonsRentals: Math.round(totalAddonsRentals),
      roomOccupancyRate,
      adr,
      revpar,
      trendSlots,
      roomRevenues: Object.values(roomRevenues).sort((a, b) => a.room_number - b.room_number)
    }
  }, [isLoading, bookings, venues, rooms, expenses, tabLines, dateRange, includePending, timeframe])

  // Custom donut calculations
  const donutSegments = useMemo(() => {
    if (!calculations) return []
    const { totalPension, vacationTotal, gardenTotal, gazeboTotal, restaurantTotal } = calculations
    const sum = totalPension + vacationTotal + gardenTotal + gazeboTotal + restaurantTotal
    if (sum === 0) return []

    const segments = [
      { name: 'Pension (Rooms 1-10)', value: totalPension, color: '#B89251' },
      { name: 'Vacation House', value: vacationTotal, color: '#4A90E2' },
      { name: 'Garden Area', value: gardenTotal, color: '#2ECC71' },
      { name: 'Gazebo', value: gazeboTotal, color: '#F39C12' },
      { name: 'Restaurant & bar', value: restaurantTotal, color: '#D0AB60' }
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
