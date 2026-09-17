import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetAnalyticsFields, harvestGetAllFields } from '@/lib/harvest/client'
import { getDemoAnalyticsFields } from '@/lib/harvest/demo-data'
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

        const [allFieldsRaw, analyticsFieldsRaw] = await Promise.all([
          harvestGetAllFields({
            name: searchParams.get('name') || undefined,
            crop_id: searchParams.get('crop_id') || undefined,
            start_date: searchParams.get('start_date') || undefined,
            harvest_date: searchParams.get('harvest_date') || undefined,
            sort_by: searchParams.get('sort_by') || undefined,
            sort_dir: searchParams.get('sort_dir') || undefined,
          }),
          harvestGetAnalyticsFields({
            mode,
            page: '1',
            perpage: '500',
            sort: 'name',
            order: 'asc',
          }).catch(() => ({ results: [] })),
        ])

        const allFields = normalizePaginatedFieldsResponse(allFieldsRaw)
        const analyticsFields = normalizePaginatedFieldsResponse(analyticsFieldsRaw)

        return {
          total: allFields.total,
          results: mergeHarvestFieldsWithAnalytics(allFields.results, analyticsFields.results),
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
