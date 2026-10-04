import { useEffect, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient'

/**
 * Calls `onChange` when any order slip or any of its lines changes, on any tablet.
 *
 * A room guest's slip is paid at the front desk while the Restaurant screen is open on
 * another tablet — the staff's feedback (2026-10-04) was that the restaurant went on
 * showing food that had already been paid. The screen reads its slips again on every
 * change instead of only after its own orders. Changes that arrive together are read once.
 */
export function useRealtimeTabs(onChange: () => void) {
  const latest = useRef(onChange)
  useEffect(() => { latest.current = onChange })

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let timer: number | undefined
    const changed = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => latest.current(), 300)
    }
    const channel = supabase
      .channel('order-slips-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tabs' }, changed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tab_lines' }, changed)
      .subscribe()

    return () => {
      window.clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [])
}
