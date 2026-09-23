import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestCreateEntity, harvestGetCrops } from '@/lib/harvest/client'
import { createDemoField, getDemoHarvestCrops } from '@/lib/harvest/demo-data'
import { buildHarvestCreateFieldPayload } from '@/lib/harvest/field-create'
import { computeRingsCentroid, suggestHarvestSeasonDates } from '@/lib/harvest/season-dates'
import { harvestJsonResponse } from '@/lib/harvest/resolve'
import type { LatLngVertex } from '@/lib/harvest/geojson'

async function resolveCropName(cropId: number, demoMode: boolean) {
  const crops = demoMode ? getDemoHarvestCrops() : await harvestGetCrops()
  const crop = crops.find((entry) => entry.id === cropId)
  return crop?.name || 'crop'
}

export async function POST(request: Request) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const rings = Array.isArray(body?.rings)
      ? (body.rings as LatLngVertex[][]).filter((ring) => Array.isArray(ring))
      : Array.isArray(body?.vertices) && body.vertices.length >= 3
        ? [body.vertices as LatLngVertex[]]
        : []

    const cropId = typeof body?.crop_id === 'number' ? body.crop_id : Number(body?.crop_id)
    const cropName = await resolveCropName(cropId, access.demoMode)
    const suggestedStartDate = suggestHarvestSeasonDates({
      cropName,
      location: computeRingsCentroid(rings),
    }).start_date

    const payload = buildHarvestCreateFieldPayload({
      name: typeof body?.name === 'string' ? body.name : '',
      crop_id: cropId,
      start_date: suggestedStartDate,
      harvest_date: typeof body?.harvest_date === 'string' ? body.harvest_date : '',
      rings,
    })

    if (access.demoMode) {
      const created = createDemoField({
        name: payload.name,
        cropId: payload.crop_id,
        startDate: payload.start_date,
        harvestDate: payload.harvest_date,
        rings,
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
