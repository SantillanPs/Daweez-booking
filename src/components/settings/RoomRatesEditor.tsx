import React, { useState } from 'react'
import { Room } from '../../types/booking'
import { NumInput } from '../NumInput'
import { RoomDraft, roomDraft } from './roomDraft'

const money = (n: number) => '₱' + Number(n || 0).toLocaleString()

/** One editable figure: its name, and the box on the right. */
function Field({ label, value, onChange, note }: { label: string; value: number; onChange: (v: number) => void; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-soft last:border-b-0">
      <span className="text-[11.5px] text-ink-600">{label}</span>
      {note ? (
        <span className="text-[11px] text-muted font-mono">{note}</span>
      ) : (
        <NumInput value={value} onChange={onChange}
          className="w-24 bg-page border border-soft text-main px-2 py-1 rounded-md text-sm font-mono focus:outline-none focus:border-brand-primary text-right" />
      )}
    </div>
  )
}

interface RoomRatesEditorProps {
  rooms: Room[]
  /** Only the rooms staff have actually typed into — the page's save bar counts these. */
  edits: Record<string, Partial<RoomDraft>>
  onEdit: (roomId: string, patch: Partial<RoomDraft>) => void
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
 * stated rather than offered as a fourth box. A room with typing waiting shows a small
 * gold dot, and there is **no Save button here** — the page has one save bar, so this is
 * controlled (`edits` + `onEdit`) and the parent owns the draft.
 */
export function RoomRatesEditor({ rooms, edits, onEdit }: RoomRatesEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(rooms.length > 0 ? rooms[0].id : null)
  const selected = rooms.find(r => r.id === selectedId) || rooms[0] || null
  const draft = selected ? roomDraft(selected, edits) : null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-3.5 items-start">
      {/* The price list — every room and its night price on one screen. */}
      <div className="bg-card border border-soft rounded-xl overflow-hidden">
        <div className="px-3.5 py-2 bg-page border-b border-soft flex items-center justify-between text-[9.5px] font-bold tracking-wider uppercase text-muted">
          <span>Room</span><span>A night</span>
        </div>
        {rooms.map(room => {
          const d = roomDraft(room, edits)
          const touched = !!edits[room.id]
          const isOn = selected?.id === room.id
          return (
            <button key={room.id} type="button" onClick={() => setSelectedId(room.id)}
              className={'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-soft last:border-b-0 text-left transition-colors cursor-pointer ' +
                (isOn ? 'bg-gold-100/60 border-l-4 border-l-gold-400' : 'hover:bg-page')}>
              <span className="min-w-0">
                <span className="text-[12.5px] font-bold text-main">Room {room.room_number}</span>
                <span className="text-[11px] text-muted"> · {room.name}</span>
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="text-[12.5px] font-mono font-bold text-main">{money(d.price)}</span>
                {touched && <span className="w-1.5 h-1.5 rounded-full bg-gold-400" title="Changed — the save bar at the foot of the page has it" />}
              </span>
            </button>
          )
        })}
      </div>

      {/* The panel — the room you clicked, and nothing else. */}
      {selected && draft && (
        <div className="bg-card border border-soft rounded-xl px-3.5 py-3.5">
          <p className="font-display font-bold text-[15px] text-main">Room {selected.room_number}</p>
          <p className="text-[11px] text-muted mt-0.5">
            {selected.name} · {draft.breakfast > 0 ? 'breakfast ' + money(draft.breakfast) : 'no breakfast'}
          </p>

          <div className="border-t border-soft mt-3 pt-2.5">
            <p className="text-[9px] font-bold tracking-widest uppercase text-muted">Overnight</p>
            <Field label="A night" value={draft.price} onChange={v => onEdit(selected.id, { price: v })} />
            <Field label="Breakfast, once for the stay" value={draft.breakfast} onChange={v => onEdit(selected.id, { breakfast: v })} />
          </div>

          <div className="border-t border-soft mt-3 pt-2.5">
            <p className="text-[9px] font-bold tracking-widest uppercase text-muted">Short stay — leave 0 for not sold</p>
            <Field label="3 hours" value={draft.hour3} onChange={v => onEdit(selected.id, { hour3: v })} />
            <Field label="6 hours" value={draft.hour6} onChange={v => onEdit(selected.id, { hour6: v })} />
            <Field label="12 hours" value={draft.hour12} onChange={v => onEdit(selected.id, { hour12: v })} />
            <Field label="22 hours" value={0} onChange={() => {}} note={'the night price · ' + money(draft.price)} />
          </div>

          <p className="text-[10.5px] text-muted mt-2">
            0 means this room is not sold for those hours. The board, the booking form and the printed bill all read these.
          </p>
        </div>
      )}
    </div>
  )
}
