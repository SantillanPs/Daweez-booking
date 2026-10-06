import React, { useState } from 'react'
import { Copy, Check, ChevronDown } from 'lucide-react'
import { SyncFeed } from '../../types/booking'
import { Room } from '../../types/booking'
import { getChannelSync, saveChannelSync, type ChannelSyncSettings } from '../../utils/channelSync'
import { findFeedUrlClashes } from '../../utils/feedUrls'
import { showToast } from '../../utils/toast'
import { GROUP_TITLE, ICON_BUTTON, LABEL, REVEAL } from '../walk-in/formStyles'

interface ChannelFeedsProps {
  rooms: Room[]
  /** Every room's two link rows, with anything typed and not yet saved laid over them. */
  links: SyncFeed[]
  /** The rows that hold typing the page has not saved yet. */
  unsaved: Record<string, string>
  onLink: (feedId: string, url: string) => void
}

/**
 * The calendar links with Airbnb and Booking.com: a switch for the whole connection, a switch per room, and
 * the links behind each room's row.
 *
 * **The switches save the moment they are thrown** (the owner's design, 2026-09-30) — an on/off is a decision
 * the desk wants to see take effect, not something to batch behind a Save button. A refused save puts the
 * switch back where it was and says so, so the screen never shows an off connection that is still running.
 *
 * **The links are saved by the page's one save bar**, like every other box in Settings. They had a gold button
 * of their own, inside whichever room was open: it saved every room's links while looking as if it saved one,
 * and a link pasted into a room that was then folded away left no sign it was waiting. So this is controlled
 * (`links` + `onLink`) and the parent owns the draft — a room with a link waiting shows the same gold dot a
 * room with a new price does.
 *
 * **Its words are the staff's, not the calendar format's.** It said "iCal connections", "Export URL" and "Save
 * feed URLs". Which way a link goes is the whole question on this screen, so each box is named by it: the link
 * to give them, the link from Airbnb, the link from Booking.com.
 */
export function ChannelFeeds({ rooms, links, unsaved, onLink }: ChannelFeedsProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [switches, setSwitches] = useState<ChannelSyncSettings>(() => getChannelSync())

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(c => (c === id ? null : c)), 1500)
    })
  }
  const [openRoomId, setOpenRoomId] = useState<string | null>(rooms.length > 0 ? rooms[0].id : null)

  // **One address, one room.** Putting one calendar link on several rooms makes the sync fetch that calendar
  // once per room and import every reservation in it once per room — nine rows on one link is how a single
  // Airbnb stay came to block nine rooms, nine times over. The screen says so here, where it is typed, and the
  // save bar refuses it (the owner, 2026-09-30; the rule lives in `utils/feedUrls.ts`).
  const roomLabel = (roomId: string) => 'Room ' + (rooms.find(r => r.id === roomId)?.room_number ?? '?')
  const clashes = findFeedUrlClashes(links)

  // Write the switches, and put them back if the database refuses — a switch that looks
  // thrown while the sync keeps running would be the worst of both.
  const applySwitches = (next: ChannelSyncSettings) => {
    const before = switches
    setSwitches(next)
    saveChannelSync(next).catch(err => {
      setSwitches(before)
      showToast(err instanceof Error ? err.message : 'Could not save the switch.', 'error')
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
        <h3 className={GROUP_TITLE}>Airbnb &amp; Booking.com calendars</h3>
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
          One link is on more than one room — {clashes.map(c => c.roomIds.map(roomLabel).join(' + ')).join(' · ')}.
          Each room needs its own link.
        </p>
      )}

      <div className="mt-4 border-y border-soft divide-y divide-soft">
        {rooms.map(room => {
          const rf = links.filter(f => f.room_id === room.id)
          const air = rf.find(f => f.channel === 'airbnb')
          const bk = rf.find(f => f.channel === 'booking_com')
          const isOpen = openRoomId === room.id
          const on = switches.enabled && switches.rooms[room.id] !== false
          const waiting = rf.some(f => f.id in unsaved)
          const exportUrl = 'https://daweez-booking.vercel.app/api/ical/room/' + room.room_number + '.ics'
          return (
            <div key={room.id}>
              {/* The switch sits OUTSIDE the expander: a button inside a button is invalid, and
                  throwing a room's switch must never also open its boxes. */}
              <div className="flex items-center justify-between gap-3">
                <button onClick={() => setOpenRoomId(isOpen ? null : room.id)} aria-expanded={isOpen}
                  className="flex-1 min-w-0 h-[52px] flex items-center gap-2 text-left cursor-pointer">
                  <span className="truncate">
                    <span className="text-[15px] font-semibold text-main">Room {room.room_number}</span>
                    <span className="ml-2 text-[13px] text-muted">{room.name}</span>
                  </span>
                  {waiting && <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-gold-500" title="Changed, not saved yet" />}
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
                  <FeedRow label="Link to give Airbnb and Booking.com" value={exportUrl} readOnly
                    copied={copied === 'export-' + room.id} onCopy={() => copy(exportUrl, 'export-' + room.id)} />
                  {air && <FeedRow label="Link from Airbnb" value={air.url} placeholder="Paste Airbnb’s calendar link"
                    copied={copied === 'air-' + room.id} onChange={v => onLink(air.id, v)} onCopy={() => copy(air.url, 'air-' + room.id)} />}
                  {bk && <FeedRow label="Link from Booking.com" value={bk.url} placeholder="Paste Booking.com’s calendar link"
                    copied={copied === 'bk-' + room.id} onChange={v => onLink(bk.id, v)} onCopy={() => copy(bk.url, 'bk-' + room.id)} />}
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
        <button type="button" onClick={onCopy} className={ICON_BUTTON} title="Copy the link" aria-label={'Copy: ' + label}>
          {copied ? <Check className="w-4 h-4 text-brand-text" /> : <Copy className="w-4 h-4" />}
        </button>
      </span>
    </label>
  )
}
