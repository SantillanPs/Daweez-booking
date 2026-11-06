import { createClient } from '@supabase/supabase-js'
import { noteReached } from './connection'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

/** False only in a copy built without the database settings. `main.tsx` then shows "This copy
 *  isn't set up" and the app never starts, so the stand-in address below is never called. (The
 *  no-database mode, with sample rooms and prices, was taken out on 2026-11-06.) */
export const isSetUp = Boolean(supabaseUrl && supabaseAnonKey)

// Every call to the database tells the connection sign whether it got an answer (`utils/connection`).
const watchedFetch: typeof fetch = async (input, init) => {
  try {
    const res = await fetch(input, init)
    noteReached(true)
    return res
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) noteReached(false)
    throw err
  }
}

export const supabase = createClient(supabaseUrl || 'https://not-set-up.invalid', supabaseAnonKey || 'not-set-up', {
  global: { fetch: watchedFetch },
})
