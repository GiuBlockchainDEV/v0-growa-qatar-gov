import { createBrowserClient } from '@supabase/ssr'

const FALLBACK_SUPABASE_URL = 'https://placeholder.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'placeholder-anon-key'

let hasWarnedMissingEnv = false

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    FALLBACK_SUPABASE_ANON_KEY

  if (
    !hasWarnedMissingEnv &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL ||
      (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
        !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY))
  ) {
    hasWarnedMissingEnv = true
    console.warn(
      '[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or anon key; using placeholder client to avoid build-time crash.'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
