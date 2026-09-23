import { harvestGetAnalytics, harvestGetAnalyticsFields, harvestGetAllFields } from '@/lib/harvest/client'
import { enrichHarvestFieldsWithStats } from '@/lib/harvest/field-metrics'
import { harvestAnalyticsModesToTry } from '@/lib/harvest/mode-resolve'
import { mergeHarvestFieldsWithAnalytics } from '@/lib/harvest/merge-fields'
import { normalizeAnalyticsResponse, normalizePaginatedFieldsResponse } from '@/lib/harvest/normalize'
import type { HarvestAnalyticsField, HarvestMode, HarvestPaginatedFieldsResponse } from '@/lib/harvest/types'

const ANALYTICS_PAGE_SIZE = 100

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

function metricCount(field: HarvestAnalyticsField) {
  return Object.values(field.metrics || {}).filter((value) => Number.isFinite(value)).length
}

function dedupeAnalyticsFields(fields: HarvestAnalyticsField[]) {
  const byParcel = new Map<string, HarvestAnalyticsField>()
  for (const field of fields) {
    const current = byParcel.get(field.parcel_id)
    if (!current || metricCount(field) >= metricCount(current)) {
      byParcel.set(field.parcel_id, field)
    }
  }
  return Array.from(byParcel.values())
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

async function loadAnalyticsFieldPages(mode: HarvestMode): Promise<HarvestAnalyticsField[]> {
  const firstRaw = await harvestGetAnalyticsFields({
    mode,
    page: '1',
    perpage: String(ANALYTICS_PAGE_SIZE),
    sort: 'name',
    order: 'asc',
  })
  const first = normalizePaginatedFieldsResponse(firstRaw)
  const results = [...first.results]
  const pageCount = Math.max(1, Math.ceil(first.total / ANALYTICS_PAGE_SIZE))

  for (let page = 2; page <= pageCount; page += 1) {
    const nextRaw = await harvestGetAnalyticsFields({
      mode,
      page: String(page),
      perpage: String(ANALYTICS_PAGE_SIZE),
      sort: 'name',
      order: 'asc',
    })
    results.push(...normalizePaginatedFieldsResponse(nextRaw).results)
  }

  return results
}

export async function loadHarvestAnalyticsFields(
  mode: HarvestMode
): Promise<HarvestPaginatedFieldsResponse> {
  for (const analyticsMode of harvestAnalyticsModesToTry(mode)) {
    const collected: HarvestAnalyticsField[] = []

    try {
      const summary = normalizeAnalyticsResponse(await harvestGetAnalytics({ mode: analyticsMode }))
      collected.push(...summary.fields)
    } catch {
      // summary is optional when the paginated table is available
    }

    try {
      collected.push(...(await loadAnalyticsFieldPages(analyticsMode)))
    } catch {
      // try the next mode when this analytics table cannot be read
    }

    const results = dedupeAnalyticsFields(collected)
    if (results.length > 0) {
      return { total: results.length, results }
    }
  }

  return { total: 0, results: [] }
}

export async function loadEnrichedHarvestCatalog(mode: HarvestMode) {
  const searchParams = new URLSearchParams({
    sort_by: 'harvest_date',
    sort_dir: 'desc',
  })
  const allFields = await loadHarvestAllFields(searchParams)
  const analyticsFields = await loadHarvestAnalyticsFields(mode)
  const merged = mergeHarvestFieldsWithAnalytics(allFields.results, analyticsFields.results)

  try {
    const results = await enrichHarvestFieldsWithStats(merged, mode)
    return { total: Math.max(allFields.total, results.length), results }
  } catch {
    return { total: Math.max(allFields.total, merged.length), results: merged }
  }
}
