import { useEffect, useState } from 'react'
import { Bell, Eye, EyeOff, Globe } from 'lucide-react'
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
//
// **A request holds no date** (Sebastian, 2026-11-15: a pending reservation "should still be considered unoccupied").
// The eye beside the bell takes the ghost pills off the calendar, so a guest who pays at the desk can be booked
// on those dates. The request itself stays in the bell; one whose dates were taken since says "Taken" and can
// still be booked on other dates on its bill, "in case that guest wants to reschedule".
export function RequestBell({ requests, taken, hidden, onHide, unitName, onOpen }: {
  requests: BookingRequest[]
  /** Requests whose room was booked on their dates since. */
  taken: Set<string>
  hidden: boolean
  onHide: (hide: boolean) => void
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
    <div className="relative flex items-center gap-1">
      {/* Hidden, it says so in gold: nobody wonders where the requests went. */}
      <button type="button" onClick={() => { markSeen('request-hide'); onHide(!hidden) }} aria-pressed={hidden}
        title={hidden ? 'Show requests on the calendar' : 'Hide requests from the calendar'} aria-label={hidden ? 'Show requests on the calendar' : 'Hide requests from the calendar'}
        className={'relative h-8 inline-flex items-center justify-center gap-1 rounded-full text-[12px] font-bold active:scale-95 transition-[background-color,color,transform] cursor-pointer '
          + (hidden ? 'px-2.5 border-[1.5px] border-dashed border-gold-600 text-gold-800 hover:bg-gold-100' : 'w-8 text-muted hover:text-main hover:bg-softbg')}>
        {hidden ? <><EyeOff aria-hidden="true" className="w-3.5 h-3.5" strokeWidth={2.4} />Hidden</> : <Eye aria-hidden="true" className="w-4 h-4" strokeWidth={2.2} />}
        <NewTag id="request-hide" />
      </button>
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
      </div>
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
                {taken.has(r.id) && <span className="rounded-full bg-danger-50 px-1.5 text-[11px] font-bold text-danger-600">Taken</span>}
                <span className="ml-auto pl-3 max-w-[40%] truncate text-[12px] font-bold text-gold-800">{r.guest_name.split(' ')[0]}</span>
              </button>
            </li>
          ))}
        </ul>
      </>)}
    </div>
  )
}
