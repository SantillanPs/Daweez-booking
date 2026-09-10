import { RateConfig, BreakfastMenuOption } from '../types/booking'

// Editable system rate settings. Staff can change these in Settings so they no
// longer have to touch code or the database directly for everyday rate changes
// (rooms, food/breakfast, venues, extras, late/early check-in/out).
export const DEFAULT_RATE_CONFIG: RateConfig = {
  lateEarlyRatePesos: 100, // rooms: ₱100/hour for early check-in / late checkout
  lateEarlyCapHours: 3,    // after 3 early/late hours the charge becomes 1 night
  breakfastPrice: 150,     // ₱150/person/night (fallback for legacy planned-ahead breakfast)
  breakfastMenu: [
    { name: 'Hotsilog', price: 150 },
    { name: 'Bangsilog', price: 150 },
    { name: 'Lumpiasilog', price: 150 },
    { name: 'Cornsilog', price: 150 },
    { name: 'Milo', price: 40 },
    { name: 'Hot Coffee', price: 40 },
  ],
  venueHourlyRate: 500,    // ₱500/hour (vacation house late/early + venue excess hours)
  venueDayBlockHours: 6,   // Gazebo & Garden are booked in 6-hour day blocks
  dayBlockRate: 0,         // 0 = fall back to each venue's own base_price per block
  securityDeposit: 500,    // ₱500 flat
  standardCheckInTime: '14:00',  // standard check-in at 2 PM
  standardCheckOutTime: '12:00', // standard check-out at 12 PM (noon)
  foamRate: 200,        // extra foam, per night
  pillowRate: 50,       // extra pillow, per night
  blanketRate: 50,      // extra blanket, per night
  towelRate: 50,        // extra towel, per night
  bigTableRate: 150,    // big table (event)
  smallTableRate: 100,  // small table (event)
  chairRate: 15,        // chair (event)
  mineralWaterRate: 35, // mineral water
  tentRate: 500,        // tent (event)
  accommodationExtras: 0, // flat extras added to Pension rooms + Vacation House (report)
  venueExtras: 0,         // flat extras added to Garden Area + Gazebo (report)
}

const RATES_KEY = 'l_etoile_rates_db'

export function getRateConfig(): RateConfig {
  try {
    const raw = localStorage.getItem(RATES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RateConfig>
      return { ...DEFAULT_RATE_CONFIG, ...parsed }
    }
  } catch { /* invalid stored value → defaults */ }
  return { ...DEFAULT_RATE_CONFIG }
}

export function saveRateConfig(config: RateConfig): void {
  localStorage.setItem(RATES_KEY, JSON.stringify(config))
}

// The current staff-editable breakfast menu (empty entries are filtered out so
// staff can blank a slot without it appearing as a ₱0 item).
export function getBreakfastMenu(): BreakfastMenuOption[] {
  return getRateConfig().breakfastMenu.filter(m => m.name && m.name.trim())
}
