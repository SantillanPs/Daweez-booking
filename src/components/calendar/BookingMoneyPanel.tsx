import { Booking } from '../../types/booking'
import {
  getPaymentView, PAYMENT_BADGE_CLASSES, amountToPayNow, paymentPlanLabel,
  paymentStatusWord, hasPaymentRecorded,
} from '../../utils/bookingMoney'
import { paymentKind } from '../../utils/paymentMethod'

const fmtPeso = (n: number) => '₱' + n.toLocaleString()
const METHODS = ['Cash', 'GCash', 'Bank transfer', 'Other']

interface BookingMoneyPanelProps {
  localBooking: Booking
  payFlash: boolean
  /**
   * True only while the staff member is actually taking a payment: right after
   * a booking, or once they have pressed Receive money / Check in. Otherwise
   * the card stays a quiet status strip, so opening a booking never feels like
   * being handed a task.
   */
  open: boolean
  /**
   * The method for the payment ABOUT TO BE TAKEN. Staff pick it for every
   * payment, because the guest may settle the rest a different way than the
   * deposit — a cash deposit here, then GCash at the door.
   */
  method: string
  setMethod: (v: string) => void
  /** The reference that belongs to that payment (GCash / bank only). */
  reference: string
  setReference: (v: string) => void
  referenceError?: string
}

