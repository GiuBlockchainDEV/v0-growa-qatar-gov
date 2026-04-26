'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Minus, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useOrganization } from '@/hooks/use-organization'

const QATAR_CENTER = { lat: 25.3548, lng: 51.1839 }
const DEFAULT_ZOOM = 10
const DEFAULT_FARM_ZOOM = 17

type MapPointType = 'farm' | 'facility' | 'sensor' | 'custom'

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
  targetZoom?: number
}

interface MapController {
  zoomIn: () => void
  zoomOut: () => void
  flyTo: (coords: [number, number], zoom: number, options?: { duration?: number }) => void
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
  crop: PolygonCropData
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

  const [isLoading, setIsLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM)
  const [farmRows, setFarmRows] = useState<FarmApiRow[]>([])
  const [customPoints, setCustomPoints] = useState<CustomPoint[]>([])
  const [pointPolygons, setPointPolygons] = useState<PointPolygonsMap>({})
  const [isAddPointMode, setIsAddPointMode] = useState(false)
  const [newPointType, setNewPointType] = useState<MapPointType>('custom')
  const [activePointId, setActivePointId] = useState<string | null>(null)
  const [polygonDrawPointId, setPolygonDrawPointId] = useState<string | null>(null)
  const [draftPolygon, setDraftPolygon] = useState<PolygonVertex[]>([])
  const [draftPolygonName, setDraftPolygonName] = useState('')
  const [draftCropName, setDraftCropName] = useState('')
  const [draftCropVariety, setDraftCropVariety] = useState('')
  const [draftSowingDate, setDraftSowingDate] = useState('')
  const [draftExpectedHarvestDate, setDraftExpectedHarvestDate] = useState('')
  const [draftCropNotes, setDraftCropNotes] = useState('')

