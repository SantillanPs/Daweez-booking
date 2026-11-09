import { Booking, PaymentRecord } from '../types/booking'
import { supabase } from './supabaseClient'

// PAYMENTS HAVE THEIR OWN PLACE (Sebastian, 2026-11-09: "how about we just have payments its own
// place? amount due doesn't need any attention since it's just bill total - payment total").
//
// A payment belongs to the BILL (`payments.bill_id`: the rooms' `group_id`, or the booking's own id),
// never to a room, so cancelling or deleting a room can no longer take a bill's receipts with it — as
// it did while they were kept on the bill's first room (2026-11-07). The app still hands a booking its
// bill's payments, on the bill's first room still in the hotel (`withPayments`), so every screen reads
// them where it always did; and still saves them with the booking: the database files them here
// (`file_booking_payments`). Taking one back is the one step of its own: `removePayment`.

export interface PaymentRow extends PaymentRecord {
  bill_id: string
}

/** The bill a booking belongs to. */
export const billKey = (b: Pick<Booking, 'id' | 'group_id'>) => b.group_id || b.id

/** Every payment still standing. Throws, like every read, so a screen keeps what it had. */
export async function getPayments(): Promise<PaymentRow[]> {
  const { data, error } = await supabase.from('payments').select('*').is('removed_at', null)
  if (error) throw error
  return (data || []).map(p => ({
    id: p.id, bill_id: p.bill_id, amount: Number(p.amount || 0), method: p.method || '',
    paid_at: p.paid_at || '',
    ...(p.reference ? { reference: p.reference } : {}),
    ...(p.prepared_by ? { prepared_by: p.prepared_by } : {}),
    ...(p.receipt_number ? { receipt_number: p.receipt_number } : {}),
    ...(p.purpose ? { purpose: p.purpose } : {}),
    ...(p.slips ? { slips: p.slips } : {}),
    ...(p.by_hand ? { by_hand: true } : {}),
    ...(p.discount != null ? { discount: Number(p.discount) } : {}),
    ...(p.fixes ? { fixes: p.fixes } : {}),
  }))
}

/** A payment taken back: marked removed in the database, never deleted. */
export async function removePayment(id: string): Promise<void> {
  const { error } = await supabase.rpc('remove_payment', { p_id: id })
  if (error) throw error
}

const order = (a: Booking, b: Booking) =>
  Date.parse(a.created_at) - Date.parse(b.created_at) || (a.invoice_number || '').localeCompare(b.invoice_number || '')

/**
 * Which room of each bill shows its payments: the first booked that is still in the hotel (the order
 * `groupOf` keeps), or, on a bill cancelled whole, its first room.
 */
export function billLeads(list: Booking[]): Map<string, string> {
  const best = new Map<string, Booking>()
  for (const b of list) {
    const k = billKey(b)
    const cur = best.get(k)
    const live = b.status !== 'cancelled', curLive = cur && cur.status !== 'cancelled'
    if (!cur || (live && !curLive) || (live === curLive && order(b, cur) < 0)) best.set(k, b)
  }
  return new Map([...best].map(([k, b]) => [k, b.id]))
}

/**
 * The bookings with their bills' payments: on the bill's leading room, the payments and what they add
 * up to; on every other room, none. Whatever a booking carried before is ignored, so it is safe to run
 * again over a list it already ran over.
 */
export function withPayments(list: Booking[], pays: PaymentRow[]): Booking[] {
  const byBill = new Map<string, PaymentRecord[]>()
  for (const { bill_id, ...rec } of pays) byBill.set(bill_id, [...(byBill.get(bill_id) || []), rec])
  const leads = billLeads(list)
  return list.map(b => {
    const recs = leads.get(billKey(b)) === b.id
      ? (byBill.get(billKey(b)) || []).slice().sort((x, y) => (x.paid_at || '').localeCompare(y.paid_at || ''))
      : []
    return { ...b, payment_records: recs, downpayment_paid: recs.reduce((t, r) => t + Number(r.amount || 0), 0) }
  })
}

/** The payments cache with one bill's set laid over it, as a save of its leading room carries it. */
export function withBillPayments(pays: PaymentRow[], b: Booking): PaymentRow[] {
  const k = billKey(b)
  return [...pays.filter(p => p.bill_id !== k), ...(b.payment_records || []).map(r => ({ ...r, bill_id: k }))]
}
