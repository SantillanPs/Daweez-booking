import React, { useState } from 'react'
import { Check } from 'lucide-react'
import { Tab } from '../../types/tab'
import { PaymentRecord } from '../../types/booking'
import { settleTab } from '../../utils/tabs'
import { slipNumber } from '../../utils/orderSlips'
import { PAYMENT_METHODS, methodNeedsReference, paymentKind } from '../../utils/paymentMethod'
import { showToast } from '../../utils/toast'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

interface TabSettlePanelProps {
  tab: Tab
  /** What the diner ran up — the amount received, never typed. */
  total: number
  /** Handed the receipt so it can be printed straight away. */
  onSettled: (receipt: PaymentRecord) => Promise<void> | void
  /**
   * True while the slip still has orders the kitchen has not been given: the kitchen's
   * copy is the next step then, so this button steps back and only one is gold.
   */
  quiet?: boolean
  /**
   * Asked just before the money is taken, so it is never taken for a slip that changed
   * while the desk was looking at it. Answering false stops the payment.
   */
  ready?: () => Promise<boolean>
}

// Paying a walk-in's order slip (k69, part C): the one place a diner with no room pays.
// It sits on the front desk's screen (`DinerPayModal`), never in the restaurant — the
// money is always taken at the front desk (Sebastian, 2026-10-04).
//
// The amount is the slip's own total — a walk-in pays what they ran up, so there is
// nothing to type and nothing to part-pay. The receipt prints straight away, because
// the diner is standing at the desk. **Nothing is preselected** for how they paid:
// a silent `Cash` is how a GCash guest once got a Cash receipt.
export function TabSettlePanel({ tab, total, onSettled, quiet = false, ready }: TabSettlePanelProps) {
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const needsRef = methodNeedsReference(method)
  const isGcash = paymentKind(method) === 'gcash'

  const settle = async () => {
    if (total <= 0) { setError('Nothing to pay — the order slip is empty.'); return }
    if (!method) { setError('Choose how the diner paid.'); return }
    if (needsRef && !reference.trim()) { setError('Enter the ' + method + ' reference number.'); return }
    setError(''); setBusy(true)
    try {
      if (ready && !(await ready())) return
      const receipt = await settleTab({ tab, amount: total, method, reference })
      setReference('')
      showToast(fmtPeso(total) + ' received · ' + (slipNumber(tab) || 'order slip') + ' paid.', 'success')
      await onSettled(receipt)
    } catch (err) {
      setError('Could not record the payment — ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-soft space-y-2.5">
      <div className="grid grid-cols-2 gap-1.5">
        {PAYMENT_METHODS.map(m => (
          <button
            key={m}
            type="button"
            onClick={() => { setMethod(m); setReference(''); setError('') }}
            aria-pressed={m === method}
            className={'min-h-11 text-[13px] font-bold px-2.5 rounded-lg border transition-colors cursor-pointer ' +
              (m === method ? 'bg-gold-400 border-gold-400 text-ink-900' : 'bg-card border-soft text-main hover:border-gold-400 hover:bg-gold-100')}
          >
            {m}
          </button>
        ))}
      </div>

      {needsRef && (
        <label className="block">
          <span className="block text-[12px] font-semibold text-muted">{isGcash ? 'GCash reference no.' : 'Reference no.'}</span>
          <input
            value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder="From the guest's phone"
            className="w-full h-11 mt-1 bg-card border border-soft text-main px-3 rounded-lg text-[13px] focus:outline-none focus:border-gold-500"
          />
        </label>
      )}

      {error && <p className="text-[12px] font-semibold text-danger-600">{error}</p>}

      <button
        type="button"
        onClick={() => void settle()}
        disabled={busy || total <= 0}
        className={'w-full min-h-12 inline-flex items-center justify-center gap-1.5 text-[14px] font-bold px-3 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ' +
          (quiet ? 'bg-card border border-soft text-main hover:border-gold-400 hover:bg-gold-100' : 'bg-gold-400 hover:bg-gold-600 text-ink-900')}
      >
        <Check className="w-4 h-4" />
        {busy ? 'Receiving…' : 'Receive ' + fmtPeso(total)}
      </button>
    </div>
  )
}
