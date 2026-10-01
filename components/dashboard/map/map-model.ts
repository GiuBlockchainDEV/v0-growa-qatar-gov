/*
 * Satellite map model: types, constants and pure helpers (parsing API rows,
 * polygon geometry, formatting). Moved out of satellite-map.tsx, which is
 * now only the React/Leaflet component; covered by map-model.test.ts.
 */

import type { Map as LeafletMap } from 'leaflet'
import { MAP_COLORS, scoreToRampColor } from '@/lib/watchtower/map-layer-colors'

export type MapPointType = 'farm' | 'facility' | 'sensor' | 'custom'
export type PolygonDrawMethod = 'vertex' | 'rectangle' | 'circle'

export interface MapMarker {
  id: string
  lat: number
  lng: number
  label: string
  type: MapPointType
}

export interface WeatherGridMapPoint {
  id: string
  lat: number
  lng: number
  north?: number
  south?: number
  east?: number
  west?: number
}

export interface WeatherGridLineSegment {
  id: string
  start: { lat: number; lng: number }
  end: { lat: number; lng: number }
}

export interface WeatherBoundaryPoint {
  lat: number
  lng: number
}

export interface HarvestMapField {
  parcel_id: string
  season_id?: number
  name: string
  crop: string
  rings: Array<Array<{ lat: number; lng: number }>>
  centroid: { lat: number; lng: number }
}

export interface OperationsFarmTarget {
  id: string
  label: string
  lat: number
  lng: number
}

export interface SatelliteMapProps {
  locale?: string
  targetPointId?: string | null
  targetFarmId?: string | null
  targetCropFilter?: string | null
  targetFocusToken?: string | null
  targetZoom?: number
  isLateralMode?: boolean
  lateralPanelOpen?: boolean
  onMapClick?: (coords: { lat: number; lng: number }) => void
  weatherGridPoints?: WeatherGridMapPoint[]
  selectedWeatherGridPointId?: string | null
  weatherGridLines?: WeatherGridLineSegment[]
  weatherBoundary?: WeatherBoundaryPoint[]
  onWeatherGridPointClick?: (point: WeatherGridMapPoint) => void
  harvestFields?: HarvestMapField[]
  selectedHarvestParcelId?: string | null
  onHarvestFieldClick?: (field: HarvestMapField) => void
  mapTileUrl?: string | null
  harvestRasterOverlay?: {
    imageUrl: string
    bounds: [[number, number], [number, number]]
    opacity?: number
  } | null
  harvestFocusBounds?: [[number, number], [number, number]] | null
  harvestFieldDrawActive?: boolean
  harvestFieldDrawMethod?: 'vertex' | 'circle'
  harvestFieldRings?: PolygonVertex[][]
  harvestFieldVertices?: PolygonVertex[]
  onHarvestFieldRingsChange?: (rings: PolygonVertex[][]) => void
  onHarvestFieldVerticesChange?: (vertices: PolygonVertex[]) => void
  activeMapLayers?: string[]
}

/** The Leaflet map instance (Leaflet's own type). */
export type MapController = LeafletMap

export interface CustomPoint {
  id: string
  lat: number
  lng: number
  label: string
  pointType: MapPointType
  externalUrl: string
}

export interface PolygonVertex {
  lat: number
  lng: number
}

export interface PolygonCropData {
  cropName: string
  variety: string
  sowingDate: string
  expectedHarvestDate: string
  notes: string
}

export interface PolygonMetricsData {
  estimatedProductionTons: number
  energyConsumptionKwh: number
  waterConsumptionM3: number
}

export interface PointPolygon {
  id: string
  customPointId: string
  name: string
  vertices: PolygonVertex[]
  score: number
  crop: PolygonCropData
  metrics: PolygonMetricsData
  createdAt: string
}

export interface FarmCropInsightApiRow {
  id: string
  custom_point_id?: string | null
  pointId?: string | null
  crop_name?: string | null
  cropName?: string | null
  estimated_production_tons?: number | string | null
  estimatedProductionTons?: number | string | null
  energy_consumption_kwh?: number | string | null
  energyConsumptionKwh?: number | string | null
  water_consumption_m3?: number | string | null
  waterConsumptionM3?: number | string | null
  external_url?: string | null
  externalUrl?: string | null
  created_at?: string | null
  createdAt?: string | null
}

export interface FarmCropInsight {
  id: string
  pointId: string
  cropName: string
  estimatedProductionTons: number
  energyConsumptionKwh: number
  waterConsumptionM3: number
  externalUrl: string
  createdAt: string
}

export type PointPolygonsMap = Record<string, PointPolygon[]>

