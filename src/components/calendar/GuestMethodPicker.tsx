import { ChevronDown } from 'lucide-react'
import { paymentKind, methodNeedsReference, PAYMENT_METHODS, paymentMethodChoice } from '../../utils/paymentMethod'

// The one list of ways to pay lives in `utils/paymentMethod` — the booking form's own
// `Paid by` row reads the same array, so the till and the form can never offer different
// choices (the owner's ruling, 2026-09-29).
const METHODS = PAYMENT_METHODS

/** The stored method, as the one of these labels it means (or '' if none). */
const chosenLabel = (method: string): string => paymentMethodChoice(method)

interface GuestMethodPickerProps {
  /** The booking's own `payment_method` — what the guest told the desk. */
  method: string
  /** The reference the guest gave (GCash / bank). */
  reference: string
  /** Shown under the control when the money is confirmed without a method or reference. */
  error?: string
  onPick: (method: string) => void
  onReference: (reference: string) => void
  /** Saves what has been typed so far (on blur), so nobody hunts for a Save button. */
  onReferenceCommit: () => void
}

/**
 * How the guest pays, said once (cards k132, and the owner's follow-up).
 *
 * The choice is the GUEST's — the printed bill carries the boxes they tick — and
 * the desk writes down what they were told. There is deliberately:
 *
 *   - **no Save button**: tapping a method writes it down, and the reference saves
 *     on the way out. The one action that matters is the record button below;
 *   - **no tick, no circle, no emoji**: the chosen method is the name on the
 *     control, nothing else sits beside the word;
 *   - **Cash · GCash · Bank transfer** only, with GCash and Bank transfer asking
 *     for the guest's reference, which the bill and the receipt print.
 *
 * The shape is the owner's own pick ("use that"): **one short list** — a single
 * button carrying the chosen method, opening the three options — and the
 * reference on the same line as a short label, because the method is already
 * named above it. It replaced a row of three buttons that went ragged on a small
 * screen, and it never preselects anything the guest did not say: with nothing
 * recorded the control reads *Choose…*, so a GCash guest can never be written
 * down as cash.
 */
export function GuestMethodPicker({
  method, reference, error = '', onPick, onReference, onReferenceCommit,
}: GuestMethodPickerProps) {
  const current = paymentKind(method)
  const value = chosenLabel(method)
  const needsRef = methodNeedsReference(method)

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="block text-[12px] font-semibold text-muted">Guest pays by</span>
        <span className="relative block mt-1">
          <select
            value={value}
            onChange={e => onPick(e.target.value)}
            className="w-full h-11 appearance-none bg-card border border-soft rounded-lg pl-3 pr-9 text-[13px] font-semibold text-main focus:outline-none focus:border-gold-500 cursor-pointer"
          >
            <option value="" disabled>Choose…</option>
            {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </span>
      </label>

      {/* GCash / Bank transfer: the guest's reference, on the line under the
          method. The label is short ("Ref no.") because the chosen method is
          already named above it — that is what keeps the row whole at 323px. */}
      {needsRef && (
        <label className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-muted shrink-0">
            Ref no. <span className="text-danger-500">*</span>
          </span>
          <input
            value={reference}
            onChange={e => onReference(e.target.value)}
            onBlur={onReferenceCommit}
            placeholder={current === 'gcash' ? '1234 567 8901' : 'transfer ref no.'}
            className={'flex-1 min-w-0 h-11 bg-card border text-main px-3 rounded-lg text-[13px] focus:outline-none ' +
              (error ? 'border-danger-400 focus:border-danger-500' : 'border-soft focus:border-gold-500')}
          />
        </label>
      )}
      {error && <p className="text-[12px] font-semibold text-danger-600">{error}</p>}
    </div>
  )
}
