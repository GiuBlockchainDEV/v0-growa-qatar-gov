import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse, withDemoHeaders } from '@/lib/harvest/auth'
import { harvestGetEntity } from '@/lib/harvest/client'
import { getDemoEntity } from '@/lib/harvest/demo-data'

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
    const payload = getDemoEntity(parcelId)
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
    const payload = await harvestGetEntity(parcelId)
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
