'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Circle, Loader2, MapPin, Pentagon, Plus, X } from 'lucide-react'
import { IntelligencePanel } from '@/components/dashboard/intelligence-workspace-ui'
import { calculatePolygonAreaHectares } from '@/lib/harvest/geojson'
import {
  MAX_FIELD_AREA_HECTARES,
  MIN_FIELD_AREA_HECTARES,
  START_DATE_LOOKBACK_DAYS,
  getDefaultHarvestEndDate,
  getDefaultHarvestStartDate,
  getLatestAllowedStartDate,
  validateHarvestFieldCreateInput,
} from '@/lib/harvest/field-create'
import type { LatLngVertex } from '@/lib/harvest/geojson'
import type { HarvestCropGroup } from '@/lib/harvest/types'

type HarvestDrawMethod = 'vertex' | 'circle'

interface HarvestFieldCreatePanelProps {
  drawMethod: HarvestDrawMethod
  vertices: LatLngVertex[]
  onDrawMethodChange: (method: HarvestDrawMethod) => void
  onClearDraw: () => void
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
  vertices,
  onDrawMethodChange,
  onClearDraw,
  onCreated,
}: HarvestFieldCreatePanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [cropId, setCropId] = useState<string>('')
  const [startDate, setStartDate] = useState(getDefaultHarvestStartDate())
  const [harvestDate, setHarvestDate] = useState(getDefaultHarvestEndDate())
  const [cropGroups, setCropGroups] = useState<HarvestCropGroup[]>([])
  const [loadingCrops, setLoadingCrops] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const areaHa = useMemo(() => calculatePolygonAreaHectares(vertices), [vertices])
  const latestStartDate = getLatestAllowedStartDate()

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
        vertices,
      }),
    [cropId, harvestDate, name, startDate, vertices]
  )

  const exitCreateMode = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('harvestCreate')
    params.delete('harvestDraw')
    router.replace(`/dashboard?${params.toString()}`)
    onClearDraw()
    setError(null)
  }, [onClearDraw, router, searchParams])

  const submitField = useCallback(async () => {
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
          vertices,
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
    name,
    onCreated,
    startDate,
    validationError,
    vertices,
  ])

  const areaValid =
    areaHa >= MIN_FIELD_AREA_HECTARES && areaHa <= MAX_FIELD_AREA_HECTARES && vertices.length >= 3

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
            ? 'Click on the map to add vertices. The polygon closes automatically when you create the field.'
            : 'Click the circle center, move the mouse to set the radius, then click again to confirm.'}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-border bg-card/70 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Vertices</p>
            <p className="mt-1 font-semibold text-foreground">{vertices.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card/70 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Area</p>
            <p className={`mt-1 font-semibold ${areaValid ? 'text-foreground' : 'text-amber-300'}`}>
              {vertices.length >= 3 ? `${areaHa.toFixed(2)} ha` : '—'}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Constraints: start date at least {START_DATE_LOOKBACK_DAYS} days before today (latest{' '}
          {latestStartDate}), area between {MIN_FIELD_AREA_HECTARES} and {MAX_FIELD_AREA_HECTARES} ha.
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
            disabled={submitting || Boolean(validationError)}
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
