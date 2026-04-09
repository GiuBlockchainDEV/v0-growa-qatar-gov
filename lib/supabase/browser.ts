/**
 * Growa Qatar - Supabase Browser Client
 * Step 0.5: Supabase bootstrap artifacts
 * 
 * Client-side Supabase client using the anon key.
 * Safe for use in browser/client components.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/supabase/types/database'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Support both standard and v0 integration variable names
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) are set.'
    )
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}
