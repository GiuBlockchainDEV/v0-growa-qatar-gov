'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Circle, Loader2, MapPin, Pentagon, Plus, X } from 'lucide-react'
import { IntelligencePanel } from '@/components/dashboard/intelligence-workspace-ui'
import { calculatePolygonAreaHectares, calculateRingsAreaHectares } from '@/lib/harvest/geojson'
import {
  MAX_FIELD_AREA_HECTARES,
  MIN_FIELD_AREA_HECTARES,
  START_DATE_LOOKBACK_DAYS,
  getLatestAllowedStartDate,
  validateHarvestFieldCreateInput,
} from '@/lib/harvest/field-create'
import { buildHarvestNationalDashboardUrl } from '@/lib/harvest/field-navigation'
import type { LatLngVertex } from '@/lib/harvest/geojson'
import type { HarvestCropGroup } from '@/lib/harvest/types'
import { useI18n } from '@/lib/i18n'

type HarvestDrawMethod = 'vertex' | 'circle'

interface HarvestFieldCreatePanelProps {
  drawMethod: HarvestDrawMethod
  rings: LatLngVertex[][]
  draftVertices: LatLngVertex[]
  onDrawMethodChange: (method: HarvestDrawMethod) => void
  onClearDraw: () => void
  onFinishPolygon: () => void
  onCreated?: (parcelId: string, seasonId?: number) => void
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'Request failed')
  }
  return payload as T
}

