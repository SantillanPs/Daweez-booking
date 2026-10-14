import { Handover } from '../types/expense'
import { supabase, isSupabaseConfigured } from './supabaseClient'

// MONEY HANDED OVER (the owner, 2026-10-13: *"the staff or the owner usually do some
// remittance with the money"*). The staff hand what they collected to the owner. It
// leaves the hotel, so it comes off "Money in the hotel" — but it is not an expense:
// the hotel still earned it, so it lives in its own table (`money_handovers`) and the
// earnings report never sees it.
//
// CASH ADDED is the same row the other way round (`kind: 'in'`, the owner, 2026-10-14): the cash the
// staff already held when they began using the system, or cash the owner puts in. It adds to the money in
// the hotel and, like a hand-over, is never income.

export async function getHandovers(): Promise<Handover[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase.from('money_handovers').select('*').order('created_at')
  if (error) throw error
  return (data || []).map(row => ({ ...row, amount: Number(row.amount) })) as Handover[]
}

export async function insertHandover(handover: Handover): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('No database is connected, so this was not saved.')
  const { error } = await supabase.from('money_handovers').insert(handover)
  if (error) throw error
}

export async function deleteHandover(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('No database is connected, so this was not taken back.')
  const { error } = await supabase.from('money_handovers').delete().eq('id', id)
  if (error) throw error
}
