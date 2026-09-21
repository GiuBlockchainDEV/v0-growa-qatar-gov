import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetParcel } from '@/lib/harvest/client'
import { loadHarvestAllFields } from '@/lib/harvest/fields-load'
import { getDemoAnalyticsFields, getDemoMapFields } from '@/lib/harvest/demo-data'
import { geoJsonToHarvestFieldPolygon } from '@/lib/harvest/geojson'
import { harvestJsonResponse, resolveHarvestPayload } from '@/lib/harvest/resolve'
import type { HarvestMapField, HarvestMode } from '@/lib/harvest/types'

async function loadLiveFieldPolygon(field: {
  parcel_id: string
  season_id?: number
  name: string
  crop: string
}): Promise<HarvestMapField | null> {
  try {
    const payload = await harvestGetParcel(field.parcel_id)
    const polygon = geoJsonToHarvestFieldPolygon(payload?.geojson, field)
    if (!polygon) return null
    return {
      ...polygon,
      season_id: field.season_id,
    }
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const mode = (searchParams.get('mode') || 'current') as HarvestMode

  try {
    const { payload: fieldsPayload, usedDemo } = await resolveHarvestPayload({
      demoMode: access.demoMode,
      fetchLive: async () => loadHarvestAllFields(searchParams),
      fetchDemo: () => getDemoAnalyticsFields(mode),
    })

    if (usedDemo) {
      return harvestJsonResponse({ fields: getDemoMapFields() }, true)
    }

    const fields = (
      await Promise.all(fieldsPayload.results.map((field) => loadLiveFieldPolygon(field)))
    ).filter((field): field is HarvestMapField => Boolean(field))

    return harvestJsonResponse({ fields }, false)
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
