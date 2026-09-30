import React, { useState } from 'react'
import { Copy, Check, ChevronDown } from 'lucide-react'
import { SyncFeed } from '../../types/booking'
import { Room } from '../../types/booking'
import { getChannelSync, saveChannelSync, type ChannelSyncSettings } from '../../utils/channelSync'
import { showToast } from '../../utils/toast'

interface ChannelFeedsProps {
  rooms: Room[]
  feeds: SyncFeed[]
  onSave: (feeds: SyncFeed[]) => Promise<void>
}

/**
 * The iCal channel connections: a switch for the whole connection, a switch per room, and the import/export
 * links behind each room's row.
 *
 * **The switches save the moment they are thrown** (the owner's design, 2026-09-30) — an on/off is a decision
 * the desk wants to see take effect, not something to batch behind the URLs' own Save button, which is a
 * different job. A refused save puts the switch back where it was and says so, so the screen never shows an
 * off connection that is still running.
 */
export function ChannelFeeds({ rooms, feeds, onSave }: ChannelFeedsProps) {
  const [editing, setEditing] = useState<SyncFeed[]>(() => fullList(rooms, feeds))
  const [copied, setCopied] = useState<string | null>(null)
  const [prevFeeds, setPrevFeeds] = useState<SyncFeed[]>(feeds)
  const [switches, setSwitches] = useState<ChannelSyncSettings>(() => getChannelSync())

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

  // Write the switches, and put them back if the database refuses — a switch that looks
  // thrown while the sync keeps running would be the worst of both.
  const applySwitches = (next: ChannelSyncSettings) => {
    const before = switches
    setSwitches(next)
    saveChannelSync(next).catch(err => {
      setSwitches(before)
      showToast(err instanceof Error ? err.message : 'Could not save the iCal switch.', 'error')
    })
  }
  const toggleMaster = () => applySwitches({ ...switches, enabled: !switches.enabled })
  const toggleRoom = (roomId: string) => {
    const rooms2 = { ...switches.rooms }
    if (rooms2[roomId] === false) delete rooms2[roomId]
    else rooms2[roomId] = false
    applySwitches({ ...switches, rooms: rooms2 })
  }

  return (
    <div className="bg-card border border-soft rounded-xl overflow-hidden font-sans shadow-sm">
      <div className="px-5 py-4 border-b border-soft flex justify-between items-center gap-3">
        <div>
          <h3 className="text-sm font-semibold text-main">iCal connections</h3>
          <p className="text-xs text-muted mt-1">Airbnb &amp; Booking.com</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={'text-xs font-bold ' + (switches.enabled ? 'text-brand-text' : 'text-muted')}>
            {switches.enabled ? 'On' : 'Off'}
          </span>
          <Switch on={switches.enabled} onToggle={toggleMaster} label="Sync with Airbnb and Booking.com" />
        </div>
      </div>
      <div className="px-5 py-3 border-b border-soft flex justify-end">
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
          const on = switches.enabled && switches.rooms[room.id] !== false
          const exportUrl = 'https://daweez-booking.vercel.app/api/ical/room/' + room.room_number + '.ics'
          return (
            <div key={room.id} className="border-b border-soft last:border-0">
              {/* The switch sits OUTSIDE the expander: a button inside a button is invalid, and
                  throwing a room's switch must never also open its boxes. */}
              <div className="w-full flex items-center justify-between px-5 py-3 hover:bg-page transition-colors">
                <button onClick={() => setOpenRoomId(isOpen ? null : room.id)}
                  className="flex-1 flex items-center gap-3 text-left cursor-pointer min-w-0">
                  <span className="text-sm font-semibold text-main">Room {room.room_number}</span>
                  <span className="text-xs text-muted truncate">{room.name}</span>
                </button>
                <span className="flex items-center gap-2.5 shrink-0 pl-3">
                  <span className={'text-[11px] font-bold ' + (on ? 'text-brand-text' : 'text-muted')}>{on ? 'Synced' : 'Off'}</span>
                  <Switch on={on} disabled={!switches.enabled} onToggle={() => toggleRoom(room.id)}
                    label={`Sync Room ${room.room_number}`} />
                  <button onClick={() => setOpenRoomId(isOpen ? null : room.id)} aria-label="Show the links"
                    className="cursor-pointer p-0.5">
                    <ChevronDown className={'w-4 h-4 text-muted transition-transform ' + (isOpen ? 'rotate-180' : '')} />
                  </button>
                </span>
              </div>
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

/** The one switch shape, used for both the connection and a room. */
function Switch({ on, onToggle, label, disabled = false }: {
  on: boolean; onToggle: () => void; label: string; disabled?: boolean
}) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      onClick={onToggle}
      className={'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ' +
        (disabled ? 'opacity-40 cursor-not-allowed ' : 'cursor-pointer ') + (on ? 'bg-brand-primary' : 'bg-ink-300')}>
      <span className={'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ' +
        (on ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
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
