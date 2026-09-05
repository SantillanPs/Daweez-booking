import { supabase, isSupabaseConfigured } from './supabaseClient'

export interface InventoryItem {
  id: string
  name: string
  category: string
  quantity: number
  created_at: string
}

const KEY = 'l_etoile_inventory_db'

export const DEFAULT_INVENTORY: InventoryItem[] = [
  'Pillow','Blanket','Foam','Soap','Toothpaste','Toothbrush','Tissue','Pillow case','Bed sheet','TV','Remote','Curtains','Wall clock','Slippers','Towel','Hanger','Trash can','Mirror'
].map((name, i) => ({ id: 'inv-' + (i + 1), name, category: 'room', quantity: 0, created_at: new Date().toISOString() }))

export async function getInventory(): Promise<InventoryItem[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('inventory_items').select('*').order('name')
      if (error) throw error
      if (data && data.length > 0) {
        return data.map(i => ({ id: i.id, name: i.name, category: i.category, quantity: Number(i.quantity || 0), created_at: i.created_at }))
      }
    } catch (err) {
      console.error('Supabase getInventory Error, falling back to local:', err)
    }
  }
  const raw = localStorage.getItem(KEY)
  if (raw) { try { return JSON.parse(raw) } catch { /* ignore */ } }
  localStorage.setItem(KEY, JSON.stringify(DEFAULT_INVENTORY))
  return DEFAULT_INVENTORY
}

export async function saveInventory(items: InventoryItem[]): Promise<void> {
  localStorage.setItem(KEY, JSON.stringify(items))
  if (isSupabaseConfigured) {
    try {
      const records = items.map(i => ({ id: i.id, name: i.name, category: i.category, quantity: i.quantity }))
      await supabase.from('inventory_items').upsert(records)
    } catch (err) {
      console.error('Supabase saveInventory Error:', err)
    }
  }
}
