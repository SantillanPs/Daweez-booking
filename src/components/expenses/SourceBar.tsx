import type { CSSProperties } from 'react'
import type { SourceCount } from '../../utils/bookingSource'
import { RequestMark } from '../calendar/RequestBell'
import { ChannelMark } from '../calendar/ChannelMark'
import { NewTag } from '../NewMark'

// **Where bookings came from** (Sebastian, 2026-11-19, the mock's "B · Bar only"): one bar, a share for each place,
// and the counts under it, for the owner's month and year. The marks are the calendar pills' own.
const NAME = { website: 'Website', messenger: 'Messenger', airbnb: 'Airbnb', booking_com: 'Booking.com', desk: 'At the desk' }
const COLOUR = { website: 'bg-gold-600', messenger: 'bg-[#0084FF]', airbnb: 'bg-[#E0565B]', booking_com: 'bg-[#003580]', desk: 'bg-ink-300' }

function Mark({ source }: { source: SourceCount['source'] }) {
  if (source === 'website' || source === 'messenger') return <RequestMark source={source} />
  if (source === 'airbnb' || source === 'booking_com') return <ChannelMark channel={source} />
  return <span aria-hidden="true" className="w-3 h-3 shrink-0 rounded-[4px] bg-ink-300" />
}

export function SourceBar({ counts, span }: { counts: SourceCount[]; span: 'month' | 'year' }) {
  const total = counts.reduce((s, c) => s + c.count, 0)
  if (!total) return null
  const online = counts.some(c => c.source !== 'desk')
  return (
    <div className="px-5 pt-4 pb-3.5 border-t border-soft">
      <p className="relative self-start inline-block text-[10px] font-bold uppercase tracking-wider text-muted">
        Where bookings came from<NewTag id="booking-sources" />
      </p>
      {/* `key` on the total: a new month grows the bar again */}
      <div key={total + span} className="flex h-3 gap-0.5 mt-2 mb-3 overflow-hidden rounded-full">
        {counts.map((c, i) => (
          <i key={c.source} className={'src-grow block h-full ' + COLOUR[c.source]}
            style={{ width: (c.count / total) * 100 + '%', '--i': i } as CSSProperties} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {counts.map(c => (
          <span key={c.source} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-main">
            <Mark source={c.source} />{NAME[c.source]} <span className="font-semibold text-muted tabular-nums">{c.count}</span>
          </span>
        ))}
      </div>
      {!online && <p className="mt-2 text-[13px] text-muted">No bookings from online this {span}.</p>}
    </div>
  )
}
