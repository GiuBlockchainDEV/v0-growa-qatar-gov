/**
 * Growa Qatar - Supabase Admin Client
 * Step 0.5: Supabase bootstrap artifacts
 * 
 * Server-side Supabase client using the service role key.
 * SECURITY: This client bypasses RLS - use only for privileged operations!
 * 
 * NEVER import this in client components or expose the service role key.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/types/database'

/**
 * Create a Supabase admin client with service role privileges.
 * This bypasses Row Level Security - use with extreme caution!
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase admin credentials. ' +
      'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
    )
  }

  return createSupabaseClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Validate that the current context allows admin operations.
 * Call this before using the admin client for extra safety.
 */
export function validateAdminContext(): void {
  // Ensure we're running on the server
  if (typeof window !== 'undefined') {
    throw new Error('Admin client cannot be used in browser context')
  }

  // Ensure service role key is available
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }
}
