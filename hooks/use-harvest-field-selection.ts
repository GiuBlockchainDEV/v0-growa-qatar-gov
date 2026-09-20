'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { buildHarvestFieldDashboardUrl } from '@/lib/harvest/field-navigation'
import { normalizeEntityToField } from '@/lib/harvest/normalize'
import type { HarvestAnalyticsField, HarvestFieldMetrics, HarvestMetricKey, HarvestMode } from '@/lib/harvest/types'

const FIELD_KPI_METRICS: HarvestMetricKey[] = ['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost']

export function useHarvestFieldSelection({
  fields,
  mode,
}: {
  fields: HarvestAnalyticsField[]
  mode: HarvestMode
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const parcelId = searchParams.get('parcelId')
  const harvestSeasonIdParam = searchParams.get('harvestSeasonId')
  const harvestCreateActive = searchParams.get('harvestCreate') === '1'

  const [hydratedField, setHydratedField] = useState<HarvestAnalyticsField | null>(null)
  const [metricOverlay, setMetricOverlay] = useState<HarvestFieldMetrics>({})
  const hydrationSeqRef = useRef(0)

  const catalogField = useMemo(() => {
    if (!parcelId) return null
    return fields.find((field) => field.parcel_id === parcelId) ?? null
  }, [fields, parcelId])

  const activeField = useMemo(() => {
    if (!parcelId) return null
    if (catalogField) return { ...catalogField, metrics: { ...catalogField.metrics, ...metricOverlay } }
    if (hydratedField?.parcel_id === parcelId) {
      return { ...hydratedField, metrics: { ...hydratedField.metrics, ...metricOverlay } }
    }
    return null
  }, [catalogField, hydratedField, metricOverlay, parcelId])

  const activeParcelId = parcelId

  const activeSeasonId = useMemo(() => {
    const fromUrl = harvestSeasonIdParam ? Number(harvestSeasonIdParam) : undefined
    if (fromUrl && Number.isFinite(fromUrl)) return fromUrl

    if (activeField?.season_id && Number.isFinite(activeField.season_id)) {
      return activeField.season_id
    }

    return undefined
  }, [activeField?.season_id, harvestSeasonIdParam])

  const isFieldDetailView = Boolean(parcelId && !harvestCreateActive)

  useEffect(() => {
    setMetricOverlay({})
  }, [parcelId])

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

        if (harvestSeasonIdParam) {
          const seasonIdFromUrl = Number(harvestSeasonIdParam)
          if (Number.isFinite(seasonIdFromUrl)) {
            normalized.season_id = seasonIdFromUrl
          }
        }

        setHydratedField(normalized)
      } catch {
        if (requestId === hydrationSeqRef.current) {
          setHydratedField(null)
        }
      }
    }

    void hydrateFromEntity()
  }, [catalogField, harvestSeasonIdParam, parcelId])

  const openField = useCallback(
    (field: HarvestAnalyticsField) => {
      router.replace(
        buildHarvestFieldDashboardUrl(searchParams, field, {
          mode,
          harvestMetric: searchParams.get('harvestMetric'),
          harvestGranularity: 'season',
        })
      )
    },
    [mode, router, searchParams]
  )

  const clearFieldSelection = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('module', 'harvest')
    params.set('harvestMode', mode)
    params.delete('parcelId')
    params.delete('harvestMetric')
    params.delete('harvestGranularity')
    params.delete('harvestPeriod')
    params.delete('harvestSeasonId')
    params.delete('focus')
    router.push(`/dashboard?${params.toString()}`)
    setHydratedField(null)
    setMetricOverlay({})
  }, [mode, router, searchParams])

  const mergeFieldMetrics = useCallback((parcelIdForStats: string, metrics: HarvestFieldMetrics) => {
    if (!parcelId || parcelIdForStats !== parcelId) return
    if (Object.keys(metrics).length === 0) return

    setMetricOverlay((current) => {
      const hasChanges = FIELD_KPI_METRICS.some(
        (key) => metrics[key] !== undefined && metrics[key] !== current[key]
      )
      if (!hasChanges) return current
      return { ...current, ...metrics }
    })
  }, [parcelId])

  const patchActiveSeasonId = useCallback((seasonId: number) => {
    if (!parcelId) return
    setHydratedField((current) => {
      if (current?.parcel_id !== parcelId) return current
      return { ...current, season_id: seasonId }
    })
  }, [parcelId])

  return {
    parcelId,
    activeParcelId,
    activeSeasonId,
    activeField,
    isFieldDetailView,
    openField,
    clearFieldSelection,
    mergeFieldMetrics,
    patchActiveSeasonId,
  }
}
