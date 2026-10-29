import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { CalendarClock, CalendarPlus, LogIn, LogOut, X } from 'lucide-react'
import { useDashboardData } from './DashboardContext'
import { Booking } from '../types/booking'
import { focusBookingAfterCreate } from '../utils/bookingFocus'
import { dateToString } from '../utils/helpers'

// THE FRONT DESK'S HISTORY (Sebastian, 2026-10-14: "turn the bookings page into a history of whatever
// happened in the front desk"). It replaced the Bookings list. Since 2026-10-29 it holds only what
// happened to the stays — made, rescheduled, checked in, checked out, cancelled: payments, their fixes and removals,
// and who still owes moved to Bills & receipts ("remove in history what contains here"). Nothing here
// is stored for it: every row is read from a booking's `created_at`, `moved_from`, `actual_check_in`,
// `actual_check_out` and `cancelled_at`. A rescheduled booking is one row at its latest move, from the
// dates it was first booked for to where it is now (task #13, 2026-10-29).

type Kind = 'book' | 'moved' | 'in' | 'out' | 'cancel'
type Filter = 'all' | 'book' | 'moved' | 'inout' | 'cancel'

interface Event {
  key: string
  at: string
  kind: Kind
  title: string
  detail: string
  booking: Booking
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const shortDay = (day: string) => new Date(day + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const span = (b: Booking) => (b.stay_hours ? b.stay_hours + '-hour stay · ' + shortDay(b.check_in) : shortDay(b.check_in) + '–' + shortDay(b.check_out))
const join = (...parts: (string | undefined | null | false)[]) => parts.filter(Boolean).join(' · ')

const ICON: Record<Kind, { Icon: typeof LogIn; tone: string }> = {
  book: { Icon: CalendarPlus, tone: 'bg-gold-100 text-gold-800' },
  moved: { Icon: CalendarClock, tone: 'bg-sky-50 text-sky-700' },
  in: { Icon: LogIn, tone: 'bg-emerald-50 text-emerald-700' },
  out: { Icon: LogOut, tone: 'bg-page text-main border border-soft' },
  cancel: { Icon: X, tone: 'bg-danger-50 text-danger-600' },
}
const FILTERS: [Filter, string][] = [['all', 'All'], ['book', 'Bookings'], ['moved', 'Rescheduled'], ['inout', 'Check-ins & outs'], ['cancel', 'Cancelled']]
const PAGE = 14

export function DeskHistory() {
  const { allBookings, rooms, venues } = useDashboardData()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [days, setDays] = useState(PAGE)

  const unit = (b: Booking) => {
    if (b.room_id) {
      const r = rooms.find(x => x.id === b.room_id)
      return r ? 'Room ' + r.room_number + ' ' + r.name : b.room_id
    }
    return venues.find(v => v.id === b.venue_id)?.name || b.venue_id || ''
  }
  const roomsOf = (list: Booking[]) => {
    const nums = list.map(b => rooms.find(r => r.id === b.room_id)?.room_number).filter((n): n is number => n !== undefined).sort((a, b) => a - b)
    if (list.length === 1) return unit(list[0])
    return nums.length ? (nums.length === 1 ? 'Room ' : 'Rooms ') + nums.join(', ') : list.map(unit).join(', ')
  }
  const who = (b: Booking) => b.company_name || b.guest_name || 'Guest'

  const events = useMemo(() => {
    const out: Event[] = []
    const groups = new Map<string, Booking[]>()
    for (const b of allBookings) {
      if (b.status === 'blocked') continue
      const g = b.group_id || b.id
      groups.set(g, [...(groups.get(g) || []), b])
      if (b.moved_from) out.push({ key: 'mv-' + b.id, at: b.moved_from.at, kind: 'moved', title: 'Rescheduled · ' + unit(b), detail: join(who(b), shortDay(b.moved_from.check_in) + '–' + shortDay(b.moved_from.check_out) + ' → ' + span(b)), booking: b })
      if (b.actual_check_in) out.push({ key: 'in-' + b.id, at: b.actual_check_in, kind: 'in', title: 'Checked in · ' + unit(b), detail: join(who(b), span(b)), booking: b })
      if (b.actual_check_out) out.push({ key: 'out-' + b.id, at: b.actual_check_out, kind: 'out', title: 'Checked out · ' + unit(b), detail: who(b), booking: b })
      // A no-show is cancelled with the quick reason "No show" (task #13): it says so in its title,
      // and stays under Cancelled, as on paper.
      if (b.status === 'cancelled' && b.cancelled_at) {
        const noShow = /^No show( · |$)/.test(b.cancel_note || '')
        const note = noShow ? (b.cancel_note || '').replace(/^No show( · )?/, '') : b.cancel_note
        out.push({ key: 'x-' + b.id, at: b.cancelled_at, kind: 'cancel', title: (noShow ? 'No show · ' : 'Cancelled · ') + unit(b), detail: join(who(b), span(b), note), booking: b })
      }
    }
    // A booking of several rooms is one booking (`group_id`), made at one time.
    for (const list of groups.values()) {
      const b = list[0]
      if (!b.created_at) continue
      out.push({ key: 'new-' + b.id, at: b.created_at, kind: 'book', title: 'New booking · ' + roomsOf(list), detail: join(who(b), span(b), b.payment_plan === 'reservation' && 'No deposit'), booking: b })
    }
    return out.sort((a, b) => b.at.localeCompare(a.at))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBookings, rooms, venues])

  const q = query.trim().toLowerCase()
  const shown = events.filter(e =>
    (filter === 'all' || (filter === 'inout' ? e.kind === 'in' || e.kind === 'out' : e.kind === filter)) &&
    (!q || (e.title + ' ' + e.detail).toLowerCase().includes(q)))
  const byDay = new Map<string, Event[]>()
  for (const e of shown) {
    const day = dateToString(new Date(e.at))
    byDay.set(day, [...(byDay.get(day) || []), e])
  }
  const allDays = [...byDay.keys()]
  const today = dateToString(new Date())
  const before = new Date()
  before.setDate(before.getDate() - 1)
  const yesterday = dateToString(before)
  const dayName = (day: string) => {
    const long = new Date(day + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    return day === today ? 'Today · ' + long : day === yesterday ? 'Yesterday · ' + long : long
  }

  const open = (b: Booking) => {
    focusBookingAfterCreate(b.id)
    void navigate({ to: '/calendar' })
  }

  const act = 'min-h-9 px-2.5 rounded-lg border border-transparent text-[12.5px] font-semibold text-muted cursor-pointer transition-colors hover:bg-card hover:border-soft hover:text-main lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100'

  return (
    <div className="space-y-3 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display font-bold text-xl text-main">History</h2>
        <div className="flex flex-wrap items-center gap-2 max-w-full">
          <input
            type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a guest or room" aria-label="Search"
            className="min-h-10 w-64 max-w-full px-3 rounded-lg border border-soft bg-card text-main text-base outline-none focus:border-gold-500"
          />
          <div role="group" aria-label="Show" className="flex gap-1 p-1 bg-card border border-soft rounded-xl max-w-full overflow-x-auto">
            {FILTERS.map(([key, label]) => (
              <button
                key={key} type="button" aria-pressed={filter === key} onClick={() => { setFilter(key); setDays(PAGE) }}
                className={`min-h-9 px-3 rounded-lg text-[13px] whitespace-nowrap cursor-pointer transition-colors ${filter === key ? 'bg-brand-primary text-ink-900 font-bold' : 'text-muted font-semibold hover:text-main'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {allDays.length === 0 && <p className="bg-card border border-soft rounded-2xl py-10 text-center text-[13px] text-muted">{q ? 'Nothing matches.' : 'Nothing has happened yet.'}</p>}
      {allDays.slice(0, days).map(day => (
        <section key={day} className="bg-card border border-soft rounded-2xl overflow-hidden">
          <div className="flex items-baseline justify-between gap-3 px-4 py-3 bg-page border-b border-soft">
            <b className="text-[14px] text-main">{dayName(day)}</b>
          </div>
          {(byDay.get(day) || []).map(e => {
            const { Icon, tone } = ICON[e.kind]
            return (
              <div key={e.key} className="group grid grid-cols-[32px_minmax(0,1fr)_auto] sm:grid-cols-[4.5rem_32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 min-h-14 border-t border-soft first:border-t-0 transition-colors hover:bg-page">
                <span className="hidden sm:block font-mono text-[12px] text-muted">{timeOf(e.at)}</span>
                <span className={`w-8 h-8 rounded-full grid place-items-center ${tone}`}><Icon className="w-4 h-4" strokeWidth={2} /></span>
                <span className="min-w-0 flex flex-col">
                  <span className="text-[14px] text-main truncate">{e.title}</span>
                  <span className="text-[12.5px] text-muted truncate">{e.detail}</span>
                </span>
                <button type="button" onClick={() => open(e.booking)} className={act}>Open</button>
              </div>
            )
          })}
        </section>
      ))}
      {allDays.length > days && (
        <div className="flex justify-center">
          <button type="button" onClick={() => setDays(d => d + PAGE)} className="min-h-10 px-4 rounded-lg border border-soft bg-card text-[13px] font-semibold text-main cursor-pointer hover:border-ink-900/30">
            Show earlier days
          </button>
        </div>
      )}
    </div>
  )
}