export const EMPTY_POLYGON_METRICS: PolygonMetricsData = {
  estimatedProductionTons: 0,
  energyConsumptionKwh: 0,
  waterConsumptionM3: 0,
}

export const POINT_TYPE_OPTIONS: Array<{ value: MapPointType; label: string }> = [
  { value: 'custom', label: 'Custom' },
  { value: 'farm', label: 'Farm' },
  { value: 'facility', label: 'Facility' },
  { value: 'sensor', label: 'Sensor' },
]

export const POINT_TYPE_LABELS: Record<MapPointType, string> = {
  custom: 'Custom',
  farm: 'Farm',
  facility: 'Facility',
  sensor: 'Sensor',
}

export const SIGNAL_SEVERITY_LABELS: Record<string, string> = {
  info: 'Info',
  attention: 'Attention',
  high: 'High',
  critical: 'Critical',
}

export const POLYGON_DRAW_METHOD_OPTIONS: Array<{ value: PolygonDrawMethod; label: string }> = [
  { value: 'vertex', label: 'Point by point' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
]

export interface DbCustomPointRow {
  id?: string
  lat?: number | string
  lng?: number | string
  label?: string
  pointType?: string
  point_type?: string
  externalUrl?: string
  external_url?: string
}

export interface CropTypeOption {
  id: string
  code: string
  nameEn: string
  nameAr: string
  varieties: string[]
}

export interface CropTypesApiRow {
  id?: string
  code?: string
  nameEn?: string
  name_en?: string
  nameAr?: string
  name_ar?: string
  varieties?: unknown
}

export function normalizeDbCustomPointRows(rows: unknown): CustomPoint[] {
  if (!Array.isArray(rows)) return []
  return rows
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as DbCustomPointRow
      const id = typeof row.id === 'string' ? row.id.trim() : ''
      const lat =
        typeof row.lat === 'number' ? row.lat : typeof row.lat === 'string' ? Number(row.lat) : Number.NaN
      const lng =
        typeof row.lng === 'number' ? row.lng : typeof row.lng === 'string' ? Number(row.lng) : Number.NaN
      const label = typeof row.label === 'string' ? row.label.trim() : ''
      const externalUrl =
        (typeof row.externalUrl === 'string' && row.externalUrl.trim()) ||
        (typeof row.external_url === 'string' && row.external_url.trim()) ||
        ''
      const rawPointType =
        typeof row.pointType === 'string'
          ? row.pointType
          : typeof row.point_type === 'string'
            ? row.point_type
            : 'custom'
      const normalizedPointType = rawPointType.trim().toLowerCase()
      const pointType: MapPointType = POINT_TYPE_OPTIONS.some((option) => option.value === normalizedPointType)
        ? (normalizedPointType as MapPointType)
        : 'custom'
      if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return {
        id,
        lat,
        lng,
        label: label || 'Custom Point',
        pointType,
        externalUrl,
      } satisfies CustomPoint
    })
    .filter((point): point is CustomPoint => Boolean(point))
}

export function normalizeCropTypeRows(rows: unknown): CropTypeOption[] {
  if (!Array.isArray(rows)) return []
  return rows
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as CropTypesApiRow
      const id = typeof row.id === 'string' ? row.id.trim() : ''
      const code = typeof row.code === 'string' ? row.code.trim() : ''
      const nameEn =
        (typeof row.nameEn === 'string' && row.nameEn.trim()) ||
        (typeof row.name_en === 'string' && row.name_en.trim()) ||
        (typeof (row as Record<string, unknown>).name === 'string' &&
          ((row as Record<string, unknown>).name as string).trim()) ||
        ''
      const nameAr =
        (typeof row.nameAr === 'string' && row.nameAr.trim()) ||
        (typeof row.name_ar === 'string' && row.name_ar.trim()) ||
        ''
      const varieties = Array.isArray(row.varieties)
        ? row.varieties
            .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
            .filter((entry) => Boolean(entry))
        : []
      if (!id || !code || !nameEn) return null
      return { id, code, nameEn, nameAr, varieties } satisfies CropTypeOption
    })
    .filter((row): row is CropTypeOption => Boolean(row))
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function calculatePolygonAreaHectares(vertices: PolygonVertex[]): number {
  if (vertices.length < 3) return 0
  const earthRadiusMeters = 6371008.8
  const toRadians = (value: number) => (value * Math.PI) / 180
  const meanLatRadians =
    vertices.reduce((sum, vertex) => sum + toRadians(vertex.lat), 0) / vertices.length
  const cartesianVertices = vertices.map((vertex) => ({
    x: earthRadiusMeters * toRadians(vertex.lng) * Math.cos(meanLatRadians),
    y: earthRadiusMeters * toRadians(vertex.lat),
  }))

  let doubleArea = 0
  for (let i = 0; i < cartesianVertices.length; i += 1) {
    const current = cartesianVertices[i]
    const next = cartesianVertices[(i + 1) % cartesianVertices.length]
    doubleArea += current.x * next.y - next.x * current.y
  }

  const areaSquareMeters = Math.abs(doubleArea) * 0.5
  return areaSquareMeters / 10000
}

