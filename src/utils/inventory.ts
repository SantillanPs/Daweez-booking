import { supabase, isSupabaseConfigured } from './supabaseClient'

export interface InventoryItem {
  id: string
  name: string
  category: string
  quantity: number
  created_at: string
}

// Hotel inventory.
//
// The browser store (`l_etoile_inventory_db`) is gone (2026-09-28). It was also
// hiding a worse fault than the room prices had: `saveInventory` wrote the
// browser copy first and never looked at the database's answer. Supabase reports
// a refused write in the returned `error` rather than by throwing, so that answer
// was discarded and a refused save was completely silent — the screen showed the
// new count and the database never had it. The result is checked now.

export const DEFAULT_INVENTORY: InventoryItem[] = [
  'Pillow','Blanket','Foam','Soap','Toothpaste','Toothbrush','Tissue','Pillow case','Bed sheet','TV','Remote','Curtains','Wall clock','Slippers','Towel','Hanger','Trash can','Mirror'
].map((name, i) => ({ id: 'inv-' + (i + 1), name, category: 'room', quantity: 0, created_at: new Date().toISOString() }))

export async function getInventory(): Promise<InventoryItem[]> {
  if (!isSupabaseConfigured) return DEFAULT_INVENTORY

  try {
    const { data, error } = await supabase.from('inventory_items').select('*').order('name')
    if (error) throw error
    if (data && data.length > 0) {
      return data.map(i => ({ id: i.id, name: i.name, category: i.category, quantity: Number(i.quantity || 0), created_at: i.created_at }))
    }
  } catch (err) {
    console.error('Supabase getInventory Error:', err)
  }

  return DEFAULT_INVENTORY
}

export async function saveInventory(items: InventoryItem[]): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('No database is connected, so the inventory was not saved.')
  }

  const records = items.map(i => ({ id: i.id, name: i.name, category: i.category, quantity: i.quantity }))
  const { error } = await supabase.from('inventory_items').upsert(records)
  if (error) throw error
}
