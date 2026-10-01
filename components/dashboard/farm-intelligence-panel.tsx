'use client'

import { useEffect, useState } from 'react'
import { Droplets, Leaf, Sun, Zap, AlertTriangle, ExternalLink } from 'lucide-react'
import { useOperationalContextOptional } from '@/contexts/operational-context-provider'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

interface FarmIntelligenceData {
  farm: {
    id: string
    name: string
    location: string | null
    lat: number | null
    lng: number | null
    areaHectares: number | null
  }
  production: { totalProductionTons: number; crops: string[]; insightCount: number }
  water: { totalM3: number; intensityM3PerTon: number | null }
  energy: { totalKwh: number; intensityKwhPerTon: number | null }
  cropHealth: { averagePolygonScore: number | null; polygonCount: number }
  dataQuality: {
    hasGps: boolean
    hasProductionData: boolean
    hasWeatherData: boolean
    lastUpdated: string
  }
}

interface FarmIntelligencePanelProps {
  farmId?: string | null
  compact?: boolean
}

export function FarmIntelligencePanel({ farmId: farmIdProp, compact = false }: FarmIntelligencePanelProps) {
  const { tr } = useI18n()
  const opCtx = useOperationalContextOptional()
  const farmId = farmIdProp || opCtx?.context.farmId || null
  const [data, setData] = useState<FarmIntelligenceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!farmId) {
      setData(null)
      return
    }

    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/operations/farms/${farmId}/intelligence`, { cache: 'no-store' })
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || 'Failed to load farm intelligence')
        // A 200 without a farm (unknown id, schema drift) used to crash the page on `farm.name`.
        if (!payload?.farm) throw new Error('Farm not found')
        if (!cancelled) setData(payload as FarmIntelligenceData)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [farmId])

  if (!farmId) {
    return (
      <div className={cn('rounded-xl border border-line bg-card p-4', compact && 'p-3')}>
        <p className="text-[13px] text-content-soft">{tr('Select a farm on the map to view intelligence context.')}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={cn('rounded-xl border border-line bg-card p-4 animate-pulse', compact && 'p-3')}>
        <div className="h-4 w-32 bg-stone-100 rounded" />
        <div className="mt-3 h-3 w-full bg-muted rounded" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={cn('rounded-xl border border-line bg-card p-4', compact && 'p-3')}>
        <p role="alert" className="text-[13px] text-critical">{error ? tr(error) : tr('Farm data unavailable')}</p>
      </div>
    )
  }

  const fmt = (v: number | null, u = '') =>
    v === null ? '—' : `${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}${u}`

  return (
    <div className={cn('rounded-xl border border-line bg-card', compact ? 'p-3' : 'p-4')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-medium text-content flex items-center gap-2">
            <span aria-hidden="true" className="w-2 h-2 bg-ink shrink-0" style={{ borderRadius: 1 }} />
            {data.farm.name}
          </h3>
          {data.farm.location && (
            <p className="text-[12px] text-content-soft mt-0.5">{data.farm.location}</p>
          )}
        </div>
        {!data.dataQuality.hasGps && (
          <span className="g-tag g-tag--outline-ink" style={{ height: 22, padding: '0 9px', fontSize: 11 }}><span aria-hidden="true" className="w-1.5 h-1.5 bg-warning" style={{ borderRadius: 1 }} />{tr('No GPS')}</span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric icon={Leaf} label={tr('Production')} value={fmt(data.production.totalProductionTons, ' t')} />
        <Metric icon={Droplets} label={tr('Water')} value={fmt(data.water.totalM3, ' m³')} />
        <Metric icon={Zap} label={tr('Energy')} value={fmt(data.energy.totalKwh, ' kWh')} />
        <Metric icon={Sun} label={tr('Health')} value={fmt(data.cropHealth.averagePolygonScore, '/100')} />
      </div>

      {data.production.crops.length > 0 && (
        <p className="mt-2 text-[10px] text-content-soft">
          {tr('Crops: {crops}', { crops: data.production.crops.join(', ') })}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <ContextButton onClick={() => opCtx?.goToModule('weather', { farmId })} label={tr('Weather')} />
        <ContextButton onClick={() => opCtx?.goToModule('harvest', { farmId })} label={tr('Harvest')} />
        <ContextButton onClick={() => opCtx?.goToModule('water-intelligence', { farmId })} label={tr('Water')} />
        <ContextButton onClick={() => opCtx?.goToModule('data-analytics', { farmId })} label={tr('Analytics')} />
      </div>

      {!data.dataQuality.hasProductionData && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-warning-strong">
          <AlertTriangle strokeWidth={1.5} className="h-3 w-3" />
          {tr('Limited production data for this farm')}
        </div>
      )}
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof Leaf; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[12px] text-content-soft">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="growa-figure text-content mt-1" style={{ fontSize: 20 }}>{value}</p>
    </div>
  )
}

function ContextButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-pill border border-line-strong px-2.5 h-7 text-[12px] text-content hover:bg-stone-100 transition-colors"
    >
      {label}
      <ExternalLink strokeWidth={1.5} className="h-2.5 w-2.5" />
    </button>
  )
}
