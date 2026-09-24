import { Room } from '../../types/booking'

/**
 * What a room is being edited to. Every field is a plain number.
 *
 * It lives in its own module (not next to the editor component) because React Fast
 * Refresh only works when a file exports components — the same reason `receiptText.ts`
 * sits beside `receiptPrimitives.tsx`.
 */
export interface RoomDraft {
  price: number
  breakfast: number
  hour3: number
  hour6: number
  hour12: number
}

/**
 * A room's figures, with anything staff have typed laid over them. Only the rooms in
 * the edit map are being changed; every other room falls through to its live values, so
 * a save keeps the whole page true.
 *
 * The old Regular + Promo pair is gone (card k128): a room has ONE price, and the
 * caller writes it into both stored columns so nothing can read the stale one.
 */
export function roomDraft(room: Room, edits: Record<string, Partial<RoomDraft>>): RoomDraft {
  const typed = edits[room.id] || {}
  return {
    price: typed.price ?? ((room.promo_price && room.promo_price > 0) ? room.promo_price : room.base_price),
    breakfast: typed.breakfast ?? (room.breakfast_price ?? 0),
    hour3: typed.hour3 ?? (room.hour3_price ?? 0),
    hour6: typed.hour6 ?? (room.hour6_price ?? 0),
    hour12: typed.hour12 ?? (room.hour12_price ?? 0),
  }
}
