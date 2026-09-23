import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { loadCropCalendar } from '@/lib/harvest/crop-calendar'
import { computeRingsCentroid, suggestHarvestSeasonDates } from '@/lib/harvest/season-dates'
import { harvestJsonResponse } from '@/lib/harvest/resolve'
import type { LatLngVertex } from '@/lib/harvest/geojson'

export async function GET() {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  try {
    const calendar = loadCropCalendar()
    return harvestJsonResponse({ calendar }, access.demoMode)
  } catch (error) {
    return harvestErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const cropName = typeof body?.crop_name === 'string' ? body.crop_name : typeof body?.cropName === 'string' ? body.cropName : ''
    const rings = Array.isArray(body?.rings)
      ? (body.rings as LatLngVertex[][]).filter((ring) => Array.isArray(ring))
      : []

    if (!cropName.trim()) {
      return NextResponse.json({ error: 'crop_name is required' }, { status: 400 })
    }

    const suggestion = suggestHarvestSeasonDates({
      cropName,
      location: computeRingsCentroid(rings),
    })

    return harvestJsonResponse(suggestion, access.demoMode)
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
