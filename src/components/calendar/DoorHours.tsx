import React, { useState } from 'react'

// **Early or late, said by the desk, out of the way** (Sebastian, 2026-10-20, the door time
// mock, "Quiet link"). The staff press Check in / Check out when they get back to the desk,
// often well after the guest came or went, so the press time is not used: a guest is on time
// unless the desk says otherwise. Coming early or leaving late rarely happens, so it is a
// quiet link under the question, and the hours open as blocks — one per hour, filling up to
// the one tapped, the hours past the cap joined into a night.
export function DoorHours({ kind, standard, maxHours, rate, cap, hourlyOnly, hours, onHours }: {
  kind: 'in' | 'out'
  /** The day's standard door time. */
  standard: Date
  /** The most hours that can be picked. */
  maxHours: number
  rate: number
  cap: number
  /** A venue is charged by the hour however long; a room's hours past the cap are a night. */
  hourlyOnly: boolean
  hours: number
  onHours: (h: number) => void
}) {
  const [open, setOpen] = useState(hours > 0)
  const [now] = useState(() => Date.now())
  if (maxHours < 1) return null
  const link = kind === 'out' ? 'Left late?' : 'Came early?'
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)}
      className="self-center px-2 py-1 text-[13px] font-semibold text-gold-800 underline underline-offset-[3px] hover:text-main cursor-pointer">
      {link}
    </button>
  )
  const night = (h: number) => !hourlyOnly && h > cap
  const timeOf = (h: number) => new Date(standard.getTime() + (kind === 'out' ? h : -h) * 3600000)
  // A late hour that has not come round yet is the hour the desk is in: "now".
  const at = (h: number) => kind === 'out' && timeOf(h).getTime() > now ? 'now'
    : timeOf(h).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '')
  const blocks = Array.from({ length: maxHours }, (_, i) => i + 1)
  const charge = hours < 1 ? '' : night(hours) ? '1 night' : '+₱' + (hours * rate).toLocaleString()
  return (
    <div className="rounded-lg bg-card p-3 flex flex-col gap-2.5">
      <div className="flex gap-1">
        {blocks.map(h => {
          const on = h <= hours
          return (
            <button key={h} type="button" onClick={() => onHours(h === hours ? 0 : h)} aria-pressed={h === hours}
              style={{ '--wait': h * 40 + 'ms' } as React.CSSProperties}
              className={'bw-arrive flex-1 min-w-0 min-h-[56px] rounded-lg flex flex-col items-center justify-center gap-px transition-[background-color,color,transform] duration-200 active:scale-[0.92] cursor-pointer ' +
                (on ? (night(h) ? 'bg-danger-600 text-white' : 'bg-danger-400 text-white') : night(h) ? 'bg-danger-50 text-main' : 'bg-softbg text-main') +
                (h === hours ? ' -translate-y-[3px] shadow-[0_3px_0_rgb(28_28_28/0.25)]' : '')}>
              <span className="font-display font-bold text-[15px] leading-none">{h}h</span>
              <span className={'text-[10px] font-semibold ' + (on ? 'text-white' : 'text-muted')}>
                {night(h) && kind === 'in' ? 'or earlier' : at(h)}
              </span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between text-[12px] font-bold text-muted">
        <span>{kind === 'out' ? 'On the bill' : 'At check-out'}</span>
        {charge
          ? <span key={hours} className="bw-arrive font-display text-[18px] text-danger-600 tabular-nums">{charge}</span>
          : <span>{hourlyOnly ? '₱' + rate.toLocaleString() + ' an hour' : '₱' + rate + ' an hour · ' + (cap + 1) + 'h on a night'}</span>}
      </div>
      <button type="button" onClick={() => { onHours(0); setOpen(false) }}
        className="self-center px-2 py-1 text-[13px] font-semibold text-muted underline underline-offset-[3px] hover:text-main cursor-pointer">
        On time after all
      </button>
    </div>
  )
}
