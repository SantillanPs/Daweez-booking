import React, { useState } from 'react'
import { Copy, Check, ChevronDown } from 'lucide-react'
import { SyncFeed } from '../../types/booking'
import { Room } from '../../types/booking'
import { getChannelSync, saveChannelSync, type ChannelSyncSettings } from '../../utils/channelSync'
import { findFeedUrlClashes, feedUrlClashMessage } from '../../utils/feedUrls'
import { showToast } from '../../utils/toast'
import { GROUP_TITLE, ICON_BUTTON, LABEL, REVEAL } from '../walk-in/formStyles'

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

  // **One address, one room.** Putting one iCal link on several rooms makes the sync fetch that calendar once
  // per room and import every reservation in it once per room — nine feed rows on one URL is how a single
  // Airbnb stay came to block nine rooms, nine times over. The screen refuses it here, and says which room has
  // the link (the owner, 2026-09-30; the rule lives in `utils/feedUrls.ts`).
  const roomLabel = (roomId: string) => 'Room ' + (rooms.find(r => r.id === roomId)?.room_number ?? '?')
  const clashes = findFeedUrlClashes(editing)

  const save = () => {
    const clash = clashes[0]
    if (clash) {
      showToast(feedUrlClashMessage(clash, roomLabel), 'error')
      return
    }
    void onSave(editing)
  }

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
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className={GROUP_TITLE}>iCal connections</h3>
          <p className="mt-0.5 text-[13px] text-muted">Airbnb &amp; Booking.com</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={'text-[14px] font-semibold ' + (switches.enabled ? 'text-brand-text' : 'text-muted')}>
            {switches.enabled ? 'On' : 'Off'}
          </span>
          <Switch on={switches.enabled} onToggle={toggleMaster} label="Sync with Airbnb and Booking.com" />
        </div>
      </div>

      {/* Says the rule where it is broken, not only when Save is pressed. */}
      {clashes.length > 0 && (
        <p role="alert" className="mt-3 text-[13px] font-medium text-danger-600">
          One address is on more than one room — {clashes.map(c => c.roomIds.map(roomLabel).join(' + ')).join(' · ')}.
          Each room needs its own link.
        </p>
      )}

      <div className="mt-4 border-y border-soft divide-y divide-soft">
        {rooms.map(room => {
          const rf = editing.filter(f => f.room_id === room.id)
          const air = rf.find(f => f.channel === 'airbnb')
          const bk = rf.find(f => f.channel === 'booking_com')
          const isOpen = openRoomId === room.id
          const on = switches.enabled && switches.rooms[room.id] !== false
          const exportUrl = 'https://daweez-booking.vercel.app/api/ical/room/' + room.room_number + '.ics'
          return (
            <div key={room.id}>
              {/* The switch sits OUTSIDE the expander: a button inside a button is invalid, and
                  throwing a room's switch must never also open its boxes. */}
              <div className="flex items-center justify-between gap-3">
                <button onClick={() => setOpenRoomId(isOpen ? null : room.id)} aria-expanded={isOpen}
                  className="flex-1 min-w-0 h-[52px] flex items-center text-left cursor-pointer">
                  <span className="truncate">
                    <span className="text-[15px] font-semibold text-main">Room {room.room_number}</span>
                    <span className="ml-2 text-[13px] text-muted">{room.name}</span>
                  </span>
                </button>
                <span className="flex items-center gap-3 shrink-0">
                  <span className={'text-[13px] font-semibold ' + (on ? 'text-brand-text' : 'text-muted')}>{on ? 'Synced' : 'Off'}</span>
                  <Switch on={on} disabled={!switches.enabled} onToggle={() => toggleRoom(room.id)}
                    label={`Sync Room ${room.room_number}`} />
                  <button onClick={() => setOpenRoomId(isOpen ? null : room.id)} aria-label="Show the links" className={ICON_BUTTON}>
                    <ChevronDown className={'w-4 h-4 transition-transform duration-200 ' + (isOpen ? 'rotate-180' : '')} />
                  </button>
                </span>
              </div>
              {isOpen && (
                <div className={'pb-5 pt-1 space-y-3 ' + REVEAL}>
                  <FeedRow label="Export URL" value={exportUrl} readOnly
                    copied={copied === 'export-' + room.id} onCopy={() => copy(exportUrl, 'export-' + room.id)} />
                  {air && <FeedRow label="Airbnb" value={air.url} placeholder="Paste the Airbnb iCal URL here…"
                    copied={copied === 'air-' + room.id} onChange={v => setUrl(air.id, v)} onCopy={() => copy(air.url, 'air-' + room.id)} />}
                  {bk && <FeedRow label="Booking.com" value={bk.url} placeholder="Paste the Booking.com iCal URL here…"
                    copied={copied === 'bk-' + room.id} onChange={v => setUrl(bk.id, v)} onCopy={() => copy(bk.url, 'bk-' + room.id)} />}
                  {/* Beside the boxes it saves, so it is met right after a link is pasted. It
                      saves every room's links, as it always has. */}
                  <button type="button" onClick={save}
                    className="h-11 px-5 rounded-md bg-gold-400 hover:bg-gold-500 text-ink-900 text-[14px] font-semibold transition-colors duration-150 active:scale-[0.98] cursor-pointer">
                    Save feed URLs
                  </button>
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
      className={'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ' +
        (disabled ? 'opacity-40 cursor-not-allowed ' : 'cursor-pointer ') + (on ? 'bg-gold-400' : 'bg-ink-300')}>
      <span className={'inline-block h-5 w-5 rounded-full bg-white transition-transform duration-200 ' +
        (on ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  )
}

/** One calendar link: its label above the box, and the copy button beside it. */
function FeedRow({ label, value, placeholder, readOnly, copied, onChange, onCopy }: {
  label: string; value: string; placeholder?: string; readOnly?: boolean
  copied: boolean; onChange?: (v: string) => void; onCopy: () => void
}) {
  return (
    <label className="block">
      <span className={LABEL + ' mb-1.5'}>{label}</span>
      <span className="flex items-center gap-1">
        <input value={value} readOnly={readOnly} onChange={e => onChange?.(e.target.value)} placeholder={placeholder}
          className={readOnly
            ? 'h-11 flex-1 min-w-0 rounded-md border border-soft bg-softbg px-3 text-[14px] text-muted outline-none select-all'
            : 'h-11 flex-1 min-w-0 rounded-md border border-soft bg-card px-3 text-[14px] text-main placeholder:text-muted outline-none transition-colors duration-200 focus:border-gold-500 focus:ring-2 focus:ring-gold-400/30'} />
        <button type="button" onClick={onCopy} className={ICON_BUTTON} title="Copy URL" aria-label={'Copy the ' + label + ' link'}>
          {copied ? <Check className="w-4 h-4 text-brand-text" /> : <Copy className="w-4 h-4" />}
        </button>
      </span>
    </label>
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
