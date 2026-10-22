import { readAppSetting, writeAppSetting } from './appSettings'

/**
 * **Where a booking is rescheduled** (Sebastian, 2026-10-22: he likes doing it on the calendar,
 * the staff want it on the billing statement, so there is a choice between the two).
 *
 *   `calendar` — the panel's Reschedule goes back to the calendar to pick the new days and room
 *                (`CalendarTab`, `moving`).
 *   `bill`     — the dates and the room are changed on the bill itself: a date is tapped
 *                (`billing/BillDates`), the room's charge line opens the other free rooms
 *                (`StatementChargesTable`).
 *
 * In the database (`app_settings`, key `front_desk`) so every PC at the desk works the same way.
 * Served from memory like the rates: `hydrateFrontDesk` fills it before any route renders, and the
 * booking panel reads it again each time it opens — the choice made on another PC or in another tab
 * was not seen until the page was reloaded (Sebastian, 2026-10-22: switched to the calendar and back,
 * and Reschedule did not go back to the bill).
 */
export interface FrontDeskSettings {
  reschedule: 'calendar' | 'bill'
}

let current: FrontDeskSettings = { reschedule: 'calendar' }

// Anything but an explicit `bill` is the calendar, the way it worked before the choice existed.
const tidy = (v: Partial<FrontDeskSettings> | null | undefined): FrontDeskSettings =>
  ({ reschedule: v?.reschedule === 'bill' ? 'bill' : 'calendar' })

export function getFrontDesk(): FrontDeskSettings {
  return current
}

export async function hydrateFrontDesk(): Promise<void> {
  current = tidy(await readAppSetting<FrontDeskSettings>('front_desk'))
}

/** Throws when the database refuses, so the screen puts the choice back and says so. */
export async function saveFrontDesk(next: FrontDeskSettings): Promise<void> {
  const clean = tidy(next), before = current
  // Held at once, so a second pick made before the first save answers is the one that stays.
  current = clean
  try {
    await writeAppSetting('front_desk', clean)
  } catch (err) {
    if (current === clean) current = before
    throw err
  }
}
