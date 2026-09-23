'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, BarChart3, Sprout, TrendingUp } from 'lucide-react'
import type { WatchtowerSummary } from '@/lib/domain/types'
import { useOperationalContextOptional } from '@/contexts/operational-context-provider'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type EstimationFocus = 'production' | 'harvest-forecast' | 'crop-health' | 'supply'

const ESTIMATION_LAYERS: Array<{ id: EstimationFocus; label: string; module: string; harvestMode?: string }> = [
  { id: 'production', label: 'Production estimate', module: 'data-analytics' },
  { id: 'harvest-forecast', label: 'Harvest forecast', module: 'harvest', harvestMode: 'predict' },
  { id: 'crop-health', label: 'Crop health risk', module: 'harvest', harvestMode: 'predict' },
  { id: 'supply', label: 'Supply position', module: 'supply-overview' },
]

interface NationalEstimationPanelProps {
  summary: WatchtowerSummary
}

function formatMetricValue(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${unit}`
}

export function NationalEstimationPanel({ summary }: NationalEstimationPanelProps) {
  const { t } = useI18n()
  const opCtx = useOperationalContextOptional()
  const [focus, setFocus] = useState<EstimationFocus>('production')

  const productionSignals = useMemo(
    () =>
      summary.signals.filter(
        (signal) => signal.type === 'production' || signal.type === 'crop_health'
      ),
    [summary.signals]
  )

  const openEstimation = (layer: typeof ESTIMATION_LAYERS[number]) => {
    setFocus(layer.id)
    if (layer.module === 'supply-overview') {
      window.location.href = '/dashboard/supply-overview'
      return
    }
    opCtx?.goToModule(layer.module, {
      signalId: summary.signals[0]?.id,
      timeframe: summary.timeframe,
    })
  }

  return (
    <div className="flex h-full min-h-[360px] flex-col rounded-lg border border-white/10 bg-[#06080c] overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#07f880]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
            {t('watchtower.national_estimations')}
          </span>
        </div>
        {summary.isDemo && (
          <span className="text-[9px] uppercase text-amber-400">Demo estimates</span>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="hidden sm:flex w-40 shrink-0 flex-col gap-2 border-r border-white/10 p-2 overflow-y-auto">
          <p className="text-[9px] uppercase tracking-widest text-white/30 mb-1">Estimation views</p>
          {ESTIMATION_LAYERS.map((layer) => (
            <button
              key={layer.id}
              type="button"
              onClick={() => openEstimation(layer)}
              className={cn(
                'w-full text-left rounded px-1.5 py-1 text-[10px] mb-0.5 transition-colors',
                focus === layer.id
                  ? 'bg-[#07f880]/15 text-[#07f880]'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
              )}
            >
              {layer.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <EstimationCard
              label="Production estimate"
              value={formatMetricValue(summary.production.productionEstimate.value, summary.production.productionEstimate.unit)}
              detail={summary.production.productionEstimate.source}
              accent
            />
            <EstimationCard
              label="At-risk entities"
              value={formatMetricValue(summary.production.atRiskProduction?.value ?? null, summary.production.atRiskProduction?.unit || 'entities')}
              detail="From estimation signals"
              warning={Boolean(summary.production.atRiskProduction?.value)}
            />
            <EstimationCard
              label="30-day harvest outlook"
              value={summary.outlook?.thirtyDay?.harvest ? 'Available' : 'Insufficient data'}
              detail={summary.outlook?.thirtyDay?.harvest || summary.outlook?.thirtyDay?.production || '—'}
            />
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-widest text-white/40">Production estimation chain</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ChainItem icon={Sprout} label="Observed production" value={formatMetricValue(summary.production.productionEstimate.value, 't')} />
              <ChainItem icon={TrendingUp} label="Forecast outlook" value={summary.outlook?.thirtyDay?.production || '—'} />
              <ChainItem icon={BarChart3} label="Crop health status" value={summary.nationalStatus.find((s) => s.domain === 'crop_health')?.reason || '—'} />
              <ChainItem icon={TrendingUp} label="Supply implication" value={summary.outlook?.thirtyDay?.supplyImplications || '—'} />
            </div>
          </div>

          {productionSignals.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Estimation anomalies</p>
              <div className="space-y-2">
                {productionSignals.slice(0, 5).map((signal) => (
                  <button
                    key={signal.id}
                    type="button"
                    onClick={() => opCtx?.goToModule('harvest', { signalId: signal.id, parcelId: signal.parcelIds?.[0] })}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-left hover:border-[#07f880]/30"
                  >
                    <div>
                      <p className="text-sm text-white">{signal.title}</p>
                      <p className="text-xs text-white/45 line-clamp-1">{signal.summary}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#07f880]" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openEstimation(ESTIMATION_LAYERS[1])}
              className="inline-flex items-center gap-1.5 rounded bg-[#07f880]/15 px-3 py-1.5 text-xs font-medium text-[#07f880]"
            >
              <Sprout className="h-3.5 w-3.5" />
              Open harvest forecast
            </button>
            <button
              type="button"
              onClick={() => openEstimation(ESTIMATION_LAYERS[0])}
              className="inline-flex items-center gap-1.5 rounded border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Production analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EstimationCard({
  label,
  value,
  detail,
  accent,
  warning,
}: {
  label: string
  value: string
  detail: string
  accent?: boolean
  warning?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-3',
        warning ? 'border-amber-500/30 bg-amber-500/10' : accent ? 'border-[#07f880]/30 bg-[#07f880]/10' : 'border-white/10 bg-white/[0.02]'
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-[10px] text-white/45 line-clamp-2">{detail}</p>
    </div>
  )
}

function ChainItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Sprout
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2 rounded border border-white/10 bg-[#0a0d12] px-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 text-[#07f880]/70" />
      <div>
        <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
        <p className="text-xs text-white/75 line-clamp-2">{value}</p>
      </div>
    </div>
  )
}