export function formatHectares(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0.00'
  if (value >= 1) return value.toFixed(2)
  if (value >= 0.1) return value.toFixed(3)
  return value.toFixed(4)
}

export function normalizePolygonScore(value: unknown, fallback = 50) {
  const numericValue =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(numericValue)) return fallback
  return Math.min(100, Math.max(0, Math.round(numericValue)))
}

export function scoreToPolygonColor(score: number) {
  const normalized = normalizePolygonScore(score, 50)
  // Scale: 0 -> critical, mid -> ochre, 100 -> good, on the brand ramp
  // (lib/watchtower/map-layer-colors.ts, PERFORMANCE_RAMP).
  return scoreToRampColor(normalized)
}

export function createRectangleVertices(start: PolygonVertex, end: PolygonVertex): PolygonVertex[] {
  const minLat = Math.min(start.lat, end.lat)
  const maxLat = Math.max(start.lat, end.lat)
  const minLng = Math.min(start.lng, end.lng)
  const maxLng = Math.max(start.lng, end.lng)
  return [
    { lat: minLat, lng: minLng },
    { lat: minLat, lng: maxLng },
    { lat: maxLat, lng: maxLng },
    { lat: maxLat, lng: minLng },
  ]
}

export function createCircleVertices(
  center: PolygonVertex,
  edge: PolygonVertex,
  segmentCount = 36
): PolygonVertex[] {
  const latScale = 111320
  const lngScale = Math.cos((center.lat * Math.PI) / 180) * 111320
  const deltaX = (edge.lng - center.lng) * lngScale
  const deltaY = (edge.lat - center.lat) * latScale
  const radiusMeters = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return []

  const vertices: PolygonVertex[] = []
  for (let i = 0; i < segmentCount; i += 1) {
    const angle = (2 * Math.PI * i) / segmentCount
    const x = radiusMeters * Math.cos(angle)
    const y = radiusMeters * Math.sin(angle)
    vertices.push({
      lat: center.lat + y / latScale,
      lng: center.lng + x / lngScale,
    })
  }
  return vertices
}

export function normalizePolygonVertices(input: unknown): PolygonVertex[] {
  if (!Array.isArray(input)) return []
  return input
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as Record<string, unknown>
      const lat = typeof row.lat === 'number' ? row.lat : Number.NaN
      const lng = typeof row.lng === 'number' ? row.lng : Number.NaN
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return { lat, lng } satisfies PolygonVertex
    })
    .filter((vertex): vertex is PolygonVertex => Boolean(vertex))
}

export function normalizeMetricValue(input: unknown): number {
  const value =
    typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : Number.NaN
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value * 100) / 100
}

export function normalizePolygonMetrics(input: unknown, fallback: PolygonMetricsData = EMPTY_POLYGON_METRICS): PolygonMetricsData {
  const row = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  return {
    estimatedProductionTons: normalizeMetricValue(
      row.estimatedProductionTons ??
        row.estimated_production_tons ??
        row.estimated_production ??
        fallback.estimatedProductionTons
    ),
    energyConsumptionKwh: normalizeMetricValue(
      row.energyConsumptionKwh ??
        row.energy_consumption_kwh ??
        row.energy_consumption ??
        fallback.energyConsumptionKwh
    ),
    waterConsumptionM3: normalizeMetricValue(
      row.waterConsumptionM3 ??
        row.water_consumption_m3 ??
        row.water_consumption ??
        fallback.waterConsumptionM3
    ),
  }
}

