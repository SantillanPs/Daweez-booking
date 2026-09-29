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

// The cleaning checklist.
//
// The browser store (`l_etoile_cleaning_db`) is gone (2026-09-28). Like the
// inventory next to it, this wrote the browser copy first and never read the
// database's answer back — and Supabase reports a refused write in the returned
// `error` rather than by throwing, so a refused save was silent. The result is
// checked now, and the write throws so the screen can say so.

export const CLEANING_ITEMS = ['Pillows', 'Blankets', 'Foam', 'Soap', 'Toothbrush', 'Toothpaste', 'Tissue', 'Pillow case', 'Bed sheet', 'Towel', 'Slippers', 'Hanger', 'Mirror', 'Trash can']

export async function getCleaningTasks(): Promise<CleaningTask[]> {
  if (!isSupabaseConfigured) return []

  try {
    const { data, error } = await supabase.from('cleaning_checklist').select('*').order('created_at', { ascending: false })
    if (error) throw error
    if (data) {
      return data.map(t => ({ id: t.id, room_id: t.room_id || undefined, item: t.item, date: t.date || undefined, cleaned_by: t.cleaned_by || undefined, checked_by: t.checked_by || undefined, status: (t.status as CleaningTask['status']) || 'pending', created_at: t.created_at }))
    }
  } catch (err) {
    console.error('Supabase getCleaningTasks Error:', err)
  }

  return []
}

export async function saveCleaningTasks(tasks: CleaningTask[]): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('No database is connected, so the cleaning checklist was not saved.')
  }

  const { error } = await supabase.from('cleaning_checklist').upsert(tasks)
  if (error) throw error
}
