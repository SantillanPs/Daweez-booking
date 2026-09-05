// Computes early check-in / late checkout hours from the ACTUAL arrival and
// departure times recorded by the Check in / Check out buttons, relative to the
// standard times (default 2 PM check-in, 12 PM check-out). Hours round up to a
// whole hour (any partial hour counts as a full hour).
export interface CheckInOutHours { earlyHours: number; lateHours: number }

export function computeCheckInOutHours(opts: {
  checkIn: string // YYYY-MM-DD
  checkOut: string // YYYY-MM-DD
  actualCheckIn?: string // ISO date-time
  actualCheckOut?: string // ISO date-time
  standardCheckInTime: string // 'HH:MM'
  standardCheckOutTime: string // 'HH:MM'
}): CheckInOutHours {
  let earlyHours = 0
  let lateHours = 0

  if (opts.actualCheckIn) {
    const standardCheckIn = new Date(opts.checkIn + 'T' + opts.standardCheckInTime + ':00').getTime()
    const actual = new Date(opts.actualCheckIn).getTime()
    earlyHours = Math.max(0, Math.ceil((standardCheckIn - actual) / 3600000))
  }

  if (opts.actualCheckOut) {
    const standardCheckOut = new Date(opts.checkOut + 'T' + opts.standardCheckOutTime + ':00').getTime()
    const actual = new Date(opts.actualCheckOut).getTime()
    lateHours = Math.max(0, Math.ceil((actual - standardCheckOut) / 3600000))
  }

  return { earlyHours, lateHours }
}
