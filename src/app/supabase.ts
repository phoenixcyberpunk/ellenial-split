import { createClient } from '@supabase/supabase-js'
import { config } from './config'

// No accounts: sessions are never stored, and the module only calls split_* functions.
export const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
