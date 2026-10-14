import { Booking, PaymentRecord } from '../types/booking'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { withoutPayment } from '../components/walk-in/bookingPayment'
import { unpaySlipsOfReceipt } from './orderSlips'

// PAYMENTS TAKEN BACK (Sebastian, 2026-10-14). Removing a payment takes its receipt off every booking it
// paid for, so this table is the only trace left. The Front desk's History shows each one struck through.

export interface RemovedPayment {
  id: string
  receipt_number?: string | null
  amount: number
  method?: string | null
  paid_at?: string | null
  prepared_by?: string | null
  guest_name?: string | null
  rooms?: string | null
  booking_ids: string[]
  removed_at: string
}

export async function getRemovedPayments(): Promise<RemovedPayment[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase.from('removed_payments').select('*').order('removed_at')
  if (error) throw error
  return (data || []).map(row => ({ ...row, amount: Number(row.amount) })) as RemovedPayment[]
}

export async function logRemovedPayment(row: Omit<RemovedPayment, 'id' | 'removed_at'>): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('removed_payments').insert(row)
  if (error) throw error
}

/**
 * Take one payment back off every booking it paid for. One payment for several rooms sits on each of
 * them (the owner's ruling, 2026-09-30), so each room gives back only its own share; the order slips it
 * paid are unpaid again; and the removal is logged. The same steps as the booking panel's "Remove".
 */
export async function takeBackPayment(
  rec: PaymentRecord,
  holders: Booking[],
  updateBooking: (b: Booking) => Promise<void>,
  label: { guest: string; rooms: string },
): Promise<void> {
  const shared = holders.length > 1
  for (const b of holders) {
    const theirs = (b.payment_records || []).find(r => (rec.receipt_number ? r.receipt_number === rec.receipt_number : r.id === rec.id))
    if (theirs) await updateBooking(withoutPayment(b, theirs, shared))
  }
  if (rec.receipt_number) await unpaySlipsOfReceipt(rec.receipt_number)
  await logRemovedPayment({
    receipt_number: rec.receipt_number,
    amount: Number(rec.amount || 0),
    method: rec.method,
    paid_at: rec.paid_at,
    prepared_by: rec.prepared_by,
    guest_name: label.guest,
    rooms: label.rooms,
    booking_ids: holders.map(b => b.id),
  })
}
