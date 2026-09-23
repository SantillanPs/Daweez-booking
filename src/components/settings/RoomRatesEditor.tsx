import React, { useState } from 'react'
import { Room } from '../../types/booking'
import { NumInput } from '../NumInput'
import { Check, ChevronDown, Loader2, Save } from 'lucide-react'

interface RoomRatesEditorProps {
  rooms: Room[]
  updateRoomRate: (roomId: string, basePrice: number, promoPrice?: number | null) => Promise<Room | null>
  /** What the room charges for breakfast (k140). Blank means it sells none. */
  updateRoomBreakfastPrice?: (roomId: string, price: number) => Promise<void>
  /**
   * What the room charges for a SHORT STAY — 3, 6 and 12 hours, from the hotel's
   * printed rate board. Blank means the room is not sold short.
   */
  updateRoomHourPrices?: (roomId: string, hour3: number, hour6: number, hour12: number) => Promise<void>
}

interface RoomDraft {
  price: number
  breakfast: number
  hour3: number
  hour6: number
  hour12: number
}

function RateField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 bg-page border border-soft rounded-lg px-3 py-2">
      <span className="text-[11px] text-muted font-medium">{label}</span>
      <NumInput value={value} onChange={onChange}
        className="w-24 bg-card border border-soft text-main px-2 py-1 rounded-md text-sm font-mono focus:outline-none focus:border-brand-primary text-right" />
    </label>
  )
}

// One price per room (card k128), and the bed count breakfast is charged against
// (card k140).
//
// The old Regular + Promo pair is gone: the owner's rule is that a room has a
// single price. Both stored columns are written with it — `promo_price` is the
// figure the pricing engine uses, and `base_price` is kept equal so nothing can
// read the stale one and quote a different number.
export function RoomRatesEditor({ rooms, updateRoomRate, updateRoomBreakfastPrice, updateRoomHourPrices }: RoomRatesEditorProps) {
  // Overlays: only rooms the staff member has started editing. Everything else
  // falls through to the live room value, so a save + refetch keeps the UI true.
  const [edits, setEdits] = useState<Record<string, Partial<RoomDraft>>>({})
  const [expandedId, setExpandedId] = useState<string | null>(rooms.length > 0 ? rooms[0].id : null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const draftFor = (room: Room): RoomDraft => ({
    // The price shown is the single price: the promo figure when one is set (the
    // rule the pricing engine follows), otherwise the regular one.
    price: edits[room.id]?.price ?? ((room.promo_price && room.promo_price > 0) ? room.promo_price : room.base_price),
    breakfast: edits[room.id]?.breakfast ?? (room.breakfast_price ?? 0),
    hour3: edits[room.id]?.hour3 ?? (room.hour3_price ?? 0),
    hour6: edits[room.id]?.hour6 ?? (room.hour6_price ?? 0),
    hour12: edits[room.id]?.hour12 ?? (room.hour12_price ?? 0),
  })

  const handleSave = async (room: Room) => {
    const draft = draftFor(room)
    if (savingId) return
    setSavingId(room.id)
    try {
      await updateRoomRate(room.id, draft.price, draft.price)
      // The breakfast price rides along: it is one charge for the stay.
      if (updateRoomBreakfastPrice) await updateRoomBreakfastPrice(room.id, draft.breakfast)
      // And the three short-stay prices, from the printed board.
      if (updateRoomHourPrices) await updateRoomHourPrices(room.id, draft.hour3, draft.hour6, draft.hour12)
      setSavedId(room.id)
      setTimeout(() => setSavedId(id => (id === room.id ? null : id)), 1500)
    } catch {
      /* keep the form open so staff can retry */
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="bg-card border border-soft rounded-lg overflow-hidden font-sans shadow-sm">
      <div className="px-5 py-4 border-b border-soft">
        <h3 className="text-sm font-semibold text-main">Room Rates</h3>
        <p className="text-xs text-muted mt-1">One price per room, and how many beds it has. New bookings and invoices use these.</p>
      </div>
      <div className="divide-y divide-soft">
        {rooms.map(room => {
          const draft = draftFor(room)
          const isExpanded = expandedId === room.id
          return (
            <div key={room.id}>
              <button type="button" onClick={() => setExpandedId(isExpanded ? null : room.id)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-page transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-main">Room {room.room_number}</span>
                  <span className="text-xs text-muted">{room.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted font-mono">
                    ₱{draft.price}{draft.breakfast > 0 ? ` · Breakfast ₱${draft.breakfast}` : ''}{draft.hour3 > 0 ? ` · 3h ₱${draft.hour3}` : ''}
                  </span>
                  <ChevronDown className={'w-4 h-4 text-muted transition-transform ' + (isExpanded ? 'rotate-180' : '')} />
                </div>
              </button>
              {isExpanded && (
                <div className="px-5 pb-4 pt-1 space-y-2.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <RateField label="Price (per night)" value={draft.price}
                      onChange={v => setEdits(s => ({ ...s, [room.id]: { ...s[room.id], price: v } }))} />
                    <RateField label="Breakfast (one charge for the stay)" value={draft.breakfast}
                      onChange={v => setEdits(s => ({ ...s, [room.id]: { ...s[room.id], breakfast: v } }))} />
                  </div>
                  <p className="text-[11px] text-muted">
                    Breakfast is one charge for the stay, whatever the room holds — type this room's own figure. Leave it at 0 and the room sells no breakfast, and the booking form says so.
                  </p>

                  {/* Short stays (from the printed rate board): the three short
                      columns. The 22-hour column is the price above, so it needs no
                      box of its own. */}
                  <div className="pt-1">
                    <p className="text-[11px] font-semibold text-main">Short stay prices</p>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      <RateField label="3 hours" value={draft.hour3}
                        onChange={v => setEdits(s => ({ ...s, [room.id]: { ...s[room.id], hour3: v } }))} />
                      <RateField label="6 hours" value={draft.hour6}
                        onChange={v => setEdits(s => ({ ...s, [room.id]: { ...s[room.id], hour6: v } }))} />
                      <RateField label="12 hours" value={draft.hour12}
                        onChange={v => setEdits(s => ({ ...s, [room.id]: { ...s[room.id], hour12: v } }))} />
                    </div>
                    <p className="text-[11px] text-muted mt-2">
                      Leave a box at 0 and this room is not sold for those hours — the dash on the printed board. The 22-hour price is the price at the top of this room, and a short stay takes the room for the whole day.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => handleSave(room)} disabled={savingId === room.id}
                      className="inline-flex items-center gap-1.5 bg-brand-primary hover:bg-gold-500 text-ink-900 text-xs font-medium px-5 py-2 rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-60">
                      {savingId === room.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save {room.name}
                    </button>
                    {savedId === room.id && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                        <Check className="w-3.5 h-3.5" /> Saved
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
