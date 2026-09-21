import type { HarvestMetricKey } from '@/lib/harvest/types'

export const HARVEST_METRIC_META: Record<
  HarvestMetricKey,
  { label: string; shortLabel: string; unit: string }
> = {
  aeti: { label: 'Water Consumption (AETI)', shortLabel: 'AETI', unit: 'm³' },
  npp: { label: 'Net Primary Production', shortLabel: 'NPP', unit: 'gC/m²' },
  tbp: { label: 'Total Biomass Product', shortLabel: 'TBP', unit: 't' },
  bwp: { label: 'Biomass Water Productivity', shortLabel: 'BWP', unit: 'kg/m³' },
  rwd: { label: 'Relative Water Deficit', shortLabel: 'RWD', unit: 'index' },
  wcu: { label: 'Water Consumption Uniformity', shortLabel: 'WCU', unit: '%' },
  cost: { label: 'Irrigation Cost', shortLabel: 'Cost', unit: 'QAR' },
}

function formatHarvestMetricNumber(
  value: number,
  key: HarvestMetricKey,
  options?: { agg?: 'sum' | 'mean' }
) {
  if (key === 'cost') {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  }

  if (key === 'wcu') {
    return value.toFixed(1)
  }

  if (key === 'bwp' || key === 'rwd' || options?.agg === 'mean') {
    return value.toFixed(2)
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

export function formatHarvestMetricValue(
  value: number | undefined,
  key: HarvestMetricKey,
  options?: { agg?: 'sum' | 'mean' }
) {
  if (value === undefined || !Number.isFinite(value)) return '—'
  return formatHarvestMetricNumber(value, key, options)
}

export function formatHarvestMetricWithUnit(
  value: number | undefined,
  key: HarvestMetricKey,
  options?: { agg?: 'sum' | 'mean' }
) {
  if (value === undefined || !Number.isFinite(value)) return '—'

  const formatted = formatHarvestMetricNumber(value, key, options)
  const unit = HARVEST_METRIC_META[key].unit

  if (key === 'wcu') {
    return `${formatted}%`
  }

  return `${formatted} ${unit}`
}

export function harvestMetricColumnHeader(key: HarvestMetricKey) {
  const meta = HARVEST_METRIC_META[key]
  return `${meta.shortLabel} (${meta.unit})`
}
