interface PolygonMetrics {
  estimatedProductionTons: number
  energyConsumptionKwh: number
  waterConsumptionM3: number
}

export function scoreToHeatColor(score: number): string {
  if (score >= 75) return '#07f880'
  if (score >= 55) return '#84cc16'
  if (score >= 40) return '#f59e0b'
  if (score >= 25) return '#f97316'
  return '#ef4444'
}

export function intensityToHeatColor(value: number, baseline: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline <= 0) return '#64748b'
  const ratio = value / baseline
  if (ratio <= 0.85) return '#07f880'
  if (ratio <= 1.1) return '#84cc16'
  if (ratio <= 1.35) return '#f59e0b'
  if (ratio <= 1.7) return '#f97316'
  return '#ef4444'
}

export function resolvePolygonColor(
  mode: string,
  score: number,
  metrics: PolygonMetrics
): string {
  const production = Math.max(metrics.estimatedProductionTons, 0.001)

  switch (mode) {
    case 'water-demand':
    case 'irrigation-pressure':
      return intensityToHeatColor(metrics.waterConsumptionM3 / production, 2.5)
    case 'energy-intensity':
      return intensityToHeatColor(metrics.energyConsumptionKwh / production, 120)
    case 'production':
      return intensityToHeatColor(metrics.estimatedProductionTons, 25)
    case 'harvest-forecast':
    case 'crop-health':
    case 'crop-type':
      return scoreToHeatColor(score)
    default:
      return scoreToHeatColor(score)
  }
}

export const SIGNAL_SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  attention: '#f59e0b',
  info: '#38bdf8',
}
