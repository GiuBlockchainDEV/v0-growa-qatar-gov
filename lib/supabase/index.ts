/**
 * Growa Qatar - Supabase Module
 * Step 0.5: Supabase bootstrap artifacts
 * 
 * Re-exports Supabase client utilities.
 * 
 * Usage:
 * - Browser/Client Components: import { createClient } from '@/lib/supabase/browser'
 * - Server Components/Actions: import { createClient } from '@/lib/supabase/server'
 * - Privileged Operations: import { createAdminClient } from '@/lib/supabase/admin'
 */

// Note: Each client type should be imported from its specific file
// to ensure proper tree-shaking and avoid bundling server code in client.

export type { Database } from '@/supabase/types/database'
