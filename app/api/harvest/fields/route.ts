import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetAnalyticsFields, harvestGetAllFields } from '@/lib/harvest/client'
import { getDemoAnalyticsFields } from '@/lib/harvest/demo-data'
import { enrichHarvestFieldsWithStats } from '@/lib/harvest/field-metrics'
import { mergeHarvestFieldsWithAnalytics } from '@/lib/harvest/merge-fields'
import { harvestAnalyticsModesToTry } from '@/lib/harvest/mode-resolve'
import { normalizePaginatedFieldsResponse } from '@/lib/harvest/normalize'
import { harvestJsonResponse, resolveHarvestPayload } from '@/lib/harvest/resolve'
import type { HarvestMode } from '@/lib/harvest/types'

async function loadAnalyticsFields(mode: HarvestMode) {
  let lastError: unknown = null

  for (const analyticsMode of harvestAnalyticsModesToTry(mode)) {
    try {
      const analyticsFieldsRaw = await harvestGetAnalyticsFields({
        mode: analyticsMode,
        page: '1',
        perpage: '500',
        sort: 'name',
        order: 'asc',
      })
      const analyticsFields = normalizePaginatedFieldsResponse(analyticsFieldsRaw)
      if (analyticsFields.results.length > 0) {
        return analyticsFields
      }
    } catch (error) {
      lastError = error
    }
  }

  if (lastError) throw lastError
  return { total: 0, results: [] }
}

export async function GET(request: Request) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source') || 'all'
  const mode = (searchParams.get('mode') || 'current') as HarvestMode

  try {
    const { payload, usedDemo } = await resolveHarvestPayload({
      demoMode: access.demoMode,
      fetchLive: async () => {
        if (source !== 'all') {
          return normalizePaginatedFieldsResponse(
            await harvestGetAnalyticsFields({
              mode,
              crop_id: searchParams.get('crop_id') || undefined,
              start_date: searchParams.get('start_date') || undefined,
              end_date: searchParams.get('end_date') || undefined,
              page: searchParams.get('page') || '1',
              perpage: searchParams.get('perpage') || '20',
              sort: searchParams.get('sort') || 'name',
              order: searchParams.get('order') || 'asc',
            })
          )
        }

        const [allFieldsRaw, analyticsFields] = await Promise.all([
          harvestGetAllFields({
            name: searchParams.get('name') || undefined,
            crop_id: searchParams.get('crop_id') || undefined,
            start_date: searchParams.get('start_date') || undefined,
            harvest_date: searchParams.get('harvest_date') || undefined,
            sort_by: searchParams.get('sort_by') || undefined,
            sort_dir: searchParams.get('sort_dir') || undefined,
          }),
          loadAnalyticsFields(mode),
        ])

        const allFields = normalizePaginatedFieldsResponse(allFieldsRaw)
        const merged = mergeHarvestFieldsWithAnalytics(allFields.results, analyticsFields.results)
        const enriched = await enrichHarvestFieldsWithStats(merged, mode)

        return {
          total: allFields.total,
          results: enriched,
        }
      },
      fetchDemo: () => getDemoAnalyticsFields(mode),
      validateLive: (data) => data.results.length > 0,
    })

    return harvestJsonResponse(payload, usedDemo)
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
