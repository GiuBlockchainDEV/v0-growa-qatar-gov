import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetAnalyticsFields, harvestGetParcel } from '@/lib/harvest/client'
import { getDemoAnalyticsFields, getDemoMapFields } from '@/lib/harvest/demo-data'
import { geoJsonToHarvestFieldPolygon } from '@/lib/harvest/geojson'
import { normalizePaginatedFieldsResponse } from '@/lib/harvest/normalize'
import { harvestJsonResponse, resolveHarvestPayload } from '@/lib/harvest/resolve'
import type { HarvestMapField, HarvestMode } from '@/lib/harvest/types'

async function loadLiveFieldPolygon(field: {
  parcel_id: string
  name: string
  crop: string
}): Promise<HarvestMapField | null> {
  try {
    const payload = await harvestGetParcel(field.parcel_id)
    return geoJsonToHarvestFieldPolygon(payload?.geojson, field)
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
          await harvestGetAnalyticsFields({
            mode,
            page: searchParams.get('page') || '1',
            perpage: searchParams.get('perpage') || '50',
            sort: searchParams.get('sort') || 'name',
            order: searchParams.get('order') || 'asc',
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
