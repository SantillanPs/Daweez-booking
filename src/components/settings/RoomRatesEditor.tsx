import React, { useRef, useState } from 'react'
import { Room } from '../../types/booking'
import { GROUP_TITLE } from '../walk-in/formStyles'
import { RoomDraft, roomDraft } from './roomDraft'
import { Figure, FieldGrid, SubHead } from './parts'

const money = (n: number) => '₱' + Number(n || 0).toLocaleString()

interface RoomRatesEditorProps {
  rooms: Room[]
  /** Only the rooms staff have actually typed into — the page's save bar counts these. */
  edits: Record<string, Partial<RoomDraft>>
  onEdit: (roomId: string, patch: Partial<RoomDraft>) => void
  /** The rooms have not arrived from the database yet. */
  loading?: boolean
}

/**
 * Rooms & prices, in the shape the owner picked (2026-09, design 6 of six drawings):
 * **the ten rooms as a price list on the left, and a small panel on the right that
 * follows whichever room you click.** Nothing pops over the list, no row grows and no
 * space is left empty — which is what the earlier card grid got wrong when one open
 * card stretched its whole row.
 *
 * Each room's prices: the night, breakfast (one charge for the stay, card k140) and the
 * three short-stay hours off the printed board. **22 hours IS the night price**, so it is
 * stated rather than offered as a fourth box. A short stay the room is not sold for is 0,
 * and an empty box says so itself ("Not sold") instead of a footnote explaining it. A room
 * with typing waiting shows a small gold dot, and there is **no Save button here** — the
 * page has one save bar, so this is controlled (`edits` + `onEdit`) and the parent owns
 * the draft.
 */
export function RoomRatesEditor({ rooms, edits, onEdit, loading = false }: RoomRatesEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = rooms.find(r => r.id === selectedId) || rooms[0] || null
  const draft = selected ? roomDraft(selected, edits) : null

  // Where the panel sits under the list instead of beside it (a phone, a tablet held
  // upright), a tap on a room changed boxes a screen further down and looked as if it
  // had done nothing. There the panel is brought into view.
  const panel = useRef<HTMLDivElement>(null)
  const pick = (roomId: string) => {
    setSelectedId(roomId)
    if (window.matchMedia('(min-width: 1024px)').matches) return
    requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-x-12 gap-y-8 items-start">
      {/* The price list — every room and its night price on one screen. */}
      <div>
        <div className="h-9 px-4 flex items-center justify-between border-b border-soft text-[13px] font-medium text-muted">
          <span>Room</span><span>A night</span>
        </div>

        {/* The list's own shape while the rooms are on their way, so nothing jumps when they land. */}
        {rooms.length === 0 && loading && (
          <div aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 px-4 flex items-center justify-between border-b border-soft">
                <span className="h-3.5 w-40 rounded-sm bg-softbg animate-pulse" />
                <span className="h-3.5 w-14 rounded-sm bg-softbg animate-pulse" />
              </div>
            ))}
          </div>
        )}
        {rooms.length === 0 && !loading && (
          <p className="py-6 px-4 text-[15px] text-muted">No rooms yet.</p>
        )}

        {rooms.map(room => {
          const d = roomDraft(room, edits)
          const touched = !!edits[room.id]
          const isOn = selected?.id === room.id
          return (
            <button key={room.id} type="button" onClick={() => pick(room.id)} aria-current={isOn ? 'true' : undefined}
              className={'w-full h-12 pl-3 pr-4 flex items-center justify-between gap-3 border-b border-soft border-l-4 text-left transition-colors duration-150 cursor-pointer ' +
                (isOn ? 'border-l-gold-400 bg-gold-100/70' : 'border-l-transparent hover:bg-softbg/60')}>
              <span className="min-w-0 truncate">
                <span className="text-[15px] font-semibold text-main">Room {room.room_number}</span>
                <span className="ml-2 text-[13px] text-muted">{room.name}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {touched && <span className="w-1.5 h-1.5 rounded-full bg-gold-500" title="Changed, not saved yet" />}
                <span className="text-[15px] font-semibold tabular-nums text-main">{money(d.price)}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* The panel — the room you clicked, and nothing else. It settles in on each click, so
          the eye sees the figures change to the new room. */}
      {selected && draft && (
        <div key={selected.id} ref={panel} className="scroll-mt-20 lg:sticky lg:top-20 space-y-5 animate-in fade-in duration-200 motion-reduce:animate-none">
          <div>
            <h3 className={GROUP_TITLE}>Room {selected.room_number}</h3>
            <p className="mt-0.5 text-[13px] text-muted">{selected.name}</p>
          </div>

          <div>
            <SubHead>Overnight</SubHead>
            <FieldGrid>
              <Figure label="A night" value={draft.price} onChange={v => onEdit(selected.id, { price: v })} />
              <Figure label="Breakfast, once for the stay" placeholder="None" value={draft.breakfast} onChange={v => onEdit(selected.id, { breakfast: v })} />
            </FieldGrid>
          </div>

          <div>
            <SubHead>Short stay</SubHead>
            <FieldGrid cols={3}>
              <Figure label="3 hours" placeholder="Not sold" value={draft.hour3} onChange={v => onEdit(selected.id, { hour3: v })} />
              <Figure label="6 hours" placeholder="Not sold" value={draft.hour6} onChange={v => onEdit(selected.id, { hour6: v })} />
              <Figure label="12 hours" placeholder="Not sold" value={draft.hour12} onChange={v => onEdit(selected.id, { hour12: v })} />
            </FieldGrid>
            <p className="mt-3 text-[13px] text-muted">
              22 hours is the night price · <span className="font-semibold tabular-nums text-main">{money(draft.price)}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
