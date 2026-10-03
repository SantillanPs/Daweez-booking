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
 * Every payment the guest has made, each with its own receipt to reprint.
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
    <section>
      <h4 className="text-[13px] font-bold text-main">Payment receipts</h4>
      <ul className="mt-1.5 border border-soft rounded-lg divide-y divide-soft">
        {records.map(r => {
          const covers = r.receipt_number ? coveredRooms?.[r.receipt_number] : undefined
          return (
            <li key={r.id} className="flex items-center justify-between gap-2 pl-3 pr-0.5 min-h-11">
              <div className="min-w-0 py-1.5 text-[13px]">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold text-emerald-600">+{fmtPeso(r.amount)}</span>
                  <span className="text-main">{r.method}</span>
                  <span className="text-muted text-[12px]">{r.paid_at ? new Date(r.paid_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                </p>
                {/* A receipt that covered other rooms says so, and names them — that is what makes it findable
                    from here instead of sending staff hunting through the other bookings. */}
                {covers && covers.length > 1 && (
                  <p className="text-[12px] text-muted">
                    {formatRoomNumbers(covers)} together{r.receipt_number ? ' · ' + r.receipt_number : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center shrink-0">
                <button type="button" onClick={() => onPrint(r)} className="w-11 h-11 flex items-center justify-center text-gold-700 hover:text-gold-800 cursor-pointer" aria-label="Print receipt" title="Print receipt">
                  <Printer className="w-4 h-4" />
                </button>
                {onRemove && (
                  <button type="button" onClick={() => onRemove(r)} className="w-11 h-11 flex items-center justify-center text-muted hover:text-danger-600 cursor-pointer" aria-label="Remove payment" title="Remove this payment">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
