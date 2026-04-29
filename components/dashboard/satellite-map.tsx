'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Minus, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useOrganization } from '@/hooks/use-organization'

const QATAR_CENTER = { lat: 25.3548, lng: 51.1839 }
const DEFAULT_ZOOM = 10
const DEFAULT_FARM_ZOOM = 17

type MapPointType = 'farm' | 'facility' | 'sensor' | 'custom'
type PolygonDrawMethod = 'vertex' | 'rectangle' | 'circle'

interface MapMarker {
  id: string
  lat: number
  lng: number
  label: string
  type: MapPointType
}

interface FarmApiRow {
  id?: string
  name_en?: string
  name_ar?: string
  name?: string
  location?: string | null
}

interface SatelliteMapProps {
  locale?: string
  targetFarmId?: string | null
  targetPointId?: string | null
  targetFocusToken?: string | null
  targetZoom?: number
}

interface MapController {
  zoomIn: () => void
  zoomOut: () => void
  flyTo: (coords: [number, number], zoom: number, options?: { duration?: number }) => void
  setView: (coords: [number, number], zoom: number) => void
  closePopup?: () => void
  getZoom: () => number
  on: (event: string, handler: (...args: any[]) => void) => void
  off: (event: string, handler: (...args: any[]) => void) => void
  remove: () => void
}

interface CustomPoint {
  id: string
  lat: number
  lng: number
  label: string
  pointType: MapPointType
}

interface PolygonVertex {
  lat: number
  lng: number
}

interface PolygonCropData {
  cropName: string
  variety: string
  sowingDate: string
  expectedHarvestDate: string
  notes: string
}

interface PolygonApiRow {
  id: string
  custom_point_id: string
  name: string
  vertices: unknown
  score: number | null
  crop_name: string | null
  crop_variety: string | null
  sowing_date: string | null
  expected_harvest_date: string | null
  notes: string | null
  created_at: string | null
}

interface PointPolygon {
  id: string
  customPointId: string
  name: string
  vertices: PolygonVertex[]
  score: number
  crop: PolygonCropData
  createdAt: string
}

interface FarmCropInsightApiRow {
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

interface FarmCropInsight {
  id: string
  pointId: string
  cropName: string
  estimatedProductionTons: number
  energyConsumptionKwh: number
  waterConsumptionM3: number
  externalUrl: string
  createdAt: string
}

type PointPolygonsMap = Record<string, PointPolygon[]>

const EMPTY_POLYGON_CROP: PolygonCropData = {
  cropName: '',
  variety: '',
  sowingDate: '',
  expectedHarvestDate: '',
  notes: '',
}

const POINT_TYPE_OPTIONS: Array<{ value: MapPointType; label: string }> = [
  { value: 'custom', label: 'Custom' },
  { value: 'farm', label: 'Farm' },
  { value: 'facility', label: 'Facility' },
  { value: 'sensor', label: 'Sensor' },
]

const POINT_TYPE_LABELS: Record<MapPointType, string> = {
  custom: 'Custom',
  farm: 'Farm',
  facility: 'Facility',
  sensor: 'Sensor',
}

const POLYGON_DRAW_METHOD_OPTIONS: Array<{ value: PolygonDrawMethod; label: string }> = [
  { value: 'vertex', label: 'Point by point' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
]

const CUSTOM_POINTS_STORAGE_PREFIX = 'growa-custom-map-points:'
const ANONYMOUS_CUSTOM_POINTS_STORAGE_KEY = `${CUSTOM_POINTS_STORAGE_PREFIX}anonymous`

interface DbCustomPointRow {
  id?: string
  lat?: number | string
  lng?: number | string
  label?: string
  pointType?: string
  point_type?: string
}

interface CropTypeOption {
  id: string
  code: string
  nameEn: string
  nameAr: string
  varieties: string[]
}

interface CropTypesApiRow {
  id?: string
  code?: string
  nameEn?: string
  name_en?: string
  nameAr?: string
  name_ar?: string
  varieties?: unknown
}

function normalizeStoredCustomPoints(rows: unknown): CustomPoint[] {
  if (!Array.isArray(rows)) return []
  return rows
    .map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as Record<string, unknown>
      const id = typeof row.id === 'string' ? row.id : ''
      const lat =
        typeof row.lat === 'number'
          ? row.lat
          : typeof row.lat === 'string'
            ? Number(row.lat)
            : Number.NaN
      const lng =
        typeof row.lng === 'number'
          ? row.lng
          : typeof row.lng === 'string'
            ? Number(row.lng)
            : Number.NaN
      const label =
        typeof row.label === 'string'
          ? row.label
          : typeof row.name === 'string'
            ? row.name
            : 'Custom Point'
      const rawPointType =
        typeof row.pointType === 'string'
          ? row.pointType
          : typeof row.type === 'string'
            ? row.type
            : 'custom'
      const pointType: MapPointType = POINT_TYPE_OPTIONS.some((option) => option.value === rawPointType)
        ? (rawPointType as MapPointType)
        : 'custom'
      if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return { id, lat, lng, label: label.trim() || 'Custom Point', pointType } satisfies CustomPoint
    })
    .filter((row): row is CustomPoint => Boolean(row))
}

function normalizeDbCustomPointRows(rows: unknown): CustomPoint[] {
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
      } satisfies CustomPoint
    })
    .filter((point): point is CustomPoint => Boolean(point))
}

function normalizeCropTypeRows(rows: unknown): CropTypeOption[] {
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

function readCustomPointsFromStorageKeys(keys: string[]): CustomPoint[] {
  if (typeof window === 'undefined') return []
  const merged = new Map<string, CustomPoint>()
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const normalized = normalizeStoredCustomPoints(parsed)
      for (const point of normalized) {
        merged.set(point.id, point)
      }
    } catch {
      // Ignore malformed storage payloads.
    }
  }
  return Array.from(merged.values())
}

function getCustomPointStorageKeys(primaryKey: string): string[] {
  const keys = new Set<string>()
  if (primaryKey) keys.add(primaryKey)
  keys.add(ANONYMOUS_CUSTOM_POINTS_STORAGE_KEY)
  if (typeof window !== 'undefined') {
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index)
        if (key && key.startsWith(CUSTOM_POINTS_STORAGE_PREFIX)) {
          keys.add(key)
        }
      }
    } catch {
      // Ignore storage access failures in restricted browser contexts.
    }
  }
  return Array.from(keys)
}

function hashToRange(input: string, min: number, max: number) {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000
  }
  const normalized = hash / 100000
  return min + normalized * (max - min)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function estimateFarmCoordinates(farmId: string, location?: string | null) {
  const locationKey = (location || '').toLowerCase()
  const cityBias: Record<string, { lat: number; lng: number }> = {
    'al khor': { lat: 25.6839, lng: 51.5058 },
    'al rayyan': { lat: 25.2919, lng: 51.4244 },
    'umm salal': { lat: 25.4167, lng: 51.4065 },
    'al daayen': { lat: 25.4476, lng: 51.5254 },
    'al wakrah': { lat: 25.1682, lng: 51.6034 },
    'madinat ash shamal': { lat: 26.1293, lng: 51.2068 },
  }
  const matchedCity = Object.entries(cityBias).find(([city]) => locationKey.includes(city))
  const base = matchedCity?.[1] || QATAR_CENTER
  return {
    lat: base.lat + hashToRange(`${farmId}-lat`, -0.035, 0.035),
    lng: base.lng + hashToRange(`${farmId}-lng`, -0.05, 0.05),
  }
}

function calculatePolygonAreaHectares(vertices: PolygonVertex[]): number {
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

function formatHectares(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0.00'
  if (value >= 1) return value.toFixed(2)
  if (value >= 0.1) return value.toFixed(3)
  return value.toFixed(4)
}

function normalizePolygonScore(value: unknown, fallback = 50) {
  const numericValue =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(numericValue)) return fallback
  return Math.min(100, Math.max(0, Math.round(numericValue)))
}

function scoreToPolygonColor(score: number) {
  const normalized = normalizePolygonScore(score, 50)
  // Requested scale: 0 -> red, mid -> yellow/orange, 100 -> green.
  const hue = (normalized / 100) * 120
  return `hsl(${hue.toFixed(1)} 100% 56%)`
}

