import React, { useState } from 'react'
import { Room } from '../../types/booking'
import { NumInput } from '../NumInput'
import { Check, ChevronDown, Loader2, Save } from 'lucide-react'

interface RoomRatesEditorProps {
  rooms: Room[]
  updateRoomRate: (roomId: string, basePrice: number, promoPrice?: number | null) => Promise<Room | null>
}

interface RoomDraft {
  base: number
  promo: number
}

function RateField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 bg-page border border-soft rounded-lg px-3 py-2">
      <span className="text-[11px] text-muted font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-muted font-bold">₱</span>
        <NumInput value={value} onChange={onChange}
          className="w-24 bg-card border border-soft text-main px-2 py-1 rounded-md text-sm font-mono focus:outline-none focus:border-brand-primary text-right" />
      </div>
    </label>
  )
}

export function RoomRatesEditor({ rooms, updateRoomRate }: RoomRatesEditorProps) {
  // Overlays: only rooms the staff member has started editing. Everything else
  // falls through to the live room value, so a save + refetch keeps the UI true.
  const [edits, setEdits] = useState<Record<string, Partial<RoomDraft>>>({})
  const [expandedId, setExpandedId] = useState<string | null>(rooms.length > 0 ? rooms[0].id : null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const draftFor = (room: Room): RoomDraft => ({
    base: edits[room.id]?.base ?? room.base_price,
    promo: edits[room.id]?.promo ?? (room.promo_price ?? 0),
  })

  const handleSave = async (room: Room) => {
    const draft = draftFor(room)
    if (savingId) return
    setSavingId(room.id)
    try {
      await updateRoomRate(room.id, draft.base, draft.promo > 0 ? draft.promo : null)
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
        <p className="text-xs text-muted mt-1">Set each room's Regular and Promo price. New bookings and invoices use these.</p>
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
                    {room.promo_price && room.promo_price > 0
                      ? `₱${room.base_price} / Promo ₱${room.promo_price}`
                      : `₱${room.base_price}`}
                  </span>
                  <ChevronDown className={'w-4 h-4 text-muted transition-transform ' + (isExpanded ? 'rotate-180' : '')} />
                </div>
              </button>
              {isExpanded && (
                <div className="px-5 pb-4 pt-1 space-y-2.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <RateField label="Regular rate (per night)" value={draft.base}
                      onChange={v => setEdits(s => ({ ...s, [room.id]: { ...s[room.id], base: v } }))} />
                    <RateField label="Promo rate (per night, 0 = none)" value={draft.promo}
                      onChange={v => setEdits(s => ({ ...s, [room.id]: { ...s[room.id], promo: v } }))} />
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => handleSave(room)} disabled={savingId === room.id}
                      className="inline-flex items-center gap-1.5 bg-brand-primary hover:bg-gold-500 text-ink-900 text-xs font-medium px-5 py-2 rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-60">
                      {savingId === room.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save {room.name} rate
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
