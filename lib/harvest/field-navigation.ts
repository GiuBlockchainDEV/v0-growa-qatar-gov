import type { HarvestAnalyticsField, HarvestMapField, HarvestMode } from '@/lib/harvest/types'

export type HarvestFieldNavTarget = Pick<HarvestAnalyticsField, 'parcel_id' | 'season_id'> | HarvestMapField

export function resolveHarvestParcelId(field: HarvestFieldNavTarget): string | null {
  const parcelId = field.parcel_id?.trim()
  if (!parcelId) return null
  return parcelId
}

export function defaultHarvestFieldNavOptions(
  mode: HarvestMode,
  harvestMetric?: string | null
) {
  return {
    mode,
    harvestMetric: harvestMetric || 'npp',
    harvestGranularity: 'season',
    preserveDekadPeriod: false,
  }
}

export function applyHarvestFieldSelectionToParams(
  params: URLSearchParams,
  field: HarvestFieldNavTarget,
  options?: {
    mode?: HarvestMode
    harvestMetric?: string | null
    harvestGranularity?: string | null
    preserveDekadPeriod?: boolean
  }
) {
  const parcelId = resolveHarvestParcelId(field)
  if (!parcelId) return params

  if (!params.get('module')) {
    params.set('module', 'harvest')
  }
  params.set('parcelId', parcelId)
  params.set('zoom', '13')
  params.set('focus', `harvest-${field.parcel_id}`)
  params.set('harvestMetric', options?.harvestMetric || 'npp')
  params.set('harvestGranularity', options?.harvestGranularity || 'season')

  if (options?.mode) {
    params.set('harvestMode', options.mode)
  }

  if (field.season_id) {
    params.set('harvestSeasonId', String(field.season_id))
  } else {
    params.delete('harvestSeasonId')
  }

  const granularity = options?.harvestGranularity || 'season'
  if (granularity !== 'dekad' || !options?.preserveDekadPeriod) {
    params.delete('harvestPeriod')
  }

  params.delete('pointId')
  params.delete('farmId')
  params.delete('crop')
  params.delete('harvestCreate')
  params.delete('harvestDraw')

  return params
}

export const HARVEST_NATIONAL_DASHBOARD_PATH = '/dashboard?module=harvest'

export function buildHarvestNationalDashboardUrl(mode?: HarvestMode) {
  const params = new URLSearchParams()
  params.set('module', 'harvest')
  if (mode === 'predict') {
    params.set('harvestMode', 'predict')
  }
  return `/dashboard?${params.toString()}`
}

export function buildHarvestCreateDashboardUrl(
  drawMethod: 'vertex' | 'circle' = 'vertex',
  mode?: HarvestMode
) {
  const params = new URLSearchParams()
  params.set('module', 'harvest')
  params.set('harvestCreate', '1')
  params.set('harvestDraw', drawMethod)
  if (mode === 'predict') {
    params.set('harvestMode', 'predict')
  }
  return `/dashboard?${params.toString()}`
}

export function buildHarvestFieldDashboardUrl(
  currentParams: URLSearchParams,
  field: HarvestFieldNavTarget,
  options?: {
    mode?: HarvestMode
    harvestMetric?: string | null
    harvestGranularity?: string | null
    preserveDekadPeriod?: boolean
  }
) {
  const params = new URLSearchParams(currentParams.toString())
  applyHarvestFieldSelectionToParams(params, field, options)
  return `/dashboard?${params.toString()}`
}
