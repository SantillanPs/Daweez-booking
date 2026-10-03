import { Booking, Room, Venue, PartnerDeal } from '../types/booking'
import { amountToPayNow } from './bookingMoney'
import { TabLine } from '../types/tab'
import { bookingLines, StatementLineItem, StatementBand } from './statementLines'

// Builds the structured data for the printable "Guest Billing Statement"
// (the form staff fill in by hand for walk-ins / Facebook calls). It turns a
// booking (and any related bookings sharing an invoice number) into the banded rows the
// paper's own table prints, plus the money the guest hands over.

export type { StatementLineItem, StatementBand }
export { nightsFor } from './statementLines'

export interface Statement {
  invoiceNumber: string
  dateIssued: string
  /** The charge rows, already banded (`room` / `breakfast` / `extras` / `discount` / `food`). */
  lineItems: StatementLineItem[]
  subTotal: number
  downpaymentPaid: number
  partialPayment: number
  other: number
  // A refundable deposit held on the booking, printed only when one is actually
  // held so the statement never shows a line that has nothing to say.
  securityDeposit: number
  // What the guest hands over at this point — the agreed 50% deposit while
  // nothing has been paid yet, otherwise whatever is still owed. Never the whole
  // stay when the guest only agreed to a deposit.
  amountDue: number
  // What is still owed AFTER that payment, so the guest can see the deposit is
  // not the whole bill and knows what to bring on arrival.
  balanceAfter: number
  // What the guest agreed to pay when they booked:
  // 'deposit' | 'full' | 'custom' | 'reservation' | ''. A reservation agreed to nothing,
  // so the page names the plan instead of a figure.
  paymentPlan: '' | 'deposit' | 'full' | 'custom' | 'reservation'
  paymentMethod: string
  /**
   * When an AGENCY is paying (the owner's design, 2026-09) the bill is addressed to them:
   * the paper prints **`COMPANY` above `NAME OF GUEST`** and the guest as `c/o <name>` —
   * exactly the lines the hotel's own PGO bill carries. All of these are empty on an
   * ordinary booking, so nothing about the usual statement changes. The agency's address,
   * contact and TIN come from its profile rather than from the booking, so a corrected
   * agency detail is right on every past bill that is reprinted.
   */
  companyName: string
  companyAddress: string
  companyContact: string
  companyTin: string
  /** `7, 9` when the bill covers several rooms booked together; empty for one room. */
  roomsLabel: string
}

export interface StatementInput {
  primaryBooking: Booking
  relatedBookings: Booking[]
  rooms: Room[]
  venues: Venue[]
  deal?: PartnerDeal | null
  bookingsList: Booking[]
  /**
   * The food and bar tab for each booking, keyed by booking id (k69). Its lines
   * print under the room and its total joins the bill, so the paper the guest
   * holds carries the same figure the screen shows.
   */
  tabLinesByBooking?: Record<string, TabLine[]>
}

export function buildStatement(o: StatementInput): Statement {
  const { primaryBooking, relatedBookings, rooms, venues } = o

  // Every booking sharing the invoice contributes its own rows, in the order the desk
  // booked the rooms — the paper lists one line per room.
  const collected: StatementLineItem[] = []
  let subTotal = 0
  let downpaymentPaid = 0
  let securityDeposit = 0
  let amountDue = 0
  let balanceAfter = 0
  let paymentMethod = ''

  const paymentPlan: '' | 'deposit' | 'full' | 'custom' | 'reservation' =
    primaryBooking.payment_plan === 'deposit' || primaryBooking.payment_plan === 'full' || primaryBooking.payment_plan === 'custom' || primaryBooking.payment_plan === 'reservation'
      ? primaryBooking.payment_plan
      : ''

  // An agency booking is addressed to the agency (the owner's rule): the name is on the
  // booking, the rest of its details come from its profile when one was passed in.
  const agency = o.deal ?? null
  const companyName = (primaryBooking.company_name || agency?.name || '').trim()
  const companyAddress = (agency?.address || '').trim()
  const companyContact = (agency?.contact_no || '').trim()
  const companyTin = (agency?.tin || '').trim()

  relatedBookings.forEach(b => {
    const { items, tabTotal } = bookingLines(b, {
      rooms,
      venues,
      bookingsList: o.bookingsList,
      tabLinesByBooking: o.tabLinesByBooking,
    })
    collected.push(...items)
    // The rows add up to exactly this: rooms (gross) − the staff discount + breakfast +
    // extras + the food tab.
    subTotal += items.reduce((sum, item) => sum + item.amount, 0)
    downpaymentPaid += Number(b.downpayment_paid || 0)
    securityDeposit += Number(b.security_deposit || 0)
    // What to pay NOW, from the guest's own choice: the agreed 50% deposit while
    // nothing has been paid, otherwise what is left. Using `balance_due` alone
    // printed the whole stay as due, which contradicted a deposit booking. The tab
    // is passed in so the deposit is still worked out from the STAY alone.
    const payNow = amountToPayNow(b, tabTotal)
    amountDue += payNow
    balanceAfter += Math.max(0, Number(b.balance_due || 0) - payNow)
    if (b.payment_method) paymentMethod = b.payment_method
  })

  // Several rooms on one bill: the stay details name all of them, not just the first.
  const roomNumbers = relatedBookings
    .map(b => rooms.find(r => r.id === b.room_id)?.room_number)
    .filter((n): n is number => typeof n === 'number')
    .sort((a, b) => a - b)
  const roomsLabel = relatedBookings.length > 1 ? roomNumbers.join(', ') : ''

  const invoiceNumber = primaryBooking.invoice_number || (
    'GRF-' + primaryBooking.check_in.substring(0, 7).replace('-', '') + '-PREVIEW'
  )

  return {
    invoiceNumber,
    dateIssued: primaryBooking.created_at ? new Date(primaryBooking.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '',
    lineItems: collected,
    subTotal,
    downpaymentPaid,
    partialPayment: 0,
    other: 0,
    securityDeposit,
    amountDue,
    balanceAfter,
    paymentPlan,
    paymentMethod,
    companyName,
    companyAddress,
    companyContact,
    companyTin,
    roomsLabel,
  }
}
