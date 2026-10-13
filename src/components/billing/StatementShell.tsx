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
  // The owner's pick from the drawings, 2026-10-13. Still **always** two columns, never
  // `sm:flex-row` (card k144): A5 is 559px wide and `sm` starts at 640px, so a breakpoint
  // never fires on paper. The bill number sits alone under the title, larger than anything
  // beside it; `Bill no.` and the date's label are grey, the figures black — the page's one
  // rule for telling a label from the information.
  return (
    <>
      <div className="flex flex-row justify-between items-start gap-3">
        <div className="min-w-0">
          <h1 className="font-display font-extrabold text-[17px] text-ink-900 uppercase tracking-tight whitespace-nowrap leading-tight">Daweez Pension House</h1>
          <p className="text-[9.5px] text-ink-600 mt-0.5 leading-snug">National Highway, San Agustin Sur, Tandag City, Surigao del Sur</p>
          <p className="text-[9.5px] text-ink-600 leading-snug">daweezpensionhouse@gmail.com · 0910-7163830</p>
        </div>
        <div className="text-right shrink-0">
          <h2 className="font-display font-bold text-[10.5px] text-ink-900 uppercase tracking-[0.12em] whitespace-nowrap">{heading}</h2>
          <div className="mt-1 grid grid-cols-[auto_auto] justify-end items-baseline gap-x-2 gap-y-px">
            {invoiceNumber && (
              <>
                <span className="text-[10px] text-muted">Bill no.</span>
                <span className="font-mono text-[13px] font-bold text-ink-900">{invoiceNumber}</span>
              </>
            )}
            {showDate && dateIssued && (
              <>
                <span className="text-[10px] text-muted">{dateLabel}</span>
                <span className="text-[11.5px] font-semibold text-ink-900">{dateIssued}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="h-[3px] bg-ink-900" />
    </>
  )
}

/**
 * The name of a block of the sheet — `Guest`, `Stay`, `Payment`: black capitals sitting on a
 * rule. One of the page's three kinds of text (the owner, 2026-10-13: *"I can't immediately
 * differentiate between labels and actual information"*); the other two are a grey label and
 * the black information beside it.
 */
export function SectionName({ children, bare = false }: { children: React.ReactNode; bare?: boolean }) {
  return (
    <span className={'block text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-ink-900 ' + (bare ? 'mb-1' : 'pb-0.5 border-b-[1.5px] border-ink-900 mb-1')}>
      {children}
    </span>
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
