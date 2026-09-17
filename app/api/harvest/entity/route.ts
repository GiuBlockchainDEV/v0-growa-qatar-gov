import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestCreateEntity } from '@/lib/harvest/client'
import { createDemoField } from '@/lib/harvest/demo-data'
import { buildHarvestCreateFieldPayload } from '@/lib/harvest/field-create'
import { harvestJsonResponse } from '@/lib/harvest/resolve'
import type { LatLngVertex } from '@/lib/harvest/geojson'

export async function POST(request: Request) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const vertices = Array.isArray(body?.vertices) ? (body.vertices as LatLngVertex[]) : []

    const payload = buildHarvestCreateFieldPayload({
      name: typeof body?.name === 'string' ? body.name : '',
      crop_id: typeof body?.crop_id === 'number' ? body.crop_id : Number(body?.crop_id),
      start_date: typeof body?.start_date === 'string' ? body.start_date : '',
      harvest_date: typeof body?.harvest_date === 'string' ? body.harvest_date : '',
      vertices,
    })

    if (access.demoMode) {
      const created = createDemoField({
        name: payload.name,
        cropId: payload.crop_id,
        startDate: payload.start_date,
        harvestDate: payload.harvest_date,
        vertices,
      })
      return harvestJsonResponse(created, true)
    }

    const created = await harvestCreateEntity(payload)
    return harvestJsonResponse(created, false)
  } catch (error) {
    if (error instanceof Error && !error.message.startsWith('HARVEST_')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return harvestErrorResponse(error)
  }
}
