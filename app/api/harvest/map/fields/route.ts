import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetAllFields, harvestGetParcel } from '@/lib/harvest/client'
import { getDemoAnalyticsFields, getDemoMapFields } from '@/lib/harvest/demo-data'
import { geoJsonToHarvestFieldPolygon } from '@/lib/harvest/geojson'
import { normalizePaginatedFieldsResponse } from '@/lib/harvest/normalize'
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
    return getDemoMapFields().find((entry) => entry.parcel_id === field.parcel_id) || null
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
      fetchLive: async () =>
        normalizePaginatedFieldsResponse(
          await harvestGetAllFields({
            sort_by: searchParams.get('sort_by') || 'harvest_date',
            sort_dir: searchParams.get('sort_dir') || 'desc',
          })
        ),
      fetchDemo: () => getDemoAnalyticsFields(mode),
      validateLive: (data) => data.results.length > 0,
    })

    if (usedDemo) {
      return harvestJsonResponse({ fields: getDemoMapFields() }, true)
    }

    const fields = (
      await Promise.all(fieldsPayload.results.map((field) => loadLiveFieldPolygon(field)))
    ).filter((field): field is HarvestMapField => Boolean(field))

    if (fields.length === 0) {
      return harvestJsonResponse({ fields: getDemoMapFields() }, true)
    }

    return harvestJsonResponse({ fields }, false)
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
