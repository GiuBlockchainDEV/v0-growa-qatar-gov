import { harvestGetAnalyticsFields, harvestGetAllFields } from '@/lib/harvest/client'
import { harvestAnalyticsModesToTry } from '@/lib/harvest/mode-resolve'
import { normalizePaginatedFieldsResponse } from '@/lib/harvest/normalize'
import type { HarvestAnalyticsField, HarvestMode, HarvestPaginatedFieldsResponse } from '@/lib/harvest/types'

function isHarvest422(error: unknown) {
  return error instanceof Error && error.message.includes('HARVEST_REQUEST_FAILED:422')
}

export function sortCatalogFieldsByHarvestDate(fields: HarvestAnalyticsField[]) {
  return [...fields].sort((left, right) => {
    const leftDate = left.harvest_date || ''
    const rightDate = right.harvest_date || ''
    if (leftDate === rightDate) return left.name.localeCompare(right.name)
    return rightDate.localeCompare(leftDate)
  })
}

export async function loadHarvestAllFields(
  searchParams: URLSearchParams
): Promise<HarvestPaginatedFieldsResponse> {
  const withSort = {
    name: searchParams.get('name') || undefined,
    crop_id: searchParams.get('crop_id') || undefined,
    start_date: searchParams.get('start_date') || undefined,
    harvest_date: searchParams.get('harvest_date') || undefined,
    sort_by: searchParams.get('sort_by') || undefined,
    sort_dir: searchParams.get('sort_dir') || undefined,
  }

  try {
    return normalizePaginatedFieldsResponse(await harvestGetAllFields(withSort))
  } catch (error) {
    if (!isHarvest422(error) || !withSort.sort_by) throw error
  }

  const withoutSort = {
    name: withSort.name,
    crop_id: withSort.crop_id,
    start_date: withSort.start_date,
    harvest_date: withSort.harvest_date,
  }

  const payload = normalizePaginatedFieldsResponse(await harvestGetAllFields(withoutSort))
  return {
    total: payload.total,
    results: sortCatalogFieldsByHarvestDate(payload.results),
  }
}

export async function loadHarvestAnalyticsFields(
  mode: HarvestMode
): Promise<HarvestPaginatedFieldsResponse> {
  const perPageOptions = ['100', '50', '20']

  for (const analyticsMode of harvestAnalyticsModesToTry(mode)) {
    for (const perpage of perPageOptions) {
      try {
        const analyticsFieldsRaw = await harvestGetAnalyticsFields({
          mode: analyticsMode,
          page: '1',
          perpage,
          sort: 'name',
          order: 'asc',
        })
        const analyticsFields = normalizePaginatedFieldsResponse(analyticsFieldsRaw)
        if (analyticsFields.results.length > 0) {
          return analyticsFields
        }
      } catch {
        // try next mode/page size
      }
    }
  }

  return { total: 0, results: [] }
}