function createRectangleVertices(start: PolygonVertex, end: PolygonVertex): PolygonVertex[] {
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

function createCircleVertices(
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

function normalizePolygonVertices(input: unknown): PolygonVertex[] {
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

function normalizePointPolygon(
  input: unknown,
  fallbackId: string,
  fallbackName: string,
  fallbackCustomPointId = ''
): PointPolygon | null {
  // Backward compatibility with legacy format: polygon was an array of vertices.
  if (Array.isArray(input)) {
    const legacyVertices = normalizePolygonVertices(input)
    if (legacyVertices.length < 3) return null
    return {
      id: fallbackId,
      customPointId: fallbackCustomPointId,
      name: fallbackName,
      vertices: legacyVertices,
      score: 50,
      crop: { ...EMPTY_POLYGON_CROP },
      createdAt: new Date().toISOString(),
    }
  }

  if (!input || typeof input !== 'object') return null
  const row = input as Record<string, unknown>
  const vertices = normalizePolygonVertices(row.vertices)
  if (vertices.length < 3) return null

  const cropRow = row.crop && typeof row.crop === 'object' ? (row.crop as Record<string, unknown>) : null
  const customPointId =
    (typeof row.customPointId === 'string' && row.customPointId.trim()) ||
    (typeof row.custom_point_id === 'string' && row.custom_point_id.trim()) ||
    (typeof row.pointId === 'string' && row.pointId.trim()) ||
    fallbackCustomPointId
  return {
    id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : fallbackId,
    customPointId,
    name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : fallbackName,
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
    createdAt:
      (typeof row.createdAt === 'string' && row.createdAt.trim() ? row.createdAt : null) ||
      (typeof row.created_at === 'string' && row.created_at.trim() ? row.created_at : null) ||
      new Date().toISOString(),
  }
}

function fromApiPolygonRow(row: PolygonApiRow): PointPolygon | null {
  const vertices = normalizePolygonVertices(row.vertices)
  if (vertices.length < 3) return null
  return {
    id: row.id,
    customPointId: row.custom_point_id,
    name: row.name?.trim() || 'Polygon',
    vertices,
    score: normalizePolygonScore(row.score, 50),
    crop: {
      cropName: row.crop_name || '',
      variety: row.crop_variety || '',
      sowingDate: row.sowing_date || '',
      expectedHarvestDate: row.expected_harvest_date || '',
      notes: row.notes || '',
    },
    createdAt: row.created_at || new Date().toISOString(),
  }
}

function normalizeMetricValue(input: unknown): number {
  const value =
    typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : Number.NaN
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value * 100) / 100
}

function normalizeFarmCropInsight(input: unknown): FarmCropInsight | null {
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

function formatMetric(value: number, unit: string) {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${unit}`
}

function formatScoreValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '-'
  return `${value.toFixed(1)}/100`
}

function getScoreTextColor(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '#9ca3af'
  return scoreToPolygonColor(value)
}

function getScoreSurfaceColor(value: number | null, alpha: number) {
  if (value === null || !Number.isFinite(value)) {
    return `rgba(156, 163, 175, ${Math.max(0, Math.min(1, alpha))})`
  }
  const normalized = normalizePolygonScore(value, 50)
  const hue = (normalized / 100) * 120
  return `hsl(${hue.toFixed(1)} 100% 56% / ${Math.max(0, Math.min(1, alpha))})`
}

function normalizeExternalLink(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function isLeafletUiClick(event: any) {
  const target = event?.originalEvent?.target
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      '.leaflet-marker-icon, .leaflet-popup, .leaflet-popup-content, .leaflet-control, .custom-marker, .leaflet-interactive'
    )
  )
}

export function SatelliteMap({
  locale = 'en',
  targetFarmId = null,
  targetPointId = null,
  targetFocusToken = null,
  targetZoom,
}: SatelliteMapProps) {
  const { user } = useAuth()
  const { organization } = useOrganization()

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<MapController | null>(null)
  const leafletRef = useRef<any>(null)
  const markerInstancesRef = useRef<any[]>([])
  const polygonInstancesRef = useRef<any[]>([])
  const draftPolylineRef = useRef<any | null>(null)
  const draftVertexInstancesRef = useRef<any[]>([])
  const polygonDrawPointIdRef = useRef<string | null>(null)
  const lastClearedFocusTokenRef = useRef<string | null>(null)
  const insightsRequestIdRef = useRef(0)
  const migratedLegacyPointsRef = useRef(false)

  const [isLoading, setIsLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM)
  const [farmRows, setFarmRows] = useState<FarmApiRow[]>([])
  const [customPoints, setCustomPoints] = useState<CustomPoint[]>([])
  const [pointPolygons, setPointPolygons] = useState<PointPolygonsMap>({})
  const [isAddPointMode, setIsAddPointMode] = useState(false)
  const [newPointType, setNewPointType] = useState<MapPointType>('custom')
  const [activePointId, setActivePointId] = useState<string | null>(null)
  const [polygonCropFilterQuery, setPolygonCropFilterQuery] = useState('')
  const [farmCropInsightsByPoint, setFarmCropInsightsByPoint] = useState<Record<string, FarmCropInsight[]>>({})
  const [cropTypeOptions, setCropTypeOptions] = useState<CropTypeOption[]>([])
  const [insightsModalPointId, setInsightsModalPointId] = useState<string | null>(null)
  const [isInsightsModalOpen, setIsInsightsModalOpen] = useState(false)
  const [isInsightsModalLoading, setIsInsightsModalLoading] = useState(false)
  const [insightsModalError, setInsightsModalError] = useState<string | null>(null)
  const [polygonDrawPointId, setPolygonDrawPointId] = useState<string | null>(null)
  const [polygonDrawMethod, setPolygonDrawMethod] = useState<PolygonDrawMethod>('vertex')
  const [shapeSeedVertex, setShapeSeedVertex] = useState<PolygonVertex | null>(null)
  const [circleSegments, setCircleSegments] = useState(16)
  const [draftPolygon, setDraftPolygon] = useState<PolygonVertex[]>([])
  const [draftPolygonName, setDraftPolygonName] = useState('')
  const [draftPolygonScore, setDraftPolygonScore] = useState(50)
  const [draftCropName, setDraftCropName] = useState('')
  const [draftCropVariety, setDraftCropVariety] = useState('')
  const [draftSowingDate, setDraftSowingDate] = useState('')
  const [draftExpectedHarvestDate, setDraftExpectedHarvestDate] = useState('')
  const [draftCropNotes, setDraftCropNotes] = useState('')

  const resetDraftMetadata = useCallback(() => {
    setDraftPolygonName('')
    setDraftPolygonScore(50)
    setDraftCropName('')
    setDraftCropVariety('')
    setDraftSowingDate('')
    setDraftExpectedHarvestDate('')
    setDraftCropNotes('')
  }, [])

  useEffect(() => {
    polygonDrawPointIdRef.current = polygonDrawPointId
  }, [polygonDrawPointId])

  const organizationType = (organization?.organization_type || organization?.type || '')
    .toString()
    .toLowerCase()
  const isFarmCompanyContext = organizationType === 'farm_company'
  const isGrowaAdmin = Boolean(user?.email?.toLowerCase().endsWith('@growa.ai'))

  const customPointStorageKeys = useMemo(
    () => getCustomPointStorageKeys(`${CUSTOM_POINTS_STORAGE_PREFIX}${user?.id || 'anonymous'}`),
    [user?.id]
  )
  const legacyCustomPointCache = useMemo(
    () => readCustomPointsFromStorageKeys(customPointStorageKeys),
    [customPointStorageKeys]
  )
  const cropNameByNormalized = useMemo(() => {
    const map = new Map<string, string>()
    for (const cropType of cropTypeOptions) {
      const normalizedName = cropType.nameEn.trim().toLowerCase()
      const normalizedCode = cropType.code.trim().toLowerCase()
      const normalizedArabicName = cropType.nameAr.trim().toLowerCase()
      if (normalizedName) map.set(normalizedName, cropType.nameEn)
      if (normalizedCode) map.set(normalizedCode, cropType.nameEn)
      if (normalizedArabicName) map.set(normalizedArabicName, cropType.nameEn)
    }
    return map
  }, [cropTypeOptions])
  const cropVarietyOptionsForDraft = useMemo(() => {
    const normalizedDraftCropName = draftCropName.trim().toLowerCase()
    if (!normalizedDraftCropName) return [] as string[]
    const match =
      cropTypeOptions.find((cropType) => {
        const normalizedName = cropType.nameEn.trim().toLowerCase()
        const normalizedCode = cropType.code.trim().toLowerCase()
        const normalizedArabicName = cropType.nameAr.trim().toLowerCase()
        return (
          normalizedName === normalizedDraftCropName ||
          normalizedCode === normalizedDraftCropName ||
          normalizedArabicName === normalizedDraftCropName
        )
      }) ||
      cropTypeOptions.find((cropType) => {
        const normalizedName = cropType.nameEn.trim().toLowerCase()
        const normalizedCode = cropType.code.trim().toLowerCase()
        const normalizedArabicName = cropType.nameAr.trim().toLowerCase()
        return (
          normalizedName.includes(normalizedDraftCropName) ||
          normalizedCode.includes(normalizedDraftCropName) ||
          normalizedArabicName.includes(normalizedDraftCropName)
        )
      })
    if (!match || !Array.isArray(match.varieties)) return [] as string[]
    return match.varieties
  }, [cropTypeOptions, draftCropName])
  const loadCustomPointsFromDb = useCallback(async () => {
    try {
      const response = await fetch('/api/operations/custom-map-points', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) return [] as CustomPoint[]
      return normalizeDbCustomPointRows(payload)
    } catch {
      return [] as CustomPoint[]
    }
  }, [])

  const upsertCustomPointInDb = useCallback(async (point: CustomPoint) => {
    const response = await fetch('/api/operations/custom-map-points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: point.id,
        label: point.label,
        lat: point.lat,
        lng: point.lng,
        pointType: point.pointType,
      }),
    })
    if (!response.ok) return null
    const payload = await response.json().catch(() => null)
    const normalized = normalizeDbCustomPointRows(payload ? [payload] : [])
    return normalized[0] || null
  }, [])

  useEffect(() => {
    if (!isGrowaAdmin) {
      setCustomPoints([])
      setIsAddPointMode(false)
      return
    }
    let cancelled = false
    async function loadCustomPoints() {
      const dbPoints = await loadCustomPointsFromDb()
      if (cancelled) return

      if (!migratedLegacyPointsRef.current) {
        const legacyPoints = readCustomPointsFromStorageKeys(customPointStorageKeys)
        const knownIds = new Set(dbPoints.map((point) => point.id))
        const missingLegacyPoints = legacyPoints.filter((point) => !knownIds.has(point.id))
        if (missingLegacyPoints.length > 0) {
          const migrated = await Promise.all(missingLegacyPoints.map((point) => upsertCustomPointInDb(point)))
          if (!cancelled && migrated.some(Boolean)) {
            const refreshed = await loadCustomPointsFromDb()
            if (!cancelled) {
              setCustomPoints(refreshed)
            }
            migratedLegacyPointsRef.current = true
            return
          }
        }
        migratedLegacyPointsRef.current = true
      }

      setCustomPoints(dbPoints)
    }

    loadCustomPoints()
    return () => {
      cancelled = true
    }
  }, [customPointStorageKeys, isGrowaAdmin, loadCustomPointsFromDb, upsertCustomPointInDb])

  useEffect(() => {
    if (!isGrowaAdmin) {
      setCropTypeOptions([])
      return
    }
    let cancelled = false
    async function loadCropTypes() {
      try {
        const response = await fetch('/api/operations/crop-types', { cache: 'no-store' })
        const payload = await response.json().catch(() => null)
        if (!response.ok || cancelled) {
          if (!cancelled) setCropTypeOptions([])
          return
        }
        setCropTypeOptions(normalizeCropTypeRows(payload))
      } catch {
        if (!cancelled) setCropTypeOptions([])
      }
    }
    loadCropTypes()
    return () => {
      cancelled = true
    }
  }, [isGrowaAdmin])

  useEffect(() => {
    if (!isGrowaAdmin) {
      setPointPolygons({})
      setFarmCropInsightsByPoint({})
      setIsInsightsModalOpen(false)
      setInsightsModalPointId(null)
      setIsInsightsModalLoading(false)
      setInsightsModalError(null)
      setActivePointId(null)
      setPolygonDrawPointId(null)
      setDraftPolygon([])
      resetDraftMetadata()
      return
    }
    let cancelled = false
    async function loadPolygons() {
      try {
        const response = await fetch('/api/operations/custom-point-polygons', {
          cache: 'no-store',
        })
        const payload = await response.json()
        if (!response.ok || !Array.isArray(payload) || cancelled) {
          if (!cancelled) setPointPolygons({})
          return
        }
        const grouped = payload.reduce<Record<string, PointPolygon[]>>((acc, row) => {
          const pointId =
            (typeof row?.pointId === 'string' && row.pointId) ||
            (typeof row?.custom_point_id === 'string' && row.custom_point_id) ||
            (typeof row?.customPointId === 'string' && row.customPointId) ||
            ''
          if (!pointId) return acc
          const fallbackId =
            typeof row?.id === 'string' && row.id.trim() ? row.id.trim() : `polygon-${Date.now()}`
          const fallbackName =
            typeof row?.name === 'string' && row.name.trim() ? row.name.trim() : 'Polygon'
          const polygon = normalizePointPolygon(row, fallbackId, fallbackName, pointId)
          if (!polygon) return acc
          if (!acc[pointId]) acc[pointId] = []
          acc[pointId].push(polygon)
          return acc
        }, {})
        setPointPolygons(grouped)
      } catch {
        if (!cancelled) setPointPolygons({})
      }
    }
    loadPolygons()
    return () => {
      cancelled = true
    }
  }, [isGrowaAdmin, resetDraftMetadata])

  useEffect(() => {
    if (!isGrowaAdmin) return
    let cancelled = false
    async function loadFarmCropInsights() {
      try {
        const response = await fetch('/api/operations/farm-crop-insights', {
          cache: 'no-store',
        })
        const payload = await response.json()
        if (!response.ok || !Array.isArray(payload) || cancelled) {
          if (!cancelled) setFarmCropInsightsByPoint({})
          return
        }

        const grouped = payload.reduce<Record<string, FarmCropInsight[]>>((acc, row) => {
          const normalized = normalizeFarmCropInsight(row)
          if (!normalized) return acc
          if (!acc[normalized.pointId]) acc[normalized.pointId] = []
          acc[normalized.pointId].push(normalized)
          return acc
        }, {})
        for (const pointId of Object.keys(grouped)) {
          grouped[pointId].sort((a, b) => a.cropName.localeCompare(b.cropName))
        }
        setFarmCropInsightsByPoint(grouped)
      } catch {
        if (!cancelled) setFarmCropInsightsByPoint({})
      }
    }
    loadFarmCropInsights()
    return () => {
      cancelled = true
    }
  }, [isGrowaAdmin])

  const dynamicFarmMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = []
    for (const farm of farmRows) {
      if (!farm.id) continue
      const coordinates = estimateFarmCoordinates(farm.id, farm.location || null)
      const label =
        (locale === 'ar' && farm.name_ar) || farm.name_en || farm.name || `Farm ${farm.id.slice(0, 8)}`
      markers.push({ id: farm.id, lat: coordinates.lat, lng: coordinates.lng, label, type: 'farm' })
    }
    return markers
  }, [farmRows, locale])

  const mapMarkers = useMemo<MapMarker[]>(() => {
    const custom = customPoints.map((point) => ({
      id: point.id,
      lat: point.lat,
      lng: point.lng,
      label: point.label,
      type: point.pointType,
    }))
    return [...dynamicFarmMarkers, ...custom]
  }, [customPoints, dynamicFarmMarkers])

  const pointScoreStatsById = useMemo(() => {
    const stats: Record<string, { count: number; average: number | null }> = {}
    for (const point of customPoints) {
      stats[point.id] = { count: 0, average: null }
    }
    for (const [pointId, polygons] of Object.entries(pointPolygons)) {
      if (!Array.isArray(polygons) || polygons.length === 0) {
        if (!stats[pointId]) stats[pointId] = { count: 0, average: null }
        continue
      }
      const total = polygons.reduce((sum, polygon) => sum + normalizePolygonScore(polygon.score, 50), 0)
      stats[pointId] = { count: polygons.length, average: total / polygons.length }
    }
    return stats
  }, [customPoints, pointPolygons])

  const parsePointTypeInput = useCallback((input: string | null, fallback: MapPointType) => {
    if (input === null) return fallback
    const normalized = input.trim().toLowerCase()
    if (!normalized) return fallback
    const byValue = POINT_TYPE_OPTIONS.find((option) => option.value === normalized)
    if (byValue) return byValue.value
    const byLabel = POINT_TYPE_OPTIONS.find((option) => option.label.toLowerCase() === normalized)
    if (byLabel) return byLabel.value
    return fallback
  }, [])

  const handleEditPoint = useCallback(
    async (pointId: string) => {
      const target = customPoints.find((point) => point.id === pointId)
      if (!target) return
      const labelInput = window.prompt(
        locale === 'ar' ? 'عدّل اسم النقطة' : 'Edit point name',
        target.label
      )
      if (labelInput === null) return
      const nextLabel = labelInput.trim() || target.label
      const typeInput = window.prompt(
        locale === 'ar'
          ? 'عدّل نوع النقطة (custom, farm, facility, sensor)'
          : 'Edit point type (custom, farm, facility, sensor)',
        target.pointType
      )
      const nextType = parsePointTypeInput(typeInput, target.pointType)
      const nextPoint = { ...target, label: nextLabel, pointType: nextType }
      setCustomPoints((prev) =>
        prev.map((entry) =>
          entry.id === pointId ? { ...entry, label: nextLabel, pointType: nextType } : entry
        )
      )
      try {
        await fetch('/api/operations/custom-map-points', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: nextPoint.id,
            label: nextPoint.label,
            pointType: nextPoint.pointType,
          }),
        })
      } catch {
        // Keep UI responsive even if update fails.
      }
    },
    [customPoints, locale, parsePointTypeInput]
  )

  const handleDeletePoint = useCallback(
    async (pointId: string) => {
      const target = customPoints.find((point) => point.id === pointId)
      if (!target) return
      const confirmed = window.confirm(
        locale === 'ar'
          ? `هل تريد حذف النقطة "${target.label}" وكل المضلعات المرتبطة بها؟`
          : `Delete point "${target.label}" and all linked polygons?`
      )
      if (!confirmed) return

      try {
        await fetch(`/api/operations/custom-point-polygons?pointId=${encodeURIComponent(pointId)}`, {
          method: 'DELETE',
        })
      } catch {
        // Continue local cleanup even if remote delete fails.
      }

      try {
        await fetch(`/api/operations/custom-map-points?id=${encodeURIComponent(pointId)}`, {
          method: 'DELETE',
        })
      } catch {
        // Continue local cleanup even if point delete fails.
      }

      setCustomPoints((prev) => prev.filter((entry) => entry.id !== pointId))
      setPointPolygons((prev) => {
        if (!(pointId in prev)) return prev
        const next = { ...prev }
        delete next[pointId]
        return next
      })
      setActivePointId((prev) => (prev === pointId ? null : prev))
      setPolygonDrawPointId((prev) => (prev === pointId ? null : prev))
      setDraftPolygon([])
      resetDraftMetadata()
    },
    [customPoints, locale, resetDraftMetadata]
  )

  const startPolygonDraw = useCallback(
    (pointId: string) => {
      setActivePointId(pointId)
      setPolygonDrawPointId(pointId)
      setShapeSeedVertex(null)
      setDraftPolygon([])
      resetDraftMetadata()
      setIsAddPointMode(false)
    },
    [resetDraftMetadata]
  )

  const cancelPolygonDraw = useCallback(() => {
    setPolygonDrawPointId(null)
    setShapeSeedVertex(null)
    setDraftPolygon([])
    resetDraftMetadata()
  }, [resetDraftMetadata])

  const saveDraftPolygon = useCallback(async () => {
    if (!polygonDrawPointId || draftPolygon.length < 3) return
    const polygonName =
      draftPolygonName.trim() || `Polygon ${(pointPolygons[polygonDrawPointId]?.length || 0) + 1}`
    const normalizedDraftCropName = draftCropName.trim()
    const canonicalDraftCropName =
      cropNameByNormalized.get(normalizedDraftCropName.toLowerCase()) || normalizedDraftCropName
    const cropPayload: PolygonCropData = {
      cropName: canonicalDraftCropName,
      variety: draftCropVariety.trim(),
      sowingDate: draftSowingDate.trim(),
      expectedHarvestDate: draftExpectedHarvestDate.trim(),
      notes: draftCropNotes.trim(),
    }

    try {
      const response = await fetch('/api/operations/custom-point-polygons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pointId: polygonDrawPointId,
          name: polygonName,
          score: normalizePolygonScore(draftPolygonScore, 50),
          vertices: draftPolygon,
          crop: cropPayload,
        }),
      })
      const payload = await response.json()
      if (!response.ok) return

      const normalized = normalizePointPolygon(
        payload,
        payload.id || `polygon-${Date.now()}`,
        polygonName,
        polygonDrawPointId
      )
      if (!normalized) return

      setPointPolygons((prev) => ({
        ...prev,
        [polygonDrawPointId]: [...(prev[polygonDrawPointId] || []), normalized],
      }))
      setPolygonDrawPointId(null)
      setShapeSeedVertex(null)
      setDraftPolygon([])
      resetDraftMetadata()
      if (canonicalDraftCropName) {
        await fetch('/api/operations/crop-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: canonicalDraftCropName }),
        })
      }
    } catch {
      // Keep draft in place so user can retry save.
    }
  }, [
    circleSegments,
    cropNameByNormalized,
    draftCropName,
    draftCropNotes,
    draftCropVariety,
    draftExpectedHarvestDate,
    draftPolygon,
    draftPolygonName,
    draftPolygonScore,
    draftSowingDate,
    pointPolygons,
    polygonDrawPointId,
    polygonDrawMethod,
    resetDraftMetadata,
  ])

  const handleEditPolygonData = useCallback(
    async (polygon: PointPolygon) => {
      const nextNameInput = window.prompt('Polygon name', polygon.name)
      if (nextNameInput === null) return
      const nextName = nextNameInput.trim() || polygon.name

      const nextScoreRaw = window.prompt('Score (0-100)', String(polygon.score))
      if (nextScoreRaw === null) return
      const nextScore = normalizePolygonScore(nextScoreRaw, polygon.score)

      const nextCropPrompt = cropTypeOptions.length
        ? `Crop name (available: ${cropTypeOptions.map((option) => option.nameEn).slice(0, 24).join(', ')})`
        : 'Crop name'
      const nextCropName = window.prompt(nextCropPrompt, polygon.crop.cropName || '') ?? polygon.crop.cropName
      const normalizedCropName = nextCropName.trim()
      const canonicalCropName = cropNameByNormalized.get(normalizedCropName.toLowerCase()) || normalizedCropName
      const matchingCropType = cropTypeOptions.find(
        (cropType) => cropType.nameEn.trim().toLowerCase() === canonicalCropName.toLowerCase()
      )
      const nextVarietyPrompt =
        matchingCropType && matchingCropType.varieties.length > 0
          ? `Variety (available: ${matchingCropType.varieties.slice(0, 24).join(', ')})`
          : 'Variety'
      const nextVariety = window.prompt(nextVarietyPrompt, polygon.crop.variety || '') ?? polygon.crop.variety
      const nextSowingDate =
        window.prompt('Sowing date (YYYY-MM-DD)', polygon.crop.sowingDate || '') ?? polygon.crop.sowingDate
      const nextHarvestDate =
        window.prompt('Expected harvest date (YYYY-MM-DD)', polygon.crop.expectedHarvestDate || '') ??
        polygon.crop.expectedHarvestDate
      const nextNotes = window.prompt('Notes', polygon.crop.notes || '') ?? polygon.crop.notes

      try {
        const response = await fetch('/api/operations/custom-point-polygons', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            polygonId: polygon.id,
            name: nextName,
            score: nextScore,
            crop: {
              cropName: canonicalCropName,
              variety: nextVariety,
              sowingDate: nextSowingDate,
              expectedHarvestDate: nextHarvestDate,
              notes: nextNotes,
            },
          }),
        })
        const payload = await response.json()
        if (!response.ok) return
        const normalized = normalizePointPolygon(payload, polygon.id, nextName, polygon.customPointId)
        if (!normalized || !normalized.customPointId) return
        setPointPolygons((prev) => {
          const pointId = normalized.customPointId
          const current = prev[pointId] || []
          const updated = current.map((entry) => (entry.id === normalized.id ? normalized : entry))
          return { ...prev, [pointId]: updated }
        })
        if (canonicalCropName) {
          await fetch('/api/operations/crop-types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: canonicalCropName }),
          })
        }
        window.location.reload()
      } catch {
        // Ignore network errors to keep map interactions responsive.
      }
    },
    [cropNameByNormalized, cropTypeOptions]
  )

  const handleDeletePolygon = useCallback(
    async (polygon: PointPolygon) => {
      const confirmed = window.confirm(
        locale === 'ar' ? `هل تريد حذف المضلع "${polygon.name}"؟` : `Delete polygon "${polygon.name}"?`
      )
      if (!confirmed) return

      try {
        const response = await fetch(
          `/api/operations/custom-point-polygons?polygonId=${encodeURIComponent(polygon.id)}`,
          { method: 'DELETE' }
        )
        if (!response.ok) return

        setPointPolygons((prev) => {
          const pointId = polygon.customPointId
          const current = prev[pointId] || []
          const updated = current.filter((entry) => entry.id !== polygon.id)
          if (updated.length === current.length) return prev
          if (updated.length === 0) {
            const next = { ...prev }
            delete next[pointId]
            return next
          }
          return { ...prev, [pointId]: updated }
        })
      } catch {
        // Ignore network errors to keep map interactions responsive.
      }
    },
    [locale]
  )

  const undoDraftVertex = useCallback(() => {
    if (polygonDrawMethod === 'vertex') {
      setDraftPolygon((prev) => prev.slice(0, -1))
      return
    }

    if (shapeSeedVertex) {
      setShapeSeedVertex(null)
      setDraftPolygon([])
    }
  }, [polygonDrawMethod, shapeSeedVertex])

  const explicitTargetFarm = useMemo(
    () =>
      targetFarmId
        ? dynamicFarmMarkers.find((marker) => marker.id === targetFarmId) ||
          mapMarkers.find((marker) => marker.id === targetFarmId) ||
          null
        : null,
    [dynamicFarmMarkers, mapMarkers, targetFarmId]
  )

  const resolvedTargetFarm = useMemo(() => {
    if (explicitTargetFarm) return explicitTargetFarm
    // When a specific point is requested from search, keep point focus priority.
    if (targetPointId) return null
    if (!isFarmCompanyContext) return null
    return dynamicFarmMarkers[0] || null
  }, [dynamicFarmMarkers, explicitTargetFarm, isFarmCompanyContext, targetPointId])

  const explicitTargetPoint = useMemo(() => {
    if (!targetPointId) return null
    return customPoints.find((point) => point.id === targetPointId) || null
  }, [customPoints, targetPointId])

  useEffect(() => {
    if (!isGrowaAdmin || !targetPointId) return
    if (customPoints.some((point) => point.id === targetPointId)) return
    let cancelled = false
    async function hydrateTargetPointFromDb() {
      const dbPoints = await loadCustomPointsFromDb()
      if (cancelled || dbPoints.length === 0) return
      const match = dbPoints.find((point) => point.id === targetPointId)
      if (!match) return
      setCustomPoints((prev) => {
        if (prev.some((point) => point.id === match.id)) return prev
        return [...prev, match]
      })
    }
    hydrateTargetPointFromDb()
    return () => {
      cancelled = true
    }
  }, [customPoints, isGrowaAdmin, loadCustomPointsFromDb, targetPointId])

  const resolvedTargetZoom =
    resolvedTargetFarm || explicitTargetPoint ? targetZoom ?? DEFAULT_FARM_ZOOM : DEFAULT_ZOOM
  const normalizedCropFilter = polygonCropFilterQuery.trim().toLowerCase()
  const cropFilterOptions = useMemo(() => {
    const uniqueCrops = new Set<string>()
    for (const cropType of cropTypeOptions) {
      const cropName = cropType.nameEn.trim()
      if (cropName) uniqueCrops.add(cropName)
    }
    for (const polygonList of Object.values(pointPolygons)) {
      for (const polygon of polygonList) {
        const cropName = polygon.crop.cropName.trim()
        if (cropName) uniqueCrops.add(cropName)
      }
    }
    return Array.from(uniqueCrops).sort((a, b) => a.localeCompare(b))
  }, [cropTypeOptions, pointPolygons])
  const cropFilteredPolygonCount = useMemo(() => {
    if (!normalizedCropFilter) return 0
    let count = 0
    for (const polygonList of Object.values(pointPolygons)) {
      for (const polygon of polygonList) {
        const cropName = polygon.crop.cropName.trim().toLowerCase()
        const variety = polygon.crop.variety.trim().toLowerCase()
        if (cropName.includes(normalizedCropFilter) || variety.includes(normalizedCropFilter)) {
          count += 1
        }
      }
    }
    return count
  }, [normalizedCropFilter, pointPolygons])
  const activePointInsights = insightsModalPointId ? farmCropInsightsByPoint[insightsModalPointId] || [] : []
  const activeInsightsPointPolygons = insightsModalPointId
    ? pointPolygons[insightsModalPointId] || []
    : []
  const insightsModalPoint = useMemo(
    () => (insightsModalPointId ? customPoints.find((point) => point.id === insightsModalPointId) || null : null),
    [customPoints, insightsModalPointId]
  )
  const activeInsightsPointLabel = insightsModalPoint?.label || 'Selected point'
  const activeInsightsPointPolygonCount = insightsModalPointId
    ? (pointPolygons[insightsModalPointId] || []).length
    : 0
  const activeInsightsFarmScore = useMemo(() => {
    if (activeInsightsPointPolygons.length === 0) return null
    const total = activeInsightsPointPolygons.reduce(
      (sum, polygon) => sum + normalizePolygonScore(polygon.score, 50),
      0
    )
    return total / activeInsightsPointPolygons.length
  }, [activeInsightsPointPolygons])
  const cropScoreByName = useMemo(() => {
    const grouped = new Map<string, { total: number; count: number }>()
    for (const polygon of activeInsightsPointPolygons) {
      const cropName = polygon.crop.cropName.trim().toLowerCase()
      if (!cropName) continue
      const current = grouped.get(cropName) || { total: 0, count: 0 }
      current.total += normalizePolygonScore(polygon.score, 50)
      current.count += 1
      grouped.set(cropName, current)
    }

    const averages = new Map<string, number>()
    for (const [cropName, stats] of grouped.entries()) {
      if (stats.count <= 0) continue
      averages.set(cropName, stats.total / stats.count)
    }
    return averages
  }, [activeInsightsPointPolygons])
  const activeInsightsFarmExternalUrl = useMemo(() => {
    for (const insight of activePointInsights) {
      const normalized = normalizeExternalLink(insight.externalUrl)
      if (normalized) return normalized
    }
    return ''
  }, [activePointInsights])

  const closePointInsightsModal = useCallback(() => {
    insightsRequestIdRef.current += 1
    setIsInsightsModalOpen(false)
    setInsightsModalPointId(null)
    setInsightsModalError(null)
    setIsInsightsModalLoading(false)
  }, [])

  const openPointInsightsModal = useCallback(async (pointId: string) => {
    const requestId = insightsRequestIdRef.current + 1
    insightsRequestIdRef.current = requestId
    mapInstanceRef.current?.closePopup?.()
    setInsightsModalPointId(pointId)
    setIsInsightsModalOpen(true)
    setInsightsModalError(null)
    setIsInsightsModalLoading(true)
    try {
      const response = await fetch(
        `/api/operations/farm-crop-insights?pointId=${encodeURIComponent(pointId)}`,
        {
          cache: 'no-store',
        }
      )
      const payload = await response.json()
      if (requestId !== insightsRequestIdRef.current) return
      if (!response.ok || !Array.isArray(payload)) {
        setInsightsModalError('Failed to load farm crop insights.')
        return
      }
      const normalized = payload
        .map((row) => normalizeFarmCropInsight(row))
        .filter((row): row is FarmCropInsight => Boolean(row))
        .sort((a, b) => a.cropName.localeCompare(b.cropName))
      setFarmCropInsightsByPoint((prev) => ({
        ...prev,
        [pointId]: normalized,
      }))
    } catch {
      if (requestId !== insightsRequestIdRef.current) return
      setInsightsModalError('Failed to load farm crop insights.')
    } finally {
      if (requestId !== insightsRequestIdRef.current) return
      setIsInsightsModalLoading(false)
    }
  }, [])

  const handleInsightsModalEditPoint = useCallback(() => {
    if (!insightsModalPointId) return
    handleEditPoint(insightsModalPointId)
  }, [handleEditPoint, insightsModalPointId])

  const handleInsightsModalDrawPolygon = useCallback(() => {
    if (!insightsModalPointId) return
    startPolygonDraw(insightsModalPointId)
    setIsInsightsModalOpen(false)
    setInsightsModalError(null)
    setIsInsightsModalLoading(false)
  }, [insightsModalPointId, startPolygonDraw])

  const handleInsightsModalDeletePoint = useCallback(async () => {
    if (!insightsModalPointId) return
    await handleDeletePoint(insightsModalPointId)
    closePointInsightsModal()
  }, [closePointInsightsModal, handleDeletePoint, insightsModalPointId])

  const handleZoomIn = useCallback(() => {
    mapInstanceRef.current?.zoomIn()
  }, [])

  const handleZoomOut = useCallback(() => {
    mapInstanceRef.current?.zoomOut()
  }, [])

  const handleRecenter = useCallback(() => {
    if (!mapInstanceRef.current) return
    const recenterLat = explicitTargetPoint?.lat ?? resolvedTargetFarm?.lat ?? QATAR_CENTER.lat
    const recenterLng = explicitTargetPoint?.lng ?? resolvedTargetFarm?.lng ?? QATAR_CENTER.lng
    const recenterZoom = explicitTargetPoint || resolvedTargetFarm ? resolvedTargetZoom : DEFAULT_ZOOM
    mapInstanceRef.current.flyTo([recenterLat, recenterLng], recenterZoom, { duration: 1.5 })
  }, [explicitTargetPoint, resolvedTargetFarm, resolvedTargetZoom])

  const clearFocusParamFromUrl = useCallback(() => {
    if (typeof window === 'undefined') return
    const currentUrl = new URL(window.location.href)
    if (!currentUrl.searchParams.has('focus')) return
    const currentToken = currentUrl.searchParams.get('focus')
    if (currentToken && lastClearedFocusTokenRef.current === currentToken) return
    if (currentToken) {
      lastClearedFocusTokenRef.current = currentToken
    }
    currentUrl.searchParams.delete('focus')
    const nextUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
    window.history.replaceState(window.history.state, '', nextUrl)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadFarms() {
      try {
        const response = await fetch('/api/operations/farms', { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) return
        if (!cancelled) setFarmRows(Array.isArray(payload) ? (payload as FarmApiRow[]) : [])
      } catch {
        if (!cancelled) setFarmRows([])
      }
    }
    loadFarms()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let map: MapController | null = null
    const initMap = async () => {
      if (!mapRef.current) return
      if ((mapRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id) {
        setIsLoading(false)
        setMapReady(true)
        return
      }

      const L = (await import('leaflet')).default as any
      await import('leaflet/dist/leaflet.css')
      leafletRef.current = L
      map = L.map(mapRef.current, {
        center: [QATAR_CENTER.lat, QATAR_CENTER.lng],
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
        attributionControl: false,
      })
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      ).addTo(map)
      map.on('zoomend', () => setCurrentZoom(map.getZoom()))
      mapInstanceRef.current = map
      setIsLoading(false)
      setMapReady(true)
    }

    initMap()
    return () => {
      markerInstancesRef.current.forEach((marker) => marker.remove?.())
      markerInstancesRef.current = []
      polygonInstancesRef.current.forEach((layer) => layer.remove?.())
      polygonInstancesRef.current = []
      draftPolylineRef.current?.remove?.()
      draftPolylineRef.current = null
      draftVertexInstancesRef.current.forEach((marker) => marker.remove?.())
      draftVertexInstancesRef.current = []
      if (map) {
        map.remove()
        mapInstanceRef.current = null
      }
      leafletRef.current = null
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    if (!activePointId) return
    if (customPoints.some((point) => point.id === activePointId)) return
    setActivePointId(null)
  }, [activePointId, customPoints])

  useEffect(() => {
    if (!polygonDrawPointId) return
    if (customPoints.some((point) => point.id === polygonDrawPointId)) return
    setPolygonDrawPointId(null)
    setShapeSeedVertex(null)
    setDraftPolygon([])
    resetDraftMetadata()
  }, [customPoints, polygonDrawPointId, resetDraftMetadata])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletRef.current) return
    const L = leafletRef.current
    const map = mapInstanceRef.current

    const createMarkerIcon = (type: MapMarker['type'], markerId: string) => {
      const colors = {
        farm: '#07f880',
        facility: '#3B82F6',
        sensor: '#F59E0B',
        custom: '#9ca3af',
      }
      const scoreStats = pointScoreStatsById[markerId]
      const scoreBasedColor =
        scoreStats && scoreStats.count > 0 && scoreStats.average !== null
          ? scoreToPolygonColor(scoreStats.average)
          : '#9ca3af'
      const color = scoreStats ? scoreBasedColor : colors[type] || colors.farm
      return L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            width: 24px;
            height: 24px;
            background: ${color};
            border: 3px solid rgba(255,255,255,0.95);
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 16px ${color}50;
            cursor: pointer;
          "></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
    }

    markerInstancesRef.current.forEach((marker) => marker.remove?.())
    markerInstancesRef.current = mapMarkers.map((marker) => {
      const customPoint = customPoints.find((point) => point.id === marker.id) || null
      const markerInstance = L.marker([marker.lat, marker.lng], {
        icon: createMarkerIcon(marker.type, marker.id),
      }).addTo(map)

      if (customPoint) {
        markerInstance.on('click', (event: any) => {
          event?.originalEvent?.preventDefault?.()
          event?.originalEvent?.stopPropagation?.()
          setActivePointId(customPoint.id)
          openPointInsightsModal(customPoint.id)
        })
        return markerInstance
      }

      const popupContent = `
        <div style="font-family: system-ui; padding: 8px; min-width: 140px;">
          <strong style="color: #07f880; font-size: 13px;">${escapeHtml(marker.label)}</strong>
          <br/>
          <span style="font-size: 10px; color: #888; text-transform: uppercase;">Type: ${escapeHtml(
            POINT_TYPE_LABELS[marker.type]
          )}</span>
        </div>
      `

      markerInstance.bindPopup(popupContent, { className: 'custom-popup' })
      markerInstance.on('popupopen', () => {
        setActivePointId(null)
      })
      return markerInstance
    })
  }, [
    customPoints,
    mapMarkers,
    mapReady,
    openPointInsightsModal,
    pointScoreStatsById,
  ])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletRef.current) return
    const L = leafletRef.current
    const map = mapInstanceRef.current

    polygonInstancesRef.current.forEach((layer) => layer.remove?.())
    polygonInstancesRef.current = []
    draftPolylineRef.current?.remove?.()
    draftPolylineRef.current = null
    draftVertexInstancesRef.current.forEach((marker) => marker.remove?.())
    draftVertexInstancesRef.current = []

    const polygonsToRender = normalizedCropFilter
      ? Object.values(pointPolygons)
          .flat()
          .filter((polygon) => {
            const cropName = polygon.crop.cropName.trim().toLowerCase()
            const variety = polygon.crop.variety.trim().toLowerCase()
            return cropName.includes(normalizedCropFilter) || variety.includes(normalizedCropFilter)
          })
      : activePointId
        ? pointPolygons[activePointId] || []
        : []

    for (const polygon of polygonsToRender) {
        if (polygon.vertices.length < 3) continue
        const crop = polygon.crop
        const polygonScore = normalizePolygonScore(polygon.score, 50)
        const polygonColor = scoreToPolygonColor(polygonScore)
        const areaHectares = calculatePolygonAreaHectares(polygon.vertices)
        const popupLines = [
          `<strong style="color:#07f880;font-size:13px;">${escapeHtml(polygon.name)}</strong>`,
          `<br/><span style="font-size:11px;color:${escapeHtml(polygonColor)};">Score: ${polygonScore}/100</span>`,
          `<br/><span style="font-size:11px;color:#9ca3af;">Area: ${escapeHtml(formatHectares(areaHectares))} ha</span>`,
          crop.cropName ? `<br/><span style="font-size:11px;color:#ddd;">Crop: ${escapeHtml(crop.cropName)}</span>` : '',
          crop.variety ? `<br/><span style="font-size:11px;color:#bbb;">Variety: ${escapeHtml(crop.variety)}</span>` : '',
          crop.sowingDate ? `<br/><span style="font-size:11px;color:#bbb;">Sowing: ${escapeHtml(crop.sowingDate)}</span>` : '',
          crop.expectedHarvestDate
            ? `<br/><span style="font-size:11px;color:#bbb;">Harvest: ${escapeHtml(crop.expectedHarvestDate)}</span>`
            : '',
          crop.notes ? `<br/><span style="font-size:11px;color:#999;">${escapeHtml(crop.notes)}</span>` : '',
        ].join('')
        const popupActions = `
          <div style="margin-top:10px; display:flex; gap:6px;">
            <button
              data-edit-polygon-id="${polygon.id}"
              style="
                border: 1px solid rgba(147,197,253,0.45);
                background: rgba(147,197,253,0.14);
                color: #bfdbfe;
                border-radius: 6px;
                padding: 4px 8px;
                font-size: 11px;
                cursor: pointer;
              "
            >
              Edit Polygon
            </button>
            <button
              data-delete-polygon-id="${polygon.id}"
              style="
                border: 1px solid rgba(239,68,68,0.45);
                background: rgba(239,68,68,0.14);
                color: #fca5a5;
                border-radius: 6px;
                padding: 4px 8px;
                font-size: 11px;
                cursor: pointer;
              "
            >
              Delete Polygon
            </button>
          </div>
        `

        const popupContainer = document.createElement('div')
        popupContainer.style.fontFamily = 'system-ui'
        popupContainer.style.padding = '8px'
        popupContainer.style.minWidth = '180px'
        popupContainer.innerHTML = `${popupLines}${popupActions}`

        const editButton = popupContainer.querySelector(
          `[data-edit-polygon-id="${polygon.id}"]`
        ) as HTMLButtonElement | null
        const deleteButton = popupContainer.querySelector(
          `[data-delete-polygon-id="${polygon.id}"]`
        ) as HTMLButtonElement | null

        if (editButton) {
          editButton.onclick = (clickEvent) => {
            clickEvent.preventDefault()
            clickEvent.stopPropagation()
            handleEditPolygonData(polygon)
          }
        }
        if (deleteButton) {
          deleteButton.onclick = (clickEvent) => {
            clickEvent.preventDefault()
            clickEvent.stopPropagation()
            handleDeletePolygon(polygon)
          }
        }

        const layer = L.polygon(
          polygon.vertices.map((vertex) => [vertex.lat, vertex.lng]),
          {
            color: polygonColor,
            weight: 4,
            opacity: 1,
            fillColor: polygonColor,
            fillOpacity: 0.4,
            interactive: true,
            bubblingMouseEvents: false,
          }
        )
          .addTo(map)
          .bindPopup(popupContainer, { className: 'custom-popup' })
        layer.on('click', (event: any) => {
          event?.originalEvent?.preventDefault?.()
          event?.originalEvent?.stopPropagation?.()
          layer.openPopup()
        })
        polygonInstancesRef.current.push(layer)
    }

    if (polygonDrawPointId && draftPolygon.length > 0 && polygonDrawPointId === activePointId) {
      draftPolylineRef.current = L.polyline(
        draftPolygon.map((vertex) => [vertex.lat, vertex.lng]),
        {
          color: '#38bdf8',
          weight: 4,
          dashArray: '10 6',
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }
      ).addTo(map)
      draftVertexInstancesRef.current = draftPolygon.map((vertex, index) =>
        L.circleMarker([vertex.lat, vertex.lng], {
          radius: index === 0 ? 7 : 6,
          color: '#ffffff',
          weight: 2,
          fillColor: index === 0 ? '#07f880' : '#38bdf8',
          fillOpacity: 1,
          interactive: false,
        }).addTo(map)
      )
    }
  }, [
    activePointId,
    draftPolygon,
    handleDeletePolygon,
    handleEditPolygonData,
    mapReady,
    normalizedCropFilter,
    pointPolygons,
    polygonDrawPointId,
  ])

  useEffect(() => {
    if (!isGrowaAdmin || !isAddPointMode || polygonDrawPointId) return
    if (!mapReady || !mapInstanceRef.current) return
    const map = mapInstanceRef.current

    const handleMapClick = async (event: any) => {
      if (isLeafletUiClick(event)) return
      const lat = Number(event?.latlng?.lat)
      const lng = Number(event?.latlng?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const pointLabelPrefix = locale === 'ar' ? 'نقطة' : POINT_TYPE_LABELS[newPointType]
      const label = `${pointLabelPrefix} ${customPoints.length + 1}`
      const pointId = `custom-${Date.now()}-${Math.floor(Math.random() * 10000)}`
      const nextPoint: CustomPoint = {
        id: pointId,
        lat,
        lng,
        label,
        pointType: newPointType,
      }
      setCustomPoints((prev) => [...prev, nextPoint])
      try {
        const response = await fetch('/api/operations/custom-map-points', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: nextPoint.id,
            label: nextPoint.label,
            lat: nextPoint.lat,
            lng: nextPoint.lng,
            pointType: nextPoint.pointType,
          }),
        })
        if (!response.ok) {
          setCustomPoints((prev) => prev.filter((entry) => entry.id !== nextPoint.id))
        }
      } catch {
        setCustomPoints((prev) => prev.filter((entry) => entry.id !== nextPoint.id))
      }
    }

    map.on('click', handleMapClick)
    return () => {
      map.off('click', handleMapClick)
    }
  }, [isAddPointMode, isGrowaAdmin, locale, mapReady, newPointType, polygonDrawPointId])

  useEffect(() => {
    if (!isGrowaAdmin || !polygonDrawPointId) return
    if (!mapReady || !mapInstanceRef.current) return
    const map = mapInstanceRef.current

    const handleMapClick = (event: any) => {
      if (isLeafletUiClick(event)) return
      const lat = Number(event?.latlng?.lat)
      const lng = Number(event?.latlng?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

      const vertex = { lat, lng } satisfies PolygonVertex
      if (polygonDrawMethod === 'vertex') {
        setDraftPolygon((prev) => [...prev, vertex])
        return
      }

      if (!shapeSeedVertex) {
        setShapeSeedVertex(vertex)
        return
      }

      if (polygonDrawMethod === 'rectangle') {
        setDraftPolygon(createRectangleVertices(shapeSeedVertex, vertex))
        setShapeSeedVertex(null)
        return
      }

      setDraftPolygon(createCircleVertices(shapeSeedVertex, vertex, circleSegments))
      setShapeSeedVertex(null)
    }

    const handleMouseMove = (event: any) => {
      if (isLeafletUiClick(event)) return
      if (!shapeSeedVertex) return
      const lat = Number(event?.latlng?.lat)
      const lng = Number(event?.latlng?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const vertex = { lat, lng } satisfies PolygonVertex
      if (polygonDrawMethod === 'rectangle') {
        setDraftPolygon(createRectangleVertices(shapeSeedVertex, vertex))
        return
      }
      if (polygonDrawMethod === 'circle') {
        setDraftPolygon(createCircleVertices(shapeSeedVertex, vertex, circleSegments))
      }
    }

    map.on('click', handleMapClick)
    map.on('mousemove', handleMouseMove)
    return () => {
      map.off('click', handleMapClick)
      map.off('mousemove', handleMouseMove)
    }
  }, [
    circleSegments,
    isGrowaAdmin,
    mapReady,
    polygonDrawMethod,
    polygonDrawPointId,
    shapeSeedVertex,
  ])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return
    if (!activePointId || isAddPointMode || polygonDrawPointId) return
    const map = mapInstanceRef.current

    const handleMapClick = (event: any) => {
      if (isLeafletUiClick(event)) return
      setActivePointId(null)
    }

    map.on('click', handleMapClick)
    return () => {
      map.off('click', handleMapClick)
    }
  }, [activePointId, isAddPointMode, mapReady, polygonDrawPointId])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !resolvedTargetFarm || targetPointId) return
    if (targetFocusToken) {
      mapInstanceRef.current.flyTo([resolvedTargetFarm.lat, resolvedTargetFarm.lng], resolvedTargetZoom, {
        duration: 1.2,
      })
      clearFocusParamFromUrl()
      return
    }
    mapInstanceRef.current.setView([resolvedTargetFarm.lat, resolvedTargetFarm.lng], resolvedTargetZoom)
  }, [clearFocusParamFromUrl, mapReady, resolvedTargetFarm, resolvedTargetZoom, targetPointId, targetFocusToken])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !explicitTargetPoint) return
    const pointZoom =
      Number.isFinite(targetZoom) && (targetZoom as number) >= 3 && (targetZoom as number) <= 19
        ? (targetZoom as number)
        : DEFAULT_FARM_ZOOM
    if (targetFocusToken) {
      mapInstanceRef.current.flyTo([explicitTargetPoint.lat, explicitTargetPoint.lng], pointZoom, {
        duration: 1.2,
      })
      clearFocusParamFromUrl()
    } else {
      mapInstanceRef.current.setView([explicitTargetPoint.lat, explicitTargetPoint.lng], pointZoom)
    }
    setActivePointId(explicitTargetPoint.id)
  }, [clearFocusParamFromUrl, mapReady, explicitTargetPoint, targetZoom, targetFocusToken])

  return (
    <div className="absolute inset-0 pt-16">
      <div ref={mapRef} className="h-full w-full" />

      <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2">
        {isGrowaAdmin && (
          <>
            <button
              onClick={() => {
                setIsAddPointMode((prev) => !prev)
                setPolygonDrawPointId(null)
                setDraftPolygon([])
                resetDraftMetadata()
              }}
              className={`h-10 px-3 flex items-center justify-center rounded-lg border transition-all shadow-lg text-xs font-medium ${
                isAddPointMode
                  ? 'bg-[#07f880]/20 border-[#07f880]/60 text-[#07f880]'
                  : 'bg-[#0c0c0e]/90 border-white/10 text-white/80 hover:border-[#07f880]/50 hover:text-[#07f880]'
              }`}
              title={isAddPointMode ? 'Click map to add points' : 'Enable add point mode'}
            >
              {isAddPointMode ? 'Add Point: ON' : 'Add Point'}
            </button>
            {isAddPointMode && !polygonDrawPointId && (
              <select
                value={newPointType}
                onChange={(event) => setNewPointType(event.target.value as MapPointType)}
                className="h-10 rounded-lg border border-white/10 bg-[#0c0c0e]/90 px-2 text-xs text-white shadow-lg focus:border-[#07f880]/60 focus:outline-none"
                title="Point type for new points"
              >
                {POINT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#0c0c0e]">
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
        <button
          onClick={handleZoomIn}
          className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#0c0c0e]/90 border border-white/10 hover:border-[#07f880]/50 hover:bg-[#0c0c0e] transition-all shadow-lg"
          title="Zoom In"
        >
          <Plus className="h-5 w-5 text-white" />
        </button>
        <button
          onClick={handleZoomOut}
          className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#0c0c0e]/90 border border-white/10 hover:border-[#07f880]/50 hover:bg-[#0c0c0e] transition-all shadow-lg"
          title="Zoom Out"
        >
          <Minus className="h-5 w-5 text-white" />
        </button>
        <button
          onClick={handleRecenter}
          className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#0c0c0e]/90 border border-white/10 hover:border-[#07f880]/50 hover:bg-[#0c0c0e] transition-all shadow-lg"
          title="Recenter on Qatar"
        >
          <Crosshair className="h-5 w-5 text-[#07f880]" />
        </button>
      </div>

      <div className="absolute bottom-6 left-6 z-[1000] rounded-lg border border-white/10 bg-[#0c0c0e]/90 px-3 py-1.5 shadow-lg">
        <div>
          <span className="text-xs text-white/60">Zoom: </span>
          <span className="text-xs font-medium text-[#07f880]">{currentZoom}</span>
        </div>
        {resolvedTargetFarm && (
          <div className="text-[11px] text-white/75">
            Focus: <span className="text-[#07f880]">{resolvedTargetFarm.label}</span>
          </div>
        )}
        {isGrowaAdmin && isAddPointMode && !polygonDrawPointId && (
          <div className="text-[11px] text-[#07f880]">
            Click on map to create a {POINT_TYPE_LABELS[newPointType].toLowerCase()} point.
          </div>
        )}
        {isGrowaAdmin && polygonDrawPointId && (
          <div className="mt-1 text-[11px] text-[#93c5fd]">
            Polygon mode:{' '}
            {polygonDrawMethod === 'vertex'
              ? 'click map to add vertices.'
              : polygonDrawMethod === 'rectangle'
                ? shapeSeedVertex
                  ? 'click opposite corner to finish rectangle.'
                  : 'click first corner of rectangle.'
                : shapeSeedVertex
                  ? 'click edge point to finish circle.'
                  : 'click circle center point.'}
          </div>
        )}
      </div>

      {isInsightsModalOpen && (
        <div
          className="absolute inset-0 z-[2600] flex items-center justify-center bg-black/75 backdrop-blur-sm px-4 py-6"
          role="dialog"
          aria-modal="true"
          onClick={closePointInsightsModal}
        >
          <div
            className="w-full max-w-4xl rounded-2xl border border-white/12 bg-gradient-to-b from-[#111216] to-[#090a0d] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.65)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-base font-semibold text-white">Farm Crop Insights</p>
                <p className="mt-1 text-xs text-white/60">
                  Point: <span className="font-medium text-[#07f880]">{activeInsightsPointLabel}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={closePointInsightsModal}
                className="rounded-md border border-white/15 bg-white/[0.02] px-2.5 py-1 text-xs text-white/80 hover:border-[#07f880]/45 hover:text-[#07f880]"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-white/50">Linked polygons</p>
                <p className="mt-1 text-sm font-semibold text-white">{activeInsightsPointPolygonCount}</p>
              </div>
              <div
                className="rounded-lg border px-3 py-2"
                style={{
                  borderColor: getScoreSurfaceColor(activeInsightsFarmScore, 0.4),
                  backgroundColor: getScoreSurfaceColor(activeInsightsFarmScore, 0.14),
                }}
              >
                <p className="text-[10px] uppercase tracking-wide text-white/50">Farm score</p>
                <p
                  className="mt-1 text-sm font-semibold"
                  style={{ color: getScoreTextColor(activeInsightsFarmScore) }}
                >
                  {formatScoreValue(activeInsightsFarmScore)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleInsightsModalEditPoint}
                disabled={!insightsModalPointId}
                className="rounded-md border border-[#07f880]/35 bg-[#07f880]/12 px-2.5 py-1.5 text-[11px] font-medium text-[#07f880] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Edit Point
              </button>
              <button
                type="button"
                onClick={handleInsightsModalDrawPolygon}
                disabled={!insightsModalPointId}
                className="rounded-md border border-[#93c5fd]/35 bg-[#93c5fd]/12 px-2.5 py-1.5 text-[11px] font-medium text-[#bfdbfe] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Draw Polygon
              </button>
              <button
                type="button"
                onClick={handleInsightsModalDeletePoint}
                disabled={!insightsModalPointId}
                className="rounded-md border border-red-400/35 bg-red-500/12 px-2.5 py-1.5 text-[11px] font-medium text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete Point
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-white/50">Farm external link</p>
              {activeInsightsFarmExternalUrl ? (
                <a
                  href={activeInsightsFarmExternalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs font-medium text-[#07f880] underline underline-offset-2 hover:text-[#8dffca]"
                >
                  Open Farm Link
                </a>
              ) : (
                <p className="mt-1 text-xs text-white/50">No farm link configured yet.</p>
              )}
            </div>

            {isInsightsModalLoading ? (
              <div className="py-10 text-center text-sm text-white/65">Loading insights...</div>
            ) : insightsModalError ? (
              <div className="py-10 text-center text-sm text-red-300">{insightsModalError}</div>
            ) : activePointInsights.length === 0 ? (
              <div className="py-10 text-center text-sm text-white/65">
                No crop insight records found for this point.
              </div>
            ) : (
              <div className="mt-4 max-h-[58vh] overflow-y-auto rounded-lg border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-left">
                  <thead className="sticky top-0 bg-[#14161b]">
                    <tr className="text-[11px] uppercase tracking-wide text-white/60">
                      <th className="px-3 py-2.5 font-medium">Crop</th>
                      <th className="px-3 py-2.5 font-medium">Crop Score</th>
                      <th className="px-3 py-2.5 font-medium">Estimated Production</th>
                      <th className="px-3 py-2.5 font-medium">Energy Consumption</th>
                      <th className="px-3 py-2.5 font-medium">Water Consumption</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {activePointInsights.map((insight, index) => {
                      const cropKey = insight.cropName.trim().toLowerCase()
                      const cropScore = cropScoreByName.get(cropKey) ?? null
                      return (
                        <tr
                          key={insight.id}
                          className={`text-xs text-white/85 ${index % 2 === 0 ? 'bg-white/[0.01]' : 'bg-transparent'} hover:bg-white/[0.03]`}
                        >
                          <td className="px-3 py-2.5 font-medium text-white">{insight.cropName}</td>
                          <td
                            className="px-3 py-2.5 font-semibold"
                            style={{ color: getScoreTextColor(cropScore) }}
                          >
                            {formatScoreValue(cropScore)}
                          </td>
                          <td className="px-3 py-2.5">{formatMetric(insight.estimatedProductionTons, 'tons')}</td>
                          <td className="px-3 py-2.5">{formatMetric(insight.energyConsumptionKwh, 'kWh')}</td>
                          <td className="px-3 py-2.5">{formatMetric(insight.waterConsumptionM3, 'm³')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {isGrowaAdmin && polygonDrawPointId && (
        <div className="absolute left-6 top-24 z-[1000] w-80 rounded-lg border border-white/10 bg-[#0c0c0e]/90 p-3 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Polygon Draft</p>
          <p className="mt-1 text-[11px] text-white/60">
            Vertices: <span className="text-[#93c5fd]">{draftPolygon.length}</span>
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {POLYGON_DRAW_METHOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setPolygonDrawMethod(option.value)
                  setShapeSeedVertex(null)
                  setDraftPolygon([])
                }}
                className={`h-7 rounded border text-[11px] ${
                  polygonDrawMethod === option.value
                    ? 'border-[#07f880]/45 bg-[#07f880]/12 text-[#07f880]'
                    : 'border-white/15 bg-white/5 text-white/70'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-white/45">
            {polygonDrawMethod === 'vertex'
              ? 'Click to add each vertex.'
              : polygonDrawMethod === 'rectangle'
                ? shapeSeedVertex
                  ? 'Move mouse to resize rectangle, then click to confirm.'
                  : 'Click first corner of rectangle.'
                : shapeSeedVertex
                  ? 'Move mouse to resize circle, then click to confirm.'
                  : 'Click circle center point.'}
          </p>
          {polygonDrawMethod === 'circle' && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-white/55">Circle detail</span>
              <input
                type="range"
                min={8}
                max={72}
                step={4}
                value={circleSegments}
                onChange={(event) => setCircleSegments(Number(event.target.value))}
                className="flex-1 accent-[#07f880]"
              />
              <span className="w-10 text-right text-[11px] text-[#07f880]">{circleSegments}</span>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-white/55">Score</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={draftPolygonScore}
              onChange={(event) => setDraftPolygonScore(normalizePolygonScore(event.target.value, 50))}
              className="flex-1 accent-[#07f880]"
            />
            <span className="w-12 text-right text-[11px] text-[#07f880]">{draftPolygonScore}</span>
          </div>

          <div className="mt-3 space-y-2">
            <input
              value={draftPolygonName}
              onChange={(event) => setDraftPolygonName(event.target.value)}
              placeholder="Polygon name (e.g. Tomato Plot A)"
              className="h-8 w-full rounded border border-white/10 bg-[#0b0b0c] px-2 text-[11px] text-white placeholder:text-white/35 focus:border-[#07f880]/60 focus:outline-none"
            />
            <input
              value={draftCropName}
              onChange={(event) => setDraftCropName(event.target.value)}
              placeholder="Crop name"
              list="draft-crop-type-options"
              className="h-8 w-full rounded border border-white/10 bg-[#0b0b0c] px-2 text-[11px] text-white placeholder:text-white/35 focus:border-[#07f880]/60 focus:outline-none"
            />
            <datalist id="draft-crop-type-options">
              {cropTypeOptions.map((cropType) => (
                <option key={cropType.id} value={cropType.nameEn} />
              ))}
            </datalist>
            <input
              value={draftCropVariety}
              onChange={(event) => setDraftCropVariety(event.target.value)}
              placeholder="Variety"
              list="draft-crop-variety-options"
              className="h-8 w-full rounded border border-white/10 bg-[#0b0b0c] px-2 text-[11px] text-white placeholder:text-white/35 focus:border-[#07f880]/60 focus:outline-none"
            />
            <datalist id="draft-crop-variety-options">
              {cropVarietyOptionsForDraft.map((variety) => (
                <option key={variety} value={variety} />
              ))}
            </datalist>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={draftSowingDate}
                onChange={(event) => setDraftSowingDate(event.target.value)}
                className="h-8 w-full rounded border border-white/10 bg-[#0b0b0c] px-2 text-[11px] text-white focus:border-[#07f880]/60 focus:outline-none"
              />
              <input
                type="date"
                value={draftExpectedHarvestDate}
                onChange={(event) => setDraftExpectedHarvestDate(event.target.value)}
                className="h-8 w-full rounded border border-white/10 bg-[#0b0b0c] px-2 text-[11px] text-white focus:border-[#07f880]/60 focus:outline-none"
              />
            </div>
            <textarea
              value={draftCropNotes}
              onChange={(event) => setDraftCropNotes(event.target.value)}
              placeholder="Notes"
              rows={2}
              className="w-full resize-none rounded border border-white/10 bg-[#0b0b0c] px-2 py-1.5 text-[11px] text-white placeholder:text-white/35 focus:border-[#07f880]/60 focus:outline-none"
            />
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={undoDraftVertex}
              disabled={polygonDrawMethod !== 'vertex' ? !shapeSeedVertex && draftPolygon.length === 0 : draftPolygon.length === 0}
              className="h-8 flex-1 rounded border border-white/15 bg-white/5 text-[11px] text-white/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Undo
            </button>
            <button
              onClick={cancelPolygonDraw}
              className="h-8 flex-1 rounded border border-white/15 bg-white/5 text-[11px] text-white/80"
            >
              Cancel
            </button>
            <button
              onClick={saveDraftPolygon}
              disabled={draftPolygon.length < 3}
              className="h-8 flex-1 rounded border border-[#07f880]/35 bg-[#07f880]/15 text-[11px] text-[#07f880] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {isGrowaAdmin && (
        <div className="absolute right-6 top-24 z-[1000] w-80 rounded-lg border border-white/10 bg-[#0c0c0e]/90 p-3 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Polygon Crop Filter
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={polygonCropFilterQuery}
              onChange={(event) => setPolygonCropFilterQuery(event.target.value)}
              list="polygon-crop-options"
              placeholder="Search crop (e.g. Tomato)"
              className="h-8 flex-1 rounded border border-white/10 bg-[#0b0b0c] px-2 text-[11px] text-white placeholder:text-white/35 focus:border-[#07f880]/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setPolygonCropFilterQuery('')}
              className="h-8 rounded border border-white/15 bg-white/5 px-2 text-[11px] text-white/80 hover:border-[#07f880]/40 hover:text-[#07f880]"
            >
              Clear
            </button>
          </div>
          <datalist id="polygon-crop-options">
            {cropFilterOptions.map((cropName) => (
              <option key={cropName} value={cropName} />
            ))}
          </datalist>
          <p className="mt-2 text-[11px] text-white/60">
            {normalizedCropFilter
              ? `Showing ${cropFilteredPolygonCount} polygon${cropFilteredPolygonCount === 1 ? '' : 's'} for "${polygonCropFilterQuery.trim()}".`
              : 'Type a crop name to only show matching polygons on the map.'}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-[#07f880]/20 border-t-[#07f880]" />
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo512-dN5LxVKBkzU9yWpc5ROgvoTj7C4wM5.png"
                alt="Growa"
                className="absolute inset-0 m-auto h-8 w-8"
              />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {locale === 'ar' ? 'جاري تحميل صور الأقمار الصناعية...' : 'Loading satellite imagery...'}
            </span>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-popup .leaflet-popup-content-wrapper {
          background: rgba(12, 12, 14, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }
        .custom-popup .leaflet-popup-tip {
          background: rgba(12, 12, 14, 0.95);
        }
        .custom-popup .leaflet-popup-close-button {
          color: #888;
        }
        .custom-popup .leaflet-popup-close-button:hover {
          color: #07f880;
        }
      `}</style>
    </div>
  )
}
