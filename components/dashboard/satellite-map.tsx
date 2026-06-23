'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Minus, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useOrganization } from '@/hooks/use-organization'

const QATAR_CENTER = { lat: 25.3548, lng: 51.1839 }
const DEFAULT_ZOOM = 10
const DEFAULT_FARM_ZOOM = 17

function resolveLiveMapZoom(targetZoom?: number, fallback = DEFAULT_ZOOM) {
  return Number.isFinite(targetZoom) && (targetZoom as number) >= 3 && (targetZoom as number) <= 19
    ? (targetZoom as number)
    : fallback
}

type MapPointType = 'farm' | 'facility' | 'sensor' | 'custom'
type PolygonDrawMethod = 'vertex' | 'rectangle' | 'circle'

interface MapMarker {
  id: string
  lat: number
  lng: number
  label: string
  type: MapPointType
}

interface WeatherGridMapPoint {
  id: string
  lat: number
  lng: number
  north?: number
  south?: number
  east?: number
  west?: number
}

interface WeatherGridLineSegment {
  id: string
  start: { lat: number; lng: number }
  end: { lat: number; lng: number }
}

interface WeatherBoundaryPoint {
  lat: number
  lng: number
}

interface SatelliteMapProps {
  locale?: string
  targetPointId?: string | null
  targetCropFilter?: string | null
  targetFocusToken?: string | null
  targetZoom?: number
  isLateralMode?: boolean
  onMapClick?: (coords: { lat: number; lng: number }) => void
  weatherGridPoints?: WeatherGridMapPoint[]
  selectedWeatherGridPointId?: string | null
  weatherGridLines?: WeatherGridLineSegment[]
  weatherBoundary?: WeatherBoundaryPoint[]
  onWeatherGridPointClick?: (point: WeatherGridMapPoint) => void
}

interface MapController {
  zoomIn: () => void
  zoomOut: () => void
  invalidateSize?: () => void
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
  externalUrl: string
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

interface PolygonMetricsData {
  estimatedProductionTons: number
  energyConsumptionKwh: number
  waterConsumptionM3: number
}

interface PointPolygon {
  id: string
  customPointId: string
  name: string
  vertices: PolygonVertex[]
  score: number
  crop: PolygonCropData
  metrics: PolygonMetricsData
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

const EMPTY_POLYGON_METRICS: PolygonMetricsData = {
  estimatedProductionTons: 0,
  energyConsumptionKwh: 0,
  waterConsumptionM3: 0,
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

interface DbCustomPointRow {
  id?: string
  lat?: number | string
  lng?: number | string
  label?: string
  pointType?: string
  point_type?: string
  externalUrl?: string
  external_url?: string
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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

function normalizeMetricValue(input: unknown): number {
  const value =
    typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : Number.NaN
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value * 100) / 100
}

function normalizePolygonMetrics(input: unknown, fallback: PolygonMetricsData = EMPTY_POLYGON_METRICS): PolygonMetricsData {
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

function normalizePointPolygon(input: unknown): PointPolygon | null {
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
  targetPointId = null,
  targetCropFilter = null,
  targetFocusToken = null,
  targetZoom,
  isLateralMode = false,
  onMapClick,
  weatherGridPoints = [],
  selectedWeatherGridPointId = null,
  weatherGridLines = [],
  weatherBoundary = [],
  onWeatherGridPointClick,
}: SatelliteMapProps) {
  const { user } = useAuth()
  const { organization } = useOrganization()

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<MapController | null>(null)
  const leafletRef = useRef<any>(null)
  const markerInstancesRef = useRef<any[]>([])
  const weatherGridMarkerInstancesRef = useRef<any[]>([])
  const polygonInstancesRef = useRef<any[]>([])
  const draftPolylineRef = useRef<any | null>(null)
  const draftVertexInstancesRef = useRef<any[]>([])
  const polygonDrawPointIdRef = useRef<string | null>(null)
  const lastClearedFocusTokenRef = useRef<string | null>(null)
  const insightsRequestIdRef = useRef(0)

  const [isLoading, setIsLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM)
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
  const [draftEstimatedProductionTons, setDraftEstimatedProductionTons] = useState('')
  const [draftEnergyConsumptionKwh, setDraftEnergyConsumptionKwh] = useState('')
  const [draftWaterConsumptionM3, setDraftWaterConsumptionM3] = useState('')

  const resetDraftMetadata = useCallback(() => {
    setDraftPolygonName('')
    setDraftPolygonScore(50)
    setDraftCropName('')
    setDraftCropVariety('')
    setDraftSowingDate('')
    setDraftExpectedHarvestDate('')
    setDraftCropNotes('')
    setDraftEstimatedProductionTons('')
    setDraftEnergyConsumptionKwh('')
    setDraftWaterConsumptionM3('')
  }, [])

  useEffect(() => {
    polygonDrawPointIdRef.current = polygonDrawPointId
  }, [polygonDrawPointId])

  const organizationType = (organization?.organization_type || organization?.type || '')
    .toString()
    .toLowerCase()
  const isFarmCompanyContext = organizationType === 'farm_company'
  const isGrowaAdmin = Boolean(user?.email?.toLowerCase().endsWith('@growa.ai'))

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
      setCustomPoints(dbPoints)
    }

    loadCustomPoints()
    return () => {
      cancelled = true
    }
  }, [isGrowaAdmin, loadCustomPointsFromDb])

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
          if (typeof row?.id !== 'string' || !row.id.trim()) return acc
          if (typeof row?.name !== 'string' || !row.name.trim()) return acc
          const polygon = normalizePointPolygon(row)
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

