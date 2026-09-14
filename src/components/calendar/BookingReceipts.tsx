import { PaymentRecord } from '../../types/booking'
import { Printer, Trash2 } from 'lucide-react'
import { RecordPaymentForm } from './RecordPaymentForm'

const fmtPeso = (n: number) => '₱' + n.toLocaleString()

interface BookingReceiptsProps {
  records: PaymentRecord[]
  showAdd: boolean
  open: boolean
  setOpen: (v: boolean) => void
  totalDue: number
  amount: number
  setAmount: (v: number) => void
  method: string
  setMethod: (v: string) => void
  reference: string
  setReference: (v: string) => void
  onAdd: () => void
  onPrint: (r: PaymentRecord) => void
  /** Removing a receipt logged by mistake; the balance is recomputed after. */
  onRemove?: (r: PaymentRecord) => void
  referenceRequired?: boolean
  referenceError?: string
}

// Every payment the guest has made, each with its own receipt to reprint.
export function BookingReceipts({
  records, showAdd, open, setOpen, totalDue, amount, setAmount,
  method, setMethod, reference, setReference, onAdd, onPrint, onRemove,
  referenceRequired = false, referenceError = '',
}: BookingReceiptsProps) {
  return (
    <div className="space-y-2.5">
      {showAdd && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-[11px] font-bold text-gold-700 bg-gold-100 border border-gold-200 hover:bg-gold-100 rounded-md px-2.5 py-1 transition-colors cursor-pointer"
          >
            {open ? 'Cancel' : '+ Record a payment'}
          </button>
        </div>
      )}

      {showAdd && open && (
        <RecordPaymentForm
          totalDue={totalDue}
          amount={amount} setAmount={setAmount}
          method={method} setMethod={setMethod}
          reference={reference} setReference={setReference}
          onSubmit={onAdd}
          referenceRequired={referenceRequired}
          referenceError={referenceError}
        />
      )}

      {records.length > 0 ? (
        <ul className="space-y-1.5">
          {records.map(r => (
            <li key={r.id} className="flex items-center justify-between gap-2 bg-card border border-soft rounded-md px-2.5 py-1.5 text-[12px]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-emerald-600 shrink-0">+{fmtPeso(r.amount)}</span>
                <span className="text-muted shrink-0">{r.method}</span>
                <span className="text-muted text-[10px] truncate">{r.paid_at ? new Date(r.paid_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</span>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button type="button" onClick={() => onPrint(r)} className="text-gold-600 hover:text-gold-700 p-1 cursor-pointer" aria-label="Print receipt" title="Print receipt">
                  <Printer className="w-3.5 h-3.5" />
                </button>
                {onRemove && (
                  <button type="button" onClick={() => onRemove(r)} className="text-muted hover:text-danger-600 p-1 cursor-pointer" aria-label="Remove payment" title="Remove this payment">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted">No payments yet — a receipt is created each time the guest pays.</p>
      )}
    </div>
  )
}
