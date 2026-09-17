import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { resolveConfirm, useConfirmRequest } from '../utils/confirm'

// The app's own "are you sure?" — replaces window.confirm. Mounted once in
// DashboardLayout; z-[70] so it also sits above the booking slide-overs (z-50)
// that ask their own questions (remove a payment, cancel a booking).
export function ConfirmHost() {
  const req = useConfirmRequest()

  // Escape always means "no". Nothing is confirmed by accident.
  useEffect(() => {
    if (!req) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') resolveConfirm(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [req])

  if (!req) return null
  const danger = req.tone === 'danger'

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50">
      <div className="w-full max-w-sm bg-card rounded-xl shadow-softLg overflow-hidden">
        <div className="flex items-start gap-3 px-5 pt-4 pb-3">
          <div className={'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ' + (danger ? 'bg-danger-50' : 'bg-gold-100')}>
            <AlertTriangle className={'w-4 h-4 ' + (danger ? 'text-danger-500' : 'text-gold-800')} />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-bold text-main text-[15px] leading-snug">{req.title}</h3>
            {req.message && <p className="text-[12px] text-muted mt-1 leading-snug">{req.message}</p>}
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-4">
          <button type="button" onClick={() => resolveConfirm(false)}
            className="flex-1 border border-soft text-main text-sm font-semibold py-2.5 rounded-lg hover:bg-page transition-colors cursor-pointer">
            Cancel
          </button>
          <button type="button" onClick={() => resolveConfirm(true)}
            className={'flex-1 text-sm font-bold py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm ' +
              (danger ? 'bg-danger-500 hover:bg-danger-600 text-white' : 'bg-gold-400 hover:bg-gold-600 text-ink-900')}>
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
