import { useState } from 'react'
import { Utensils } from 'lucide-react'
import { slipNumber } from '../../utils/orderSlips'
import { useDinerSlips } from '../../hooks/useDinerSlips'
import { DinerPayModal } from '../restaurant/DinerPayModal'
import { tableName } from '../restaurant/served'

// **Diners to pay** — the diners with no room whose bill the restaurant has sent over and
// who have not paid it. The money is always taken here, at the front desk, never in the
// restaurant (Sebastian, 2026-10-04); a room guest's slip is paid from the booking. It
// sits on the calendar's top line, and only while a sent bill is waiting — a table still
// eating does not bring it up (his ruling, 2026-10-09).
//
// **It used to be a whole line of the calendar** — "Today: Arriving · Leaving · In the
// hotel · Breakfast" — and Sebastian had it taken off piece by piece as redundant
// (2026-10-08): the grid says who arrives, leaves and is in, and a room still to be asked
// about breakfast has a cup on it that opens the same window. This button is what the grid
// cannot show.
export function TodayStrip() {
  const [open, setOpen] = useState(false)
  const diners = useDinerSlips()
  const NAME = 'flex w-full items-center gap-1.5 min-h-11 px-3 rounded-md border border-soft bg-card text-left text-[13px] hover:border-gold-400 hover:bg-gold-100 transition-colors duration-150 active:scale-[0.98] cursor-pointer'

  return (
    <div className="relative flex items-center mr-1.5">
      {diners.slips.length > 0 && (
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          className={'inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-[13px] font-semibold transition-colors duration-150 cursor-pointer active:scale-[0.98] ' +
            (open ? 'bg-gold-400 border-gold-400 text-ink-900' : 'bg-card border-soft text-main hover:border-gold-400 hover:bg-gold-100')}>
          <Utensils className="w-4 h-4" />
          Diners to pay
          <span className="font-bold tabular-nums">{diners.slips.length}</span>
        </button>
      )}

      {open && diners.slips.length > 0 && (<>
        {/* A tap anywhere else puts the list away. */}
        <button type="button" aria-label="Close the list" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
        <div className="absolute right-0 top-full z-50 mt-2 flex max-h-[320px] w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-1.5 overflow-y-auto rounded-lg border border-gold-400 bg-card p-2 animate-in fade-in duration-150 motion-reduce:animate-none">
          {diners.slips.map(s => (
            <button key={s.tab.id} type="button" onClick={() => { setOpen(false); diners.pay(s) }} className={NAME}>
              <b className="text-main">{tableName(s.tab.table_label) || s.tab.label || 'Walk-in'}</b>
              <span className="text-muted">· {[s.tab.table_label ? s.tab.label : '', slipNumber(s.tab)].filter(Boolean).join(' · ')}</span>
              <span className="font-semibold text-danger-600">· to pay ₱{s.total.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </>)}

      {diners.paying && (
        <DinerPayModal
          key={diners.paying.tab.id}
          slip={diners.paying}
          onClose={() => diners.pay(null)}
          onChanged={() => void diners.reload()}
        />
      )}
    </div>
  )
}
