'use client'

import { useEffect, useState } from 'react'
import { Droplets, Leaf, MapPin, Sun, Zap, AlertTriangle, ExternalLink } from 'lucide-react'
import { useOperationalContextOptional } from '@/contexts/operational-context-provider'
import { cn } from '@/lib/utils'

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
      <div className={cn('rounded-lg border border-white/10 bg-[#0a0d12] p-4', compact && 'p-3')}>
        <p className="text-xs text-white/40">Select a farm on the map to view intelligence context.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={cn('rounded-lg border border-white/10 bg-[#0a0d12] p-4 animate-pulse', compact && 'p-3')}>
        <div className="h-4 w-32 bg-white/10 rounded" />
        <div className="mt-3 h-3 w-full bg-white/5 rounded" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={cn('rounded-lg border border-red-500/20 bg-red-500/5 p-4', compact && 'p-3')}>
        <p className="text-xs text-red-300">{error || 'Farm data unavailable'}</p>
      </div>
    )
  }

  const fmt = (v: number | null, u = '') =>
    v === null ? '—' : `${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}${u}`

  return (
    <div className={cn('rounded-lg border border-[#07f880]/20 bg-[#0a0d12]', compact ? 'p-3' : 'p-4')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-[#07f880]" />
            {data.farm.name}
          </h3>
          {data.farm.location && (
            <p className="text-[10px] text-white/40 mt-0.5">{data.farm.location}</p>
          )}
        </div>
        {!data.dataQuality.hasGps && (
          <span className="text-[9px] uppercase text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">No GPS</span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric icon={Leaf} label="Production" value={fmt(data.production.totalProductionTons, ' t')} />
        <Metric icon={Droplets} label="Water" value={fmt(data.water.totalM3, ' m³')} />
        <Metric icon={Zap} label="Energy" value={fmt(data.energy.totalKwh, ' kWh')} />
        <Metric icon={Sun} label="Health" value={fmt(data.cropHealth.averagePolygonScore, '/100')} />
      </div>

      {data.production.crops.length > 0 && (
        <p className="mt-2 text-[10px] text-white/50">
          Crops: {data.production.crops.join(', ')}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <ContextButton onClick={() => opCtx?.goToModule('weather', { farmId })} label="Weather" />
        <ContextButton onClick={() => opCtx?.goToModule('harvest', { farmId })} label="Harvest" />
        <ContextButton onClick={() => opCtx?.goToModule('water-intelligence', { farmId })} label="Water" />
        <ContextButton onClick={() => opCtx?.goToModule('data-analytics', { farmId })} label="Analytics" />
      </div>

      {!data.dataQuality.hasProductionData && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-300">
          <AlertTriangle className="h-3 w-3" />
          Limited production data for this farm
        </div>
      )}
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof Leaf; label: string; value: string }) {
  return (
    <div className="rounded border border-white/5 bg-white/[0.02] px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-white/35">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-xs font-medium text-white mt-0.5">{value}</p>
    </div>
  )
}

function ContextButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-0.5 rounded border border-white/10 px-2 py-0.5 text-[10px] text-white/60 hover:text-[#07f880] hover:border-[#07f880]/30 transition-colors"
    >
      {label}
      <ExternalLink className="h-2.5 w-2.5" />
    </button>
  )
}
