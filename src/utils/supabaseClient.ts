import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Export indicator to dynamically toggle offline/online database logic
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'your_supabase_project_url')

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-ctbqxcxqfsrbgzfcmntw.supabase.co', 
  supabaseAnonKey || 'placeholder'
)
