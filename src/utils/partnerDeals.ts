import { PartnerDeal } from '../types/booking'
import { supabase, isSupabaseConfigured } from './supabaseClient'

// ── Partner Deals Operations ──
//
// The database is the only home for an agency profile. The browser store that
// used to mirror these is gone (2026-09-28): `savePartnerDeals` /
// `insertPartnerDeal` / `deletePartnerDeal` now throw when the database refuses
// the write, so the screen reports it instead of showing a saved agency that
// only ever existed on that one machine.

const NO_DB = 'No database is connected, so this agency was not saved.'

function toRecord(d: PartnerDeal) {
  return {
    id: d.id,
    name: d.name,
    type: d.type,
    tin: d.tin || null,
    address: d.address || null,
    contact_no: d.contact_no || null,
    email: d.email || null,
    vehicle_plate: d.vehicle_plate || null,
    breakfast_default: d.breakfast_default,
    contracted_rates: d.contracted_rates,
    created_at: d.created_at
  }
}

export async function getPartnerDeals(): Promise<PartnerDeal[]> {
  if (!isSupabaseConfigured) return []

  try {
    const { data, error } = await supabase
      .from('partner_deals')
      .select('*')
      .order('name', { ascending: true })
    if (error) throw error

    if (data) {
      return data.map(d => ({
        id: d.id,
        name: d.name,
        type: d.type as PartnerDeal['type'],
        tin: d.tin || undefined,
        address: d.address || undefined,
        contact_no: d.contact_no || undefined,
        email: d.email || undefined,
        vehicle_plate: d.vehicle_plate || undefined,
        breakfast_default: d.breakfast_default as PartnerDeal['breakfast_default'],
        contracted_rates: d.contracted_rates || {},
        created_at: d.created_at
      }))
    }
  } catch (err) {
    console.error('Supabase getPartnerDeals Error:', err)
  }

  return []
}

export async function savePartnerDeals(deals: PartnerDeal[]): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)

  const { error } = await supabase.from('partner_deals').upsert(deals.map(toRecord))
  if (error) throw error
}

export async function insertPartnerDeal(deal: PartnerDeal): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)

  const { error } = await supabase.from('partner_deals').insert(toRecord(deal))
  if (error) throw error
}

export async function deletePartnerDeal(dealId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('No database is connected, so this agency was not deleted.')

  const { error } = await supabase.from('partner_deals').delete().eq('id', dealId)
  if (error) throw error
}
