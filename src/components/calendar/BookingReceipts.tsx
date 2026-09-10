import { PaymentRecord } from '../../types/booking'
import { NumInput } from '../NumInput'
import { Printer } from 'lucide-react'

const fmtPeso = (n: number) => '₱' + n.toLocaleString()

interface BookingReceiptsProps {
  records: PaymentRecord[]
  open: boolean
  setOpen: (v: boolean) => void
  amount: number
  setAmount: (v: number) => void
  method: string
  setMethod: (v: string) => void
  reference: string
  setReference: (v: string) => void
  onAdd: () => void
  onPrint: (r: PaymentRecord) => void
}

// One receipt per payment the guest actually made. Reprintable at any time.
export function BookingReceipts({
  records, open, setOpen, amount, setAmount, method, setMethod, reference, setReference, onAdd, onPrint,
}: BookingReceiptsProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-[11px] font-bold text-gold-700 bg-gold-100 border border-gold-200 hover:bg-gold-100 rounded-md px-2.5 py-1 transition-colors cursor-pointer"
        >
          {open ? 'Cancel' : '+ Record a payment'}
        </button>
      </div>

      {open && (
        <div className="p-3 bg-page border border-soft rounded-lg space-y-2">
          <label className="text-[10px] text-muted font-bold block">Amount (PHP)</label>
          <NumInput value={amount} onChange={setAmount} placeholder="0"
            className="w-full bg-card border border-soft text-main px-2.5 py-1.5 rounded-lg text-sm font-mono focus:outline-none focus:border-gold-500" />
          <div className="grid grid-cols-2 gap-2">
            <select value={method} onChange={e => setMethod(e.target.value)} className="bg-card border border-soft text-main px-2.5 py-1.5 rounded-lg text-sm focus:outline-none focus:border-gold-500">
              <option>Cash</option><option>GCash</option><option>Bank transfer</option><option>Other</option>
            </select>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Reference (optional)" className="bg-card border border-soft text-main px-2.5 py-1.5 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
          </div>
          <button type="button" onClick={onAdd} className="w-full bg-gold-400 hover:bg-gold-600 text-ink-900 text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer">Save receipt</button>
        </div>
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
              <button type="button" onClick={() => onPrint(r)} className="text-gold-600 hover:text-gold-700 p-1 cursor-pointer shrink-0" aria-label="Print receipt">
                <Printer className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted">No payments yet — a receipt is created each time the guest pays.</p>
      )}
    </div>
  )
}
