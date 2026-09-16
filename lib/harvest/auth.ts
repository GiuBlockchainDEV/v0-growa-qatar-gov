import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isHarvestConfigured, missingHarvestConfigPayload } from '@/lib/harvest/config'

export async function requireHarvestAccess() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  if (!isHarvestConfigured()) {
    return {
      ok: false as const,
      response: NextResponse.json(missingHarvestConfigPayload(), { status: 503 }),
    }
  }

  return {
    ok: true as const,
    user,
  }
}

export function harvestErrorResponse(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'HARVEST_NOT_CONFIGURED') {
      return NextResponse.json(missingHarvestConfigPayload(), { status: 503 })
    }

    if (error.message.startsWith('HARVEST_LOGIN_FAILED')) {
      return NextResponse.json(
        {
          error: 'Unable to authenticate with Harvest API',
          details: error.message,
        },
        { status: 502 }
      )
    }

    if (error.message.startsWith('HARVEST_REQUEST_FAILED')) {
      const [, status, ...rest] = error.message.split(':')
      const upstreamStatus = Number(status) || 502
      return NextResponse.json(
        {
          error: 'Harvest API request failed',
          status: upstreamStatus,
          details: rest.join(':') || error.message,
        },
        { status: upstreamStatus >= 400 && upstreamStatus < 600 ? upstreamStatus : 502 }
      )
    }
  }

  return NextResponse.json(
    {
      error: 'Unable to reach Harvest API',
      details: error instanceof Error ? error.message : 'Unknown upstream error',
    },
    { status: 502 }
  )
}