export function HarvestFieldCreatePanel({
  drawMethod,
  rings,
  draftVertices,
  onDrawMethodChange,
  onClearDraw,
  onFinishPolygon,
  onCreated,
}: HarvestFieldCreatePanelProps) {
  const { tr } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const harvestMode = searchParams.get('harvestMode') === 'predict' ? 'predict' : 'current'
  const [name, setName] = useState('')
  const [cropId, setCropId] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [harvestDate, setHarvestDate] = useState('')
  const [cropGroups, setCropGroups] = useState<HarvestCropGroup[]>([])
  const [loadingCrops, setLoadingCrops] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const completedAreaHa = useMemo(() => calculateRingsAreaHectares(rings), [rings])
  const draftAreaHa = useMemo(() => calculatePolygonAreaHectares(draftVertices), [draftVertices])
  const totalAreaHa = completedAreaHa + draftAreaHa
  const polygonCount = rings.length
  const latestStartDate = getLatestAllowedStartDate()
  const hasDraftInProgress = draftVertices.length > 0
  const canFinishPolygon = drawMethod === 'vertex' && draftVertices.length >= 3

  useEffect(() => {
    let cancelled = false
    const loadCrops = async () => {
      setLoadingCrops(true)
      try {
        const payload = await fetchJson<{ groups: HarvestCropGroup[] }>('/api/harvest/crops')
        if (!cancelled) setCropGroups(payload.groups || [])
      } catch {
        if (!cancelled) setCropGroups([])
      } finally {
        if (!cancelled) setLoadingCrops(false)
      }
    }
    void loadCrops()
    return () => {
      cancelled = true
    }
  }, [])

  const cropName = useMemo(() => {
    if (!cropId) return ''
    for (const group of cropGroups) {
      const option = group.options.find((entry) => String(entry.value) === cropId)
      if (option) return option.label
    }
    return ''
  }, [cropGroups, cropId])

  const seasonGeometry = useMemo(() => {
    const geometry = [...rings]
    if (draftVertices.length >= 3) geometry.push(draftVertices)
    return geometry
  }, [draftVertices, rings])

  useEffect(() => {
    if (!cropId || !cropName) return

    let cancelled = false
    const loadSuggestedDates = async () => {
      try {
        const response = await fetch('/api/harvest/season-dates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            crop_name: cropName,
            rings: seasonGeometry,
          }),
        })
        const payload = await response.json()
        if (!response.ok) return
        if (cancelled) return
        if (typeof payload?.start_date === 'string') setStartDate(payload.start_date)
      } catch {
        // keep previous values when suggestion is unavailable
      }
    }

    void loadSuggestedDates()
    return () => {
      cancelled = true
    }
  }, [cropId, cropName, seasonGeometry])

  const validationError = useMemo(
    () =>
      validateHarvestFieldCreateInput({
        name,
        crop_id: cropId ? Number(cropId) : null,
        start_date: startDate,
        harvest_date: harvestDate,
        rings,
      }),
    [cropId, harvestDate, name, rings, startDate]
  )

  const exitCreateMode = useCallback(() => {
    router.replace(buildHarvestNationalDashboardUrl(harvestMode), { scroll: false })
    onClearDraw()
    setError(null)
  }, [harvestMode, onClearDraw, router])

  const submitField = useCallback(async () => {
    if (hasDraftInProgress) {
      setError(tr('Finish the current polygon or clear it before creating the field.'))
      return
    }

    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/harvest/entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          crop_id: Number(cropId),
          start_date: startDate,
          harvest_date: harvestDate,
          rings,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : tr('Unable to create field'))
      }

      window.dispatchEvent(new Event('harvest:fields-updated'))
      onCreated?.(payload.parcel_id, payload.season_id)
      exitCreateMode()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : tr('Unable to create field'))
    } finally {
      setSubmitting(false)
    }
  }, [
    cropId,
    exitCreateMode,
    harvestDate,
    hasDraftInProgress,
    name,
    onCreated,
    rings,
    startDate,
    tr,
    validationError,
  ])

  const areaValid =
    totalAreaHa >= MIN_FIELD_AREA_HECTARES &&
    totalAreaHa <= MAX_FIELD_AREA_HECTARES &&
    polygonCount >= 1

  return (
    <IntelligencePanel
      title={tr('Create new field')}
      subtitle={tr('Draw the boundary on the map, then select the crop to auto-fill season dates')}
      icon={Plus}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onDrawMethodChange('vertex')}
            className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium ${
              drawMethod === 'vertex'
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-card text-content-soft hover:text-content'
            }`}
          >
            <Pentagon strokeWidth={1.5} className="h-3.5 w-3.5" />
            {tr('Polygon')}
          </button>
          <button
            type="button"
            onClick={() => onDrawMethodChange('circle')}
            className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium ${
              drawMethod === 'circle'
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-card text-content-soft hover:text-content'
            }`}
          >
            <Circle strokeWidth={1.5} className="h-3.5 w-3.5" />
            {tr('Circle')}
          </button>
          <button
            type="button"
            onClick={exitCreateMode}
            className="ms-auto inline-flex items-center gap-1.5 rounded-pill border border-line px-3 py-1.5 text-xs text-content-soft hover:text-content"
          >
            <X strokeWidth={1.5} className="h-3.5 w-3.5" />
            {tr('Cancel')}
          </button>
        </div>

        <div className="bg-muted px-3 py-2.5 text-[12px] leading-[1.45] text-content-soft" style={{ borderRadius: 'var(--radius-md)' }}>
          {drawMethod === 'vertex'
            ? tr('Click on the map to add vertices. Use “Finish polygon” to save it, then draw more polygons in the same field.')
            : tr('Click the circle center, move the mouse to set the radius, then click again to confirm. You can add multiple circles.')}
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg border border-line bg-card px-3 py-2">
            <p className="text-[11px] text-content-soft">{tr('Polygons')}</p>
            <p className="mt-1 growa-figure text-[16px] text-content">{polygonCount}</p>
          </div>
          <div className="rounded-lg border border-line bg-card px-3 py-2">
            <p className="text-[11px] text-content-soft">{tr('Draft pts')}</p>
            <p className="mt-1 growa-figure text-[16px] text-content">{draftVertices.length}</p>
          </div>
          <div className="rounded-lg border border-line bg-card px-3 py-2">
            <p className="text-[11px] text-content-soft">{tr('Area')}</p>
            <p className={`mt-1 growa-figure text-[16px] ${areaValid ? 'text-content' : 'text-warning-strong'}`}>
              {polygonCount > 0 || draftVertices.length >= 3 ? `${totalAreaHa.toFixed(2)} ha` : '—'}
            </p>
          </div>
        </div>

        {canFinishPolygon ? (
          <button
            type="button"
            onClick={onFinishPolygon}
            className="g-btn g-btn--primary w-full" style={{ height: 36, fontSize: 13 }}
          >
            {tr('Finish polygon and add another')}
          </button>
        ) : null}

        <p className="text-[11px] text-content-soft">
          {tr(
            'Season start is suggested from crop type and field location. Harvest date must be set manually. Start must be at least {days} days before today (latest {latest}). Area must be between {min} and {max} ha.',
            { days: START_DATE_LOOKBACK_DAYS, latest: latestStartDate, min: MIN_FIELD_AREA_HECTARES, max: MAX_FIELD_AREA_HECTARES }
          )}
        </p>

        <div className="space-y-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={tr('Field name')}
            className="h-9 w-full rounded-md border border-line-strong bg-card px-3 text-[14px] text-content placeholder:text-content-soft focus:border-sage focus:outline-none"
          />

          <select
            value={cropId}
            onChange={(event) => setCropId(event.target.value)}
            disabled={loadingCrops}
            className="h-9 w-full rounded-md border border-line-strong bg-card px-3 text-[14px] text-content placeholder:text-content-soft focus:border-sage focus:outline-none"
          >
            <option value="">{tr('Select crop')}</option>
            {cropGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <label className="space-y-1 text-xs text-content-soft">
              <span>{tr('Season start (auto)')}</span>
              <input
                type="date"
                value={startDate}
                max={latestStartDate}
                min="2018-01-01"
                readOnly
                className="h-9 w-full rounded-md border border-line-strong bg-muted px-3 text-[14px] text-content placeholder:text-content-soft focus:border-sage focus:outline-none"
              />
            </label>
            <label className="space-y-1 text-xs text-content-soft">
              <span>{tr('Harvest date')}</span>
              <input
                type="date"
                value={harvestDate}
                min={startDate || '2018-01-01'}
                onChange={(event) => setHarvestDate(event.target.value)}
                className="h-9 w-full rounded-md border border-line-strong bg-card px-3 text-[14px] text-content placeholder:text-content-soft focus:border-sage focus:outline-none"
              />
            </label>
          </div>
        </div>

        {error ? <p role="alert" className="text-[12px] text-critical">{tr(error)}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onClearDraw}
            className="rounded-pill border border-line px-3 py-2 text-xs text-content-soft hover:text-content"
          >
            {tr('Clear drawing')}
          </button>
          <button
            type="button"
            onClick={() => void submitField()}
            disabled={submitting || Boolean(validationError) || hasDraftInProgress}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-pill border border-ink bg-ink px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 strokeWidth={1.5} className="h-3.5 w-3.5 animate-spin" /> : <MapPin strokeWidth={1.5} className="h-3.5 w-3.5" />}
            {tr('Create field on map')}
          </button>
        </div>
      </div>
    </IntelligencePanel>
  )
}
