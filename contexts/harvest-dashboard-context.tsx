'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { deduplicateHarvestCatalogFields, resolveCatalogField } from '@/lib/harvest/catalog'
import {
  buildHarvestCreateDashboardUrl,
  buildHarvestFieldDashboardUrl,
  buildHarvestNationalDashboardUrl,
  defaultHarvestFieldNavOptions,
  resolveHarvestParcelId,
  type HarvestFieldNavTarget,
} from '@/lib/harvest/field-navigation'
import { findHarvestMapFieldAtLatLng } from '@/lib/harvest/field-hit-test'
import { normalizeEntityToField } from '@/lib/harvest/normalize'
import type {
  HarvestAnalyticsField,
  HarvestFieldMetrics,
  HarvestMapField,
  HarvestMode,
} from '@/lib/harvest/types'

const FIELD_KPI_METRICS = ['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost'] as const

interface HarvestDashboardContextValue {
  mode: HarvestMode
  setMode: (mode: HarvestMode) => void
  fields: HarvestAnalyticsField[]
  mapFields: HarvestMapField[]
  catalogLoading: boolean
  catalogError: string | null
  refreshCatalog: () => void
  parcelId: string | null
  activeSeasonId: number | undefined
  activeField: HarvestAnalyticsField | null
  isFieldDetailView: boolean
  harvestCreateActive: boolean
  selectField: (field: HarvestFieldNavTarget) => void
  getFieldDetailHref: (field: HarvestFieldNavTarget) => string
  /** @deprecated alias for selectField */
  openField: (field: HarvestFieldNavTarget) => void
  selectFieldAtLatLng: (lat: number, lng: number) => boolean
  clearFieldSelection: () => void
  startFieldCreate: (drawMethod?: 'vertex' | 'circle') => void
  mergeFieldMetrics: (parcelIdForStats: string, metrics: HarvestFieldMetrics) => void
  patchActiveSeasonId: (seasonId: number) => void
}

const HarvestDashboardContext = createContext<HarvestDashboardContextValue | null>(null)

async function fetchHarvestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  const contentType = response.headers.get('content-type') || ''
  const rawBody = await response.text()

  if (!contentType.includes('application/json')) {
    throw new Error(`Unexpected response type: ${contentType || 'unknown'}`)
  }

  const payload = JSON.parse(rawBody) as Record<string, unknown>
  if (!response.ok) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : typeof payload.details === 'string'
          ? payload.details
          : 'Request failed'
    throw new Error(message)
  }

  return payload as T
}

