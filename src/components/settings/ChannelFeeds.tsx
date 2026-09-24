import React, { useState } from 'react'
import { Copy, Check, ChevronDown } from 'lucide-react'
import { SyncFeed } from '../../types/booking'
import { Room } from '../../types/booking'

interface ChannelFeedsProps {
  rooms: Room[]
  feeds: SyncFeed[]
  onSave: (feeds: SyncFeed[]) => Promise<void>
}

/**
 * The iCal feed links (OTA channels), unchanged in what it does: an export link per
 * room, plus the Airbnb and Booking.com import boxes. It keeps its OWN save button,
 * because it is a different job from the rates and has nothing to do with the money
 * save bar at the foot of the page.
 */
export function ChannelFeeds({ rooms, feeds, onSave }: ChannelFeedsProps) {
  const [editing, setEditing] = useState<SyncFeed[]>(() => fullList(rooms, feeds))
  const [copied, setCopied] = useState<string | null>(null)
  const [prevFeeds, setPrevFeeds] = useState<SyncFeed[]>(feeds)

  // The stored feeds arrive asynchronously; rebuild the rows when they do, so a room
  // added later still gets its two boxes.
  if (feeds !== prevFeeds) {
    setPrevFeeds(feeds)
    setEditing(fullList(rooms, feeds))
  }

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(c => (c === id ? null : c)), 1500)
    })
  }
  const setUrl = (feedId: string, url: string) => setEditing(prev => prev.map(f => f.id === feedId ? { ...f, url } : f))
  const [openRoomId, setOpenRoomId] = useState<string | null>(rooms.length > 0 ? rooms[0].id : null)

  return (
    <div className="bg-card border border-soft rounded-xl overflow-hidden font-sans shadow-sm">
      <div className="px-5 py-4 border-b border-soft flex justify-between items-center gap-3">
        <div>
          <h3 className="text-sm font-semibold text-main">iCal feed subscriptions</h3>
          <p className="text-xs text-muted mt-1">The import and export calendar links for your rooms.</p>
        </div>
        <button onClick={() => void onSave(editing)}
          className="bg-brand-primary hover:bg-gold-500 text-ink-900 text-xs font-medium px-5 py-2 rounded-lg transition-colors cursor-pointer shadow-sm shrink-0">
          Save feed URLs
        </button>
      </div>
      <div>
        {rooms.map(room => {
          const rf = editing.filter(f => f.room_id === room.id)
          const air = rf.find(f => f.channel === 'airbnb')
          const bk = rf.find(f => f.channel === 'booking_com')
          const isOpen = openRoomId === room.id
          const exportUrl = 'https://daweez-booking.vercel.app/api/ical/room/' + room.room_number + '.ics'
          return (
            <div key={room.id} className="border-b border-soft last:border-0">
              <button onClick={() => setOpenRoomId(isOpen ? null : room.id)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-page transition-colors cursor-pointer">
                <span className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-main">Room {room.room_number}</span>
                  <span className="text-xs text-muted">{room.name}</span>
                </span>
                <ChevronDown className={'w-4 h-4 text-muted transition-transform ' + (isOpen ? 'rotate-180' : '')} />
              </button>
              {isOpen && (
                <div className="px-5 pb-4 pt-1 space-y-2.5">
                  <FeedRow label="Export URL" tone="text-brand-text" value={exportUrl} readOnly
                    copied={copied === 'export-' + room.id} onCopy={() => copy(exportUrl, 'export-' + room.id)} />
                  {air && <FeedRow label="Airbnb" tone="text-emerald-600" value={air.url} placeholder="Paste the Airbnb iCal URL here…"
                    copied={copied === 'air-' + room.id} onChange={v => setUrl(air.id, v)} onCopy={() => copy(air.url, 'air-' + room.id)} />}
                  {bk && <FeedRow label="Booking.com" tone="text-blue-600" value={bk.url} placeholder="Paste the Booking.com iCal URL here…"
                    copied={copied === 'bk-' + room.id} onChange={v => setUrl(bk.id, v)} onCopy={() => copy(bk.url, 'bk-' + room.id)} />}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FeedRow({ label, tone, value, placeholder, readOnly, copied, onChange, onCopy }: {
  label: string; tone: string; value: string; placeholder?: string; readOnly?: boolean
  copied: boolean; onChange?: (v: string) => void; onCopy: () => void
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] md:grid-cols-[100px_1fr] gap-3 items-center">
      <span className={'text-xs font-medium text-right ' + tone}>{label}</span>
      <div className="relative flex items-center">
        <input value={value} readOnly={readOnly} onChange={e => onChange?.(e.target.value)} placeholder={placeholder}
          className={'py-1.5 pl-3 pr-9 rounded-lg font-mono text-[10px] w-full focus:outline-none ' +
            (readOnly ? 'bg-page border border-soft text-muted select-all' : 'bg-card border border-soft text-main focus:border-brand-primary')} />
        <button onClick={onCopy} className="absolute right-1.5 p-1 text-muted hover:text-brand-text transition-colors cursor-pointer" title="Copy URL">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}

/** Every room wants both import boxes, whether or not a feed row exists yet. */
function fullList(rooms: Room[], feeds: SyncFeed[]): SyncFeed[] {
  const out: SyncFeed[] = []
  rooms.forEach(room => {
    const mine = feeds.filter(f => f.room_id === room.id)
    const air = mine.find(f => f.channel === 'airbnb')
    const bk = mine.find(f => f.channel === 'booking_com')
    out.push(air || { id: 'feed-ab-' + room.id, room_id: room.id, channel: 'airbnb', url: '', last_synced: null })
    out.push(bk || { id: 'feed-bc-' + room.id, room_id: room.id, channel: 'booking_com', url: '', last_synced: null })
  })
  return out
}
