import { Booking } from '../types/booking'

/**
 * Whether a booking holds money: its receipt must survive it. A room taken off a bill leaves its money
 * on the bill (Sebastian, 2026-10-24: "Money stays on the bill"), moved onto the first room (`onLead`).
 */
export const holdsMoney = (b: Booking) => Number(b.downpayment_paid || 0) > 0 || (b.payment_records || []).length > 0
