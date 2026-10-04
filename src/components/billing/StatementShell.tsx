import React, { useRef, useState } from 'react'
import { Printer, X } from 'lucide-react'
import { EmailTarget } from '../../utils/emailDocument'
import { EmailBar, EmailButton } from './EmailBar'

/**
 * The frame both bills are printed in: the on-screen control bar (hidden when printing)
 * and the A4 page itself, so the **normal** statement and the **agency** statement are the
 * same piece of paper with different contents on it (the owner's design, 2026-09).
 */
export function StatementShell({ label, invoiceNumber, onClose, onPrint, embedded = false, email, children }: {
  /** The little badge on the control bar — `Billing statement` on both. */
  label: string
  invoiceNumber: string
  onClose: () => void
  onPrint: () => void
  embedded?: boolean
  /** Who this bill can be emailed to. The Email button is drawn only when it is given. */
  email?: EmailTarget
  children: React.ReactNode
}) {
  // The sheet itself — what is attached when the bill is emailed.
  const sheet = useRef<HTMLDivElement>(null)
  const [emailing, setEmailing] = useState(false)

  return (
    <div className={'print-page bg-card w-full max-w-xl mx-auto rounded-xl shadow-2xl overflow-hidden flex flex-col print:my-0 print:shadow-none print:rounded-none print:w-full print:max-w-none ' + (embedded ? 'my-0 shadow-xl' : 'my-8')}>
      <div className="flex items-center justify-between px-5 py-3 bg-ink-900 text-white shrink-0 print:hidden">
        <div className="flex items-center gap-2">
          <span className="bg-white text-ink-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase">{label}</span>
          <span className="text-xs font-mono text-white/70">{invoiceNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          {email && <EmailButton tone="ink" onClick={() => setEmailing(open => !open)} />}
          <button onClick={onPrint} className="bg-white hover:bg-slate-100 text-ink-800 font-bold text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer">
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      {email && emailing && (
        <EmailBar target={email} paper={() => sheet.current} size="a5" onClose={() => setEmailing(false)}
          className="px-5 py-3 border-b border-soft shrink-0" />
      )}
      {/* On paper the page box is zero-margin (set at print time in `PrintInvoiceModal`),
          so the sheet has no place for the browser's own header/footer; the paper's own
          margins live here.

          `space-y-2` is the **one spacing rhythm of the whole sheet** (card k144, the
          owner's ruling: *"can you just make the padding consistent?"*). Every direct child
          — the letterhead, the rule, the fields, the charges table, the payment block, the
          policies, the signatures — is exactly **8px** below the one before it, and
          `BrandHeader` returns a fragment, so its letterhead div and its rule div are
          direct children too and take part in the same rhythm. The blocks therefore carry
          **no vertical padding of their own**; if one ever needs its own, this rhythm is
          gone and the page starts drifting again. */}
      <div ref={sheet} className="p-6 md:p-10 overflow-y-auto print:px-8 print:py-4 print:overflow-visible flex-1 bg-card font-sans text-main leading-relaxed print:static space-y-2">
        {children}
      </div>
    </div>
  )
}

/** The hotel's own letterhead, identical on every piece of paper the office prints. */
export function BrandHeader({ invoiceNumber, dateIssued, showDate = true, heading = 'Guest Billing Statement', dateLabel = 'Date Issued' }: { invoiceNumber?: string; dateIssued?: string; showDate?: boolean; heading?: string; dateLabel?: string }) {
  return (
    <>
      {/* The letterhead is **always** two columns, never `sm:flex-row` (card k144, the
          owner's ruling, 2026-09-29): A5 is 559px wide and `sm` starts at 640px, so the
          breakpoint never fires on paper — the hotel's address and the bill number were
          stacking and costing the page height for nothing. The document is always rendered
          at 576px or less (`max-w-xl`), so this is also what the preview now shows.

          `pb-4` here and `my-2` on the rule below were **16px + 16px** around the bold
          rule; with the field block's `py-3` underneath, the rule floated in 46px of air
          (the owner's *"massive padding in those bold lines"*). Both are gone now — the
          shell's `space-y-2` gives the rule its 8px above and below. */}
      <div className="flex flex-row justify-between items-start gap-3">
        <div className="min-w-0">
          {/* `text-[16px]` and `whitespace-nowrap` (card k144): at `text-lg` the hotel's name
              needed ~240px and the bill-number block was leaving it ~235, so it broke after
              "PENSION" and cost the page a line. The right-hand block is now `text-[12px]`,
              which gives the name the room it needs to sit on one line. */}
          <h1 className="font-display font-extrabold text-[16px] text-ink-800 uppercase tracking-tight whitespace-nowrap">Daweez Pension House</h1>
          <p className="text-[11px] text-ink-600 mt-0.5">National Highway, San Agustin Sur, Tandag City, Surigao del Sur</p>
          <p className="text-[11px] text-ink-600">Email Address: daweezpensionhouse@gmail.com</p>
          <p className="text-[11px] text-ink-600">Mobile No: 0910-7163830</p>
        </div>
        <div className="text-right shrink-0">
          <h2 className="font-display font-bold text-[12px] text-ink-800 uppercase tracking-wider whitespace-nowrap">{heading}</h2>
          <div className="mt-2 text-[12px] text-ink-700 space-y-1">
            {invoiceNumber && (
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[11px] font-bold whitespace-nowrap">Bill / Invoice No.:</span>
                <span className="font-mono border-b border-ink-300">{invoiceNumber}</span>
              </div>
            )}
            {showDate && dateIssued && (
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[11px] font-bold whitespace-nowrap">{dateLabel}:</span>
                <span className="font-mono border-b border-ink-300">{dateIssued}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="border-t-2 border-ink-700" />
    </>
  )
}

/** One labelled line, like the paper form. A field the booking does not hold is skipped. */
export function Line({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  const shown = (value ?? '').toString().trim()
  if (!shown) return null
  return (
    <div className={'flex items-end gap-2 border-b border-ink-300 pb-px ' + className}>
      <span className="text-[11px] font-bold whitespace-nowrap text-main">{label}:</span>
      <span className="flex-1 text-[13px] text-main min-h-[18px] break-words">{shown}</span>
    </div>
  )
}
