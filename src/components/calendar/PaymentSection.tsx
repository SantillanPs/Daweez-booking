import React from 'react'

export interface PaymentTotals {
  grand: number
  deposit: number
  balance: number
}

interface PaymentSectionProps {
  totals: PaymentTotals
  payStatus: 'unpaid' | 'downpayment' | 'paid'
  setPayStatus: (s: 'unpaid' | 'downpayment' | 'paid') => void
  payMethod: string
  setPayMethod: (s: string) => void
  payRef: string
  setPayRef: (s: string) => void
}

// Plain-language payment card: total, 50% deposit, balance left, and what
// the guest handed over right now.
export function PaymentSection({ totals, payStatus, setPayStatus, payMethod, setPayMethod, payRef, setPayRef }: PaymentSectionProps) {
  return (
    <section className="bg-sea-50/70 border border-sea-200 rounded-lg p-3 space-y-2.5">
      <p className="text-[11px] font-bold text-sea-800 uppercase tracking-wider">Payment</p>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Total</span>
        <span className="font-display font-bold text-main">₱{totals.grand.toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Deposit (50%)</span>
        <span className="font-semibold text-main">₱{totals.deposit.toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between text-sm border-t border-sea-200/70 pt-2">
        <span className="text-muted">Left to pay</span>
        <span className="font-semibold text-coral-600">₱{totals.balance.toLocaleString()}</span>
      </div>
      <div>
        <p className="text-[10px] text-muted font-bold mb-1.5">How much did they pay now?</p>
        <div className="grid grid-cols-3 gap-1.5">
          {([['unpaid', 'Not yet'], ['downpayment', 'Deposit'], ['paid', 'Fully paid']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setPayStatus(val)} className={'px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ' + (payStatus === val ? 'bg-sea-600 border-sea-600 text-white shadow-sm' : 'bg-card border-soft text-muted hover:border-sea-400')}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {payStatus !== 'unpaid' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted font-bold block mb-1">Paid with</label>
            <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full bg-card border border-soft text-main px-2.5 py-1.5 rounded-lg text-sm focus:outline-none focus:border-sea-500">
              <option>Cash</option><option>GCash</option><option>Bank transfer</option><option>Other</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted font-bold block mb-1">Reference (optional)</label>
            <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Ref no." className="w-full bg-card border border-soft text-main px-2.5 py-1.5 rounded-lg text-sm focus:outline-none focus:border-sea-500" />
          </div>
        </div>
      )}
    </section>
  )
}
