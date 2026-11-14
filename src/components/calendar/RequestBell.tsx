import { useEffect, useState } from 'react'
import { Bell, Globe } from 'lucide-react'
import { BookingRequest } from '../../utils/bookingRequests'
import { chime } from '../../utils/chime'
import { shortDay } from '../../utils/helpers'
import { markSeen } from '../../utils/newMarks'
import { NewTag } from '../NewMark'

/** Where a request came from: a blue bubble for Messenger, a green one for WhatsApp, a globe for the website. */
export function RequestMark({ source, big = false }: { source: BookingRequest['source']; big?: boolean }) {
  const box = big ? 'w-[22px] h-[22px]' : 'w-4 h-4'
  if (source === 'website') return <Globe aria-label="Website" className={'shrink-0 text-gold-800 ' + box} strokeWidth={2.2} />
  if (source === 'messenger') return (
    <svg aria-label="Messenger" viewBox="0 0 24 24" className={'shrink-0 ' + box}>
      <path d="M12 2C6.5 2 2 6.1 2 11.3c0 2.9 1.4 5.5 3.7 7.2V22l3.4-1.9c.9.3 1.9.4 2.9.4 5.5 0 10-4.1 10-9.2S17.5 2 12 2z" fill="#0084FF" />
      <path d="M6.5 14.2l3.2-3.4 2.3 2 3.3-3.6-3.1 3.5-2.3-2z" fill="#fff" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
  return (
    <svg aria-label="WhatsApp" viewBox="0 0 24 24" className={'shrink-0 ' + box}>
      <circle cx="12" cy="12" r="10" fill="#1F9D55" />
      <path d="M7.5 16.5l.8-2.6A4.8 4.8 0 1 1 10 15.7z" fill="#fff" />
    </svg>
  )
}

/**
 * **Guests asking for a room** (the mock, Sebastian, 2026-11-12: "B · Ghost pill"). A gold bell beside
 * the booking sites' black one, only there while a request waits; it rings when one lands. One request
 * opens straight away; several open a list. Each also shows on the calendar as a dashed gold pill.
 */
export function RequestBell({ requests, unitName, onOpen }: {
  requests: BookingRequest[]
  unitName: (id: string) => string
  onOpen: (r: BookingRequest) => void
}) {
  const [listOpen, setOpen] = useState(false)
  const n = requests.length
  const open = listOpen && n > 1
  const [was, setWas] = useState(n)
  const [ring, setRing] = useState(0)
  if (n !== was) {
    setWas(n)
    if (n > was) setRing(r => r + 1)
  }
  useEffect(() => { if (ring) chime() }, [ring])

  if (n === 0) return null
  const tap = () => { markSeen('booking-requests'); if (n > 1) setOpen(o => !o); else onOpen(requests[0]) }
  return (
    <div className="relative">
      <button type="button" key={ring} onClick={tap} aria-expanded={n > 1 ? open : undefined}
        title={n + (n === 1 ? ' booking request' : ' booking requests')} aria-label={n + (n === 1 ? ' booking request' : ' booking requests')}
        className={'h-8 px-2.5 inline-flex items-center gap-1.5 rounded-full bg-gold-400 hover:bg-gold-500 text-ink-900 text-[13px] font-bold tabular-nums active:scale-95 transition-[background-color,transform] cursor-pointer ' + (ring ? 'bp-up' : '')}>
        <span className="inline-flex items-center gap-1.5">
          <Bell aria-hidden="true" className={'w-3.5 h-3.5 ' + (ring ? 'ss-ring' : '')} strokeWidth={2.4} />
          {n}
        </span>
      </button>
      <NewTag id="booking-requests" />
      {open && (<>
        <button type="button" aria-label="Close the list" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
        <ul className="absolute right-0 top-full z-50 mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-lg border border-soft bg-card p-1.5 shadow-softLg animate-in fade-in duration-150">
          {requests.map(r => (
            <li key={r.id}>
              <button type="button" onClick={() => { setOpen(false); onOpen(r) }}
                className="w-full min-h-11 flex items-center gap-2 rounded-lg px-2 text-left text-[13px] hover:bg-softbg active:scale-[0.98] transition-[background-color,transform] cursor-pointer">
                <RequestMark source={r.source} />
                <b className="font-semibold text-main">{unitName(r.room_id)}</b>
                <span className="text-muted">{shortDay(r.check_in)} → {shortDay(r.check_out)}</span>
                <span className="ml-auto pl-3 max-w-[40%] truncate text-[12px] font-bold text-gold-800">{r.guest_name.split(' ')[0]}</span>
              </button>
            </li>
          ))}
        </ul>
      </>)}
    </div>
  )
}
