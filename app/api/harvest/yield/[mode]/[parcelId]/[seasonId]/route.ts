import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { withDemoHeaders } from '@/lib/harvest/resolve'
import { harvestTriggerYield } from '@/lib/harvest/client'
import { getDemoYieldTask } from '@/lib/harvest/demo-data'
import type { HarvestMode } from '@/lib/harvest/types'

interface RouteContext {
  params: Promise<{ mode: string; parcelId: string; seasonId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  const { mode, parcelId, seasonId } = await context.params
  if (!mode || !parcelId || !seasonId) {
    return NextResponse.json({ error: 'mode, parcelId and seasonId are required' }, { status: 400 })
  }

  if (access.demoMode) {
    const { trigger } = getDemoYieldTask(mode as HarvestMode, parcelId, seasonId)
    return withDemoHeaders(
      NextResponse.json(trigger, {
        headers: { 'Cache-Control': 'no-store' },
      }),
      true
    )
  }

  try {
    const payload = await harvestTriggerYield(mode, parcelId, seasonId)
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
