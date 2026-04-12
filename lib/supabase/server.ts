import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const FALLBACK_SUPABASE_URL = 'https://placeholder.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'placeholder-anon-key'
const PROJECT_SUPABASE_URL = 'https://qczaynvalytoqesfwdue.supabase.co'
const PROJECT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QGFiYo2eeyHi4KzBnUBHFQ_smp9qEi6'

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || PROJECT_SUPABASE_URL || FALLBACK_SUPABASE_URL
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    PROJECT_SUPABASE_PUBLISHABLE_KEY ||
    FALLBACK_SUPABASE_ANON_KEY

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // The "setAll" method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    },
  )
}
