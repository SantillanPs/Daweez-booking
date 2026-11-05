import { supabase, isSupabaseConfigured } from './supabaseClient'
import { Tab, TabEvent } from '../types/tab'

// Restaurant → History: every order slip with the steps that happened to it (`tab_events`,
// written by the database as each one happens).

/** One slip and its steps, oldest step first. */
export interface SlipStory {
  tab: Tab
  steps: TabEvent[]
  /** When its first dish went on: the time the slip is listed under. */
  at: string
  /** What the slip comes to now. */
  total: number
}

/** A sale written by hand in Cash Flow: not an order the restaurant took. */
function handWritten(tab: Tab): boolean {
  const records = tab.payment_records || []
  return records.length > 0 && records.every(r => r.by_hand)
}

/** The slips with a step since `since`, newest first. Thrown on failure. */
export async function getSlipHistory(since: Date): Promise<SlipStory[]> {
  if (!isSupabaseConfigured) return []
  const from = since.toISOString()
  const [ev, tb] = await Promise.all([
    supabase.from('tab_events').select('*').gte('at', from).order('at', { ascending: true }),
    supabase.from('tabs').select('*, tab_lines(amount)').gte('opened_at', new Date(since.getTime() - 86400000).toISOString()),
  ])
  if (ev.error) throw ev.error
  if (tb.error) throw tb.error

  const byTab = new Map<string, TabEvent[]>()
  for (const e of (ev.data || []) as TabEvent[]) {
    const list = byTab.get(e.tab_id) || []
    list.push({ ...e, amount: Number(e.amount || 0), items: Array.isArray(e.items) ? e.items : [] })
    byTab.set(e.tab_id, list)
  }
  const out: SlipStory[] = []
  for (const row of (tb.data || []) as (Tab & { tab_lines?: { amount: number }[] })[]) {
    const steps = byTab.get(row.id)
    if (!steps?.length || handWritten(row)) continue
    const { tab_lines, ...tab } = row
    const total = Math.round((tab_lines || []).reduce((s, l) => s + Number(l.amount || 0), 0) * 100) / 100
    out.push({ tab, steps, at: steps[0].at, total })
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}
