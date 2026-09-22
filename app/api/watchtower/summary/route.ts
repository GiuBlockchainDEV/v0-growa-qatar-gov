import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseWatchtowerTimeframe } from '@/lib/domain/timeframes'
import { buildWatchtowerSummary } from '@/lib/watchtower/build-summary'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const timeframe = parseWatchtowerTimeframe(searchParams.get('timeframe') || searchParams.get('timeRange'))

  const startedAt = Date.now()

  try {
    const summary = await buildWatchtowerSummary(timeframe)
    const durationMs = Date.now() - startedAt

    if (durationMs > 5000) {
      console.warn('[watchtower] slow aggregation', { durationMs, timeframe, userId: user.id })
    }

    return NextResponse.json(summary, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        'X-Watchtower-Duration-Ms': String(durationMs),
      },
    })
  } catch (error) {
    console.error('[watchtower] aggregation failed', {
      error: error instanceof Error ? error.message : 'unknown',
      userId: user.id,
    })

    return NextResponse.json(
      {
        error: 'Failed to generate watchtower summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
