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