export function HarvestDashboardProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const parcelId = searchParams.get('parcelId')
  const harvestSeasonIdParam = searchParams.get('harvestSeasonId')
  const harvestCreateActive = searchParams.get('harvestCreate') === '1'

  const [mode, setModeState] = useState<HarvestMode>(
    searchParams.get('harvestMode') === 'predict' ? 'predict' : 'current'
  )

  useEffect(() => {
    const urlMode = searchParams.get('harvestMode') === 'predict' ? 'predict' : 'current'
    setModeState(urlMode)
  }, [searchParams])
  const [fields, setFields] = useState<HarvestAnalyticsField[]>([])
  const [mapFields, setMapFields] = useState<HarvestMapField[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [hydratedField, setHydratedField] = useState<HarvestAnalyticsField | null>(null)
  const [metricOverlay, setMetricOverlay] = useState<HarvestFieldMetrics>({})
  const catalogSeqRef = useRef(0)
  const hydrationSeqRef = useRef(0)
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0)

  const enrichedMapFields = useMemo(() => {
    return mapFields.map((mapField) => {
      const catalog = resolveCatalogField(fields, mapField.parcel_id, mapField.season_id)
      if (!catalog) return mapField
      return {
        ...mapField,
        name: catalog.name,
        crop: catalog.crop || mapField.crop,
        season_id: catalog.season_id ?? mapField.season_id,
      }
    })
  }, [fields, mapFields])

  const seasonIdFromUrl = harvestSeasonIdParam ? Number(harvestSeasonIdParam) : undefined
  const catalogField = useMemo(() => {
    if (!parcelId) return null
    return resolveCatalogField(
      fields,
      parcelId,
      seasonIdFromUrl && Number.isFinite(seasonIdFromUrl) ? seasonIdFromUrl : undefined
    )
  }, [fields, parcelId, seasonIdFromUrl])

  const activeField = useMemo(() => {
    if (!parcelId) return null
    const base = catalogField ?? (hydratedField?.parcel_id === parcelId ? hydratedField : null)
    if (!base) return null
    return { ...base, metrics: { ...base.metrics, ...metricOverlay } }
  }, [catalogField, hydratedField, metricOverlay, parcelId])

  const activeSeasonId = useMemo(() => {
    if (seasonIdFromUrl && Number.isFinite(seasonIdFromUrl)) return seasonIdFromUrl
    if (activeField?.season_id && Number.isFinite(activeField.season_id)) return activeField.season_id
    return undefined
  }, [activeField?.season_id, seasonIdFromUrl])

  const isFieldDetailView = Boolean(parcelId && !harvestCreateActive)

  const loadCatalog = useCallback(async () => {
    const requestId = ++catalogSeqRef.current
    setCatalogLoading(true)
    setCatalogError(null)

    try {
      const fieldsParams = new URLSearchParams({
        source: 'all',
        mode,
        sort_by: 'harvest_date',
        sort_dir: 'desc',
      })

      const [catalogPayload, mapPayload] = await Promise.all([
        fetchHarvestJson<{ total: number; results: HarvestAnalyticsField[] }>(
          `/api/harvest/fields?${fieldsParams.toString()}`
        ),
        fetchHarvestJson<{ fields: HarvestMapField[] }>(`/api/harvest/map/fields?mode=${mode}`),
      ])

      if (requestId !== catalogSeqRef.current) return

      setFields(deduplicateHarvestCatalogFields(catalogPayload.results || []))
      setMapFields(Array.isArray(mapPayload.fields) ? mapPayload.fields : [])
    } catch (error) {
      if (requestId !== catalogSeqRef.current) return
      setCatalogError(error instanceof Error ? error.message : 'Unable to load harvest catalog')
      setFields([])
      setMapFields([])
    } finally {
      if (requestId === catalogSeqRef.current) {
        setCatalogLoading(false)
      }
    }
  }, [mode])

  const refreshCatalog = useCallback(() => {
    setCatalogRefreshKey((value) => value + 1)
  }, [])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog, catalogRefreshKey])

  useEffect(() => {
    const handleFieldsUpdated = () => refreshCatalog()
    window.addEventListener('harvest:fields-updated', handleFieldsUpdated)
    return () => window.removeEventListener('harvest:fields-updated', handleFieldsUpdated)
  }, [refreshCatalog])

  useEffect(() => {
    setMetricOverlay({})
  }, [parcelId])

  useEffect(() => {
    if (!harvestCreateActive) return
    setHydratedField(null)
    setMetricOverlay({})
  }, [harvestCreateActive])

  useEffect(() => {
    if (!parcelId) {
      setHydratedField(null)
      return
    }

    if (catalogField) {
      setHydratedField(null)
      return
    }

    const requestId = ++hydrationSeqRef.current

    const hydrateFromEntity = async () => {
      try {
        const response = await fetch(`/api/harvest/entity/${parcelId}`, { cache: 'no-store' })
        if (requestId !== hydrationSeqRef.current) return
        if (!response.ok) {
          setHydratedField(null)
          return
        }

        const entity = await response.json()
        if (requestId !== hydrationSeqRef.current) return

        const normalized = normalizeEntityToField(entity, parcelId)
        if (!normalized) {
          setHydratedField(null)
          return
        }

        if (seasonIdFromUrl && Number.isFinite(seasonIdFromUrl)) {
          normalized.season_id = seasonIdFromUrl
        }

        setHydratedField(normalized)
      } catch {
        if (requestId === hydrationSeqRef.current) {
          setHydratedField(null)
        }
      }
    }

    void hydrateFromEntity()
  }, [catalogField, parcelId, seasonIdFromUrl])

  const getFieldDetailHref = useCallback(
    (field: HarvestFieldNavTarget) => {
      const currentParams =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : new URLSearchParams(searchParams.toString())
      return buildHarvestFieldDashboardUrl(
        currentParams,
        field,
        defaultHarvestFieldNavOptions(mode, searchParams.get('harvestMetric'))
      )
    },
    [mode, searchParams]
  )

  const selectField = useCallback(
    (field: HarvestFieldNavTarget) => {
      if (!resolveHarvestParcelId(field)) return
      const href = getFieldDetailHref(field)
      router.push(href, { scroll: false })
    },
    [getFieldDetailHref, router]
  )

  const selectFieldAtLatLng = useCallback(
    (lat: number, lng: number) => {
      const field = findHarvestMapFieldAtLatLng(enrichedMapFields, lat, lng)
      if (!field) return false
      selectField(field)
      return true
    },
    [enrichedMapFields, selectField]
  )

  const clearFieldSelection = useCallback(() => {
    router.replace(buildHarvestNationalDashboardUrl(mode), { scroll: false })
    setHydratedField(null)
    setMetricOverlay({})
  }, [mode, router])

  const startFieldCreate = useCallback(
    (drawMethod: 'vertex' | 'circle' = 'vertex') => {
      setHydratedField(null)
      setMetricOverlay({})
      const href = buildHarvestCreateDashboardUrl(drawMethod, mode)
      window.dispatchEvent(new Event('harvest:field-draw-clear'))
      router.push(href, { scroll: false })
    },
    [mode, router]
  )

  const setMode = useCallback(
    (nextMode: HarvestMode) => {
      setModeState(nextMode)
      const params = new URLSearchParams(searchParams.toString())
      params.set('module', 'harvest')
      params.set('harvestMode', nextMode)
      router.replace(`/dashboard?${params.toString()}`)
    },
    [router, searchParams]
  )

  const mergeFieldMetrics = useCallback(
    (parcelIdForStats: string, metrics: HarvestFieldMetrics) => {
      if (Object.keys(metrics).length === 0) return

      setFields((current) =>
        current.map((field) =>
          field.parcel_id === parcelIdForStats
            ? { ...field, metrics: { ...field.metrics, ...metrics } }
            : field
        )
      )

      if (!parcelId || parcelIdForStats !== parcelId) return

      setMetricOverlay((current) => {
        const hasChanges = FIELD_KPI_METRICS.some(
          (key) => metrics[key] !== undefined && metrics[key] !== current[key]
        )
        if (!hasChanges) return current
        return { ...current, ...metrics }
      })
    },
    [parcelId]
  )

  const patchActiveSeasonId = useCallback(
    (seasonId: number) => {
      if (!parcelId) return
      setHydratedField((current) => {
        if (current?.parcel_id !== parcelId) return current
        return { ...current, season_id: seasonId }
      })
    },
    [parcelId]
  )

  const value = useMemo(
    () => ({
      mode,
      setMode,
      fields,
      mapFields: enrichedMapFields,
      catalogLoading,
      catalogError,
      refreshCatalog,
      parcelId,
      activeSeasonId,
      activeField,
      isFieldDetailView,
      harvestCreateActive,
      selectField,
      getFieldDetailHref,
      openField: selectField,
      selectFieldAtLatLng,
      clearFieldSelection,
      startFieldCreate,
      mergeFieldMetrics,
      patchActiveSeasonId,
    }),
    [
      mode,
      setMode,
      fields,
      enrichedMapFields,
      catalogLoading,
      catalogError,
      refreshCatalog,
      parcelId,
      activeSeasonId,
      activeField,
      isFieldDetailView,
      harvestCreateActive,
      selectField,
      getFieldDetailHref,
      selectFieldAtLatLng,
      clearFieldSelection,
      startFieldCreate,
      mergeFieldMetrics,
      patchActiveSeasonId,
    ]
  )

  return <HarvestDashboardContext.Provider value={value}>{children}</HarvestDashboardContext.Provider>
}

export function useHarvestDashboard() {
  const context = useContext(HarvestDashboardContext)
  if (!context) {
    throw new Error('useHarvestDashboard must be used within HarvestDashboardProvider')
  }
  return context
}

export function useHarvestDashboardOptional() {
  return useContext(HarvestDashboardContext)
}
