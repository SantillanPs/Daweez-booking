import React from 'react'
import { Wallet } from 'lucide-react'
import { NumInput } from '../NumInput'

interface BookingDepositFieldsProps {
  /** What the stay comes to, so half of it can be offered as the deposit. */
  estTotal: number
  /** The working behind `estTotal` — nights, the room/venue part, breakfast and
   *  extras — so the half is shown as a sum instead of a bare figure. */
  nights: number
  stayAmount: number
  breakfast: number
  extras: number
  agreedDeposit: number
  setAgreedDeposit: (v: number) => void
  /** Correcting an existing booking: its invoice number and its figures. */
  isEditMode: boolean
  formInvoiceNumber: string
  setFormInvoiceNumber: (v: string) => void
  formDownpaymentPaid: number
  setFormDownpaymentPaid: (v: number) => void
  formBalanceDue: number | null
  setFormBalanceDue: (v: number | null) => void
  formSecurityDeposit: number | null
  setFormSecurityDeposit: (v: number | null) => void
}

const input = 'input input-bordered w-full'
const label = 'text-[10px] text-base-content/60 font-bold'

/**
 * What the guest pays now (cards k126 and k130).
 *
 * This replaced the old billing step, which printed a Total / Deposit / Balance
 * summary and asked staff to choose a payment method. The owner's rules changed
 * both of those:
 *
 *  - the summary is gone — those figures are on the printed statement the guest
 *    is handed, and saying them twice is noise;
 *  - **the deposit is half the stay by default and can be typed** when a
 *    different figure was agreed;
 *  - **the guest chooses how they pay**, so nothing here asks for a method. It is
 *    recorded when the money actually arrives.
 */
export function BookingDepositFields({
  estTotal,
  nights,
  stayAmount,
  breakfast,
  extras,
  agreedDeposit,
  setAgreedDeposit,
  isEditMode,
  formInvoiceNumber,
  setFormInvoiceNumber,
  formDownpaymentPaid,
  setFormDownpaymentPaid,
  formBalanceDue,
  setFormBalanceDue,
  formSecurityDeposit,
  setFormSecurityDeposit,
}: BookingDepositFieldsProps) {
  const half = Math.max(0, Math.round(estTotal / 2))

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Wallet className="w-3 h-3" />
        </span>
        <h4 className="text-[10px] font-bold text-base-content tracking-widest uppercase">What the guest pays now</h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,190px)_minmax(0,1fr)] gap-2.5 items-start">
        <label className="block">
          <span className={label}>Deposit (₱)</span>
          <NumInput value={agreedDeposit} onChange={setAgreedDeposit} className={input} />
        </label>
        <p className="text-[11px] text-base-content/70 sm:pt-4">
          {estTotal > 0 ? (
            <>
              {/* The working, not just the answer: the owner could not tell where
                  half the stay came from when the stay was more than one night. */}
              <span className="block">
                <b>{nights} {nights === 1 ? 'night' : 'nights'}</b>
                {' · Room '}<b>₱{stayAmount.toLocaleString()}</b>
                {breakfast > 0 && <>{' · Breakfast '}<b>₱{breakfast.toLocaleString()}</b></>}
                {extras > 0 && <>{' · Extras '}<b>₱{extras.toLocaleString()}</b></>}
              </span>
              <span className="block mt-0.5">
                Whole stay <b>₱{estTotal.toLocaleString()}</b> — half of it is <b>₱{half.toLocaleString()}</b>.
              </span>
              <span className="block mt-0.5">
                Type another figure if that is what you agreed. The guest chooses how they pay; it is recorded when the money arrives.
              </span>
            </>
          ) : (
            <>Half the stay is filled in for you once the dates and unit are chosen.</>
          )}
        </p>
      </div>

      {isEditMode && (
        <div className="border border-base-300 rounded-lg p-3 bg-base-100/40 space-y-2">
          <p className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider">Correcting this booking</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <label className="block">
              <span className={label}>Already received (₱)</span>
              <input type="text" inputMode="decimal" value={formDownpaymentPaid || ''}
                onChange={e => setFormDownpaymentPaid(parseFloat(e.target.value) || 0)} className={input} />
            </label>
            <label className="block">
              <span className={label}>Balance due (₱)</span>
              <input type="text" inputMode="decimal" value={formBalanceDue ?? ''}
                onChange={e => setFormBalanceDue(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Worked out from the stay" className={input} />
            </label>
            <label className="block">
              <span className={label}>Security deposit (₱)</span>
              <input type="text" inputMode="decimal" value={formSecurityDeposit ?? ''}
                onChange={e => setFormSecurityDeposit(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Optional" className={input} />
            </label>
            <label className="block">
              <span className={label}>Invoice number</span>
              <input value={formInvoiceNumber} onChange={e => setFormInvoiceNumber(e.target.value)}
                placeholder="Given one if left empty" className={input} />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
