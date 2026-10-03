import { Booking } from '../../types/booking'
import { paymentStatusFromMoney } from '../../utils/bookingMoney'
import { BookingSubmitParams } from './bookingSubmitTypes'

type EditedMoney = {
  paymentStatus?: 'unpaid' | 'downpayment' | 'paid'
  downpaymentPaid?: number
  balanceDue?: number
  securityDeposit?: number
}

const same = (a: number, b: number) => Math.abs(a - b) < 0.005
const sum = (list: number[]) => list.reduce((a, b) => a + b, 0)

/** Divide `total` across the weights, whole pesos, the remainder on the first — so the parts always add back up. */
function splitByWeight(total: number, weights: number[]): number[] {
  const all = sum(weights)
  if (all <= 0) return weights.map((_, i) => (i === 0 ? total : 0))
  const parts = weights.map(w => Math.floor(total * w / all))
  parts[0] += total - sum(parts)
  return parts
}

/**
 * The money a corrected booking is saved with.
 *
 * The edit form shows ONE "Already received" and ONE "Balance due" — for a booking of
 * several rooms those are the totals of the whole set. They used to be written onto
 * every room as they stood, so correcting a two-room booking saved each room with both
 * rooms' money: the guest was credited twice and owed twice.
 *
 * Each room now keeps its own figures. Only when the desk actually typed a different
 * total is it divided across the rooms, in proportion to what each room's stay comes to.
 * A room added during the correction has no figures yet and is priced fresh.
 */
export function editedMoney(p: BookingSubmitParams, existing?: Booking): EditedMoney {
  const group = p.editingBookings
  if (!group) return {}
  if (group.length <= 1) {
    return {
      paymentStatus: p.derivedPaymentStatus,
      downpaymentPaid: p.formDownpaymentPaid,
      balanceDue: p.formBalanceDue !== null ? p.formBalanceDue : undefined,
      securityDeposit: p.formSecurityDeposit !== null ? p.formSecurityDeposit : undefined,
    }
  }
  const i = existing ? group.indexOf(existing) : -1
  if (!existing || i < 0) return {}

  const paidEach = group.map(b => Number(b.downpayment_paid || 0))
  const owedEach = group.map(b => Number(b.balance_due || 0))
  const chargeEach = group.map((_, k) => paidEach[k] + owedEach[k])

  const paid = same(p.formDownpaymentPaid, sum(paidEach))
    ? paidEach[i]
    : splitByWeight(p.formDownpaymentPaid, chargeEach)[i]
  const balance = p.formBalanceDue === null
    ? undefined
    : same(p.formBalanceDue, sum(owedEach))
      ? owedEach[i]
      : splitByWeight(p.formBalanceDue, sum(owedEach) > 0 ? owedEach : chargeEach)[i]

  return {
    // With no balance typed the stay is re-priced on save, so something is still owed.
    paymentStatus: balance === undefined ? (paid > 0 ? 'downpayment' : 'unpaid') : paymentStatusFromMoney(paid, balance),
    downpaymentPaid: paid,
    balanceDue: balance,
    securityDeposit: Number(existing.security_deposit || 0),
  }
}
