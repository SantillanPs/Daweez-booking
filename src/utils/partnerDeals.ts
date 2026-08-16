import { PartnerDeal } from '../types/booking'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { PARTNERS_KEY } from './db'

// ── Partner Deals Operations ──

export async function getPartnerDeals(): Promise<PartnerDeal[]> {
  if (isSupabaseConfigured) {
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
      console.error('Supabase getPartnerDeals Error, falling back to LocalStorage:', err)
    }
  }

  const data = localStorage.getItem(PARTNERS_KEY)
  if (!data) return []
  return JSON.parse(data)
}

export async function savePartnerDeals(deals: PartnerDeal[]): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const records = deals.map(d => ({
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
      }))

      const { error } = await supabase.from('partner_deals').upsert(records)
      if (error) throw error
      return
    } catch (err) {
      console.error('Supabase savePartnerDeals Error, falling back to LocalStorage:', err)
    }
  }

  localStorage.setItem(PARTNERS_KEY, JSON.stringify(deals))
}

export async function insertPartnerDeal(deal: PartnerDeal): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const record = {
        id: deal.id,
        name: deal.name,
        type: deal.type,
        tin: deal.tin || null,
        address: deal.address || null,
        contact_no: deal.contact_no || null,
        email: deal.email || null,
        vehicle_plate: deal.vehicle_plate || null,
        breakfast_default: deal.breakfast_default,
        contracted_rates: deal.contracted_rates,
        created_at: deal.created_at
      }

      const { error } = await supabase.from('partner_deals').insert(record)
      if (error) throw error
      return
    } catch (err) {
      console.error('Supabase insertPartnerDeal Error, falling back to LocalStorage:', err)
    }
  }

  const data = localStorage.getItem(PARTNERS_KEY)
  const existing: PartnerDeal[] = data ? JSON.parse(data) : []
  localStorage.setItem(PARTNERS_KEY, JSON.stringify([...existing, deal]))
}

export async function deletePartnerDeal(dealId: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('partner_deals').delete().eq('id', dealId)
      if (error) throw error
      return
    } catch (err) {
      console.error('Supabase deletePartnerDeal Error, falling back to LocalStorage:', err)
    }
  }

  const data = localStorage.getItem(PARTNERS_KEY)
  if (data) {
    const existing: PartnerDeal[] = JSON.parse(data)
    localStorage.setItem(PARTNERS_KEY, JSON.stringify(existing.filter(d => d.id !== dealId)))
  }
}
