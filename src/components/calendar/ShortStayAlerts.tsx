import { useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'
import { clockLabel, shortStayOut } from '../../utils/shortStay'
import { roomDisplayName } from './bookingStyles'

let audio: AudioContext | null = null
/** A soft two-note chime, so a desk that is away from the screen hears that a time is up. */
function chime() {
  try {
    audio = audio || new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    const a = audio
    ;[659, 523].forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain()
      o.frequency.value = f
      o.connect(g); g.connect(a.destination)
      const t = a.currentTime + i * 0.22
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
      o.start(t); o.stop(t + 0.62)
    })
  } catch { /* no sound on this device: the banner still says it */ }
}

/**
 * **A short stay whose time is up says so** (the owner, 2026-10-24, on the "Short Stay Out"
 * mock: "add like an alert or notify or something"). A banner drops in under the top bar with a
 * chime, and stays until the desk answers it — a time's-up that went away by itself could be
 * missed. It changes nothing on the booking by itself (Sebastian, 2026-10-20): "Checked out" notes
 * the time, "+1 hr" adds an hour of late checkout to the bill and moves the time on.
 */
export function ShortStayAlerts({ due, rooms, venues, onOut, onMore }: {
  due: Booking[]
  rooms: Room[]
  venues: Venue[]
  onOut: (b: Booking) => void
  onMore: (b: Booking) => void
}) {
  // Each time chimes once: a booking given another hour chimes again when that hour is up.
  const heard = useRef(new Set<string>())
  useEffect(() => {
    const fresh = due.filter(b => !heard.current.has(b.id + '@' + shortStayOut(b)?.getTime()))
    fresh.forEach(b => heard.current.add(b.id + '@' + shortStayOut(b)?.getTime()))
    if (fresh.length) chime()
  }, [due])

  if (!due.length) return null
  return (
    <div role="status" aria-live="polite" className="fixed left-1/2 -translate-x-1/2 top-[76px] z-[45] w-[min(560px,calc(100vw-24px))] grid gap-2 print:hidden">
      {due.map(b => {
        const out = shortStayOut(b)
        const room = rooms.find(r => r.id === b.room_id)
        const where = b.room_id ? (room?.room_number != null ? 'Room ' + room.room_number : roomDisplayName(room)) : (venues.find(v => v.id === b.venue_id)?.name || 'Venue')
        const hours = Number(b.stay_hours || 0) + Number(b.late_check_out_hours || 0)
        return (
          <div key={b.id + '@' + out?.getTime()} className="bp-drop flex items-center gap-2.5 rounded-2xl bg-ink-900 text-white pl-2.5 pr-2 py-2 shadow-softLg">
            <span className="ss-ring w-[34px] h-[34px] shrink-0 rounded-[10px] bg-gold-400 text-ink-900 grid place-items-center" aria-hidden="true">
              <Bell className="w-4 h-4" strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1 grid">
              <b className="text-[13.5px] truncate">{where} · time's up</b>
              <span className="text-[12px] text-white/65 truncate">{b.guest_name} · {hours} hrs{out ? ' · out ' + clockLabel(out) : ''}</span>
            </span>
            <button type="button" onClick={() => onOut(b)}
              className="shrink-0 min-h-11 px-3.5 rounded-[10px] bg-white text-ink-900 text-[13px] font-bold hover:bg-paper-50 active:scale-95 transition-[background-color,transform] cursor-pointer">
              Checked out
            </button>
            <button type="button" onClick={() => onMore(b)}
              className="shrink-0 min-h-11 px-3 rounded-[10px] text-[13px] font-bold shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.3)] hover:bg-white/10 active:scale-95 transition-[background-color,transform] cursor-pointer">
              +1 hr
            </button>
          </div>
        )
      })}
    </div>
  )
}
