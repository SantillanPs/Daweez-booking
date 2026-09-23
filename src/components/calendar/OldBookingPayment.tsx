const fmtPeso = (n: number) => '₱' + n.toLocaleString()

interface OldBookingPaymentProps {
  payMode: string
  setPayMode: (v: string) => void
  payDate: string
  setPayDate: (v: string) => void
  deposit: string
  setDeposit: (v: string) => void
  usePromo: boolean
  setUsePromo: (v: boolean) => void
  fullyPaid: boolean
  setFullyPaid: (v: boolean) => void
  totalLabel: string
  totalNum: number
  balance: number
  cleanNum: (v: string) => string
}

// "What was paid" box for the Log-old-booking form. A single "Amount paid"
// input, or mark the booking fully paid and the amount equals the total.
export function OldBookingPayment({ payMode, setPayMode, payDate, setPayDate, deposit, setDeposit, usePromo, setUsePromo, fullyPaid, setFullyPaid, totalLabel, totalNum, balance, cleanNum }: OldBookingPaymentProps) {
  const baseField = 'w-full bg-page border text-main px-3 py-2 rounded-lg text-sm focus:outline-none'
  const field = baseField + ' border-soft focus:border-gold-500'
  const label = 'text-[10px] text-muted font-bold block mb-1'
  const moneyField = field + ' mt-1 font-mono'

  return (
    <div className="bg-paper-50 border border-paper-200 rounded-lg p-3 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">What was paid</p>
      <div className="flex items-center gap-2 pt-0.5 select-none">
        <input type="checkbox" id="fully-paid" checked={fullyPaid} onChange={e => setFullyPaid(e.target.checked)} className="rounded text-gold-600 accent-gold-600 w-3.5 h-3.5 cursor-pointer" />
        <label htmlFor="fully-paid" className="text-[11px] font-bold text-main cursor-pointer">Fully paid?</label>
        <span className="text-[10px] text-muted">Check to use the full price.</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className={label}>Mode of payment
          <select value={payMode} onChange={e => setPayMode(e.target.value)} className={field + ' mt-1'}>
            <option>Cash</option><option>GCash</option><option>Bank transfer</option><option>Other</option>
          </select>
        </label>
        <label className={label}>Date paid
          <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={field + ' mt-1'} />
        </label>
        <label className={label}>Total (auto){totalLabel}
          <input type="text" value={totalNum ? String(totalNum) : ''} disabled placeholder="0" className={moneyField + ' disabled:opacity-60 disabled:cursor-not-allowed'} />
        </label>
        <label className={label}>Amount paid
          <input type="text" inputMode="decimal" value={fullyPaid ? String(totalNum) : deposit} onChange={e => { setDeposit(cleanNum(e.target.value)); setFullyPaid(false) }} placeholder="0" className={moneyField} />
        </label>
      </div>
      <div className="flex items-center gap-2 pt-1 select-none">
        <input type="checkbox" id="use-promo" checked={usePromo} onChange={e => setUsePromo(e.target.checked)} className="rounded text-gold-600 accent-gold-600 w-3.5 h-3.5 cursor-pointer" />
        <label htmlFor="use-promo" className="text-[10px] font-bold text-muted cursor-pointer">Use the price on the board today</label>
      </div>
      <div className="flex items-center justify-between text-[12px] pt-1 border-t border-paper-200">
        <span className={balance <= 0 ? 'text-emerald-600' : 'text-danger-600'}>{balance <= 0 ? 'Fully paid' : 'Total Due'}</span>
        <span className={'font-bold ' + (balance <= 0 ? 'text-emerald-600' : 'text-danger-600')}>{fmtPeso(balance)}</span>
      </div>
    </div>
  )
}