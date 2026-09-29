import { RateConfig, BreakfastMenuOption } from '../types/booking'
import { readAppSetting, writeAppSetting } from './appSettings'

// Editable system rate settings. Staff can change these in Settings so they no
// longer have to touch code or the database directly for everyday rate changes
// (rooms, food/breakfast, venues, extras, late/early check-in/out).
export const DEFAULT_RATE_CONFIG: RateConfig = {
  lateEarlyRatePesos: 100, // rooms: ₱100/hour for early check-in / late checkout
  lateEarlyCapHours: 3,    // after 3 early/late hours the charge becomes 1 night
  // There is deliberately NO breakfast price here. Breakfast is priced by the ROOM's own
  // `breakfast_price`, typed by the desk (card k140) — there is **no per-head default**. The
  // retired ₱150-per-person-per-night figure billed rooms the desk had never priced, which is
  // how Room 4 was charged ₱300 for two nights the guest was never offered (the owner's
  // ruling, 2026-09-29: *"if a room has no breakfast price, then breakfast should be
  // unavailable … remove every trace of 150 per head"*).
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

const RATES_KEY = 'rate_config'

// The loaded config, held in memory for this session. The database is the home;
// this cache exists only because `getRateConfig()` is called synchronously from
// the pricing engine, the statements and the reports, which cannot await.
// `hydrateRateConfig()` fills it before the app renders anything.
let cache: RateConfig | null = null

/**
 * Reads the shared rates out of the database into memory. Runs once, before any
 * screen renders, so nothing is ever priced against the factory defaults by
 * accident — that is exactly the class of bug this replaced. Throws when the
 * database cannot be reached; the router turns that into a visible stop rather
 * than a screen quietly using the wrong figures.
 */
export async function hydrateRateConfig(): Promise<void> {
  const stored = await readAppSetting<Partial<RateConfig>>(RATES_KEY)
  cache = stored ? { ...DEFAULT_RATE_CONFIG, ...stored } : { ...DEFAULT_RATE_CONFIG }
}

export function getRateConfig(): RateConfig {
  return cache ? { ...cache } : { ...DEFAULT_RATE_CONFIG }
}

/** Saves the shared rates to the database. Throws when it refuses. */
export async function saveRateConfig(config: RateConfig): Promise<void> {
  const clean = { ...config }
  await writeAppSetting(RATES_KEY, clean)
  cache = clean
}

// The current staff-editable breakfast menu (empty entries are filtered out so
// staff can blank a slot without it appearing as a ₱0 item).
export function getBreakfastMenu(): BreakfastMenuOption[] {
  return getRateConfig().breakfastMenu.filter(m => m.name && m.name.trim())
}