  const mapMarkers = useMemo<MapMarker[]>(() => {
    const custom = customPoints.map((point) => ({
      id: point.id,
      lat: point.lat,
      lng: point.lng,
      label: point.label,
      type: point.pointType,
    }))
    return custom
  }, [customPoints])

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
      const linkInput = window.prompt(
        locale === 'ar' ? 'رابط صفحة خارجية للنقطة/المزرعة' : 'External page link for this point/farm',
        target.externalUrl || ''
      )
      if (linkInput === null) return
      const nextExternalUrl = normalizeExternalLink(linkInput)
      const nextPoint = { ...target, label: nextLabel, pointType: nextType, externalUrl: nextExternalUrl }
      setCustomPoints((prev) =>
        prev.map((entry) =>
          entry.id === pointId
            ? { ...entry, label: nextLabel, pointType: nextType, externalUrl: nextExternalUrl }
            : entry
        )
      )
      try {
        const response = await fetch('/api/operations/custom-map-points', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: nextPoint.id,
            label: nextPoint.label,
            pointType: nextPoint.pointType,
            externalUrl: nextPoint.externalUrl,
          }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          window.alert(payload?.error || 'Failed to update point link.')
          setCustomPoints((prev) => prev.map((entry) => (entry.id === pointId ? target : entry)))
          return
        }
        const [normalized] = normalizeDbCustomPointRows([payload])
        if (normalized) {
          setCustomPoints((prev) => prev.map((entry) => (entry.id === pointId ? normalized : entry)))
        }
      } catch {
        window.alert('Failed to update point link.')
        setCustomPoints((prev) => prev.map((entry) => (entry.id === pointId ? target : entry)))
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

  const refreshPointInsights = useCallback(async (pointId: string) => {
    try {
      const response = await fetch(
        `/api/operations/farm-crop-insights?pointId=${encodeURIComponent(pointId)}`,
        { cache: 'no-store' }
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok || !Array.isArray(payload)) return false
      const normalized = payload
        .map((row) => normalizeFarmCropInsight(row))
        .filter((row): row is FarmCropInsight => Boolean(row))
        .sort((a, b) => a.cropName.localeCompare(b.cropName))
      setFarmCropInsightsByPoint((prev) => ({
        ...prev,
        [pointId]: normalized,
      }))
      return true
    } catch {
      return false
    }
  }, [])

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
    const metricsPayload: PolygonMetricsData = {
      estimatedProductionTons: normalizeMetricValue(draftEstimatedProductionTons),
      energyConsumptionKwh: normalizeMetricValue(draftEnergyConsumptionKwh),
      waterConsumptionM3: normalizeMetricValue(draftWaterConsumptionM3),
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
          metrics: metricsPayload,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        window.alert(payload?.error || 'Failed to save polygon metrics.')
        return
      }

      const normalized = normalizePointPolygon(payload)
      if (!normalized) return

      setPointPolygons((prev) => ({
        ...prev,
        [polygonDrawPointId]: [...(prev[polygonDrawPointId] || []), normalized],
      }))
      await refreshPointInsights(normalized.customPointId)
      setPolygonDrawPointId(null)
      setShapeSeedVertex(null)
      setDraftPolygon([])
      resetDraftMetadata()
    } catch {
      // Keep draft in place so user can retry save.
    }
  }, [
    circleSegments,
    cropNameByNormalized,
    draftCropName,
    draftEnergyConsumptionKwh,
    draftEstimatedProductionTons,
    draftCropNotes,
    draftCropVariety,
    draftExpectedHarvestDate,
    draftPolygon,
    draftPolygonName,
    draftPolygonScore,
    draftSowingDate,
    draftWaterConsumptionM3,
    pointPolygons,
    polygonDrawPointId,
    polygonDrawMethod,
    refreshPointInsights,
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
      const nextProductionRaw = window.prompt(
        'Estimated production for this polygon (tons)',
        String(polygon.metrics.estimatedProductionTons)
      )
      if (nextProductionRaw === null) return
      const nextEnergyRaw = window.prompt(
        'Energy consumption for this polygon (kWh)',
        String(polygon.metrics.energyConsumptionKwh)
      )
      if (nextEnergyRaw === null) return
      const nextWaterRaw = window.prompt(
        'Water consumption for this polygon (m3)',
        String(polygon.metrics.waterConsumptionM3)
      )
      if (nextWaterRaw === null) return

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
            metrics: {
              estimatedProductionTons: normalizeMetricValue(nextProductionRaw),
              energyConsumptionKwh: normalizeMetricValue(nextEnergyRaw),
              waterConsumptionM3: normalizeMetricValue(nextWaterRaw),
            },
          }),
        })
        const payload = await response.json()
        if (!response.ok) {
          window.alert(payload?.error || 'Failed to update polygon metrics.')
          return
        }
        const normalized = normalizePointPolygon(payload)
        if (!normalized || !normalized.customPointId) return
        setPointPolygons((prev) => {
          const pointId = normalized.customPointId
          const current = prev[pointId] || []
          const updated = current.map((entry) => (entry.id === normalized.id ? normalized : entry))
          return { ...prev, [pointId]: updated }
        })
        await refreshPointInsights(normalized.customPointId)
      } catch {
        window.alert('Failed to update polygon metrics.')
      }
    },
    [cropNameByNormalized, cropTypeOptions, refreshPointInsights]
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
        await refreshPointInsights(polygon.customPointId)
      } catch {
        // Ignore network errors to keep map interactions responsive.
      }
    },
    [locale, refreshPointInsights]
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

  const resolvedTargetFarm = useMemo(() => {
    // When a specific point is requested from search, keep point focus priority.
    if (targetPointId) return null
    if (!isFarmCompanyContext) return null
    return mapMarkers.find((marker) => marker.type === 'farm') || null
  }, [mapMarkers, isFarmCompanyContext, targetPointId])

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
    resolvedTargetFarm || explicitTargetPoint
      ? targetZoom ?? DEFAULT_FARM_ZOOM
      : resolveLiveMapZoom(targetZoom, DEFAULT_ZOOM)
  const normalizedCropFilter = polygonCropFilterQuery.trim().toLowerCase()
  const normalizedTargetCropName = targetCropFilter?.trim().toLowerCase() || ''
  const hasDeepLinkTarget = Boolean(
    targetPointId || normalizedTargetCropName || (resolvedTargetFarm && !targetPointId)
  )
  const lastAppliedTargetCropRef = useRef<string>('')

  useEffect(() => {
    if (!normalizedTargetCropName) {
      lastAppliedTargetCropRef.current = ''
      return
    }
    if (lastAppliedTargetCropRef.current === normalizedTargetCropName) return
    lastAppliedTargetCropRef.current = normalizedTargetCropName
    setPolygonCropFilterQuery(targetCropFilter?.trim() || '')
  }, [normalizedTargetCropName, targetCropFilter])

  useEffect(() => {
    if (!targetPointId) return
    // Switching back to point focus (Top Gainer/Loser) must exit crop-only mode.
    lastAppliedTargetCropRef.current = ''
    setPolygonCropFilterQuery('')
  }, [targetPointId])

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
  const cropPolygonCountByName = useMemo(() => {
    const counts = new Map<string, number>()
    for (const polygon of activeInsightsPointPolygons) {
      const cropName = polygon.crop.cropName.trim().toLowerCase()
      if (!cropName) continue
      counts.set(cropName, (counts.get(cropName) || 0) + 1)
    }
    return counts
  }, [activeInsightsPointPolygons])
  const activeInsightsFarmExternalUrl = useMemo(() => {
    const pointLink = normalizeExternalLink(insightsModalPoint?.externalUrl || '')
    if (pointLink) return pointLink
    for (const insight of activePointInsights) {
      const normalized = normalizeExternalLink(insight.externalUrl)
      if (normalized) return normalized
    }
    return ''
  }, [activePointInsights, insightsModalPoint?.externalUrl])

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
    const recenterZoom =
      explicitTargetPoint || resolvedTargetFarm
        ? resolvedTargetZoom
        : resolveLiveMapZoom(targetZoom, DEFAULT_ZOOM)
    mapInstanceRef.current.flyTo([recenterLat, recenterLng], recenterZoom, { duration: 1.5 })
  }, [explicitTargetPoint, resolvedTargetFarm, resolvedTargetZoom, targetZoom])

  const applyDefaultLiveMapViewport = useCallback(() => {
    if (!mapReady || !mapInstanceRef.current || isLateralMode || weatherGridPoints.length > 0) return
    if (hasDeepLinkTarget) return

    const liveMapZoom = resolveLiveMapZoom(targetZoom, DEFAULT_ZOOM)
    mapInstanceRef.current.invalidateSize?.()
    mapInstanceRef.current.setView([QATAR_CENTER.lat, QATAR_CENTER.lng], liveMapZoom)
    setCurrentZoom(liveMapZoom)
  }, [hasDeepLinkTarget, isLateralMode, mapReady, targetZoom, weatherGridPoints.length])

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
      const initialZoom = resolveLiveMapZoom(targetZoom, DEFAULT_ZOOM)
      const createdMap = L.map(mapRef.current, {
        center: [QATAR_CENTER.lat, QATAR_CENTER.lng],
        zoom: initialZoom,
        zoomControl: false,
        attributionControl: false,
      }) as MapController
      map = createdMap
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      ).addTo(createdMap)
      createdMap.on('zoomend', () => setCurrentZoom(createdMap.getZoom()))
      mapInstanceRef.current = createdMap
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
    const hideMarkersForCropFocus =
      isLateralMode && (Boolean(normalizedTargetCropName) || Boolean(normalizedCropFilter))

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
    if (hideMarkersForCropFocus) {
      markerInstancesRef.current = []
      return
    }

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
    isLateralMode,
    mapMarkers,
    mapReady,
    normalizedCropFilter,
    normalizedTargetCropName,
    openPointInsightsModal,
    pointScoreStatsById,
  ])


  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletRef.current) return
    const L = leafletRef.current
    const map = mapInstanceRef.current

    weatherGridMarkerInstancesRef.current.forEach((layer) => layer.remove?.())
    weatherGridMarkerInstancesRef.current = []

    if (weatherGridPoints.length === 0) return

    const layers: any[] = []

    if (weatherBoundary.length > 2) {
      const outline = L.polyline(
        [...weatherBoundary, weatherBoundary[0]].map((point) => [point.lat, point.lng]),
        {
          color: '#07f880',
          weight: 2.4,
          opacity: 0.95,
          interactive: false,
        }
      ).addTo(map)
      layers.push(outline)
    }

    for (const segment of weatherGridLines) {
      const line = L.polyline(
        [
          [segment.start.lat, segment.start.lng],
          [segment.end.lat, segment.end.lng],
        ],
        {
          color: '#07f880',
          weight: 1.35,
          opacity: 0.85,
          interactive: false,
        }
      ).addTo(map)
      layers.push(line)
    }

    for (const point of weatherGridPoints) {
      const selected = point.id === selectedWeatherGridPointId
      const north = Number(point.north)
      const south = Number(point.south)
      const east = Number(point.east)
      const west = Number(point.west)
      const hasBounds = Number.isFinite(north) && Number.isFinite(south) && Number.isFinite(east) && Number.isFinite(west)
      const clickLayer = hasBounds
        ? L.rectangle(
            [
              [south, west],
              [north, east],
            ],
            {
              color: selected ? '#07f880' : '#07f880',
              weight: selected ? 3 : 0,
              opacity: selected ? 1 : 0,
              fillColor: '#07f880',
              fillOpacity: selected ? 0.12 : 0.01,
              interactive: true,
              bubblingMouseEvents: false,
            }
          )
        : L.circleMarker([point.lat, point.lng], {
            radius: selected ? 7 : 5,
            color: selected ? '#ffffff' : '#07f880',
            weight: selected ? 3 : 1,
            fillColor: selected ? '#07f880' : '#07f880',
            fillOpacity: selected ? 1 : 0.2,
            interactive: true,
            bubblingMouseEvents: false,
          })

      clickLayer.addTo(map)
      clickLayer.bindTooltip(point.id, {
        direction: 'top',
        opacity: 0.9,
        className: 'custom-tooltip',
      })
      clickLayer.on('click', (event: any) => {
        event?.originalEvent?.preventDefault?.()
        event?.originalEvent?.stopPropagation?.()
        const lat = Number(point.lat)
        const lng = Number(point.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
        onWeatherGridPointClick?.({ ...point, lat, lng })
      })
      layers.push(clickLayer)
    }

    weatherGridMarkerInstancesRef.current = layers

    return () => {
      weatherGridMarkerInstancesRef.current.forEach((layer) => layer.remove?.())
      weatherGridMarkerInstancesRef.current = []
    }
  }, [mapReady, onWeatherGridPointClick, selectedWeatherGridPointId, weatherBoundary, weatherGridLines, weatherGridPoints])

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
        const metrics = polygon.metrics
        const popupLines = [
          `<strong style="color:#07f880;font-size:13px;">${escapeHtml(polygon.name)}</strong>`,
          `<br/><span style="font-size:11px;color:${escapeHtml(polygonColor)};">Score: ${polygonScore}/100</span>`,
          `<br/><span style="font-size:11px;color:#9ca3af;">Area: ${escapeHtml(formatHectares(areaHectares))} ha</span>`,
          crop.cropName ? `<br/><span style="font-size:11px;color:#ddd;">Crop: ${escapeHtml(crop.cropName)}</span>` : '',
          crop.variety ? `<br/><span style="font-size:11px;color:#bbb;">Variety: ${escapeHtml(crop.variety)}</span>` : '',
          `<br/><span style="font-size:11px;color:#ddd;">Production: ${escapeHtml(formatMetric(metrics.estimatedProductionTons, 'tons'))}</span>`,
          `<br/><span style="font-size:11px;color:#ddd;">Energy: ${escapeHtml(formatMetric(metrics.energyConsumptionKwh, 'kWh'))}</span>`,
          `<br/><span style="font-size:11px;color:#ddd;">Water: ${escapeHtml(formatMetric(metrics.waterConsumptionM3, 'm³'))}</span>`,
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
        externalUrl: '',
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
            externalUrl: nextPoint.externalUrl,
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
    if (!onMapClick || !mapReady || !mapInstanceRef.current) return
    if (isAddPointMode || polygonDrawPointId) return
    const map = mapInstanceRef.current

    const handleMapClick = (event: any) => {
      if (isLeafletUiClick(event)) return
      const lat = Number(event?.latlng?.lat)
      const lng = Number(event?.latlng?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      onMapClick({ lat, lng })
    }

    map.on('click', handleMapClick)
    return () => {
      map.off('click', handleMapClick)
    }
  }, [isAddPointMode, mapReady, onMapClick, polygonDrawPointId])

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
    if (normalizedTargetCropName) return
    if (targetFocusToken) {
      mapInstanceRef.current.flyTo([resolvedTargetFarm.lat, resolvedTargetFarm.lng], resolvedTargetZoom, {
        duration: 1.2,
      })
      clearFocusParamFromUrl()
      return
    }
    mapInstanceRef.current.setView([resolvedTargetFarm.lat, resolvedTargetFarm.lng], resolvedTargetZoom)
  }, [
    clearFocusParamFromUrl,
    mapReady,
    normalizedTargetCropName,
    resolvedTargetFarm,
    resolvedTargetZoom,
    targetPointId,
    targetFocusToken,
  ])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return
    if (!normalizedTargetCropName || targetPointId) return
    const cropFocusZoom = 10
    if (targetFocusToken) {
      mapInstanceRef.current.flyTo([QATAR_CENTER.lat, QATAR_CENTER.lng], cropFocusZoom, {
        duration: 1.2,
      })
      clearFocusParamFromUrl()
      return
    }
    mapInstanceRef.current.setView([QATAR_CENTER.lat, QATAR_CENTER.lng], cropFocusZoom)
  }, [
    clearFocusParamFromUrl,
    mapReady,
    normalizedTargetCropName,
    targetPointId,
    targetFocusToken,
  ])

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

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || isLateralMode || weatherGridPoints.length > 0) return
    if (hasDeepLinkTarget) return

    const liveMapZoom = resolveLiveMapZoom(targetZoom, DEFAULT_ZOOM)
    if (targetFocusToken) {
      mapInstanceRef.current.invalidateSize?.()
      mapInstanceRef.current.flyTo([QATAR_CENTER.lat, QATAR_CENTER.lng], liveMapZoom, {
        duration: 1.2,
      })
      clearFocusParamFromUrl()
      return
    }

    applyDefaultLiveMapViewport()
  }, [
    applyDefaultLiveMapViewport,
    clearFocusParamFromUrl,
    hasDeepLinkTarget,
    isLateralMode,
    mapReady,
    targetFocusToken,
    targetZoom,
    weatherGridPoints.length,
  ])

  useEffect(() => {
    if (!mapReady || !mapRef.current || isLateralMode || weatherGridPoints.length > 0) return

    const node = mapRef.current
    const observer = new ResizeObserver(() => {
      mapInstanceRef.current?.invalidateSize?.()
      if (!hasDeepLinkTarget) {
        applyDefaultLiveMapViewport()
      }
    })
    observer.observe(node)

    return () => observer.disconnect()
  }, [applyDefaultLiveMapViewport, hasDeepLinkTarget, isLateralMode, mapReady, weatherGridPoints.length])

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
          className={`absolute inset-0 z-[2600] flex px-4 py-6 ${
            isLateralMode
              ? 'items-start justify-end bg-black/50 pt-24 backdrop-blur-[2px]'
              : 'items-center justify-center bg-black/75 backdrop-blur-sm'
          }`}
          role="dialog"
          aria-modal="true"
          onClick={closePointInsightsModal}
        >
          <div
            className={`w-full rounded-2xl border border-white/12 bg-gradient-to-b from-[#111216] to-[#090a0d] shadow-[0_20px_80px_rgba(0,0,0,0.65)] ${
              isLateralMode
                ? 'max-w-[34rem] max-h-[calc(100vh-7rem)] overflow-y-auto p-4'
                : 'max-w-4xl p-5'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-base font-semibold text-white">Farm Crop Insights</p>
                <p className="mt-1 text-xs text-white/60">
                  Point: <span className="font-medium text-[#07f880]">{activeInsightsPointLabel}</span>
                </p>
                <p className="mt-1 text-[11px] text-white/45">
                  Totals are summed from the linked polygon metrics for each crop.
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
              isLateralMode ? (
                <div className="mt-4 max-h-[44vh] space-y-2 overflow-y-auto pr-1">
                  {activePointInsights.map((insight) => {
                    const cropKey = insight.cropName.trim().toLowerCase()
                    const cropScore = cropScoreByName.get(cropKey) ?? null
                    const cropPolygonCount = cropPolygonCountByName.get(cropKey) || 0
                    return (
                      <div
                        key={insight.id}
                        className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/85"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-white">{insight.cropName}</p>
                          <span
                            className="rounded-md border px-2 py-0.5 text-xs font-semibold"
                            style={{
                              color: getScoreTextColor(cropScore),
                              borderColor: getScoreSurfaceColor(cropScore, 0.38),
                              backgroundColor: getScoreSurfaceColor(cropScore, 0.12),
                            }}
                          >
                            {formatScoreValue(cropScore)}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-white/60">Polygon contributors</span>
                            <span className="font-medium text-white">{cropPolygonCount}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-white/60">Estimated production</span>
                            <span className="font-medium text-white">
                              {formatMetric(insight.estimatedProductionTons, 'tons')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-white/60">Energy consumption</span>
                            <span className="font-medium text-white">
                              {formatMetric(insight.energyConsumptionKwh, 'kWh')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-white/60">Water consumption</span>
                            <span className="font-medium text-white">
                              {formatMetric(insight.waterConsumptionM3, 'm³')}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-4 max-h-[58vh] overflow-y-auto rounded-lg border border-white/10">
                  <table className="min-w-full divide-y divide-white/10 text-left">
                    <thead className="sticky top-0 bg-[#14161b]">
                      <tr className="text-[11px] uppercase tracking-wide text-white/60">
                        <th className="px-3 py-2.5 font-medium">Crop</th>
                        <th className="px-3 py-2.5 font-medium">Crop Score</th>
                        <th className="px-3 py-2.5 font-medium">Polygons</th>
                        <th className="px-3 py-2.5 font-medium">Estimated Production</th>
                        <th className="px-3 py-2.5 font-medium">Energy Consumption</th>
                        <th className="px-3 py-2.5 font-medium">Water Consumption</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {activePointInsights.map((insight, index) => {
                        const cropKey = insight.cropName.trim().toLowerCase()
                        const cropScore = cropScoreByName.get(cropKey) ?? null
                        const cropPolygonCount = cropPolygonCountByName.get(cropKey) || 0
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
                            <td className="px-3 py-2.5">{cropPolygonCount}</td>
                            <td className="px-3 py-2.5">{formatMetric(insight.estimatedProductionTons, 'tons')}</td>
                            <td className="px-3 py-2.5">{formatMetric(insight.energyConsumptionKwh, 'kWh')}</td>
                            <td className="px-3 py-2.5">{formatMetric(insight.waterConsumptionM3, 'm³')}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
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
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                value={draftEstimatedProductionTons}
                onChange={(event) => setDraftEstimatedProductionTons(event.target.value)}
                placeholder="Tons"
                className="h-8 w-full rounded border border-white/10 bg-[#0b0b0c] px-2 text-[11px] text-white placeholder:text-white/35 focus:border-[#07f880]/60 focus:outline-none"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={draftEnergyConsumptionKwh}
                onChange={(event) => setDraftEnergyConsumptionKwh(event.target.value)}
                placeholder="kWh"
                className="h-8 w-full rounded border border-white/10 bg-[#0b0b0c] px-2 text-[11px] text-white placeholder:text-white/35 focus:border-[#07f880]/60 focus:outline-none"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={draftWaterConsumptionM3}
                onChange={(event) => setDraftWaterConsumptionM3(event.target.value)}
                placeholder="m3"
                className="h-8 w-full rounded border border-white/10 bg-[#0b0b0c] px-2 text-[11px] text-white placeholder:text-white/35 focus:border-[#07f880]/60 focus:outline-none"
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