// The money card has three faces, and only ever one at a time:
//
//   OPEN      — the full panel, while a payment is being taken: chip, Pay by,
//               whole stay total, amount to pay, progress bar, reference box.
//   WAITING   — a quiet amber strip saying the stay is only partly paid. This is
//               what a deposit booking looks like when staff open it: a clear
//               signal, no task. Money is taken only when they decide to.
//   SETTLED   — a green strip once nothing is left to pay.
//
// The waiting strip exists because an always-open payment panel read as "you
// still have something to do" long before the guest walked in. The staff member
// decides when to take the rest; the booking just says how it stands.
export function BookingMoneyPanel({
  localBooking, payFlash, open, method, setMethod, reference, setReference, referenceError = '',
}: BookingMoneyPanelProps) {
  const paid = Number(localBooking.downpayment_paid || 0)
  const owed = Number(localBooking.balance_due || 0)
  const total = paid + owed
  const dueNow = amountToPayNow(localBooking)
  const plan = paymentPlanLabel(localBooking.payment_plan)
  const view = getPaymentView(localBooking)
  const received = hasPaymentRecorded(localBooking) || paid > 0

  const kind = paymentKind(method)
  const needsProof = kind === 'gcash' || kind === 'bank'
  const proofLabel = kind === 'gcash' ? 'GCash reference no.' : 'Bank transfer reference no.'
  // The booking already decided how the first payment is made, so that one is
  // shown as a fact rather than asked for again. From the second payment on the
  // guest may pay another way, and the picker appears.
  const methodLocked = !hasPaymentRecorded(localBooking)

  const lastPaidAt = (localBooking.payment_records || [])
    .reduce<string>((latest, r) => ((r.paid_at || '') > latest ? r.paid_at || '' : latest), '')
  const paidToday = lastPaidAt
    ? new Date(lastPaidAt).toDateString() === new Date().toDateString()
    : false

  // ── Settled: nothing left to hand over ────────────────────────────────────
  if (dueNow <= 0) {
    // No single method is named here: a deposit can be cash and the rest GCash,
    // so the count of payments is the honest summary. Each receipt below still
    // shows exactly how its own money was paid.
    const receiptCount = (localBooking.payment_records || []).length
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 flex items-center gap-2.5">
        <span className={'text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 ' + PAYMENT_BADGE_CLASSES[view.tone]}>
          {paymentStatusWord(localBooking)}
        </span>
        <span className="min-w-0">
          <span className="block text-[12px] font-bold text-emerald-800 leading-tight">Fully paid ✓</span>
          <span className="block text-[10px] font-semibold text-emerald-700 truncate">
            {fmtPeso(paid)} received
            {receiptCount > 0 ? ' · ' + receiptCount + ' payment' + (receiptCount > 1 ? 's' : '') : ''}
            {paidToday ? ' · today' : ''}
          </span>
        </span>
      </div>
    )
  }

  // ── Waiting: part of the stay is paid, and the rest is the staff's call ────
  if (!open) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 flex items-center gap-2.5">
        <span className={'text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 ' + PAYMENT_BADGE_CLASSES[view.tone]}>
          {paymentStatusWord(localBooking)}
        </span>
        <span className="min-w-0">
          <span className="block text-[12px] font-bold text-amber-800 leading-tight">Partly paid</span>
          <span className="block text-[10px] font-semibold text-amber-700 truncate">
            {fmtPeso(paid)} of {fmtPeso(total)} received · {fmtPeso(owed)} still to receive
          </span>
        </span>
        {payFlash && <span className="ml-auto text-[10px] font-bold text-emerald-600 shrink-0">Saved ✓</span>}
      </div>
    )
  }

  // ── Open: the payment being taken right now ───────────────────────────────
  const amountCaption = received ? 'Rest of the stay' : (plan || 'Full payment')
  const receivedPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0

  return (
    <div className="rounded-xl border border-paper-200 bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-paper-50 border-b border-paper-200">
        <span className={'text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 ' + PAYMENT_BADGE_CLASSES[view.tone]}>
          {paymentStatusWord(localBooking)}
        </span>
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted shrink-0">Pay by</span>
          {methodLocked ? (
            /* Nothing has been paid yet, so the method is the one agreed when
               the booking was made — it is not asked for again. */
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text truncate">{method}</span>
          ) : (
            /* Money has already changed hands once, and the guest may settle the
               rest a different way — so this one is the staff's to change. */
            <select value={method} onChange={e => setMethod(e.target.value)}
              title="How this payment is being made — chosen again for every payment"
              className="bg-transparent text-[10px] font-bold uppercase tracking-wider text-brand-text cursor-pointer focus:outline-none">
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          {payFlash && <span className="text-[10px] font-bold text-emerald-600 shrink-0">Saved ✓</span>}
        </span>
      </div>

      {/* The only two numbers, each named so neither can be misread. */}
      <div className="grid grid-cols-2 divide-x divide-paper-200">
        <div className="px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Whole stay total</p>
          <p className="font-display text-[22px] font-bold leading-none mt-1.5 text-main">{fmtPeso(total)}</p>
          <p className="text-[10px] text-muted mt-1.5 leading-snug">Every charge, before any payment</p>
        </div>
        <div className="px-3.5 py-3 bg-gold-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-text">Amount to pay</p>
          <p className="font-display text-[26px] font-extrabold leading-none mt-1.5 text-ink-900">{fmtPeso(dueNow)}</p>
          <p className="text-[10px] font-semibold mt-1.5 leading-snug text-brand-text">{amountCaption}</p>
        </div>
      </div>

      {/* Payment progress. An empty bar means nothing is paid yet; a green fill
          means money is already in hand — so the stage reads with no English. */}
      <div className="px-3.5 py-3 border-t border-paper-200">
        <div className="h-2 rounded-full bg-paper-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            /* The one value Tailwind cannot express: a live percentage. */
            style={{ width: receivedPct + '%' }}
          />
        </div>
        <p className={'mt-1.5 text-[10px] font-bold ' + (paid > 0 ? 'text-emerald-600' : 'text-muted')}>
          {paid > 0
            ? '✓ ' + fmtPeso(paid) + ' of ' + fmtPeso(total) + ' received' + (paidToday ? ' · today' : '')
            : 'Nothing received yet'}
        </p>
      </div>

      {/* Proof for the payment about to be taken — only where one exists. This is
          the only reference box in the quick view: the button below submits it. */}
      {needsProof && (
        <label className="block px-3.5 py-3 border-t border-paper-200">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {proofLabel} <span className="text-danger-500">*</span>
          </span>
          <input
            value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder={kind === 'gcash' ? 'e.g. 1234 567 890123' : 'e.g. transfer ref no.'}
            className={'w-full mt-1 bg-card border text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none ' +
              (referenceError ? 'border-danger-400 focus:border-danger-500' : 'border-soft focus:border-gold-500')}
          />
          {referenceError && <span className="block text-[10px] font-semibold text-danger-600 mt-1">{referenceError}</span>}
        </label>
      )}
    </div>
  )
}
