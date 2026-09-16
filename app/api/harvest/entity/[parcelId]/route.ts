import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { withDemoHeaders } from '@/lib/harvest/resolve'
import { harvestDeleteEntity, harvestGetEntity } from '@/lib/harvest/client'
import { deleteDemoField, getDemoEntity } from '@/lib/harvest/demo-data'

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

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  const { parcelId } = await context.params
  if (!parcelId) {
    return NextResponse.json({ error: 'parcelId is required' }, { status: 400 })
  }

  if (access.demoMode) {
    deleteDemoField(parcelId)
    return withDemoHeaders(
      NextResponse.json({ ok: true, parcel_id: parcelId }, {
        headers: { 'Cache-Control': 'no-store' },
      }),
      true
    )
  }

  try {
    await harvestDeleteEntity(parcelId)
    return NextResponse.json({ ok: true, parcel_id: parcelId }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
