import React from 'react'
import { Sun, LogIn, LogOut, BedDouble, Wallet } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'
import { dateToString } from '../../utils/helpers'

interface TodayBriefingProps {
  bookings: Booking[]
  rooms: Room[]
  venues: Venue[]
}

// The "morning briefing": tells staff in one glance what today looks like so
// nobody has to wonder where to start.
export function TodayBriefing({ bookings, rooms }: TodayBriefingProps) {
  const stats = React.useMemo(() => {
    const todayStr = dateToString(new Date())
    const active = bookings.filter(b => b.status !== 'blocked')
    const arrivals = active.filter(b => b.check_in === todayStr).length
    const departures = active.filter(b => b.check_out === todayStr).length

    const occupiedTonight = new Set<string>()
    active
      .filter(b => b.status === 'confirmed' && todayStr >= b.check_in && todayStr < b.check_out)
      .forEach(b => { if (b.room_id) occupiedTonight.add(b.room_id) })
    const freeTonight = rooms.length - occupiedTonight.size

    const owes = active.filter(b => !b.payment_status || b.payment_status === 'unpaid')
    return { arrivals, departures, freeTonight, owes: owes.length }
  }, [bookings, rooms.length])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="relative overflow-hidden rounded-xl bg-sand-100 border border-sand-200 flex-shrink-0">
      {/* soft sun, one decorative touch */}
      <svg viewBox="0 0 120 120" className="absolute -right-4 -top-8 h-28 w-28 text-sun-300/60 fill-current pointer-events-none" aria-hidden="true">
        <circle cx="60" cy="60" r="30" />
      </svg>

      <div className="relative z-10 flex flex-wrap items-center gap-x-5 gap-y-2.5 px-4 py-3">
        <div className="flex items-center gap-3 min-w-[210px] flex-1">
          <div className="w-9 h-9 rounded-full bg-sea-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Sun className="w-[18px] h-[18px]" />
          </div>
          <div>
            <p className="font-display font-bold text-main text-[15px] leading-tight">
              {greeting}!
            </p>
            <p className="text-[11px] text-muted font-medium capitalize">{todayLabel}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <BriefStat icon={<LogIn className="w-3.5 h-3.5 text-sea-600" />} value={stats.arrivals} label="check-ins today" />
          <BriefStat icon={<LogOut className="w-3.5 h-3.5 text-sea-600" />} value={stats.departures} label="check-outs today" />
          <BriefStat icon={<BedDouble className="w-3.5 h-3.5 text-sun-600" />} value={stats.freeTonight} label="rooms free tonight" accent="text-sun-700" />
          <BriefStat
            icon={<Wallet className="w-3.5 h-3.5 text-coral-500" />}
            value={stats.owes}
            label="owe money"
            accent="text-coral-600"
            alert={stats.owes > 0}
          />
        </div>
      </div>
    </div>
  )
}

function BriefStat({ icon, value, label, accent = 'text-main', alert = false }: {
  icon: React.ReactNode
  value: number
  label: string
  accent?: string
  alert?: boolean
}) {
  return (
    <div className={alert ? 'flex items-center gap-1.5 rounded-lg bg-card border border-coral-200 px-2.5 py-1.5 shadow-[0_1px_3px_rgba(42,55,51,0.06)]' : 'flex items-center gap-1.5 rounded-lg bg-card border border-soft px-2.5 py-1.5 shadow-[0_1px_3px_rgba(42,55,51,0.06)]'}>
      {icon}
      <span className={'font-display font-bold text-sm leading-none ' + (alert ? 'text-coral-600' : accent)}>{value}</span>
      <span className="text-[10px] text-muted font-medium whitespace-nowrap">{label}</span>
    </div>
  )
}
