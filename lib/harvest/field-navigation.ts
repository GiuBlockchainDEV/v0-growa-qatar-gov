import type { HarvestAnalyticsField, HarvestMapField, HarvestMode } from '@/lib/harvest/types'

export type HarvestFieldNavTarget = Pick<HarvestAnalyticsField, 'parcel_id' | 'season_id'> | HarvestMapField

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
  params.set('module', 'harvest')
  params.set('parcelId', field.parcel_id)
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

  return params
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
