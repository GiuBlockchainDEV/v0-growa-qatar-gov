import type { WatchtowerRawData } from '@/lib/watchtower/fetch-context-data'

export interface HarvestProductionSnapshot {
  forecastBiomassTons: number | null
  fieldCount: number
  cropCount: number
  avgBwp: number | null
  lowHealthPolygonCount: number
  avgPolygonScore: number | null
}

export function buildHarvestProductionSnapshot(data: WatchtowerRawData): HarvestProductionSnapshot {
  const forecastBiomassTons = data.harvestFields.reduce((sum, field) => sum + (field.metrics?.tbp ?? 0), 0)
  const crops = new Set(data.harvestFields.map((field) => field.crop).filter(Boolean))
  const bwpValues = data.harvestFields
    .map((field) => field.metrics?.bwp)
    .filter((value): value is number => typeof value === 'number' && value > 0)
  const avgBwp =
    bwpValues.length > 0 ? bwpValues.reduce((sum, value) => sum + value, 0) / bwpValues.length : null
  const lowHealthPolygonCount = data.polygons.filter((polygon) => polygon.score < 50).length
  const avgPolygonScore =
    data.polygons.length > 0
      ? data.polygons.reduce((sum, polygon) => sum + polygon.score, 0) / data.polygons.length
      : null

  return {
    forecastBiomassTons: forecastBiomassTons > 0 ? forecastBiomassTons : null,
    fieldCount: data.harvestFields.length,
    cropCount: crops.size,
    avgBwp,
    lowHealthPolygonCount,
    avgPolygonScore,
  }
}

export function humanizeMetricSource(source: string): string {
  const labels: Record<string, string> = {
    'operations.farm_crop_insights': 'Operational crop insights',
    'harvest.analytics.predict': 'Harvest forecast model',
    'harvest.analytics': 'Harvest analytics',
    'watchtower.signals': 'Active signals',
    'weather.api': 'Weather monitoring',
    'supply_overview_snapshots': 'Supply contracts',
  }
  return labels[source] || source.replace(/\./g, ' · ')
}
