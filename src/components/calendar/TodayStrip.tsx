import { useEffect, useState } from 'react'
import { OrderSlip } from '../../utils/orderSlips'
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
  // The bill being paid keeps its place, lit, until its window is closed — it leaves the
  // list the moment the money is saved, which is behind the window, and would be gone
  // unseen. Then it tears off (the owner, 2026-10-15: animations for the table payments).
  const [at, setAt] = useState(0)
  const pick = (s: OrderSlip) => { setAt(Math.max(0, diners.slips.indexOf(s))); setOpen(false); diners.pay(s) }
  const payingId = diners.paying?.tab.id
  const shown = diners.paying && !diners.slips.some(s => s.tab.id === payingId)
    ? [...diners.slips.slice(0, at), diners.paying, ...diners.slips.slice(at)]
    : diners.slips
  const many = shown.length > 3
  const room = many ? 2 : 3

  // A receipt that was on the line and is not any more (paid, or sent back) is drawn once
  // more where it was, tearing off. Worked out while drawing, from the line as it was.
  const key = shown.map(s => s.tab.id).join()
  const [was, setWas] = useState({ key, list: shown, room })
  const [leaving, setLeaving] = useState<{ slip: OrderSlip; at: number }[]>([])
  if (was.key !== key) {
    const gone = was.list.map((slip, i) => ({ slip, at: i }))
      .filter(g => g.at < was.room && !shown.some(s => s.tab.id === g.slip.tab.id))
    setWas({ key, list: shown, room })
    if (gone.length) setLeaving(l => [...l, ...gone])
  }
  useEffect(() => {
    if (!leaving.length) return
    const t = window.setTimeout(() => setLeaving([]), 500)
    return () => window.clearTimeout(t)
  }, [leaving])

  const line: { slip: OrderSlip; leaving?: boolean }[] = shown.slice(0, room).map(slip => ({ slip }))
  for (const g of leaving) line.splice(Math.min(g.at, line.length), 0, { slip: g.slip, leaving: true })

  const TICKET = 'dp-ticket relative flex flex-col justify-center h-9 px-3 leading-tight text-left rounded-t-md border-[1.5px] border-b-0 border-gold-400 cursor-pointer '
  const NAME ='flex w-full items-center gap-1.5 min-h-11 px-3 rounded-md border border-soft bg-card text-left text-[13px] hover:border-gold-400 hover:bg-gold-100 transition-colors duration-150 active:scale-[0.98] cursor-pointer'

  return (
    <div className="relative flex items-center mr-1.5">
      {/* Each bill is its own receipt, one tap to take the money (the owner picked this
          over a "Diners to pay" button, 2026-10-15: that one looked like every other box
          on the line and said a count, not what was owed). Past three the third becomes
          "+N more", which opens the list. */}
      <div className="flex items-start gap-1.5 pb-[5px]">
        {line.map(({ slip: s, leaving: off }, i) => (
          <button key={s.tab.id + (off ? '-off' : '')} type="button" onClick={() => off ? undefined : pick(s)} style={{ '--i': i } as React.CSSProperties}
            title={'Take payment · ' + slipNumber(s.tab)} aria-hidden={off || undefined} tabIndex={off ? -1 : undefined}
            className={TICKET + (off ? 'dp-rip pointer-events-none bg-gold-100' : s.tab.id === payingId ? 'bg-gold-400' : 'bg-gold-100 hover:bg-gold-200')}>
            <span className="max-w-36 truncate text-[11px] font-bold text-gold-800">{tableName(s.tab.table_label) || s.tab.label || 'Walk-in'}</span>
            <b className="text-[14px] text-main tabular-nums">₱{s.total.toLocaleString()}</b>
          </button>
        ))}
        {many && (
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ '--i': 2 } as React.CSSProperties} className={TICKET + 'bg-gold-100 hover:bg-gold-200'}>
            <span className="text-[11px] font-bold text-gold-800">Diners</span>
            <b className="text-[14px] text-main tabular-nums">+{shown.length - 2} more</b>
          </button>
        )}
      </div>

      {open && diners.slips.length > 0 && (<>
        {/* A tap anywhere else puts the list away. */}
        <button type="button" aria-label="Close the list" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
        <div className="absolute right-0 top-full z-50 mt-2 flex max-h-[320px] w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-1.5 overflow-y-auto rounded-lg border border-gold-400 bg-card p-2 animate-in fade-in duration-150 motion-reduce:animate-none">
          {diners.slips.map(s => (
            <button key={s.tab.id} type="button" onClick={() => pick(s)} className={NAME}>
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