export function normalizePointPolygon(input: unknown): PointPolygon | null {
  if (!input || typeof input !== 'object') return null
  const row = input as Record<string, unknown>
  const vertices = normalizePolygonVertices(row.vertices)
  if (vertices.length < 3) return null

  const cropRow = row.crop && typeof row.crop === 'object' ? (row.crop as Record<string, unknown>) : null
  const metricsRow = row.metrics && typeof row.metrics === 'object' ? (row.metrics as Record<string, unknown>) : row
  const customPointId =
    (typeof row.customPointId === 'string' && row.customPointId.trim()) ||
    (typeof row.custom_point_id === 'string' && row.custom_point_id.trim()) ||
    (typeof row.pointId === 'string' && row.pointId.trim()) ||
    ''
  const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : ''
  const name = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : ''
  if (!id || !customPointId || !name) return null
  return {
    id,
    customPointId,
    name,
    vertices,
    score: normalizePolygonScore(
      (row as Record<string, unknown>).score ??
        (row as Record<string, unknown>).polygonScore ??
        (row as Record<string, unknown>).polygon_score,
      50
    ),
    crop: {
      cropName:
        (typeof cropRow?.cropName === 'string' && cropRow.cropName) ||
        (typeof cropRow?.crop_name === 'string' && cropRow.crop_name) ||
        (typeof row.cropName === 'string' && row.cropName) ||
        (typeof row.crop_name === 'string' && row.crop_name) ||
        '',
      variety:
        (typeof cropRow?.variety === 'string' && cropRow.variety) ||
        (typeof cropRow?.cropVariety === 'string' && cropRow.cropVariety) ||
        (typeof cropRow?.crop_variety === 'string' && cropRow.crop_variety) ||
        (typeof row.cropVariety === 'string' && row.cropVariety) ||
        (typeof row.crop_variety === 'string' && row.crop_variety) ||
        '',
      sowingDate:
        (typeof cropRow?.sowingDate === 'string' && cropRow.sowingDate) ||
        (typeof cropRow?.sowing_date === 'string' && cropRow.sowing_date) ||
        (typeof row.plantingDate === 'string' && row.plantingDate) ||
        (typeof row.sowingDate === 'string' && row.sowingDate) ||
        (typeof row.sowing_date === 'string' && row.sowing_date) ||
        '',
      expectedHarvestDate:
        (typeof cropRow?.expectedHarvestDate === 'string' && cropRow.expectedHarvestDate) ||
        (typeof cropRow?.expected_harvest_date === 'string' && cropRow.expected_harvest_date) ||
        (typeof row.expectedHarvestDate === 'string' && row.expectedHarvestDate) ||
        (typeof row.expected_harvest_date === 'string' && row.expected_harvest_date) ||
        '',
      notes:
        (typeof cropRow?.notes === 'string' && cropRow.notes) ||
        (typeof row.notes === 'string' && row.notes) ||
        '',
    },
    metrics: normalizePolygonMetrics(metricsRow),
    createdAt:
      (typeof row.createdAt === 'string' && row.createdAt.trim() ? row.createdAt : null) ||
      (typeof row.created_at === 'string' && row.created_at.trim() ? row.created_at : null) ||
      new Date().toISOString(),
  }
}

export function normalizeFarmCropInsight(input: unknown): FarmCropInsight | null {
  if (!input || typeof input !== 'object') return null
  const row = input as FarmCropInsightApiRow
  const id = typeof row.id === 'string' ? row.id.trim() : ''
  const pointId =
    (typeof row.custom_point_id === 'string' && row.custom_point_id.trim()) ||
    (typeof row.pointId === 'string' && row.pointId.trim()) ||
    ''
  const cropName =
    (typeof row.crop_name === 'string' && row.crop_name.trim()) ||
    (typeof row.cropName === 'string' && row.cropName.trim()) ||
    ''
  if (!id || !pointId || !cropName) return null
  const externalUrl =
    (typeof row.external_url === 'string' && row.external_url.trim()) ||
    (typeof row.externalUrl === 'string' && row.externalUrl.trim()) ||
    ''
  return {
    id,
    pointId,
    cropName,
    estimatedProductionTons: normalizeMetricValue(
      row.estimated_production_tons ?? row.estimatedProductionTons
    ),
    energyConsumptionKwh: normalizeMetricValue(
      row.energy_consumption_kwh ?? row.energyConsumptionKwh
    ),
    waterConsumptionM3: normalizeMetricValue(
      row.water_consumption_m3 ?? row.waterConsumptionM3
    ),
    externalUrl,
    createdAt:
      (typeof row.created_at === 'string' && row.created_at.trim()) ||
      (typeof row.createdAt === 'string' && row.createdAt.trim()) ||
      new Date().toISOString(),
  }
}

export function formatMetric(value: number, unit: string) {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${unit}`
}

export function formatScoreValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '-'
  return `${value.toFixed(1)}/100`
}

export function getScoreTextColor(value: number | null) {
  if (value === null || !Number.isFinite(value)) return MAP_COLORS.unknown
  return scoreToPolygonColor(value)
}

export function normalizeExternalLink(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}
