interface PolygonMetrics {
  estimatedProductionTons: number
  energyConsumptionKwh: number
  waterConsumptionM3: number
}

/*
 * Five-step performance ramp in the Growa palette (good → critical).
 * It classifies OUR scores and intensity ratios, so it follows the brand;
 * scientific rasters (NDVI, harvest, weather) keep their conventional ramps.
 *   good      sage-400    #87A16C  (brand sage, lifted to read on imagery)
 *   fair      cream-500   #CDD994  (derived)
 *   attention ochre       #C9A227  (derived, "warning")
 *   high      terracotta  #B4644A  (derived)
 *   critical  system red  #A8392B  (derived)
 */
export const PERFORMANCE_RAMP = ['#87A16C', '#CDD994', '#C9A227', '#B4644A', '#A8392B'] as const

/** Brand values for things drawn on the map (Leaflet takes literal colours). */
export const MAP_COLORS = {
  ink: '#111E13',
  cream: '#EEF4C9',
  white: '#FFFFFF',
  sage: '#6C8952',
  sage300: '#A2B78C',
  stone300: '#CBD0C5',
  stone500: '#8C9388',
  unknown: '#8C9388',
} as const

export function scoreToHeatColor(score: number): string {
  if (score >= 75) return PERFORMANCE_RAMP[0]
  if (score >= 55) return PERFORMANCE_RAMP[1]
  if (score >= 40) return PERFORMANCE_RAMP[2]
  if (score >= 25) return PERFORMANCE_RAMP[3]
  return PERFORMANCE_RAMP[4]
}

export function intensityToHeatColor(value: number, baseline: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline <= 0) return MAP_COLORS.unknown
  const ratio = value / baseline
  if (ratio <= 0.85) return PERFORMANCE_RAMP[0]
  if (ratio <= 1.1) return PERFORMANCE_RAMP[1]
  if (ratio <= 1.35) return PERFORMANCE_RAMP[2]
  if (ratio <= 1.7) return PERFORMANCE_RAMP[3]
  return PERFORMANCE_RAMP[4]
}

/** Continuous version of the ramp for 0–100 scores (0 = critical, 100 = good). */
export function scoreToRampColor(score: number): string {
  const t = Math.max(0, Math.min(100, score)) / 100
  const stops = [...PERFORMANCE_RAMP].reverse() // critical … good
  const pos = t * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(pos))
  const f = pos - i
  const a = hexToRgb(stops[i])
  const b = hexToRgb(stops[i + 1])
  const mix = (x: number, y: number) => Math.round(x + (y - x) * f)
  return `rgb(${mix(a[0], b[0])}, ${mix(a[1], b[1])}, ${mix(a[2], b[2])})`
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
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

/* Severity in the app's scale (see globals.css, "SEVERITY SCALE"). */
export const SIGNAL_SEVERITY_COLORS: Record<string, string> = {
  critical: '#A8392B',
  high: '#B4644A',
  attention: '#C9A227',
  info: '#8C9388',
}
