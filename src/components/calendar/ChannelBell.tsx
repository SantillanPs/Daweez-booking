import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Booking, Room } from '../../types/booking'
import { ChannelAlert, channelOf } from '../../utils/channelStay'
import { ChannelMark } from './ChannelMark'
import { chime } from '../../utils/chime'
import { shortDay } from '../../utils/helpers'

const fmtDay = shortDay

/**
 * **What the booking sites need from the desk.** The calendar links work unseen, so what they bring
 * has to announce itself (the mock, Sebastian, 2026-10-31): a bell that is only there while something
 * waits, rings when something lands, and is red for a stay sold twice or cancelled. One thing opens
 * straight away; several open a list.
 */
export function ChannelBell({ stays, alerts, rooms, onStay, onAlert }: {
  /** The site's stays with no name yet. */
  stays: Booking[]
  alerts: ChannelAlert[]
  rooms: Room[]
  onStay: (b: Booking) => void
  onAlert: (a: ChannelAlert) => void
}) {
  const [listOpen, setOpen] = useState(false)
  const n = stays.length + alerts.length
  const open = listOpen && n > 1
  // It rings each time the count grows.
  const [was, setWas] = useState(n)
  const [ring, setRing] = useState(0)
  if (n !== was) {
    setWas(n)
    if (n > was) setRing(r => r + 1)
  }
  useEffect(() => { if (ring) chime() }, [ring])

  if (n === 0) return null
  const roomName = (id: string) => 'Room ' + (rooms.find(r => r.id === id)?.room_number ?? '?')
  const row = (key: string, channel: ReturnType<typeof channelOf>, room: string, b: { check_in: string; check_out: string }, word: string, tone: string, pick: () => void) => (
    <li key={key}>
      <button type="button" onClick={() => { setOpen(false); pick() }}
        className="w-full min-h-11 flex items-center gap-2 rounded-lg px-2 text-left text-[13px] hover:bg-softbg active:scale-[0.98] transition-[background-color,transform] cursor-pointer">
        {channel && <ChannelMark channel={channel} />}
        <b className="font-semibold text-main">{room}</b>
        <span className="text-muted">{fmtDay(b.check_in)} → {fmtDay(b.check_out)}</span>
        <span className={'ml-auto pl-3 whitespace-nowrap text-[12px] font-bold ' + tone}>{word}</span>
      </button>
    </li>
  )
  const tap = () => {
    if (n > 1) setOpen(o => !o)
    else if (alerts[0]) onAlert(alerts[0])
    else onStay(stays[0])
  }
  return (
    <div className="relative">
      <button type="button" key={ring} onClick={tap} aria-expanded={n > 1 ? open : undefined}
        title={n + ' from the booking sites'} aria-label={n + ' from the booking sites'}
        className={'h-8 px-2.5 inline-flex items-center gap-1.5 rounded-full text-white text-[13px] font-bold tabular-nums active:scale-95 transition-[background-color,transform] cursor-pointer '
          + (ring ? 'bp-up ' : '')
          + (alerts.length ? 'bg-danger-600 hover:bg-danger-700' : 'bg-ink-900 hover:bg-ink-700')}>
        {/* `bp-up` makes the button a plain block, so the row is its own. */}
        <span className="inline-flex items-center gap-1.5">
          <Bell aria-hidden="true" className={'w-3.5 h-3.5 ' + (ring ? 'ss-ring' : '')} strokeWidth={2.4} />
          {n}
        </span>
      </button>
      {open && (<>
        <button type="button" aria-label="Close the list" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
        <ul className="absolute right-0 top-full z-50 mt-2 w-[330px] max-w-[calc(100vw-2rem)] rounded-lg border border-soft bg-card p-1.5 shadow-softLg animate-in fade-in duration-150">
          {alerts.map(a => row(a.id, a.channel, roomName(a.room_id), a, a.kind === 'clash' ? 'Sold twice' : 'Cancelled', 'text-danger-600', () => onAlert(a)))}
          {stays.map(b => row(b.id, channelOf(b), roomName(b.room_id || ''), b, 'Name needed', 'text-blue-700', () => onStay(b)))}
        </ul>
      </>)}
    </div>
  )
}
