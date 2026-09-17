import type { HarvestMode, HarvestTrendGranularity } from '@/lib/harvest/types'

/**
 * Harvest API rule: dekad data always lives under `current` mode.
 * Season overlays can use `current` or `predict` depending on user selection.
 */
export function resolveHarvestDataMode(
  mode: HarvestMode,
  granularity: HarvestTrendGranularity
): HarvestMode {
  return granularity === 'dekad' ? 'current' : mode
}

export function harvestStatsModesToTry(mode: HarvestMode): HarvestMode[] {
  if (mode === 'predict') return ['current', 'predict']
  return ['current']
}
