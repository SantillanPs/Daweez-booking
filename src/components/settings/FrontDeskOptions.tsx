import { useEffect, useState } from 'react'
import { CalendarDays, Check, FileText } from 'lucide-react'
import { FrontDeskSettings, getFrontDesk, hydrateFrontDesk, saveFrontDesk } from '../../utils/frontDesk'
import { showToast } from '../../utils/toast'
import { Section } from './parts'

const PLACES: { key: FrontDeskSettings['reschedule']; title: string; line: string; Icon: typeof CalendarDays }[] = [
  { key: 'calendar', title: 'On the calendar', line: 'Pick the new days and room on the grid', Icon: CalendarDays },
  { key: 'bill', title: 'On the bill', line: 'Tap a date or the room line on the billing statement', Icon: FileText },
]

/**
 * **Where a booking is rescheduled** (Sebastian, 2026-10-22: the staff want it on the billing
 * statement; he likes the calendar). Saved the moment it is picked, like the channel switches,
 * and put back with a word if the database refuses.
 */
export function FrontDeskOptions() {
  const [desk, setDesk] = useState<FrontDeskSettings>(() => getFrontDesk())
  // What another PC may have picked since this page loaded.
  useEffect(() => { hydrateFrontDesk().then(() => setDesk(getFrontDesk())).catch(() => {}) }, [])
  const pick = (reschedule: FrontDeskSettings['reschedule']) => {
    if (reschedule === desk.reschedule) return
    const before = desk
    setDesk({ ...desk, reschedule })
    saveFrontDesk({ ...desk, reschedule }).catch(() => {
      setDesk(before)
      showToast('Could not save the choice. Check the internet connection and try again.', 'error')
    })
  }
  return (
    <Section title="Reschedule a booking">
      <div role="radiogroup" aria-label="Where a booking is rescheduled" className="grid sm:grid-cols-2 gap-3 max-w-[640px]">
        {PLACES.map(({ key, title, line, Icon }) => {
          const on = desk.reschedule === key
          return (
            <button key={key} type="button" role="radio" aria-checked={on} onClick={() => pick(key)}
              className={'relative flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-[border-color,background-color,transform] duration-200 active:scale-[0.98] cursor-pointer ' +
                (on ? 'border-gold-400 bg-gold-100/60' : 'border-soft hover:border-gold-300')}>
              <Icon className={'w-5 h-5 mt-0.5 shrink-0 transition-colors ' + (on ? 'text-gold-800' : 'text-muted')} />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-main">{title}</span>
                <span className="block mt-0.5 text-[13px] text-muted">{line}</span>
              </span>
              <span aria-hidden="true" className={'absolute top-3 right-3 w-5 h-5 rounded-full grid place-items-center transition-[transform,opacity] duration-300 ease-[cubic-bezier(.34,1.4,.64,1)] bg-gold-400 ' + (on ? 'scale-100 opacity-100' : 'scale-50 opacity-0')}>
                <Check className="w-3 h-3 text-ink-900" strokeWidth={3} />
              </span>
            </button>
          )
        })}
      </div>
    </Section>
  )
}
