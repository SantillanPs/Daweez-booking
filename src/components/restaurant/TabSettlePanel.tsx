import React, { useState } from 'react'
import { Check } from 'lucide-react'
import { Tab } from '../../types/tab'
import { PaymentRecord } from '../../types/booking'
import { settleTab } from '../../utils/tabs'
import { methodNeedsReference } from '../../utils/paymentMethod'
import { showToast } from '../../utils/toast'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()
const METHODS = ['Cash', 'GCash', 'Bank transfer']

interface TabSettlePanelProps {
  tab: Tab
  /** What the diner ran up — the amount received, never typed. */
  total: number
  /** Handed the receipt so it can be printed straight away. */
  onSettled: (receipt: PaymentRecord) => Promise<void> | void
}

// Settling a walk-in tab (k69, part C): the one place a diner with no room pays.
//
// The amount is the tab's own total — a walk-in settles what they ran up, so
// there is nothing to type and nothing to part-pay. The receipt prints straight
// away, because the diner is standing at the counter.
export function TabSettlePanel({ tab, total, onSettled }: TabSettlePanelProps) {
  const [method, setMethod] = useState('Cash')
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const needsRef = methodNeedsReference(method)

  const settle = async () => {
    if (total <= 0) { setError('Nothing to settle — the tab is empty.'); return }
    if (needsRef && !reference.trim()) { setError('Enter the ' + method + ' reference number.'); return }
    setError(''); setBusy(true)
    try {
      const receipt = await settleTab({ tab, amount: total, method, reference })
      setReference('')
      showToast(fmtPeso(total) + ' received · tab closed.', 'success')
      await onSettled(receipt)
    } catch (err) {
      setError('Could not settle the tab — ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 border border-gold-400 bg-gold-100 rounded-lg p-3 space-y-2">
      <p className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-bold text-ink-900">To pay</span>
        <span className="font-display text-[18px] font-extrabold text-ink-900">{fmtPeso(total)}</span>
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {METHODS.map(m => (
          <button
            key={m}
            type="button"
            onClick={() => { setMethod(m); setReference(''); setError('') }}
            className={'text-[11.5px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ' +
              (m === method ? 'bg-gold-400 border-gold-400 text-ink-900' : 'bg-card border-soft text-ink-600 hover:bg-gold-100')}
          >
            {m}
          </button>
        ))}
      </div>

      {needsRef && (
        <label className="block">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
            {method === 'GCash' ? 'GCash reference no.' : 'Bank transfer reference no.'}
          </span>
          <input
            value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder={method === 'GCash' ? 'e.g. 1234 567 890123' : 'e.g. transfer ref no.'}
            className="w-full mt-1 bg-card border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500"
          />
        </label>
      )}

      {error && <p className="text-[11px] font-semibold text-danger-600">{error}</p>}

      <button
        type="button"
        onClick={() => void settle()}
        disabled={busy || total <= 0}
        className="w-full inline-flex items-center justify-center gap-1.5 text-[13px] font-bold text-ink-900 bg-gold-400 hover:bg-gold-600 px-3 py-2.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
      >
        <Check className="w-4 h-4" />
        {busy ? 'Receiving…' : 'Receive ' + fmtPeso(total) + ' & close tab'}
      </button>

      <p className="text-[10.5px] text-muted">The full amount — a walk-in settles what they ran up. The receipt prints next.</p>
    </div>
  )
}
