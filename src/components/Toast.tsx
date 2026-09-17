import { ToastTone, useToastMessage } from '../utils/toast'

const TONES: Record<ToastTone, { box: string; dot: string }> = {
  success: { box: 'border-emerald-200', dot: 'bg-emerald-500' },
  error: { box: 'border-danger-200', dot: 'bg-danger-500' },
  info: { box: 'border-gold-200', dot: 'bg-gold-400' },
}

// Mounted once, near the bottom centre so it never covers the header tabs and
// stays clear of the top-right sync notice on the calendar. Every "saved" /
// "could not save" message in the staff app appears here.
export function ToastHost() {
  const msg = useToastMessage()
  if (!msg) return null
  const tone = TONES[msg.tone]
  return (
    <div className="fixed inset-x-0 bottom-20 md:bottom-6 z-[60] flex justify-center px-4 pointer-events-none">
      <div className={'flex items-center gap-2 px-4 py-2.5 bg-card border rounded-xl shadow-softLg text-sm font-medium text-main animate-in fade-in slide-in-from-bottom-1 max-w-[92vw] ' + tone.box}>
        <span className={'w-2 h-2 rounded-full shrink-0 ' + tone.dot} />
        <span>{msg.text}</span>
      </div>
    </div>
  )
}
