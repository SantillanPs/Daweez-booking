import { supabase, isSupabaseConfigured } from './supabaseClient'

export interface CleaningTask {
  id: string
  room_id?: string
  item: string
  date?: string
  cleaned_by?: string
  checked_by?: string
  status: 'pending' | 'done' | 'checked'
  created_at: string
}

const KEY = 'l_etoile_cleaning_db'

export const CLEANING_ITEMS = ['Pillows', 'Blankets', 'Foam', 'Soap', 'Toothbrush', 'Toothpaste', 'Tissue', 'Pillow case', 'Bed sheet', 'Towel', 'Slippers', 'Hanger', 'Mirror', 'Trash can']

export async function getCleaningTasks(): Promise<CleaningTask[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('cleaning_checklist').select('*').order('created_at', { ascending: false })
      if (error) throw error
      if (data) {
        return data.map(t => ({ id: t.id, room_id: t.room_id || undefined, item: t.item, date: t.date || undefined, cleaned_by: t.cleaned_by || undefined, checked_by: t.checked_by || undefined, status: (t.status as CleaningTask['status']) || 'pending', created_at: t.created_at }))
      }
    } catch (err) {
      console.error('Supabase getCleaningTasks Error, falling back to local:', err)
    }
  }
  const raw = localStorage.getItem(KEY)
  if (raw) { try { return JSON.parse(raw) } catch { /* ignore */ } }
  return []
}

export async function saveCleaningTasks(tasks: CleaningTask[]): Promise<void> {
  localStorage.setItem(KEY, JSON.stringify(tasks))
  if (isSupabaseConfigured) {
    try {
      await supabase.from('cleaning_checklist').upsert(tasks)
    } catch (err) {
      console.error('Supabase saveCleaningTasks Error:', err)
    }
  }
}
