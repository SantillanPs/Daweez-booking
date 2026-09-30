import { supabase, isSupabaseConfigured } from './supabaseClient'

/**
 * Shared staff settings that live in the database.
 *
 * One `app_settings` row per key, each holding a whole JSON object:
 *
 *   rate_config      — the shared rates (venue hourly, early/late charge, the
 *                      breakfast menu, extras & rentals, deposit, standard times)
 *   payment_accounts — where the guest sends the downpayment (GCash + both banks)
 *   channel_sync     — the iCal switches: the master on/off and the rooms taken off
 *
 * These used to live ONLY in one browser's localStorage, so a second PC showed
 * the factory defaults and the account a guest was told to pay into could differ
 * from the one printed on their bill (found 2026-09-28). The browser copy is
 * gone; `app_settings` is the single home.
 *
 * Writes go through the `set_app_setting` SECURITY DEFINER RPC — RLS gives the
 * app SELECT only, the same shape `rooms` uses.
 */

export type AppSettingKey = 'rate_config' | 'payment_accounts' | 'channel_sync'

/** Reads one setting. Returns null when it has never been saved. */
export async function readAppSetting<T>(key: AppSettingKey): Promise<T | null> {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error) throw error
  return (data?.value as T) ?? null
}

/** Writes one setting. Throws when the database refuses it. */
export async function writeAppSetting(key: AppSettingKey, value: unknown): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('No database is connected, so this setting was not saved.')
  }

  const { error } = await supabase.rpc('set_app_setting', { p_key: key, p_value: value })
  if (error) throw error
}
