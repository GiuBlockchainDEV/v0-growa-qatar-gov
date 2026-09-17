import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetParcel } from '@/lib/harvest/client'
import { getDemoParcelGeojson } from '@/lib/harvest/demo-data'
import { withDemoHeaders } from '@/lib/harvest/resolve'

interface RouteContext {
  params: Promise<{ parcelId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  const { parcelId } = await context.params
  if (!parcelId) {
    return NextResponse.json({ error: 'parcelId is required' }, { status: 400 })
  }

  if (access.demoMode) {
    const payload = getDemoParcelGeojson(parcelId)
    if (!payload) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 })
    }
    return withDemoHeaders(
      NextResponse.json(payload, {
        headers: { 'Cache-Control': 'no-store' },
      }),
      true
    )
  }

  try {
    const payload = await harvestGetParcel(parcelId)
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    const demoPayload = getDemoParcelGeojson(parcelId)
    if (demoPayload) {
      return withDemoHeaders(
        NextResponse.json(demoPayload, {
          headers: { 'Cache-Control': 'no-store' },
        }),
        true
      )
    }
    return harvestErrorResponse(error)
  }
}
