'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Minus, Plus, Search, X } from 'lucide-react'
import type { Layer, LeafletMouseEvent } from 'leaflet'

type LeafletModule = typeof import('leaflet')
import { createHarvestRasterLayer } from '@/components/dashboard/harvest-raster-layer'
import { useAuth } from '@/hooks/use-auth'
import { useOrganization } from '@/hooks/use-organization'
import type { IntelligenceSignal } from '@/lib/domain/types'
import { MAP_COLORS, resolvePolygonColor, SIGNAL_SEVERITY_COLORS } from '@/lib/watchtower/map-layer-colors'
import { Logo } from '@/components/brand/logo'
import { LatticeLoader } from '@/components/brand/ui'
import { COORDINATE_SEARCH_ZOOM, parseCoordinateQuery } from '@/lib/dashboard/coordinate-search'
import { resolveMapLayerVisibility } from '@/lib/watchtower/map-layer-visibility'
import { useConfirm, useToast } from '@/components/brand/feedback'
import { invalidateShared, sharedFetch } from '@/lib/client/shared-fetch'
import { useI18n } from '@/lib/i18n'
import {
  PointEditDialog,
  PolygonEditDialog,
  type PointEditValues,
  type PolygonEditValues,
} from '@/components/dashboard/map-edit-dialogs'
import {
  type MapPointType,
  type PolygonDrawMethod,
  type MapMarker,
  type OperationsFarmTarget,
  type SatelliteMapProps,
  type MapController,
  type CustomPoint,
  type PolygonVertex,
  type PolygonCropData,
  type PolygonMetricsData,
  type PointPolygon,
  type FarmCropInsight,
  type PointPolygonsMap,
  POINT_TYPE_OPTIONS,
  POINT_TYPE_LABELS,
  SIGNAL_SEVERITY_LABELS,
  POLYGON_DRAW_METHOD_OPTIONS,
  type CropTypeOption,
  normalizeDbCustomPointRows,
  normalizeCropTypeRows,
  escapeHtml,
  calculatePolygonAreaHectares,
  formatHectares,
  normalizePolygonScore,
  scoreToPolygonColor,
  createRectangleVertices,
  createCircleVertices,
  normalizeMetricValue,
  normalizePointPolygon,
  normalizeFarmCropInsight,
  formatMetric,
  formatScoreValue,
  getScoreTextColor,
  normalizeExternalLink,
} from '@/components/dashboard/map/map-model'

const QATAR_CENTER = { lat: 25.3548, lng: 51.1839 }
const DEFAULT_ZOOM = 10
const DEFAULT_FARM_ZOOM = 17
const DEFAULT_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

function isLeafletUiClick(event: { originalEvent?: Event } | null | undefined) {
  const target = event?.originalEvent?.target
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      '.leaflet-marker-icon, .leaflet-popup, .leaflet-popup-content, .leaflet-control, .custom-marker, .leaflet-interactive'
    )
  )
}

/* Stable empty defaults. A literal `= []` in the signature is a NEW array on
   every render, and these props are dependencies of the effects that tear
   down and rebuild every marker and polygon: each zoom or keystroke used to
   redraw the whole map. */
const NO_WEATHER_POINTS: NonNullable<SatelliteMapProps['weatherGridPoints']> = []
const NO_WEATHER_LINES: NonNullable<SatelliteMapProps['weatherGridLines']> = []
const NO_BOUNDARY: NonNullable<SatelliteMapProps['weatherBoundary']> = []
const NO_HARVEST_FIELDS: NonNullable<SatelliteMapProps['harvestFields']> = []
const NO_RINGS: NonNullable<SatelliteMapProps['harvestFieldRings']> = []
const NO_VERTICES: NonNullable<SatelliteMapProps['harvestFieldVertices']> = []

/* The zoom readout listens to the map itself: as state of the 3,000-line
   map component, every zoom step re-rendered all of it. */
function ZoomReadout({ map }: { map: MapController | null }) {
  const [zoom, setZoom] = useState(() => map?.getZoom() ?? DEFAULT_ZOOM)
  useEffect(() => {
    if (!map) return
    const update = () => setZoom(map.getZoom())
    update()
    map.on('zoomend', update)
    return () => {
      map.off('zoomend', update)
    }
  }, [map])
  return <>{zoom}</>
}

/* Writes to the operations API drop the shared GET cache, so the map, the
   workspace beside it and the header search all read the new data. */
async function mutateOperations(input: string, init: RequestInit) {
  try {
    return await fetch(input, init)
  } finally {
    invalidateShared('/api/operations/')
  }
}

/** Latest value in a ref: callbacks from the parent without making them effect deps. */
function useLatestRef<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

