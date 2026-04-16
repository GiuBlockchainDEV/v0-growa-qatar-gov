import { createBrowserClient } from '@supabase/ssr'

const DEFAULT_SUPABASE_URL = 'https://qczaynvalytoqesfwdue.supabase.co'
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QGFiYo2eeyHi4KzBnUBHFQ_smp9qEi6'

let hasWarnedMissingEnv = false
let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY

  if (
    !hasWarnedMissingEnv &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL ||
      (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
        !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY))
  ) {
    hasWarnedMissingEnv = true
    console.warn(
      '[supabase] Missing Supabase env vars; using embedded project public config.'
    )
  }

  // Reuse a singleton browser client to avoid recreating subscriptions/listeners
  // on every render across hooks and providers.
  if (typeof window !== 'undefined') {
    if (!browserClient) {
      browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey)
    }
    return browserClient
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
