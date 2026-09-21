'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Circle, Loader2, MapPin, Pentagon, Plus, X } from 'lucide-react'
import { IntelligencePanel } from '@/components/dashboard/intelligence-workspace-ui'
import { calculatePolygonAreaHectares, calculateRingsAreaHectares } from '@/lib/harvest/geojson'
import {
  MAX_FIELD_AREA_HECTARES,
  MIN_FIELD_AREA_HECTARES,
  START_DATE_LOOKBACK_DAYS,
  getDefaultHarvestEndDate,
  getDefaultHarvestStartDate,
  getLatestAllowedStartDate,
  validateHarvestFieldCreateInput,
} from '@/lib/harvest/field-create'
import { HARVEST_NATIONAL_DASHBOARD_PATH } from '@/lib/harvest/field-navigation'
import type { LatLngVertex } from '@/lib/harvest/geojson'
import type { HarvestCropGroup } from '@/lib/harvest/types'

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
  const router = useRouter()
  const [name, setName] = useState('')
  const [cropId, setCropId] = useState<string>('')
  const [startDate, setStartDate] = useState(getDefaultHarvestStartDate())
  const [harvestDate, setHarvestDate] = useState(getDefaultHarvestEndDate())
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
    router.replace(HARVEST_NATIONAL_DASHBOARD_PATH, { scroll: false })
    onClearDraw()
    setError(null)
  }, [onClearDraw, router])

  const submitField = useCallback(async () => {
    if (hasDraftInProgress) {
      setError('Finish the current polygon or clear it before creating the field.')
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
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Unable to create field')
      }

      window.dispatchEvent(new Event('harvest:fields-updated'))
      onCreated?.(payload.parcel_id, payload.season_id)
      exitCreateMode()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create field')
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
    validationError,
  ])

  const areaValid =
    totalAreaHa >= MIN_FIELD_AREA_HECTARES &&
    totalAreaHa <= MAX_FIELD_AREA_HECTARES &&
    polygonCount >= 1

  return (
    <IntelligencePanel
      title="Create new field"
      subtitle="Draw the boundary on the map, then set crop and season dates"
      icon={Plus}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onDrawMethodChange('vertex')}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
              drawMethod === 'vertex'
                ? 'border-primary/40 bg-primary/15 text-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <Pentagon className="h-3.5 w-3.5" />
            Polygon
          </button>
          <button
            type="button"
            onClick={() => onDrawMethodChange('circle')}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
              drawMethod === 'circle'
                ? 'border-primary/40 bg-primary/15 text-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <Circle className="h-3.5 w-3.5" />
            Circle
          </button>
          <button
            type="button"
            onClick={exitCreateMode}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        </div>

        <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
          {drawMethod === 'vertex'
            ? 'Click on the map to add vertices. Use "Finish polygon" to save it, then draw more polygons in the same field.'
            : 'Click the circle center, move the mouse to set the radius, then click again to confirm. You can add multiple circles.'}
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg border border-border bg-card/70 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Polygons</p>
            <p className="mt-1 font-semibold text-foreground">{polygonCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-card/70 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Draft pts</p>
            <p className="mt-1 font-semibold text-foreground">{draftVertices.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card/70 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Area</p>
            <p className={`mt-1 font-semibold ${areaValid ? 'text-foreground' : 'text-amber-300'}`}>
              {polygonCount > 0 || draftVertices.length >= 3 ? `${totalAreaHa.toFixed(2)} ha` : '—'}
            </p>
          </div>
        </div>

        {canFinishPolygon ? (
          <button
            type="button"
            onClick={onFinishPolygon}
            className="w-full rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/15"
          >
            Finish polygon and add another
          </button>
        ) : null}

        <p className="text-[11px] text-muted-foreground">
          Constraints: start date at least {START_DATE_LOOKBACK_DAYS} days before today (latest{' '}
          {latestStartDate}), total area between {MIN_FIELD_AREA_HECTARES} and {MAX_FIELD_AREA_HECTARES} ha.
        </p>

        <div className="space-y-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Field name"
            className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground"
          />

          <select
            value={cropId}
            onChange={(event) => setCropId(event.target.value)}
            disabled={loadingCrops}
            className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="">Select crop</option>
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
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>Season start</span>
              <input
                type="date"
                value={startDate}
                max={latestStartDate}
                min="2018-01-01"
                onChange={(event) => setStartDate(event.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>Harvest date</span>
              <input
                type="date"
                value={harvestDate}
                min={startDate || '2018-01-01'}
                onChange={(event) => setHarvestDate(event.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              />
            </label>
          </div>
        </div>

        {error ? <p className="text-xs text-red-300">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onClearDraw}
            className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear drawing
          </button>
          <button
            type="button"
            onClick={() => void submitField()}
            disabled={submitting || Boolean(validationError) || hasDraftInProgress}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
            Create field on map
          </button>
        </div>
      </div>
    </IntelligencePanel>
  )
}
