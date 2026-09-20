import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'

interface SlipModalProps {
  /**
   * What the print button says. A payment receipt and a running tab are not the
   * same piece of paper, and staff read the button before they press it.
   */
  printLabel: string
  onClose: () => void
  children: React.ReactNode
}

// The frame every 58 mm thermal slip is shown in (k69).
//
// The hotel prints on a 58 mm roll, so the paper is always one narrow column —
// and the page size is left in place only while a slip is on screen, so the A4
// Guest Billing Statement keeps its own page size. The slip itself is passed in,
// which is what keeps the payment receipt and the running tab from drifting into
// two different-looking pieces of paper.
export function SlipModal({ printLabel, onClose, children }: SlipModalProps) {
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = '@page { size: 58mm auto; margin: 3mm }'
    document.head.appendChild(style)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.head.removeChild(style)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 print:static print:bg-white print:p-0">
      <div className="w-full max-w-[300px]">
        <div className="flex items-center justify-between gap-2 mb-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-ink-900 bg-gold-400 hover:bg-gold-600 px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> {printLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-white/80 hover:text-white p-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="print-slip bg-white text-black font-mono p-3 rounded-lg w-[58mm]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
