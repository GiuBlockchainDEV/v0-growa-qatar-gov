import type { HarvestMode, HarvestTrendGranularity } from '@/lib/harvest/types'

/** Raster API uses the selected mode (`current` or `predict`) for both season and dekad. */
export function resolveHarvestDataMode(
  mode: HarvestMode,
  _granularity: HarvestTrendGranularity
): HarvestMode {
  return mode
}

export function harvestStatsModesToTry(mode: HarvestMode): HarvestMode[] {
  if (mode === 'predict') return ['current', 'predict']
  return ['current']
}

export function harvestRasterModesToTry(
  mode: HarvestMode,
  granularity: HarvestTrendGranularity = 'season'
): HarvestMode[] {
  if (granularity === 'dekad') return mode === 'current' ? ['current'] : ['current', 'predict']
  return mode === 'predict' ? ['predict', 'current'] : ['current']
}

export function harvestAnalyticsModesToTry(mode: HarvestMode): HarvestMode[] {
  if (mode === 'predict') return ['predict', 'current']
  return ['current']
}
