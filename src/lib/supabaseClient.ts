import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || (globalThis as any)?.VITE_SUPABASE_URL
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (globalThis as any)?.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing configuration:', { 
    hasUrl: !!supabaseUrl, 
    hasKey: !!supabaseAnonKey 
  })
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
)

export async function getSupabaseAccessToken(): Promise<string | null> {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return null
    }
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token || null
    return token
  } catch {
    return null
  }
}


