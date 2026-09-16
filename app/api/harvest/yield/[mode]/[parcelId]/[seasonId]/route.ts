import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestTriggerYield } from '@/lib/harvest/client'

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

  try {
    const payload = await harvestTriggerYield(mode, parcelId, seasonId)
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
