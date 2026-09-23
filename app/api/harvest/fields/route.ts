import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetAnalyticsFields } from '@/lib/harvest/client'
import { getDemoAnalyticsFields } from '@/lib/harvest/demo-data'
import { enrichHarvestFieldsWithStats } from '@/lib/harvest/field-metrics'
import { loadHarvestAllFields, loadHarvestAnalyticsFields } from '@/lib/harvest/fields-load'
import { mergeHarvestFieldsWithAnalytics } from '@/lib/harvest/merge-fields'
import { normalizePaginatedFieldsResponse } from '@/lib/harvest/normalize'
import { harvestJsonResponse, resolveHarvestPayload } from '@/lib/harvest/resolve'
import type { HarvestMode } from '@/lib/harvest/types'

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

        const allFields = await loadHarvestAllFields(searchParams)
        const analyticsFields = await loadHarvestAnalyticsFields(mode)
        const merged = mergeHarvestFieldsWithAnalytics(allFields.results, analyticsFields.results)

        try {
          const enriched = await enrichHarvestFieldsWithStats(merged, mode)
          return {
            total: Math.max(allFields.total, enriched.length),
            results: enriched,
          }
        } catch {
          return {
            total: Math.max(allFields.total, merged.length),
            results: merged,
          }
        }
      },
      fetchDemo: () => getDemoAnalyticsFields(mode),
    })

    return harvestJsonResponse(payload, usedDemo)
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
