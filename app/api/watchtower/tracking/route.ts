import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTrackingSnapshot } from '@/lib/watchtower/tracking-providers'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30
const headers = { 'Cache-Control': 'private, no-store, max-age=0' }
export async function GET(request:Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Sign in to access the Watchtower.' }, { status: 401, headers })
    const stage = new URL(request.url).searchParams.get('stage') === 'quick' ? 'quick' : 'full'
    return NextResponse.json(await getTrackingSnapshot(stage), { headers })
  } catch {
    return NextResponse.json({ error: 'Tracking feeds unavailable. Retained observations may be stale.' }, { status: 503, headers })
  }
}
