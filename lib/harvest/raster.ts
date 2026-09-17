import type { HarvestMetricKey } from '@/lib/harvest/types'
import { boundsFromRings, type LatLngVertex } from '@/lib/harvest/geojson'

export interface HarvestRasterMeta {
  bounds: [[number, number], [number, number]]
  vmin: number
  vmax: number
  unit: string
  legend: Array<{ color: string; label: string }>
}

const METRIC_COLORS: Record<HarvestMetricKey, string> = {
  aeti: '#38bdf8',
  npp: '#22c55e',
  tbp: '#f59e0b',
  bwp: '#a78bfa',
  rwd: '#f97316',
  wcu: '#06b6d4',
  cost: '#eab308',
}

const METRIC_UNITS: Record<HarvestMetricKey, string> = {
  aeti: 'm³',
  npp: 'gC/m²',
  tbp: 't',
  bwp: 'kg/m³',
  rwd: 'index',
  wcu: '%',
  cost: 'QAR',
}

export function buildDemoRasterMeta(metric: HarvestMetricKey, rings: LatLngVertex[][]): HarvestRasterMeta {
  const color = METRIC_COLORS[metric]
  return {
    bounds: boundsFromRings(rings),
    vmin: 0,
    vmax: 100,
    unit: METRIC_UNITS[metric],
    legend: [
      { color: '#0f172a', label: 'Low' },
      { color: color, label: 'Medium' },
      { color: '#f8fafc', label: 'High' },
    ],
  }
}

export function buildDemoRasterSvg(metric: HarvestMetricKey, fieldName: string) {
  const color = METRIC_COLORS[metric]
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
      <defs>
        <linearGradient id="heat" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="45%" stop-color="${color}" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#f8fafc" />
        </linearGradient>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
        </pattern>
      </defs>
      <rect width="640" height="420" fill="url(#heat)" />
      <rect width="640" height="420" fill="url(#grid)" />
      <rect x="18" y="18" width="220" height="54" rx="10" fill="rgba(7,10,16,0.72)" />
      <text x="32" y="42" fill="#f8fafc" font-family="system-ui" font-size="14" font-weight="600">${fieldName}</text>
      <text x="32" y="62" fill="#94a3b8" font-family="system-ui" font-size="12">${metric.toUpperCase()} field raster</text>
    </svg>
  `.trim()

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
