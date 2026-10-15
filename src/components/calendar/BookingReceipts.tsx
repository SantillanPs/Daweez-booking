import { PaymentRecord } from '../../types/booking'
import { Printer, Trash2 } from 'lucide-react'
import { formatRoomNumbers } from '../../utils/roomNumbers'

const fmtPeso = (n: number) => '₱' + n.toLocaleString()

interface BookingReceiptsProps {
  records: PaymentRecord[]
  onPrint: (r: PaymentRecord) => void
  /** Removing a receipt logged by mistake; the balance is recomputed after. */
  onRemove?: (r: PaymentRecord) => void
  /**
   * Which rooms each receipt covers, by receipt number.
   *
   * **A payment is written onto every room it paid for** (the owner's ruling, 2026-09-30) so the desk can
   * always find it — which means Room 7's list can show a ₱9,200 receipt that is not Room 7's money. The
   * covering rooms are what identify it, so they are printed under the amount whenever there is more than
   * one. Without them the receipt reads as this room's own payment.
   */
  coveredRooms?: Record<string, number[]>
}

/**
 * Every payment the guest has made, each with its own receipt to reprint — as lines of the
 * panel's folded bill, under the charges (the owner chose the "visual hierarchy" panel,
 * 2026-10-15). Rendered as `<li>`s; the bill owns the list.
 *
 * **A plain list, shown only once there is a payment** (the owner's feedback, 2026-10-04:
 * *"it looks so lazy just stacking accordions"*). It used to be a closed section that was
 * on screen even when empty — `Payment receipts · None yet`, opening to a sentence saying
 * there were none — and it carried a second "Record a payment" form a few lines under the
 * money box's own button. Money is taken in one place now, the money box, so this only
 * lists what has been taken.
 */
export function BookingReceipts({ records, onPrint, onRemove, coveredRooms }: BookingReceiptsProps) {
  return (
    <>
      {records.map(r => {
        const covers = r.receipt_number ? coveredRooms?.[r.receipt_number] : undefined
        // What sets this payment apart: its receipt number, the order slips it was
        // taken for, and — when it covered other rooms — which ones. Naming the rooms
        // is what makes it findable from here instead of sending staff hunting
        // through the other bookings.
        const about = [
          r.paid_at ? new Date(r.paid_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '',
          r.receipt_number,
          r.slips && r.slips.length > 0 ? 'Order slip ' + r.slips.join(', ') : '',
          covers && covers.length > 1 ? formatRoomNumbers(covers) + ' together' : '',
        ].filter(Boolean).join(' · ')
        return (
          <li key={r.id} className="flex items-center justify-between gap-2 border-b border-dashed border-paper-300 last:border-0">
            <span className="min-w-0 py-1.5 text-[12px] text-muted">
              <span className="font-semibold text-main">{r.method}</span>{about && ' · ' + about}
            </span>
            <span className="flex items-center shrink-0">
              <span className="text-[12px] font-semibold text-emerald-700 tabular-nums mr-1">−{fmtPeso(r.amount)}</span>
              <button type="button" onClick={() => onPrint(r)} className="w-10 h-10 flex items-center justify-center text-gold-700 hover:text-gold-800 cursor-pointer" aria-label="Print or email receipt" title="Print or email receipt">
                <Printer className="w-4 h-4" />
              </button>
              {onRemove && (
                <button type="button" onClick={() => onRemove(r)} className="w-10 h-10 flex items-center justify-center text-muted hover:text-danger-600 cursor-pointer" aria-label="Remove payment" title="Remove this payment">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </span>
          </li>
        )
      })}
    </>
  )
}