export function SatelliteMap({
  locale = 'en',
  targetPointId = null,
  targetFarmId = null,
  targetCropFilter = null,
  targetFocusToken = null,
  targetZoom,
  isLateralMode = false,
  lateralPanelOpen = false,
  onMapClick: onMapClickProp,
  weatherGridPoints = NO_WEATHER_POINTS,
  selectedWeatherGridPointId = null,
  weatherGridLines = NO_WEATHER_LINES,
  weatherBoundary = NO_BOUNDARY,
  onWeatherGridPointClick: onWeatherGridPointClickProp,
  harvestFields = NO_HARVEST_FIELDS,
  selectedHarvestParcelId = null,
  onHarvestFieldClick: onHarvestFieldClickProp,
  mapTileUrl = null,
  harvestRasterOverlay: harvestRasterOverlayProp = null,
  harvestFocusBounds = null,
  harvestFieldDrawActive = false,
  harvestFieldDrawMethod = 'vertex',
  harvestFieldRings = NO_RINGS,
  harvestFieldVertices = NO_VERTICES,
  onHarvestFieldRingsChange: onHarvestFieldRingsChangeProp,
  onHarvestFieldVerticesChange: onHarvestFieldVerticesChangeProp,
  activeMapLayers,
}: SatelliteMapProps) {
  const { tr } = useI18n()
  const showToast = useToast()
  const confirmDialog = useConfirm()

  /* Parent callbacks are usually inline arrows (new on every render). Keep
     them in refs and hand the effects stable wrappers; `undefined` is kept
     as `undefined` so "is there a handler?" checks still work. */
  const onMapClickRef = useLatestRef(onMapClickProp)
  const onWeatherGridPointClickRef = useLatestRef(onWeatherGridPointClickProp)
  const onHarvestFieldClickRef = useLatestRef(onHarvestFieldClickProp)
  const onHarvestFieldRingsChangeRef = useLatestRef(onHarvestFieldRingsChangeProp)
  const onHarvestFieldVerticesChangeRef = useLatestRef(onHarvestFieldVerticesChangeProp)
  const hasMapClick = Boolean(onMapClickProp)
  const hasWeatherGridPointClick = Boolean(onWeatherGridPointClickProp)
  const hasHarvestFieldClick = Boolean(onHarvestFieldClickProp)
  const hasHarvestFieldRingsChange = Boolean(onHarvestFieldRingsChangeProp)
  const hasHarvestFieldVerticesChange = Boolean(onHarvestFieldVerticesChangeProp)
  const onMapClick = useMemo<SatelliteMapProps['onMapClick']>(
    () => (hasMapClick ? (...args) => onMapClickRef.current?.(...args) : undefined),
    [hasMapClick, onMapClickRef]
  )
  const onWeatherGridPointClick = useMemo<SatelliteMapProps['onWeatherGridPointClick']>(
    () => (hasWeatherGridPointClick ? (...args) => onWeatherGridPointClickRef.current?.(...args) : undefined),
    [hasWeatherGridPointClick, onWeatherGridPointClickRef]
  )
  const onHarvestFieldClick = useMemo<SatelliteMapProps['onHarvestFieldClick']>(
    () => (hasHarvestFieldClick ? (...args) => onHarvestFieldClickRef.current?.(...args) : undefined),
    [hasHarvestFieldClick, onHarvestFieldClickRef]
  )
  const onHarvestFieldRingsChange = useMemo<SatelliteMapProps['onHarvestFieldRingsChange']>(
    () => (hasHarvestFieldRingsChange ? (...args) => onHarvestFieldRingsChangeRef.current?.(...args) : undefined),
    [hasHarvestFieldRingsChange, onHarvestFieldRingsChangeRef]
  )
  const onHarvestFieldVerticesChange = useMemo<SatelliteMapProps['onHarvestFieldVerticesChange']>(
    () => (hasHarvestFieldVerticesChange ? (...args) => onHarvestFieldVerticesChangeRef.current?.(...args) : undefined),
    [hasHarvestFieldVerticesChange, onHarvestFieldVerticesChangeRef]
  )

  /* The raster overlay arrives as a fresh object each render: key it on what
     actually changes the image so the overlay is not re-added every time. */
  const rasterKey = harvestRasterOverlayProp
    ? `${harvestRasterOverlayProp.imageUrl}|${harvestRasterOverlayProp.bounds.flat().join(',')}|${harvestRasterOverlayProp.opacity ?? ''}`
    : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const harvestRasterOverlay = useMemo(() => harvestRasterOverlayProp, [rasterKey])
  const { user } = useAuth()
  const { organization } = useOrganization()

  const layerVisibility = useMemo(
    () => (activeMapLayers ? resolveMapLayerVisibility(activeMapLayers) : null),
    [activeMapLayers]
  )

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<MapController | null>(null)
  const leafletRef = useRef<LeafletModule | null>(null)
  const markerInstancesRef = useRef<Layer[]>([])
  const weatherGridMarkerInstancesRef = useRef<Layer[]>([])
  const harvestFieldLayerInstancesRef = useRef<Layer[]>([])
  const harvestRasterOverlayRef = useRef<Layer | null>(null)
  const harvestDraftLayerRef = useRef<Layer | null>(null)
  const harvestDraftVertexInstancesRef = useRef<Layer[]>([])
  const tileLayerRef = useRef<Layer | null>(null)
  const polygonInstancesRef = useRef<Layer[]>([])
  const coordinateMarkerRef = useRef<Layer | null>(null)
  const signalMarkerInstancesRef = useRef<Layer[]>([])
  const draftPolylineRef = useRef<Layer | null>(null)
  const draftVertexInstancesRef = useRef<Layer[]>([])
  const polygonDrawPointIdRef = useRef<string | null>(null)
  const lastClearedFocusTokenRef = useRef<string | null>(null)
  const insightsRequestIdRef = useRef(0)

  const [isLoading, setIsLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  // The live map for small children (zoom readout); effects keep using the ref.
  const [mapForReadout, setMapForReadout] = useState<MapController | null>(null)
  const [customPoints, setCustomPoints] = useState<CustomPoint[]>([])
  const [nationalFarmMarkers, setNationalFarmMarkers] = useState<MapMarker[]>([])
  const [intelligenceSignals, setIntelligenceSignals] = useState<IntelligenceSignal[]>([])
  const [operationsFarmTarget, setOperationsFarmTarget] = useState<OperationsFarmTarget | null>(null)
  const [pointPolygons, setPointPolygons] = useState<PointPolygonsMap>({})
  const [isAddPointMode, setIsAddPointMode] = useState(false)
  const [newPointType, setNewPointType] = useState<MapPointType>('custom')
  const [activePointId, setActivePointId] = useState<string | null>(null)
  const [polygonCropFilterQuery, setPolygonCropFilterQuery] = useState('')
  const [coordinateQuery, setCoordinateQuery] = useState('')
  const [coordinateSearchOpen, setCoordinateSearchOpen] = useState(false)
  const [coordinateSearchError, setCoordinateSearchError] = useState<string | null>(null)
  const [farmCropInsightsByPoint, setFarmCropInsightsByPoint] = useState<Record<string, FarmCropInsight[]>>({})
  const [cropTypeOptions, setCropTypeOptions] = useState<CropTypeOption[]>([])
  const [insightsModalPointId, setInsightsModalPointId] = useState<string | null>(null)
  const [isInsightsModalOpen, setIsInsightsModalOpen] = useState(false)
  const [isInsightsModalLoading, setIsInsightsModalLoading] = useState(false)
  const [insightsModalError, setInsightsModalError] = useState<string | null>(null)
  const [polygonDrawPointId, setPolygonDrawPointId] = useState<string | null>(null)
  const [polygonDrawMethod, setPolygonDrawMethod] = useState<PolygonDrawMethod>('vertex')
  const [shapeSeedVertex, setShapeSeedVertex] = useState<PolygonVertex | null>(null)
  const harvestShapeSeedRef = useRef<PolygonVertex | null>(null)
  const harvestDrawMethodRef = useRef(harvestFieldDrawMethod)
  const [harvestShapeSeedVertex, setHarvestShapeSeedVertex] = useState<PolygonVertex | null>(null)
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
      const response = await sharedFetch('/api/operations/custom-map-points')
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
        const response = await sharedFetch('/api/operations/crop-types', { ttlMs: 10 * 60_000 })
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
        const response = await sharedFetch('/api/operations/custom-point-polygons')
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
        const response = await sharedFetch('/api/operations/farm-crop-insights')
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

  const customPointById = useMemo(() => new Map(customPoints.map((point) => [point.id, point])), [customPoints])

  const mapMarkers = useMemo<MapMarker[]>(() => {
    const custom = customPoints.map((point) => ({
      id: point.id,
      lat: point.lat,
      lng: point.lng,
      label: point.label,
      type: point.pointType,
    }))
    if (!layerVisibility?.showFarms) return custom
    const merged = [...custom]
    const seen = new Set(custom.map((entry) => entry.id))
    for (const marker of nationalFarmMarkers) {
      if (!seen.has(marker.id)) {
        seen.add(marker.id)
        merged.push(marker)
      }
    }
    return merged
  }, [customPoints, layerVisibility?.showFarms, nationalFarmMarkers])

  useEffect(() => {
    if (!layerVisibility?.showFarms) {
      setNationalFarmMarkers([])
      return
    }

    let cancelled = false
    async function loadNationalFarms() {
      try {
        const response = await sharedFetch('/api/operations/farms')
        const payload = await response.json()
        if (!response.ok || cancelled || !Array.isArray(payload)) return
        const markers = payload
          .map((row: Record<string, unknown>) => {
            const lat = Number(row.gps_latitude ?? row.gpsLatitude)
            const lng = Number(row.gps_longitude ?? row.gpsLongitude)
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
            const id = typeof row.id === 'string' ? row.id : ''
            if (!id) return null
            const label =
              (typeof row.name_en === 'string' && row.name_en.trim()) ||
              (typeof row.name === 'string' && row.name.trim()) ||
              (typeof row.name_ar === 'string' && row.name_ar.trim()) ||
              `Farm ${id.slice(0, 8)}`
            return { id, lat, lng, label, type: 'farm' as MapPointType }
          })
          .filter((marker): marker is MapMarker => Boolean(marker))
        if (!cancelled) setNationalFarmMarkers(markers)
      } catch {
        if (!cancelled) setNationalFarmMarkers([])
      }
    }

    loadNationalFarms()
    return () => {
      cancelled = true
    }
  }, [layerVisibility?.showFarms])

  useEffect(() => {
    if (!layerVisibility?.showIntelligenceSignals) {
      setIntelligenceSignals([])
      return
    }

    let cancelled = false
    async function loadSignals() {
      try {
        const response = await sharedFetch('/api/watchtower/summary?timeframe=7d')
        const payload = await response.json()
        if (!response.ok || cancelled) return
        setIntelligenceSignals(Array.isArray(payload.signals) ? payload.signals : [])
      } catch {
        if (!cancelled) setIntelligenceSignals([])
      }
    }

    loadSignals()
    return () => {
      cancelled = true
    }
  }, [layerVisibility?.showIntelligenceSignals])

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

  const pointTypeOptions = useMemo(
    () => POINT_TYPE_OPTIONS.map((option) => ({ ...option, label: tr(option.label) })),
    [tr]
  )

  const [editingPointId, setEditingPointId] = useState<string | null>(null)
  const editingPoint = useMemo(
    () => (editingPointId ? customPointById.get(editingPointId) ?? null : null),
    [customPointById, editingPointId]
  )
  const editingPointInitial = useMemo<PointEditValues | null>(
    () =>
      editingPoint
        ? { label: editingPoint.label, pointType: editingPoint.pointType, externalUrl: editingPoint.externalUrl || '' }
        : null,
    [editingPoint]
  )

  /* Opens the edit form (it used to be three window.prompt() in a row). */
  const handleEditPoint = useCallback((pointId: string) => setEditingPointId(pointId), [])

  const savePointEdit = useCallback(
    async (values: PointEditValues) => {
      const pointId = editingPointId
      setEditingPointId(null)
      const target = pointId ? customPoints.find((point) => point.id === pointId) : null
      if (!pointId || !target) return
      const nextLabel = values.label.trim() || target.label
      const nextType = parsePointTypeInput(values.pointType, target.pointType)
      const nextExternalUrl = normalizeExternalLink(values.externalUrl)
      const nextPoint = { ...target, label: nextLabel, pointType: nextType, externalUrl: nextExternalUrl }
      setCustomPoints((prev) =>
        prev.map((entry) =>
          entry.id === pointId
            ? { ...entry, label: nextLabel, pointType: nextType, externalUrl: nextExternalUrl }
            : entry
        )
      )
      try {
        const response = await mutateOperations('/api/operations/custom-map-points', {
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
          showToast(payload?.error || tr('Failed to update point link.'), 'error')
          setCustomPoints((prev) => prev.map((entry) => (entry.id === pointId ? target : entry)))
          return
        }
        const [normalized] = normalizeDbCustomPointRows([payload])
        if (normalized) {
          setCustomPoints((prev) => prev.map((entry) => (entry.id === pointId ? normalized : entry)))
        }
      } catch {
        showToast(tr('Failed to update point link.'), 'error')
        setCustomPoints((prev) => prev.map((entry) => (entry.id === pointId ? target : entry)))
      }
    },
    [customPoints, editingPointId, parsePointTypeInput, showToast, tr]
  )

  const handleDeletePoint = useCallback(
    async (pointId: string) => {
      const target = customPoints.find((point) => point.id === pointId)
      if (!target) return
      const confirmed = await confirmDialog(
        tr('Delete point "{name}" and all linked polygons?', { name: target.label })
      )
      if (!confirmed) return

      try {
        await mutateOperations(`/api/operations/custom-point-polygons?pointId=${encodeURIComponent(pointId)}`, {
          method: 'DELETE',
        })
      } catch {
        // Continue local cleanup even if remote delete fails.
      }

      try {
        await mutateOperations(`/api/operations/custom-map-points?id=${encodeURIComponent(pointId)}`, {
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
    [customPoints, resetDraftMetadata, confirmDialog, tr]
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
      draftPolygonName.trim() || `Polygon ${(pointPolygons[polygonDrawPointId]?.length || 0) + 1}` /* stored name: stays in English */
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
      const response = await mutateOperations('/api/operations/custom-point-polygons', {
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
        showToast(payload?.error || tr('Failed to save polygon metrics.'), 'error')
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
    showToast,
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
    tr,
  ])

  const [editingPolygon, setEditingPolygon] = useState<PointPolygon | null>(null)
  const editingPolygonInitial = useMemo<PolygonEditValues | null>(
    () =>
      editingPolygon
        ? {
            name: editingPolygon.name,
            score: editingPolygon.score,
            cropName: editingPolygon.crop.cropName || '',
            variety: editingPolygon.crop.variety || '',
            sowingDate: editingPolygon.crop.sowingDate || '',
            expectedHarvestDate: editingPolygon.crop.expectedHarvestDate || '',
            notes: editingPolygon.crop.notes || '',
            estimatedProductionTons: String(editingPolygon.metrics.estimatedProductionTons ?? ''),
            energyConsumptionKwh: String(editingPolygon.metrics.energyConsumptionKwh ?? ''),
            waterConsumptionM3: String(editingPolygon.metrics.waterConsumptionM3 ?? ''),
          }
        : null,
    [editingPolygon]
  )

  /* Opens the edit form (it used to be up to twelve window.prompt() in a row). */
  const handleEditPolygonData = useCallback((polygon: PointPolygon) => setEditingPolygon(polygon), [])

  const savePolygonEdit = useCallback(
    async (values: PolygonEditValues) => {
      const polygon = editingPolygon
      setEditingPolygon(null)
      if (!polygon) return
      const nextName = values.name.trim() || polygon.name
      const nextScore = normalizePolygonScore(String(values.score), polygon.score)
      const normalizedCropName = values.cropName.trim()
      const canonicalCropName = cropNameByNormalized.get(normalizedCropName.toLowerCase()) || normalizedCropName
      const nextVariety = values.variety.trim()
      const nextSowingDate = values.sowingDate
      const nextHarvestDate = values.expectedHarvestDate
      const nextNotes = values.notes
      const nextProductionRaw = values.estimatedProductionTons
      const nextEnergyRaw = values.energyConsumptionKwh
      const nextWaterRaw = values.waterConsumptionM3

      try {
        const response = await mutateOperations('/api/operations/custom-point-polygons', {
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
          showToast(payload?.error || tr('Failed to update polygon metrics.'), 'error')
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
        showToast(tr('Failed to update polygon metrics.'), 'error')
      }
    },
    [cropNameByNormalized, editingPolygon, refreshPointInsights, showToast, tr]
  )

  const handleDeletePolygon = useCallback(
    async (polygon: PointPolygon) => {
      const confirmed = await confirmDialog(
        tr('Delete polygon "{name}"?', { name: polygon.name })
      )
      if (!confirmed) return

      try {
        const response = await mutateOperations(
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
    [refreshPointInsights, confirmDialog, tr]
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

  useEffect(() => {
    if (!targetFarmId || targetPointId) {
      setOperationsFarmTarget(null)
      return
    }

    let cancelled = false

    const loadFarmTarget = async () => {
      try {
        const response = await fetch(`/api/operations/farms?id=${encodeURIComponent(targetFarmId)}`, {
          cache: 'no-store',
        })
        if (!response.ok || cancelled) return
        const row = (await response.json()) as Record<string, unknown>
        const lat = Number(row.gps_latitude ?? row.gpsLatitude ?? row.lat)
        const lng = Number(row.gps_longitude ?? row.gpsLongitude ?? row.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
        const label =
          (typeof row.name_en === 'string' && row.name_en.trim()) ||
          (typeof row.name === 'string' && row.name.trim()) ||
          (typeof row.name_ar === 'string' && row.name_ar.trim()) ||
          `Farm ${targetFarmId.slice(0, 8)}`
        if (!cancelled) {
          setOperationsFarmTarget({ id: targetFarmId, label, lat, lng })
        }
      } catch {
        if (!cancelled) setOperationsFarmTarget(null)
      }
    }

    void loadFarmTarget()

    return () => {
      cancelled = true
    }
  }, [targetFarmId, targetPointId])

  const resolvedTargetFarm = useMemo(() => {
    if (targetPointId) return null
    if (operationsFarmTarget) {
      return {
        id: operationsFarmTarget.id,
        lat: operationsFarmTarget.lat,
        lng: operationsFarmTarget.lng,
        label: operationsFarmTarget.label,
        type: 'farm' as MapPointType,
      }
    }
    if (!isFarmCompanyContext) return null
    return mapMarkers.find((marker) => marker.type === 'farm') || null
  }, [isFarmCompanyContext, mapMarkers, operationsFarmTarget, targetPointId])

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
  const normalizedTargetCropName = targetCropFilter?.trim().toLowerCase() || ''
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

  const activePointInsights = insightsModalPointId ? farmCropInsightsByPoint[insightsModalPointId] || [] : []
  const activeInsightsPointPolygons = insightsModalPointId
    ? pointPolygons[insightsModalPointId] || []
    : []
  const insightsModalPoint = useMemo(
    () => (insightsModalPointId ? customPoints.find((point) => point.id === insightsModalPointId) || null : null),
    [customPoints, insightsModalPointId]
  )
  const activeInsightsPointLabel = insightsModalPoint?.label || tr('Selected point')
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
        setInsightsModalError(tr('Failed to load farm crop insights.'))
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
      setInsightsModalError(tr('Failed to load farm crop insights.'))
    } finally {
      if (requestId !== insightsRequestIdRef.current) return
      setIsInsightsModalLoading(false)
    }
  }, [tr])

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

  const clearCoordinatePin = useCallback(() => {
    coordinateMarkerRef.current?.remove?.()
    coordinateMarkerRef.current = null
  }, [])

  const goToCoordinates = useCallback(() => {
    const parsed = parseCoordinateQuery(coordinateQuery)
    if (!parsed) {
      setCoordinateSearchError(
        tr('Enter latitude and longitude, for example 25.2854, 51.5310')
      )
      return
    }
    const map = mapInstanceRef.current
    if (!map) return
    setCoordinateSearchError(null)
    map.flyTo([parsed.lat, parsed.lng], COORDINATE_SEARCH_ZOOM, { duration: 1.2 })
    clearCoordinatePin()
    const L = leafletRef.current
    if (!L) return
    coordinateMarkerRef.current = L.circleMarker([parsed.lat, parsed.lng], {
      radius: 8,
      color: MAP_COLORS.ink,
      weight: 2,
      fillColor: MAP_COLORS.cream,
      fillOpacity: 1,
      interactive: false,
    }).addTo(map)
  }, [clearCoordinatePin, coordinateQuery, tr])

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
    /* React (StrictMode in dev, fast refresh) mounts, cleans up and mounts
       again while the first run is still awaiting the Leaflet import: both
       runs then reached `L.map()` on the same div ("Map container is already
       initialized"). The flag stops a cancelled run after every await, and
       the container check is repeated once the imports have resolved. */
    let cancelled = false
    const initMap = async () => {
      const container = mapRef.current as (HTMLDivElement & { _leaflet_id?: number }) | null
      if (!container) return

      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      if (cancelled || !mapRef.current) return
      if ((mapRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id) {
        // A previous instance was never removed (hot reload): drop the stale id.
        delete (mapRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id
      }
      leafletRef.current = L
      const createdMap = L.map(mapRef.current, {
        center: [QATAR_CENTER.lat, QATAR_CENTER.lng],
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
        attributionControl: false,
      }) as MapController
      map = createdMap
      tileLayerRef.current = L.tileLayer(DEFAULT_TILE_URL, { maxZoom: 19 }).addTo(createdMap)
      mapInstanceRef.current = createdMap
      setMapForReadout(createdMap)
      setIsLoading(false)
      setMapReady(true)
    }

    initMap()
    return () => {
      cancelled = true
      markerInstancesRef.current.forEach((marker) => marker.remove?.())
      markerInstancesRef.current = []
      polygonInstancesRef.current.forEach((layer) => layer.remove?.())
      polygonInstancesRef.current = []
      draftPolylineRef.current?.remove?.()
      draftPolylineRef.current = null
      draftVertexInstancesRef.current.forEach((marker) => marker.remove?.())
      draftVertexInstancesRef.current = []
      coordinateMarkerRef.current?.remove?.()
      coordinateMarkerRef.current = null
      if (map) {
        map.remove()
        mapInstanceRef.current = null
      }
      setMapForReadout(null)
      leafletRef.current = null
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return
    const map = mapInstanceRef.current
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize?.()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [isLateralMode, lateralPanelOpen, mapReady])

  /* Leaflet only listens to window resizes. The container also changes size
     when the navigation rail collapses or expands: without this the tiles
     stop short and clicks land on the wrong coordinates. */
  useEffect(() => {
    if (!mapReady || !mapRef.current || typeof ResizeObserver === 'undefined') return
    let frame = 0
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => mapInstanceRef.current?.invalidateSize?.())
    })
    observer.observe(mapRef.current)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [mapReady])

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
      /* Nodes are SQUARES (Brand Book p.81: small white squares on the
         satellite view). The type is told by the fill, in the palette. */
      const colors = {
        farm: MAP_COLORS.white,
        facility: MAP_COLORS.cream,
        sensor: MAP_COLORS.sage300,
        custom: MAP_COLORS.stone300,
      }
      const scoreStats = pointScoreStatsById[markerId]
      const scoreBasedColor =
        scoreStats && scoreStats.count > 0 && scoreStats.average !== null
          ? scoreToPolygonColor(scoreStats.average)
          : MAP_COLORS.unknown
      const color = scoreStats ? scoreBasedColor : colors[type] || colors.farm
      return L.divIcon({
        className: 'custom-marker',
        html: `
 <div style="
 width: 16px;
 height: 16px;
 background: ${color};
 border: 2px solid ${MAP_COLORS.ink};
 border-radius: 3px;
 box-shadow: 0 0 0 2px rgba(255,255,255,0.9), 0 6px 14px -6px rgba(17,30,19,.6);
 cursor: pointer;
 "></div>
 `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
    }

    markerInstancesRef.current.forEach((marker) => marker.remove?.())
    const farmsLayerEnabled = layerVisibility ? layerVisibility.showFarms : true

    if (!layerVisibility) {
      if (weatherGridPoints.length > 0 || harvestFields.length > 0 || hideMarkersForCropFocus) {
        markerInstancesRef.current = []
        return
      }
    } else if (!farmsLayerEnabled || hideMarkersForCropFocus) {
      markerInstancesRef.current = []
      return
    } else if (harvestFields.length > 0 && !layerVisibility.showFields) {
      markerInstancesRef.current = []
      return
    }

    markerInstancesRef.current = mapMarkers.map((marker) => {
      const customPoint = customPointById.get(marker.id) || null
      const markerInstance = L.marker([marker.lat, marker.lng], {
        icon: createMarkerIcon(marker.type, marker.id),
      }).addTo(map)

      if (customPoint) {
        markerInstance.on('click', (event: LeafletMouseEvent) => {
          event?.originalEvent?.preventDefault?.()
          event?.originalEvent?.stopPropagation?.()
          setActivePointId(customPoint.id)
          openPointInsightsModal(customPoint.id)
        })
        return markerInstance
      }

      const popupContent = `
 <div class="g-map-pop">
 <strong class="g-map-pop__title">${escapeHtml(marker.label)}</strong>
 <span class="g-map-pop__meta">${escapeHtml(
            tr('Type: {type}', { type: tr(POINT_TYPE_LABELS[marker.type]) })
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
    customPointById,
    isLateralMode,
    mapMarkers,
    mapReady,
    normalizedCropFilter,
    normalizedTargetCropName,
    openPointInsightsModal,
    pointScoreStatsById,
    weatherGridPoints,
    harvestFields,
    layerVisibility,
    tr,
  ])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletRef.current) return
    const L = leafletRef.current
    const map = mapInstanceRef.current

    signalMarkerInstancesRef.current.forEach((marker) => marker.remove?.())
    signalMarkerInstancesRef.current = []

    if (!layerVisibility?.showIntelligenceSignals || intelligenceSignals.length === 0) return

    for (const signal of intelligenceSignals) {
      if (signal.lat === undefined || signal.lng === undefined) continue
      const color = SIGNAL_SEVERITY_COLORS[signal.severity] || SIGNAL_SEVERITY_COLORS.info
      const marker = L.marker([signal.lat, signal.lng], {
        icon: L.divIcon({
          className: 'custom-marker',
          html: `
 <div style="
 width: 16px;
 height: 16px;
 background: ${color};
 border: 2px solid rgba(255,255,255,0.95);
 border-radius: 3px;
 box-shadow: 0 6px 14px -6px rgba(17,30,19,.6);
 "></div>
 `,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      }).addTo(map)

      marker.bindPopup(
        `<div class="g-map-pop">
          <span class="g-map-pop__tag"><i style="background:${color}"></i>${escapeHtml(SIGNAL_SEVERITY_LABELS[signal.severity] ? tr(SIGNAL_SEVERITY_LABELS[signal.severity]) : signal.severity.charAt(0).toUpperCase() + signal.severity.slice(1))}</span>
          <strong class="g-map-pop__title">${escapeHtml(signal.title)}</strong>
          <span class="g-map-pop__meta">${escapeHtml(signal.summary)}</span>
        </div>`,
        { className: 'custom-popup' }
      )
      signalMarkerInstancesRef.current.push(marker)
    }
  }, [intelligenceSignals, layerVisibility?.showIntelligenceSignals, mapReady, tr])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletRef.current) return
    const L = leafletRef.current
    const map = mapInstanceRef.current
    const nextTileUrl = mapTileUrl || DEFAULT_TILE_URL

    if (tileLayerRef.current) {
      tileLayerRef.current.remove?.()
      tileLayerRef.current = null
    }

    tileLayerRef.current = L.tileLayer(nextTileUrl, { maxZoom: 19 }).addTo(map)
  }, [mapReady, mapTileUrl])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletRef.current) return
    const L = leafletRef.current
    const map = mapInstanceRef.current

    harvestFieldLayerInstancesRef.current.forEach((layer) => layer.remove?.())
    harvestFieldLayerInstancesRef.current = []

    if (harvestFields.length === 0) return
    if (layerVisibility && !layerVisibility.showFields) return

    const hasRasterOverlay = Boolean(harvestRasterOverlay?.imageUrl)

    for (const field of harvestFields) {
      const selected = field.parcel_id === selectedHarvestParcelId
      for (const ring of field.rings) {
        if (ring.length < 3) continue
        const layer = L.polygon(
          ring.map((vertex) => [vertex.lat, vertex.lng]),
          {
            color: hasRasterOverlay ? (selected ? MAP_COLORS.white : 'rgba(255,255,255,0.7)') : selected ? MAP_COLORS.white : MAP_COLORS.cream,
            weight: hasRasterOverlay ? (selected ? 3 : 2) : selected ? 4 : 2,
            opacity: 1,
            fillColor: hasRasterOverlay ? 'transparent' : MAP_COLORS.cream,
            fillOpacity: hasRasterOverlay ? 0.01 : 0.08,
            interactive: !harvestFieldDrawActive,
            bubblingMouseEvents: harvestFieldDrawActive,
            className: 'leaflet-harvest-field-polygon',
          }
        ).addTo(map)

        if (!harvestFieldDrawActive) {
          layer.bindTooltip(
            `<strong class="g-map-pop__title">${escapeHtml(field.name)}</strong><span class="g-map-pop__meta">${escapeHtml(field.crop)}</span>`,
            { direction: 'top', opacity: 0.95, className: 'custom-tooltip' }
          )

          layer.on('click', (event: LeafletMouseEvent) => {
            L.DomEvent.stop(event)
            if (!onHarvestFieldClick || harvestFieldDrawActive) return
            onHarvestFieldClick(field)
          })
          layer.bringToFront?.()
        }

        harvestFieldLayerInstancesRef.current.push(layer)
      }
    }

    return () => {
      harvestFieldLayerInstancesRef.current.forEach((layer) => layer.remove?.())
      harvestFieldLayerInstancesRef.current = []
    }
  }, [
    harvestFieldDrawActive,
    harvestFields,
    harvestRasterOverlay,
    layerVisibility?.showFields,
    mapReady,
    onHarvestFieldClick,
    selectedHarvestParcelId,
  ])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletRef.current || !selectedHarvestParcelId) return
    if (isLateralMode && !lateralPanelOpen) return

    const map = mapInstanceRef.current
    const L = leafletRef.current
    const zoom =
      Number.isFinite(targetZoom) && (targetZoom as number) >= 3 && (targetZoom as number) <= 19
        ? (targetZoom as number)
        : 13

    const focusSelectedField = () => {
      const selectedField = harvestFields.find((field) => field.parcel_id === selectedHarvestParcelId)
      if (selectedField) {
        const vertices = selectedField.rings.flat()
        if (vertices.length >= 3) {
          const bounds = L.latLngBounds(vertices.map((vertex) => [vertex.lat, vertex.lng]))
          map.flyToBounds(bounds, { padding: [24, 24], duration: 1.1, maxZoom: zoom })
          return
        }

        map.flyTo([selectedField.centroid.lat, selectedField.centroid.lng], zoom, { duration: 1.1 })
        return
      }

      if (harvestFocusBounds) {
        const [[south, west], [north, east]] = harvestFocusBounds
        const bounds = L.latLngBounds([south, west], [north, east])
        map.flyToBounds(bounds, { padding: [24, 24], duration: 1.1, maxZoom: zoom })
      }
    }

    const runFocus = () => {
      map.invalidateSize?.()
      focusSelectedField()
    }

    const frame = window.requestAnimationFrame(runFocus)
    const settleTimeout = isLateralMode
      ? window.setTimeout(runFocus, 320)
      : window.setTimeout(runFocus, 0)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(settleTimeout)
    }
  }, [
    harvestFields,
    harvestFocusBounds,
    isLateralMode,
    lateralPanelOpen,
    mapReady,
    selectedHarvestParcelId,
    targetFocusToken,
    targetZoom,
  ])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletRef.current) return
    const L = leafletRef.current
    const map = mapInstanceRef.current

    if (harvestRasterOverlayRef.current) {
      harvestRasterOverlayRef.current.remove?.()
      harvestRasterOverlayRef.current = null
    }

    if (!harvestRasterOverlay?.imageUrl || !harvestRasterOverlay.bounds) return

    const rasterLayer = createHarvestRasterLayer(L, {
      imageUrl: harvestRasterOverlay.imageUrl,
      bounds: harvestRasterOverlay.bounds,
      opacity: harvestRasterOverlay.opacity ?? 0.5,
    })
    rasterLayer.addTo(map)
    harvestRasterOverlayRef.current = rasterLayer

    return () => {
      if (harvestRasterOverlayRef.current) {
        harvestRasterOverlayRef.current.remove?.()
        harvestRasterOverlayRef.current = null
      }
    }
  }, [harvestRasterOverlay, mapReady])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletRef.current) return
    const L = leafletRef.current
    const map = mapInstanceRef.current

    weatherGridMarkerInstancesRef.current.forEach((layer) => layer.remove?.())
    weatherGridMarkerInstancesRef.current = []

    if (layerVisibility && !layerVisibility.showWeatherClimate) return

    if (weatherGridPoints.length === 0 && weatherGridLines.length === 0 && weatherBoundary.length <= 2) {
      return
    }

    const layers: Layer[] = []

    if (weatherBoundary.length > 2) {
      const outline = L.polyline(
        [...weatherBoundary, weatherBoundary[0]].map((point) => [point.lat, point.lng]),
        {
          color: MAP_COLORS.cream,
          weight: 2,
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
          color: MAP_COLORS.cream,
          weight: 1,
          opacity: 0.55,
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
              color: MAP_COLORS.white,
              weight: selected ? 2.5 : 0,
              opacity: selected ? 1 : 0,
              fillColor: MAP_COLORS.cream,
              fillOpacity: selected ? 0.12 : 0.01,
              interactive: true,
              bubblingMouseEvents: false,
            }
          )
        : L.circleMarker([point.lat, point.lng], {
            radius: selected ? 7 : 5,
            color: selected ? MAP_COLORS.ink : MAP_COLORS.cream,
            weight: selected ? 2 : 1,
            fillColor: selected ? MAP_COLORS.white : MAP_COLORS.cream,
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
      clickLayer.on('click', (event: LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(event)
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
  }, [
    layerVisibility?.showWeatherClimate,
    mapReady,
    onWeatherGridPointClick,
    selectedWeatherGridPointId,
    weatherBoundary,
    weatherGridLines,
    weatherGridPoints,
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

    if (layerVisibility && !layerVisibility.showPolygons) return
    if (weatherGridPoints.length > 0 || harvestFields.length > 0) return

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
        : layerVisibility?.showPolygons
          ? Object.values(pointPolygons).flat()
          : []

    for (const polygon of polygonsToRender) {
        if (polygon.vertices.length < 3) continue
        const crop = polygon.crop
        const polygonScore = normalizePolygonScore(polygon.score, 50)
        const polygonColor = layerVisibility
          ? resolvePolygonColor(layerVisibility.polygonColorMode, polygonScore, polygon.metrics)
          : scoreToPolygonColor(polygonScore)
        const areaHectares = calculatePolygonAreaHectares(polygon.vertices)
        const metrics = polygon.metrics
        const row = (label: string, value: string) =>
          `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
        const popupLines = [
          `<strong class="g-map-pop__title">${escapeHtml(polygon.name)}</strong>`,
          `<span class="g-map-pop__tag"><i style="background:${escapeHtml(polygonColor)}"></i>${escapeHtml(tr('Score {score}/100', { score: polygonScore }))}</span>`,
          `<dl class="g-map-pop__rows">`,
          row(tr('Area'), `${formatHectares(areaHectares)} ha`),
          crop.cropName ? row(tr('Crop'), crop.cropName) : '',
          crop.variety ? row(tr('Variety'), crop.variety) : '',
          row(tr('Production'), formatMetric(metrics.estimatedProductionTons, 'tons')),
          row(tr('Energy'), formatMetric(metrics.energyConsumptionKwh, 'kWh')),
          row(tr('Water'), formatMetric(metrics.waterConsumptionM3, 'm³')),
          crop.sowingDate ? row(tr('Sowing'), crop.sowingDate) : '',
          crop.expectedHarvestDate ? row(tr('Harvest'), crop.expectedHarvestDate) : '',
          `</dl>`,
          crop.notes ? `<span class="g-map-pop__meta">${escapeHtml(crop.notes)}</span>` : '',
        ].join('')
        const popupActions = `
 <div class="g-map-pop__actions">
 <button data-edit-polygon-id="${polygon.id}" class="g-map-pop__btn">${escapeHtml(tr('Edit polygon'))}</button>
 <button data-delete-polygon-id="${polygon.id}" class="g-map-pop__btn g-map-pop__btn--danger">${escapeHtml(tr('Delete polygon'))}</button>
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
        layer.on('click', (event: LeafletMouseEvent) => {
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
          color: MAP_COLORS.cream,
          weight: 3,
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
          color: MAP_COLORS.ink,
          weight: 2,
          fillColor: index === 0 ? MAP_COLORS.cream : MAP_COLORS.white,
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
    layerVisibility,
    mapReady,
    normalizedCropFilter,
    pointPolygons,
    polygonDrawPointId,
    harvestFields,
    tr,
    weatherGridPoints,
  ])

  useEffect(() => {
    if (!isGrowaAdmin || !isAddPointMode || polygonDrawPointId) return
    if (!mapReady || !mapInstanceRef.current) return
    const map = mapInstanceRef.current

    const handleMapClick = async (event: LeafletMouseEvent) => {
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
        const response = await mutateOperations('/api/operations/custom-map-points', {
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

    const handleMapClick = (event: LeafletMouseEvent) => {
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

  const resetHarvestCircleSeed = useCallback(() => {
    harvestShapeSeedRef.current = null
    setHarvestShapeSeedVertex(null)
  }, [])

  useEffect(() => {
    if (!harvestFieldDrawActive) {
      resetHarvestCircleSeed()
    }
  }, [harvestFieldDrawActive, resetHarvestCircleSeed])

  useEffect(() => {
    if (harvestDrawMethodRef.current === harvestFieldDrawMethod) return
    harvestDrawMethodRef.current = harvestFieldDrawMethod
    resetHarvestCircleSeed()
    onHarvestFieldVerticesChange?.([])
  }, [harvestFieldDrawMethod, onHarvestFieldVerticesChange, resetHarvestCircleSeed])

  useEffect(() => {
    const handleClearDraft = () => resetHarvestCircleSeed()
    window.addEventListener('harvest:field-draw-clear-draft', handleClearDraft)
    return () => window.removeEventListener('harvest:field-draw-clear-draft', handleClearDraft)
  }, [resetHarvestCircleSeed])

  useEffect(() => {
    if (!harvestFieldDrawActive) return
    if (!mapReady || !mapInstanceRef.current) return
    const map = mapInstanceRef.current

    const handleMapClick = (event: LeafletMouseEvent) => {
      if (isLeafletUiClick(event)) return
      const lat = Number(event?.latlng?.lat)
      const lng = Number(event?.latlng?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

      const vertex = { lat, lng } satisfies PolygonVertex
      if (harvestFieldDrawMethod === 'vertex') {
        onHarvestFieldVerticesChange?.([...harvestFieldVertices, vertex])
        return
      }

      const seed = harvestShapeSeedRef.current
      if (!seed) {
        harvestShapeSeedRef.current = vertex
        setHarvestShapeSeedVertex(vertex)
        return
      }

      const circleRing = createCircleVertices(seed, vertex, circleSegments)
      if (circleRing.length >= 3) {
        onHarvestFieldRingsChange?.([...harvestFieldRings, circleRing])
      }
      onHarvestFieldVerticesChange?.([])
      resetHarvestCircleSeed()
    }

    const handleMouseMove = (event: LeafletMouseEvent) => {
      const seed = harvestShapeSeedRef.current
      if (!seed || harvestFieldDrawMethod !== 'circle') return
      const lat = Number(event?.latlng?.lat)
      const lng = Number(event?.latlng?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      onHarvestFieldVerticesChange?.(
        createCircleVertices(seed, { lat, lng }, circleSegments)
      )
    }

    map.on('click', handleMapClick)
    map.on('mousemove', handleMouseMove)
    return () => {
      map.off('click', handleMapClick)
      map.off('mousemove', handleMouseMove)
    }
  }, [
    circleSegments,
    harvestFieldDrawActive,
    harvestFieldDrawMethod,
    harvestFieldRings,
    harvestFieldVertices,
    mapReady,
    onHarvestFieldRingsChange,
    onHarvestFieldVerticesChange,
    resetHarvestCircleSeed,
  ])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletRef.current) return
    const L = leafletRef.current
    const map = mapInstanceRef.current

    harvestDraftLayerRef.current?.remove?.()
    harvestDraftLayerRef.current = null
    harvestDraftVertexInstancesRef.current.forEach((layer) => layer.remove?.())
    harvestDraftVertexInstancesRef.current = []

    if (!harvestFieldDrawActive) return

    const draftLayers: Layer[] = []

    harvestFieldRings.forEach((ring) => {
      if (ring.length < 3) return
      draftLayers.push(
        L.polygon(ring.map((vertex) => [vertex.lat, vertex.lng]), {
          color: MAP_COLORS.sage300,
          weight: 2,
          opacity: 0.95,
          fillColor: MAP_COLORS.sage300,
          fillOpacity: 0.14,
          interactive: false,
        }).addTo(map)
      )
    })

    if (harvestFieldVertices.length >= 3) {
      draftLayers.push(
        L.polygon(harvestFieldVertices.map((vertex) => [vertex.lat, vertex.lng]), {
          color: MAP_COLORS.cream,
          weight: 3,
          opacity: 0.95,
          fillColor: MAP_COLORS.cream,
          fillOpacity: 0.18,
          interactive: false,
        }).addTo(map)
      )
    } else if (harvestFieldVertices.length > 0) {
      draftLayers.push(
        L.polyline(harvestFieldVertices.map((vertex) => [vertex.lat, vertex.lng]), {
          color: MAP_COLORS.cream,
          weight: 3,
          dashArray: '8 6',
          opacity: 0.95,
          interactive: false,
        }).addTo(map)
      )
    }

    harvestDraftLayerRef.current = L.layerGroup(draftLayers).addTo(map)

    if (harvestShapeSeedVertex && harvestFieldDrawMethod === 'circle') {
      harvestDraftVertexInstancesRef.current.push(
        L.circleMarker([harvestShapeSeedVertex.lat, harvestShapeSeedVertex.lng], {
          radius: 7,
          color: MAP_COLORS.ink,
          weight: 2,
          fillColor: MAP_COLORS.cream,
          fillOpacity: 1,
          interactive: false,
        }).addTo(map)
      )
    }

    harvestDraftVertexInstancesRef.current.push(
      ...harvestFieldVertices.map((vertex, index) =>
        L.circleMarker([vertex.lat, vertex.lng], {
          radius: harvestFieldDrawMethod === 'vertex' && index === 0 ? 7 : 5,
          color: MAP_COLORS.ink,
          weight: 2,
          fillColor: harvestFieldDrawMethod === 'vertex' && index === 0 ? MAP_COLORS.cream : MAP_COLORS.white,
          fillOpacity: 1,
          interactive: false,
        }).addTo(map)
      )
    )

    return () => {
      harvestDraftLayerRef.current?.remove?.()
      harvestDraftLayerRef.current = null
      harvestDraftVertexInstancesRef.current.forEach((layer) => layer.remove?.())
      harvestDraftVertexInstancesRef.current = []
    }
  }, [
    harvestFieldDrawActive,
    harvestFieldDrawMethod,
    harvestFieldRings,
    harvestFieldVertices,
    harvestShapeSeedVertex,
    mapReady,
  ])

  useEffect(() => {
    if (!isGrowaAdmin || !polygonDrawPointId) return
    if (!mapReady || !mapInstanceRef.current) return
    const map = mapInstanceRef.current

    const handleMapClick = (event: LeafletMouseEvent) => {
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

    const handleMouseMove = (event: LeafletMouseEvent) => {
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

    const handleMapClick = (event: LeafletMouseEvent) => {
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

  return (
    <div className="growa absolute inset-0">
      <div ref={mapRef} className="h-full w-full" />

      <div className="absolute bottom-6 end-6 z-[1000] flex flex-col gap-2">
        {isGrowaAdmin && (
          <>
            <button
              onClick={() => {
                setIsAddPointMode((prev) => !prev)
                setPolygonDrawPointId(null)
                setDraftPolygon([])
                resetDraftMetadata()
              }}
              className={`h-10 px-4 flex items-center justify-center rounded-pill border transition-colors shadow-panel text-[13px] font-medium ${
                isAddPointMode
                  ? 'bg-ink border-ink text-white'
                  : 'bg-card border-line text-content hover:bg-stone-100'
              }`}
              aria-pressed={isAddPointMode}
              title={isAddPointMode ? tr('Click map to add points') : tr('Enable add point mode')}
            >
              {isAddPointMode ? tr('Adding points') : tr('Add point')}
            </button>
            {isAddPointMode && !polygonDrawPointId && (
              <select
                value={newPointType}
                onChange={(event) => setNewPointType(event.target.value as MapPointType)}
                className="h-10 rounded-lg border border-line bg-card px-3 text-[13px] text-content shadow-panel focus:border-sage focus:outline-none"
                title={tr('Point type for new points')}
              >
                {POINT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-card">
                    {tr(option.label)}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
        <button
          onClick={handleZoomIn}
          className="h-10 w-10 flex items-center justify-center rounded-pill bg-card border border-line hover:bg-stone-100 transition-colors shadow-panel"
          title={tr('Zoom in')}
          aria-label={tr('Zoom in')}
        >
          <Plus strokeWidth={1.5} className="h-5 w-5 text-content" />
        </button>
        <button
          onClick={handleZoomOut}
          className="h-10 w-10 flex items-center justify-center rounded-pill bg-card border border-line hover:bg-stone-100 transition-colors shadow-panel"
          title={tr('Zoom out')}
          aria-label={tr('Zoom out')}
        >
          <Minus strokeWidth={1.5} className="h-5 w-5 text-content" />
        </button>
        <button
          onClick={handleRecenter}
          className="h-10 w-10 flex items-center justify-center rounded-pill bg-card border border-line hover:bg-stone-100 transition-colors shadow-panel"
          title={tr('Recenter on Qatar')}
          aria-label={tr('Recenter on Qatar')}
        >
          <Crosshair strokeWidth={1.5} className="h-5 w-5 text-content" />
        </button>
      </div>

      {/* Satellite view signature (Brand Book p.81): the cream mark bare on
          the imagery, then a white pill with the view state. The mark keeps
          its clear space (0.4 × 16px ≈ 6px) through the 12px gap. */}
      <div className="pointer-events-none absolute bottom-6 start-6 z-[1000] flex items-end gap-3">
        <Logo className="h-4 w-auto text-cream drop-shadow-[0_1px_2px_rgba(17,30,19,.6)]" aria-hidden="true" />
      </div>
      <div className="absolute bottom-12 start-6 z-[1000] bg-card border border-line px-3.5 py-2 shadow-panel" style={{ borderRadius: 'var(--radius-lg)' }}>
        <div className="text-[12px] text-content-soft">
          {tr('Satellite view · zoom')} <span className="text-content tabular-nums" style={{ fontWeight: 500 }}><ZoomReadout map={mapForReadout} /></span>
        </div>
        {resolvedTargetFarm && (
          <div className="text-[12px] text-content">
            {tr('Focus:')} <span style={{ fontWeight: 500 }}>{resolvedTargetFarm.label}</span>
          </div>
        )}
        {isGrowaAdmin && isAddPointMode && !polygonDrawPointId && (
          <div className="text-[12px] text-content">
            {tr('Click on map to create a {type} point.', { type: tr(POINT_TYPE_LABELS[newPointType]).toLowerCase() })}
          </div>
        )}
        {isGrowaAdmin && polygonDrawPointId && (
          <div className="mt-1 text-[12px] text-content-soft">
            {tr('Polygon mode:')}{' '}
            {polygonDrawMethod === 'vertex'
              ? tr('click map to add vertices.')
              : polygonDrawMethod === 'rectangle'
                ? shapeSeedVertex
                  ? tr('click opposite corner to finish rectangle.')
                  : tr('click first corner of rectangle.')
                : shapeSeedVertex
                  ? tr('click edge point to finish circle.')
                  : tr('click circle center point.')}
          </div>
        )}
      </div>

      {isInsightsModalOpen && (
        <div
          className={`absolute inset-0 z-[2600] flex px-4 py-6 ${
            isLateralMode
              ? 'items-start justify-end bg-ink/45 pt-6'
              : 'items-center justify-center bg-ink/45'
          }`}
          role="dialog"
          aria-modal="true"
          onClick={closePointInsightsModal}
        >
          <div
            className={`w-full bg-card ${
              isLateralMode
                ? 'max-w-[34rem] max-h-[calc(100vh-7rem)] overflow-y-auto p-6'
                : 'max-w-4xl p-7'
            }`}
            style={{ borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-panel-lg)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-dotted border-line-strong pb-4">
              <div>
                <p className="text-content" style={{ fontSize: 'var(--text-heading)', fontWeight: 500, letterSpacing: 'var(--ls-heading)' }}>{tr('Farm crop insights')}</p>
                <p className="mt-1 text-[13px] text-content-soft">
                  {tr('Point:')} <span className="text-content" style={{ fontWeight: 500 }}>{activeInsightsPointLabel}</span>
                </p>
                <p className="mt-1 text-[12px] text-content-soft">
                  {tr('Totals are summed from the linked polygon metrics for each crop.')}
                </p>
              </div>
              <button
                type="button"
                onClick={closePointInsightsModal}
                className="g-btn g-btn--secondary"
                style={{ height: 32, padding: '0 14px', fontSize: 13 }}
              >
                {tr('Close')}
              </button>
            </div>

            {/* Figures Light; the score's ramp colour is its square. */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="bg-card border border-line p-3.5" style={{ borderRadius: 'var(--radius-lg)' }}>
                <p className="text-[12px] text-content-soft">{tr('Linked polygons')}</p>
                <p className="growa-figure mt-1 text-content" style={{ fontSize: 28 }}>{activeInsightsPointPolygonCount}</p>
              </div>
              <div className="bg-card border border-line p-3.5" style={{ borderRadius: 'var(--radius-lg)' }}>
                <p className="flex items-center gap-1.5 text-[12px] text-content-soft">
                  <span aria-hidden="true" className="w-1.5 h-1.5" style={{ borderRadius: 1, background: getScoreTextColor(activeInsightsFarmScore) }} />
                  {tr('Farm score')}
                </p>
                <p className="growa-figure mt-1 text-content" style={{ fontSize: 28 }}>
                  {formatScoreValue(activeInsightsFarmScore)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleInsightsModalEditPoint}
                disabled={!insightsModalPointId}
                className="g-btn g-btn--primary"
                style={{ height: 32, padding: '0 14px', fontSize: 13 }}
              >
                {tr('Edit point')}
              </button>
              <button
                type="button"
                onClick={handleInsightsModalDrawPolygon}
                disabled={!insightsModalPointId}
                className="g-btn g-btn--outline"
                style={{ height: 32, padding: '0 14px', fontSize: 13 }}
              >
                {tr('Draw polygon')}
              </button>
              <button
                type="button"
                onClick={handleInsightsModalDeletePoint}
                disabled={!insightsModalPointId}
                className="g-btn g-btn--ghost text-critical"
                style={{ height: 32, padding: '0 14px', fontSize: 13, color: 'var(--status-critical)' }}
              >
                {tr('Delete point')}
              </button>
            </div>

            <div className="mt-4 bg-muted px-3.5 py-3" style={{ borderRadius: 'var(--radius-lg)' }}>
              <p className="text-[12px] text-content-soft">{tr('Farm external link')}</p>
              {activeInsightsFarmExternalUrl ? (
                <a
                  href={activeInsightsFarmExternalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-[13px] text-sage-700 underline underline-offset-2 hover:text-ink"
                >
                  {tr('Open farm link')}
                </a>
              ) : (
                <p className="mt-1 text-xs text-content-soft">{tr('No farm link configured yet.')}</p>
              )}
            </div>

            {isInsightsModalLoading ? (
              <div className="py-10 flex justify-center text-ink"><LatticeLoader label={tr('Loading insights…')} /></div>
            ) : insightsModalError ? (
              <div role="alert" className="py-10 text-center text-[14px] text-critical">{insightsModalError}</div>
            ) : activePointInsights.length === 0 ? (
              <div className="py-10 text-center text-[14px] text-content-soft">
                {tr('No crop insight records found for this point.')}
              </div>
            ) : (
              isLateralMode ? (
                <div className="mt-4 max-h-[44vh] space-y-2 overflow-y-auto pe-1">
                  {activePointInsights.map((insight) => {
                    const cropKey = insight.cropName.trim().toLowerCase()
                    const cropScore = cropScoreByName.get(cropKey) ?? null
                    const cropPolygonCount = cropPolygonCountByName.get(cropKey) || 0
                    return (
                      <div
                        key={insight.id}
                        className="bg-card border border-line px-3.5 py-3 text-[14px] text-content"
                        style={{ borderRadius: 'var(--radius-lg)' }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-content" style={{ fontWeight: 500 }}>{insight.cropName}</p>
                          <span className="g-tag g-tag--outline-ink" style={{ height: 22, padding: '0 9px', fontSize: 11 }}>
                            <span aria-hidden="true" className="w-1.5 h-1.5" style={{ borderRadius: 1, background: getScoreTextColor(cropScore) }} />
                            {formatScoreValue(cropScore)}
                          </span>
                        </div>
                        <div className="mt-2 divide-y divide-dotted divide-line-strong text-[12px] [&>div]:py-1">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-content-soft">{tr('Polygon contributors')}</span>
                            <span className="font-medium text-content">{cropPolygonCount}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-content-soft">{tr('Estimated production')}</span>
                            <span className="font-medium text-content">
                              {formatMetric(insight.estimatedProductionTons, 'tons')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-content-soft">{tr('Energy consumption')}</span>
                            <span className="font-medium text-content">
                              {formatMetric(insight.energyConsumptionKwh, 'kWh')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-content-soft">{tr('Water consumption')}</span>
                            <span className="font-medium text-content">
                              {formatMetric(insight.waterConsumptionM3, 'm³')}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-4 max-h-[58vh] overflow-y-auto">
                  <table className="g-table g-table--pad-sm min-w-full text-start">
                    <thead className="sticky top-0 bg-card">
                      <tr>
                        <th>{tr('Crop')}</th>
                        <th>{tr('Crop score')}</th>
                        <th>{tr('Polygons')}</th>
                        <th>{tr('Estimated production')}</th>
                        <th>{tr('Energy consumption')}</th>
                        <th>{tr('Water consumption')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {activePointInsights.map((insight, index) => {
                        const cropKey = insight.cropName.trim().toLowerCase()
                        const cropScore = cropScoreByName.get(cropKey) ?? null
                        const cropPolygonCount = cropPolygonCountByName.get(cropKey) || 0
                        return (
                          <tr
                            key={insight.id}
                            data-row={index}
                            className="text-[13px] text-content hover:bg-muted"
                          >
                            <td className="py-2.5" style={{ fontWeight: 500 }}>{insight.cropName}</td>
                            <td className="py-2.5 tabular-nums">
                              <span className="inline-flex items-center gap-1.5">
                                <span aria-hidden="true" className="w-1.5 h-1.5" style={{ borderRadius: 1, background: getScoreTextColor(cropScore) }} />
                                {formatScoreValue(cropScore)}
                              </span>
                            </td>
                            <td className="py-2.5 tabular-nums">{cropPolygonCount}</td>
                            <td className="py-2.5 tabular-nums">{formatMetric(insight.estimatedProductionTons, 'tons')}</td>
                            <td className="py-2.5 tabular-nums">{formatMetric(insight.energyConsumptionKwh, 'kWh')}</td>
                            <td className="py-2.5 tabular-nums">{formatMetric(insight.waterConsumptionM3, 'm³')}</td>
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
        <div className="absolute start-4 top-4 z-[1000] w-80 max-h-[calc(100%-2rem)] overflow-y-auto bg-card border border-line p-4" style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-panel)' }}>
          <p className="text-[14px] text-content" style={{ fontWeight: 500 }}>{tr('Polygon draft')}</p>
          <p className="mt-0.5 text-[12px] text-content-soft">
            {tr('Vertices:')} <span className="text-content tabular-nums">{draftPolygon.length}</span>
          </p>
          <div className="mt-3 g-seg w-full" role="tablist" aria-label={tr('Drawing method')}>
            {POLYGON_DRAW_METHOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setPolygonDrawMethod(option.value)
                  setShapeSeedVertex(null)
                  setDraftPolygon([])
                }}
                role="tab"
                aria-selected={polygonDrawMethod === option.value}
                data-active={polygonDrawMethod === option.value ? 'true' : 'false'}
                className="g-seg__item flex-1"
                style={{ height: 30, fontSize: 12 }}
              >
                {tr(option.label)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-content-soft">
            {polygonDrawMethod === 'vertex'
              ? tr('Click to add each vertex.')
              : polygonDrawMethod === 'rectangle'
                ? shapeSeedVertex
                  ? tr('Move mouse to resize rectangle, then click to confirm.')
                  : tr('Click first corner of rectangle.')
                : shapeSeedVertex
                  ? tr('Move mouse to resize circle, then click to confirm.')
                  : tr('Click circle center point.')}
          </p>
          {polygonDrawMethod === 'circle' && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[12px] text-content-soft">{tr('Circle detail')}</span>
              <input
                type="range"
                min={8}
                max={72}
                step={4}
                value={circleSegments}
                onChange={(event) => setCircleSegments(Number(event.target.value))}
                className="g-range flex-1"
              />
              <span className="w-10 text-end text-[12px] text-content tabular-nums">{circleSegments}</span>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[12px] text-content-soft">{tr('Score')}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={draftPolygonScore}
              onChange={(event) => setDraftPolygonScore(normalizePolygonScore(event.target.value, 50))}
              className="g-range flex-1"
            />
            <span className="w-12 text-end text-[12px] text-content tabular-nums">{draftPolygonScore}</span>
          </div>

          <div className="mt-3 space-y-2">
            <input
              value={draftPolygonName}
              onChange={(event) => setDraftPolygonName(event.target.value)}
              placeholder={tr('Polygon name (e.g. Tomato plot A)')}
              aria-label={tr('Polygon name')}
              className="h-9 w-full rounded-md border border-line-strong bg-card px-3 text-[13px] text-content placeholder:text-content-soft focus:border-sage focus:outline-none transition-colors"
            />
            <input
              value={draftCropName}
              onChange={(event) => setDraftCropName(event.target.value)}
              placeholder={tr('Crop name')}
              list="draft-crop-type-options"
              className="h-9 w-full rounded-md border border-line-strong bg-card px-3 text-[13px] text-content placeholder:text-content-soft focus:border-sage focus:outline-none transition-colors"
            />
            <datalist id="draft-crop-type-options">
              {cropTypeOptions.map((cropType) => (
                <option key={cropType.id} value={cropType.nameEn} />
              ))}
            </datalist>
            <input
              value={draftCropVariety}
              onChange={(event) => setDraftCropVariety(event.target.value)}
              placeholder={tr('Variety')}
              list="draft-crop-variety-options"
              className="h-9 w-full rounded-md border border-line-strong bg-card px-3 text-[13px] text-content placeholder:text-content-soft focus:border-sage focus:outline-none transition-colors"
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
                aria-label={tr('Sowing date')}
                title={tr('Sowing date')}
                className="h-9 w-full rounded-md border border-line-strong bg-card px-3 text-[13px] text-content focus:border-sage focus:outline-none"
              />
              <input
                type="date"
                value={draftExpectedHarvestDate}
                onChange={(event) => setDraftExpectedHarvestDate(event.target.value)}
                aria-label={tr('Expected harvest')}
                title={tr('Expected harvest')}
                className="h-9 w-full rounded-md border border-line-strong bg-card px-3 text-[13px] text-content focus:border-sage focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                value={draftEstimatedProductionTons}
                onChange={(event) => setDraftEstimatedProductionTons(event.target.value)}
                placeholder={tr('Tons')}
                className="h-9 w-full rounded-md border border-line-strong bg-card px-3 text-[13px] text-content placeholder:text-content-soft focus:border-sage focus:outline-none transition-colors"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={draftEnergyConsumptionKwh}
                onChange={(event) => setDraftEnergyConsumptionKwh(event.target.value)}
                placeholder="kWh"
                className="h-9 w-full rounded-md border border-line-strong bg-card px-3 text-[13px] text-content placeholder:text-content-soft focus:border-sage focus:outline-none transition-colors"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={draftWaterConsumptionM3}
                onChange={(event) => setDraftWaterConsumptionM3(event.target.value)}
                placeholder="m3"
                className="h-9 w-full rounded-md border border-line-strong bg-card px-3 text-[13px] text-content placeholder:text-content-soft focus:border-sage focus:outline-none transition-colors"
              />
            </div>
            <textarea
              value={draftCropNotes}
              onChange={(event) => setDraftCropNotes(event.target.value)}
              placeholder={tr('Notes')}
              rows={2}
              className="w-full resize-none rounded-md border border-line-strong bg-card px-3 py-2 text-[13px] text-content placeholder:text-content-soft focus:border-sage focus:outline-none"
            />
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={undoDraftVertex}
              disabled={polygonDrawMethod !== 'vertex' ? !shapeSeedVertex && draftPolygon.length === 0 : draftPolygon.length === 0}
              className="g-btn g-btn--ghost flex-1"
              style={{ height: 32, padding: '0 12px', fontSize: 13 }}
            >
              {tr('Undo')}
            </button>
            <button
              onClick={cancelPolygonDraw}
              className="g-btn g-btn--secondary flex-1"
              style={{ height: 32, padding: '0 12px', fontSize: 13 }}
            >
              {tr('Cancel')}
            </button>
            <button
              onClick={saveDraftPolygon}
              disabled={draftPolygon.length < 3}
              className="g-btn g-btn--primary flex-1"
              style={{ height: 32, padding: '0 12px', fontSize: 13 }}
            >
              {tr('Save')}
            </button>
          </div>
        </div>
      )}

      {/* Collapsed by default: open, the card sat over the middle of every
          map — a quarter of the side map, and on top of the markers in the
          watchtower panel. A round control, like the zoom buttons, opens it. */}
      {coordinateSearchOpen ? (
      <form
        className={`absolute end-4 z-[1000] w-[min(20rem,calc(100%-2rem))] bg-card border border-line p-4 top-4`}
        style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-panel)' }}
        onSubmit={(event) => {
          event.preventDefault()
          goToCoordinates()
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[14px] text-content" style={{ fontWeight: 500 }}>
            {tr('Coordinate search')}
          </p>
          <button
            type="button"
            onClick={() => setCoordinateSearchOpen(false)}
            aria-label={tr('Close')}
            className="-me-1.5 inline-flex h-7 w-7 items-center justify-center rounded-pill text-stone-600 hover:bg-muted hover:text-ink transition-colors"
          >
            <X strokeWidth={1.5} className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            autoFocus
            value={coordinateQuery}
            onChange={(event) => {
              setCoordinateQuery(event.target.value)
              if (coordinateSearchError) setCoordinateSearchError(null)
            }}
            placeholder="25.2854, 51.5310"
            aria-label={tr('Latitude and longitude')}
            className="h-9 flex-1 rounded-md border border-line-strong bg-card px-3 text-[13px] text-content placeholder:text-content-soft focus:border-sage focus:outline-none transition-colors"
          />
          <button
            type="submit"
            className="g-btn g-btn--primary"
            style={{ height: 32, padding: '0 12px', fontSize: 13 }}
          >
            {tr('Go')}
          </button>
          <button
            type="button"
            onClick={() => {
              setCoordinateQuery('')
              setCoordinateSearchError(null)
              clearCoordinatePin()
            }}
            className="g-btn g-btn--ghost"
            style={{ height: 32, padding: '0 10px', fontSize: 13 }}
          >
            {tr('Clear')}
          </button>
        </div>
        <p className={`mt-2 text-[12px] ${coordinateSearchError ? 'text-critical' : 'text-content-soft'}`}>
          {coordinateSearchError ||
            tr('Latitude, then longitude. Example: 25.2854, 51.5310')}
        </p>
      </form>
      ) : (
        <button
          type="button"
          onClick={() => setCoordinateSearchOpen(true)}
          aria-label={tr('Coordinate search')}
          title={tr('Coordinate search')}
          className={`absolute end-4 z-[1000] inline-flex h-10 w-10 items-center justify-center rounded-pill border border-line bg-card text-content transition-colors hover:bg-stone-100 top-4`}
          style={{ boxShadow: 'var(--shadow-panel)' }}
        >
          <Search strokeWidth={1.5} className="h-4 w-4" />
        </button>
      )}

      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4 text-ink">
            <LatticeLoader label={tr('Loading satellite imagery…')} />
            <span className="text-[14px] text-content-soft">
              {tr('Loading satellite imagery…')}
            </span>
          </div>
        </div>
      )}

      {/* Leaflet builds popups and tooltips outside React: they are styled
          here, as the SaaS does for third-party widgets. White card, the
          brand radius and the single floating shadow; facts on dotted rows;
          commands as pills. */}
      <style jsx global>{`
 .custom-popup .leaflet-popup-content-wrapper,
 .custom-tooltip.leaflet-tooltip {
 background: #ffffff;
 color: #111e13;
 border: 1px solid #e1e4dc;
 border-radius: 12px;
 box-shadow: 0 18px 44px -18px rgba(17, 30, 19, 0.34);
 font-family: var(--font-core);
 }
 .custom-popup .leaflet-popup-content { margin: 12px 14px; }
 .custom-popup .leaflet-popup-tip { background: #ffffff; box-shadow: none; }
 .custom-popup .leaflet-popup-close-button { color: #5c635a; }
 .custom-popup .leaflet-popup-close-button:hover { color: #111e13; }
 .custom-tooltip.leaflet-tooltip { padding: 6px 10px; }
 .custom-tooltip.leaflet-tooltip-top::before { border-top-color: #ffffff; }
 .g-map-pop { display: flex; flex-direction: column; gap: 4px; min-width: 160px; font-family: var(--font-core); }
 .g-map-pop__title { display: block; font-size: 14px; font-weight: 500; color: #111e13; }
 .g-map-pop__meta { display: block; font-size: 12px; color: #5c635a; line-height: 1.4; }
 .g-map-pop__tag { display: inline-flex; align-items: center; gap: 6px; width: fit-content; height: 22px; padding: 0 9px; border: 1px solid #cbd0c5; border-radius: 999px; font-size: 11px; color: #111e13; }
 .g-map-pop__tag i { display: block; width: 6px; height: 6px; border-radius: 1px; }
 .g-map-pop__rows { margin: 6px 0 0; font-size: 12px; }
 .g-map-pop__rows div { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; border-top: 1px dotted #cbd0c5; }
 .g-map-pop__rows dt { color: #5c635a; }
 .g-map-pop__rows dd { margin: 0; color: #111e13; }
 .g-map-pop__actions { margin-top: 10px; display: flex; gap: 6px; }
 .g-map-pop__btn { height: 28px; padding: 0 12px; border-radius: 999px; border: 1px solid #cbd0c5; background: #ffffff; color: #111e13; font-size: 12px; cursor: pointer; }
 .g-map-pop__btn:hover { background: #eff1ec; }
 .g-map-pop__btn--danger { color: #a8392b; }
 `}</style>

      <PointEditDialog
        open={Boolean(editingPointInitial)}
        locale={locale}
        initial={editingPointInitial}
        typeOptions={pointTypeOptions}
        onCancel={() => setEditingPointId(null)}
        onSave={savePointEdit}
      />
      <PolygonEditDialog
        open={Boolean(editingPolygonInitial)}
        locale={locale}
        initial={editingPolygonInitial}
        cropOptions={cropTypeOptions}
        onCancel={() => setEditingPolygon(null)}
        onSave={savePolygonEdit}
      />
    </div>
  )
}