  const resetDraftMetadata = useCallback(() => {
    setDraftPolygonName('')
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

  const customPointsStorageKey = useMemo(
    () => `growa-custom-map-points:${user?.id || 'anonymous'}`,
    [user?.id]
  )
  useEffect(() => {
    if (!isGrowaAdmin) {
      setCustomPoints([])
      setIsAddPointMode(false)
      return
    }
    try {
      const raw = window.localStorage.getItem(customPointsStorageKey)
      if (!raw) {
        setCustomPoints([])
        return
      }
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        setCustomPoints([])
        return
      }
      const normalized = parsed
        .map((entry: unknown) => {
          if (!entry || typeof entry !== 'object') return null
          const row = entry as Record<string, unknown>
          const id = typeof row.id === 'string' ? row.id : ''
          const lat = typeof row.lat === 'number' ? row.lat : Number.NaN
          const lng = typeof row.lng === 'number' ? row.lng : Number.NaN
          const label = typeof row.label === 'string' ? row.label : ''
          const rawPointType = typeof row.pointType === 'string' ? row.pointType : ''
          const pointType: MapPointType = POINT_TYPE_OPTIONS.some(
            (option) => option.value === rawPointType
          )
            ? (rawPointType as MapPointType)
            : 'custom'
          if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
          return { id, lat, lng, label: label.trim() || 'Custom Point', pointType } satisfies CustomPoint
        })
        .filter((row): row is CustomPoint => Boolean(row))
      setCustomPoints(normalized)
    } catch {
      setCustomPoints([])
    }
  }, [customPointsStorageKey, isGrowaAdmin])

  useEffect(() => {
    if (!isGrowaAdmin) return
    try {
      window.localStorage.setItem(customPointsStorageKey, JSON.stringify(customPoints))
    } catch {
      // Ignore storage failures in restricted browser contexts.
    }
  }, [customPoints, customPointsStorageKey, isGrowaAdmin])

  useEffect(() => {
    if (!isGrowaAdmin) {
      setPointPolygons({})
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
    (pointId: string) => {
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
      setCustomPoints((prev) =>
        prev.map((entry) =>
          entry.id === pointId ? { ...entry, label: nextLabel, pointType: nextType } : entry
        )
      )
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
      setDraftPolygon([])
      resetDraftMetadata()
      setIsAddPointMode(false)
    },
    [resetDraftMetadata]
  )

  const cancelPolygonDraw = useCallback(() => {
    setPolygonDrawPointId(null)
    setDraftPolygon([])
    resetDraftMetadata()
  }, [resetDraftMetadata])

  const saveDraftPolygon = useCallback(async () => {
    if (!polygonDrawPointId || draftPolygon.length < 3) return
    const polygonName =
      draftPolygonName.trim() || `Polygon ${(pointPolygons[polygonDrawPointId]?.length || 0) + 1}`
    const cropPayload: PolygonCropData = {
      cropName: draftCropName.trim(),
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
      setDraftPolygon([])
      resetDraftMetadata()
    } catch {
      // Keep draft in place so user can retry save.
    }
  }, [
    draftCropName,
    draftCropNotes,
    draftCropVariety,
    draftExpectedHarvestDate,
    draftPolygon,
    draftPolygonName,
    draftSowingDate,
    pointPolygons,
    polygonDrawPointId,
    resetDraftMetadata,
  ])

  const handleEditPolygonData = useCallback(
    async (polygon: PointPolygon) => {
      const nextNameInput = window.prompt('Polygon name', polygon.name)
      if (nextNameInput === null) return
      const nextName = nextNameInput.trim() || polygon.name

      const nextCropName = window.prompt('Crop name', polygon.crop.cropName || '') ?? polygon.crop.cropName
      const nextVariety = window.prompt('Variety', polygon.crop.variety || '') ?? polygon.crop.variety
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
            crop: {
              cropName: nextCropName,
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
        window.location.reload()
      } catch {
        // Ignore network errors to keep map interactions responsive.
      }
    },
    []
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
    setDraftPolygon((prev) => prev.slice(0, -1))
  }, [])

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

  const resolvedTargetZoom =
    resolvedTargetFarm || explicitTargetPoint ? targetZoom ?? DEFAULT_FARM_ZOOM : DEFAULT_ZOOM

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
    setDraftPolygon([])
    resetDraftMetadata()
  }, [customPoints, draftPolygon, polygonDrawPointId, resetDraftMetadata])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletRef.current) return
    const L = leafletRef.current
    const map = mapInstanceRef.current

    const createMarkerIcon = (type: MapMarker['type']) => {
      const colors = {
        farm: '#07f880',
        facility: '#3B82F6',
        sensor: '#F59E0B',
        custom: '#07f880',
      }
      const color = colors[type] || colors.farm
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
      const polygonCount = customPoint ? (pointPolygons[customPoint.id] || []).length : 0
      const popupContent = customPoint
        ? `
            <div style="font-family: system-ui; padding: 8px; min-width: 210px;">
              <strong style="color: #07f880; font-size: 13px;">${escapeHtml(marker.label)}</strong>
              <br/>
              <span style="font-size: 10px; color: #888; text-transform: uppercase;">Type: ${escapeHtml(
                POINT_TYPE_LABELS[marker.type]
              )}</span>
              <br/>
              <span style="font-size: 10px; color: #aaa;">Polygons: ${polygonCount}</span>
              <br/>
              <button
                data-edit-point-id="${customPoint.id}"
                style="
                  margin-top: 8px;
                  margin-right: 6px;
                  border: 1px solid rgba(7,248,128,0.35);
                  background: rgba(7,248,128,0.12);
                  color: #07f880;
                  border-radius: 6px;
                  padding: 4px 8px;
                  font-size: 11px;
                  cursor: pointer;
                "
              >
                Edit Point
              </button>
              <button
                data-draw-polygon-point-id="${customPoint.id}"
                style="
                  margin-top: 8px;
                  margin-right: 6px;
                  border: 1px solid rgba(59,130,246,0.4);
                  background: rgba(59,130,246,0.15);
                  color: #93c5fd;
                  border-radius: 6px;
                  padding: 4px 8px;
                  font-size: 11px;
                  cursor: pointer;
                "
              >
                Draw Polygon
              </button>
              <button
                data-delete-point-id="${customPoint.id}"
                style="
                  margin-top: 8px;
                  border: 1px solid rgba(239,68,68,0.45);
                  background: rgba(239,68,68,0.14);
                  color: #fca5a5;
                  border-radius: 6px;
                  padding: 4px 8px;
                  font-size: 11px;
                  cursor: pointer;
                "
              >
                Delete Point
              </button>
            </div>
          `
        : `
            <div style="font-family: system-ui; padding: 8px; min-width: 140px;">
              <strong style="color: #07f880; font-size: 13px;">${escapeHtml(marker.label)}</strong>
              <br/>
              <span style="font-size: 10px; color: #888; text-transform: uppercase;">Type: ${escapeHtml(
                POINT_TYPE_LABELS[marker.type]
              )}</span>
            </div>
          `

      const markerInstance = L.marker([marker.lat, marker.lng], { icon: createMarkerIcon(marker.type) })
        .addTo(map)
        .bindPopup(popupContent, { className: 'custom-popup' })

      if (customPoint) {
        markerInstance.on('popupopen', (event: any) => {
          setActivePointId(customPoint.id)
          const popupElement = event?.popup?.getElement?.() as HTMLElement | null
          const editButton = popupElement?.querySelector(
            `[data-edit-point-id="${customPoint.id}"]`
          ) as HTMLButtonElement | null
          const drawButton = popupElement?.querySelector(
            `[data-draw-polygon-point-id="${customPoint.id}"]`
          ) as HTMLButtonElement | null
          const deleteButton = popupElement?.querySelector(
            `[data-delete-point-id="${customPoint.id}"]`
          ) as HTMLButtonElement | null

          if (editButton) {
            editButton.onclick = (clickEvent) => {
              clickEvent.preventDefault()
              clickEvent.stopPropagation()
              handleEditPoint(customPoint.id)
            }
          }
          if (drawButton) {
            drawButton.onclick = (clickEvent) => {
              clickEvent.preventDefault()
              clickEvent.stopPropagation()
              startPolygonDraw(customPoint.id)
            }
          }
          if (deleteButton) {
            deleteButton.onclick = (clickEvent) => {
              clickEvent.preventDefault()
              clickEvent.stopPropagation()
              handleDeletePoint(customPoint.id)
            }
          }
        })
        markerInstance.on('popupclose', () => {
          if (polygonDrawPointIdRef.current === customPoint.id) return
          // Keep the point active after popup closes so linked polygons remain clickable.
        })
      } else {
        markerInstance.on('popupopen', () => {
          setActivePointId(null)
        })
      }

      return markerInstance
    })
  }, [
    customPoints,
    handleDeletePoint,
    handleEditPoint,
    mapMarkers,
    mapReady,
    pointPolygons,
    startPolygonDraw,
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

    if (activePointId) {
      const activePolygons = pointPolygons[activePointId] || []
      for (const polygon of activePolygons) {
        if (polygon.vertices.length < 3) continue
        const crop = polygon.crop
        const popupLines = [
          `<strong style="color:#07f880;font-size:13px;">${escapeHtml(polygon.name)}</strong>`,
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
            color: '#07f880',
            weight: 2,
            opacity: 0.9,
            fillColor: '#07f880',
            fillOpacity: 0.16,
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
    pointPolygons,
    polygonDrawPointId,
  ])

  useEffect(() => {
    if (!isGrowaAdmin || !isAddPointMode || polygonDrawPointId) return
    if (!mapReady || !mapInstanceRef.current) return
    const map = mapInstanceRef.current

    const handleMapClick = (event: any) => {
      if (isLeafletUiClick(event)) return
      const lat = Number(event?.latlng?.lat)
      const lng = Number(event?.latlng?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const pointLabelPrefix = locale === 'ar' ? 'نقطة' : POINT_TYPE_LABELS[newPointType]
      const label = `${pointLabelPrefix} ${customPoints.length + 1}`
      setCustomPoints((prev) => [
        ...prev,
        {
          id: `custom-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          lat,
          lng,
          label,
          pointType: newPointType,
        },
      ])
    }

    map.on('click', handleMapClick)
    return () => {
      map.off('click', handleMapClick)
    }
  }, [customPoints.length, isAddPointMode, isGrowaAdmin, locale, mapReady, newPointType, polygonDrawPointId])

  useEffect(() => {
    if (!isGrowaAdmin || !polygonDrawPointId) return
    if (!mapReady || !mapInstanceRef.current) return
    const map = mapInstanceRef.current

    const handleMapClick = (event: any) => {
      if (isLeafletUiClick(event)) return
      const lat = Number(event?.latlng?.lat)
      const lng = Number(event?.latlng?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      setDraftPolygon((prev) => [...prev, { lat, lng }])
    }

    map.on('click', handleMapClick)
    return () => {
      map.off('click', handleMapClick)
    }
  }, [isGrowaAdmin, mapReady, polygonDrawPointId])

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
    if (!mapInstanceRef.current || !resolvedTargetFarm || targetPointId) return
    mapInstanceRef.current.flyTo([resolvedTargetFarm.lat, resolvedTargetFarm.lng], resolvedTargetZoom, {
      duration: 1.2,
    })
  }, [resolvedTargetFarm, resolvedTargetZoom, targetPointId])

  useEffect(() => {
    if (!mapInstanceRef.current || !explicitTargetPoint) return
    const pointZoom =
      Number.isFinite(targetZoom) && (targetZoom as number) >= 3 && (targetZoom as number) <= 19
        ? (targetZoom as number)
        : DEFAULT_FARM_ZOOM
    mapInstanceRef.current.flyTo([explicitTargetPoint.lat, explicitTargetPoint.lng], pointZoom, {
      duration: 1.2,
    })
    setActivePointId(explicitTargetPoint.id)
  }, [explicitTargetPoint, targetZoom])

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
            Polygon mode: click map to add vertices for selected point.
          </div>
        )}
      </div>

      {isGrowaAdmin && polygonDrawPointId && (
        <div className="absolute left-6 top-24 z-[1000] w-80 rounded-lg border border-white/10 bg-[#0c0c0e]/90 p-3 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Polygon Draft</p>
          <p className="mt-1 text-[11px] text-white/60">
            Vertices: <span className="text-[#93c5fd]">{draftPolygon.length}</span>
          </p>

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
              className="h-8 w-full rounded border border-white/10 bg-[#0b0b0c] px-2 text-[11px] text-white placeholder:text-white/35 focus:border-[#07f880]/60 focus:outline-none"
            />
            <input
              value={draftCropVariety}
              onChange={(event) => setDraftCropVariety(event.target.value)}
              placeholder="Variety"
              className="h-8 w-full rounded border border-white/10 bg-[#0b0b0c] px-2 text-[11px] text-white placeholder:text-white/35 focus:border-[#07f880]/60 focus:outline-none"
            />
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
              disabled={draftPolygon.length === 0}
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
