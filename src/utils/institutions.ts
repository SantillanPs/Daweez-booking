import { supabase, isSupabaseConfigured } from './supabaseClient'

/**
 * The saved institutions (schools, offices…) the booking form picks from — the owner's note
 * of 2026-10-20, option B of the mock: a saved list like the agencies'. Only the name is
 * kept on a booking (`bookings.institution`), so a profile here is just the pick list.
 */
export interface Institution {
  id: string
  name: string
}

export async function getInstitutions(): Promise<Institution[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase.from('institutions').select('id, name').order('name')
  if (error) throw error
  return data || []
}

export async function insertInstitution(name: string): Promise<Institution> {
  if (!isSupabaseConfigured) throw new Error('No database is connected, so this institution was not saved.')
  const { data, error } = await supabase.from('institutions').insert({ name }).select('id, name').single()
  if (error) throw error
  return data
}
