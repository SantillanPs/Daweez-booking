import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Coffee, Minus, Plus, X } from 'lucide-react'
import { Booking } from '../../types/booking'
import { getBreakfastMenu } from '../../utils/rateConfig'
import { breakfastOn, saveBreakfastChoices, withBreakfastChoice } from '../../utils/breakfastChoice'
import { showToast } from '../../utils/toast'

interface BreakfastPickerProps {
  booking: Booking
  /** The day being answered for, `YYYY-MM-DD`. */
  date: string
  /** `Room 2` — where the plates go. */
  place: string
  onClose: () => void
}

// What this room wants for breakfast today. The menu is the one in Settings; the desk
// taps how many of each. "Nothing today" is an answer too — it marks the room as asked.
export function BreakfastPicker({ booking, date, place, onClose }: BreakfastPickerProps) {
  const queryClient = useQueryClient()
  const menu = getBreakfastMenu()
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const start: Record<string, number> = {}
    ;(breakfastOn(booking, date)?.items || []).forEach(i => { start[i.name] = i.qty })
    return start
  })
  const [busy, setBusy] = useState(false)

  const bump = (name: string, by: number) =>
    setCounts(c => ({ ...c, [name]: Math.max(0, (c[name] || 0) + by) }))

  const save = async (items: { name: string; qty: number }[]) => {
    setBusy(true)
    const choices = withBreakfastChoice(booking, date, items)
    try {
      await saveBreakfastChoices(booking.id, choices)
      // Shown at once; the live update from the database follows a moment later.
      queryClient.setQueryData<Booking[]>(['bookings'], old =>
        old?.map(b => b.id === booking.id ? { ...b, breakfast_choices: choices } : b))
      onClose()
    } catch {
      showToast('Could not save the breakfast choice. Please try again.', 'error')
      setBusy(false)
    }
  }

  const chosen = menu.map(m => ({ name: m.name, qty: counts[m.name] || 0 })).filter(i => i.qty > 0)

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 font-sans" onClick={onClose}>
      <div className="w-full max-w-sm bg-card rounded-xl border border-soft shadow-softLg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-soft">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-main flex items-center gap-2">
              <Coffee className="w-4 h-4 text-gold-600" /> Breakfast today
            </h3>
            <p className="text-[12px] text-muted mt-0.5 truncate">{place} · {booking.guest_name}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-main transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-3 space-y-1.5 max-h-[55vh] overflow-y-auto">
          {menu.length === 0 && <p className="text-[13px] text-muted p-2">The breakfast menu is empty — add items in Settings.</p>}
          {menu.map(item => {
            const qty = counts[item.name] || 0
            return (
              <div key={item.name} className={'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ' + (qty > 0 ? 'border-gold-400 bg-gold-100' : 'border-soft bg-page')}>
                <span className="text-[14px] font-semibold text-main">{item.name}</span>
                <span className="flex items-center gap-2">
                  <button type="button" onClick={() => bump(item.name, -1)} disabled={qty === 0} aria-label={'One less ' + item.name}
                    className="w-9 h-9 rounded-lg border border-soft bg-card text-main flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center font-mono font-bold text-[15px] text-main">{qty}</span>
                  <button type="button" onClick={() => bump(item.name, 1)} aria-label={'One more ' + item.name}
                    className="w-9 h-9 rounded-lg border border-soft bg-card text-main flex items-center justify-center cursor-pointer hover:border-gold-400">
                    <Plus className="w-4 h-4" />
                  </button>
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-2 px-3 py-3 border-t border-soft bg-page">
          <button type="button" disabled={busy} onClick={() => void save([])}
            className="text-[12px] font-bold text-muted hover:text-main px-2 py-2 cursor-pointer disabled:opacity-50">
            Nothing today
          </button>
          <button type="button" disabled={busy || chosen.length === 0} onClick={() => void save(chosen)}
            className="bg-gold-400 hover:bg-gold-600 text-ink-900 text-[13px] font-bold px-5 py-2.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
