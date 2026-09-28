import React from 'react'
import { Printer, X } from 'lucide-react'

/**
 * The frame both bills are printed in: the on-screen control bar (hidden when printing)
 * and the A4 page itself, so the **normal** statement and the **agency** statement are the
 * same piece of paper with different contents on it (the owner's design, 2026-09).
 */
export function StatementShell({ label, invoiceNumber, onClose, onPrint, embedded = false, children }: {
  /** The little badge on the control bar — `Billing statement` on both. */
  label: string
  invoiceNumber: string
  onClose: () => void
  onPrint: () => void
  embedded?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={'print-page bg-card w-full max-w-xl mx-auto rounded-xl shadow-2xl overflow-hidden flex flex-col print:my-0 print:shadow-none print:rounded-none print:w-full print:max-w-none ' + (embedded ? 'my-0 shadow-xl' : 'my-8')}>
      <div className="flex items-center justify-between px-5 py-3 bg-ink-900 text-white shrink-0 print:hidden">
        <div className="flex items-center gap-2">
          <span className="bg-white text-ink-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase">{label}</span>
          <span className="text-xs font-mono text-white/70">{invoiceNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onPrint} className="bg-white hover:bg-slate-100 text-ink-800 font-bold text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer">
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      {/* On paper the page box is zero-margin (set at print time in `PrintInvoiceModal`),
          so the sheet has no place for the browser's own header/footer; the paper's own
          margins live here. */}
      <div className="p-6 md:p-10 overflow-y-auto print:px-8 print:py-6 print:overflow-visible flex-1 bg-card font-sans text-main leading-relaxed print:static">
        {children}
      </div>
    </div>
  )
}

/** The hotel's own letterhead, identical on both bills. */
export function BrandHeader({ invoiceNumber, dateIssued, showDate = true }: { invoiceNumber: string; dateIssued?: string; showDate?: boolean }) {
  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 pb-4">
        <div>
          <h1 className="font-display font-extrabold text-lg md:text-xl text-ink-800 uppercase tracking-tight">Daweez Pension House</h1>
          <p className="text-[11px] text-ink-600 mt-0.5">National Highway, San Agustin Sur, Tandag City, Surigao del Sur</p>
          <p className="text-[11px] text-ink-600">Email Address: daweezpensionhouse@gmail.com</p>
          <p className="text-[11px] text-ink-600">Mobile No: 0910-7163830</p>
        </div>
        <div className="text-left sm:text-right">
          <h2 className="font-display font-bold text-[15px] text-ink-800 uppercase tracking-widest">Guest Billing Statement</h2>
          <div className="mt-2 text-[12px] text-ink-700 space-y-1">
            <div className="flex items-center gap-2 justify-end">
              <span className="text-[11px] font-bold whitespace-nowrap">Bill / Invoice No.:</span>
              <span className="font-mono border-b border-ink-300">{invoiceNumber}</span>
            </div>
            {showDate && dateIssued && (
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[11px] font-bold whitespace-nowrap">Date Issued:</span>
                <span className="font-mono border-b border-ink-300">{dateIssued}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="border-t-2 border-ink-700 my-2" />
    </>
  )
}

/** One labelled line, like the paper form. A field the booking does not hold is skipped. */
export function Line({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  const shown = (value ?? '').toString().trim()
  if (!shown) return null
  return (
    <div className={'flex items-end gap-2 border-b border-ink-300 pb-0.5 ' + className}>
      <span className="text-[11px] font-bold whitespace-nowrap text-main">{label}:</span>
      <span className="flex-1 text-[13px] text-main min-h-[18px] break-words">{shown}</span>
    </div>
  )
}
