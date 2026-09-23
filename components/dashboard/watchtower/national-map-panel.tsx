'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Layers, Sprout, TrendingUp } from 'lucide-react'
import { SatelliteMap } from '@/components/dashboard/satellite-map'
import { WATCHTOWER_MAP_LAYERS } from '@/lib/watchtower/map-layers'
import { humanizeMetricSource } from '@/lib/watchtower/production-metrics'
import { useOperationalContextOptional } from '@/contexts/operational-context-provider'
import { useI18n } from '@/lib/i18n'
import type { WatchtowerSummary } from '@/lib/domain/types'
import type { HarvestMapField } from '@/lib/harvest/types'
import { getQatarBoundaryCoordinates } from '@/lib/weather/qatar-grid'
import { cn } from '@/lib/utils'

const PRODUCTION_LAYER_IDS = new Set([
  'fields',
  'production',
  'harvest-forecast',
  'crop-health',
  'crop-type',
  'intelligence-signals',
])

const DEFAULT_PRODUCTION_LAYERS = [
  'fields',
  'production',
  'harvest-forecast',
  'crop-health',
  'intelligence-signals',
]

interface NationalMapPanelProps {
  summary: WatchtowerSummary
  locale: string
  targetFarmId?: string | null
  targetPointId?: string | null
  targetFocusToken?: string | null
  targetZoom?: number
  targetCropFilter?: string | null
  selectedParcelId?: string | null
}

function formatMetricValue(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${unit}`
}

export function NationalMapPanel({
  summary,
  locale,
  targetFarmId,
  targetPointId,
  targetFocusToken,
  targetZoom,
  targetCropFilter,
  selectedParcelId,
}: NationalMapPanelProps) {
  const { t } = useI18n()
  const opCtx = useOperationalContextOptional()
  const activeLayers = opCtx?.activeMapLayers?.length
    ? opCtx.activeMapLayers.filter((layer) => PRODUCTION_LAYER_IDS.has(layer))
    : DEFAULT_PRODUCTION_LAYERS
  const effectiveLayers = activeLayers.length > 0 ? activeLayers : DEFAULT_PRODUCTION_LAYERS

  const [harvestFields, setHarvestFields] = useState<HarvestMapField[]>([])
  const [mapTileUrl, setMapTileUrl] = useState<string | null>(null)
  const [mapLoading, setMapLoading] = useState(true)

  const productionLayers = useMemo(
    () => WATCHTOWER_MAP_LAYERS.filter((layer) => PRODUCTION_LAYER_IDS.has(layer.id)),
    []
  )

  const weatherBoundary = useMemo(() => getQatarBoundaryCoordinates(), [])

  const headlineMetrics = [
    {
      label: summary.production.productionEstimate.label,
      value: formatMetricValue(
        summary.production.productionEstimate.value,
        summary.production.productionEstimate.unit
      ),
      detail: humanizeMetricSource(summary.production.productionEstimate.source),
    },
    {
      label: summary.production.fieldsMonitored?.label || 'Fields monitored',
      value: formatMetricValue(
        summary.production.fieldsMonitored?.value ?? harvestFields.length,
        summary.production.fieldsMonitored?.unit || 'fields'
      ),
      detail: summary.production.cropTypes?.value
        ? `${summary.production.cropTypes.value} crop types`
        : 'Harvest forecast coverage',
    },
    {
      label: summary.production.atRiskProduction?.label || 'Below health threshold',
      value: formatMetricValue(
        summary.production.atRiskProduction?.value ?? null,
        summary.production.atRiskProduction?.unit || 'fields'
      ),
      detail: summary.production.avgHealthScore?.value
        ? `Avg vegetation ${summary.production.avgHealthScore.value.toFixed(0)}/100`
        : 'From satellite indicators',
      warning: Boolean(summary.production.atRiskProduction?.value),
    },
  ].filter((metric) => metric.value)

  useEffect(() => {
    let cancelled = false

    const loadProductionMap = async () => {
      setMapLoading(true)
      try {
        const [fieldsResponse, tileResponse] = await Promise.all([
          fetch('/api/harvest/map/fields?mode=predict', { cache: 'no-store' }),
          fetch('/api/harvest/map/tile-url', { cache: 'no-store' }),
        ])

        if (cancelled) return

        if (fieldsResponse.ok) {
          const fieldsPayload = await fieldsResponse.json()
          setHarvestFields(Array.isArray(fieldsPayload?.fields) ? fieldsPayload.fields : [])
        } else {
          setHarvestFields([])
        }

        if (tileResponse.ok) {
          const tilePayload = await tileResponse.json()
          setMapTileUrl(typeof tilePayload?.url === 'string' ? tilePayload.url : null)
        } else {
          setMapTileUrl(null)
        }
      } catch {
        if (!cancelled) {
          setHarvestFields([])
          setMapTileUrl(null)
        }
      } finally {
        if (!cancelled) setMapLoading(false)
      }
    }

    void loadProductionMap()

    return () => {
      cancelled = true
    }
  }, [summary.timeframe])

  return (
    <div className="flex h-full min-h-[360px] flex-col rounded-lg border border-white/10 bg-[#06080c] overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#07f880]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
            {t('watchtower.national_estimations')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/35">
          <Layers className="h-3 w-3" />
          <span>{effectiveLayers.length} {t('watchtower.layers_active')}</span>
          {summary.isDemo && <span className="text-amber-400 uppercase">Demo</span>}
          {mapLoading && <span className="text-white/25">Loading…</span>}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="hidden sm:flex w-40 shrink-0 flex-col border-r border-white/10 overflow-y-auto">
          {headlineMetrics.length > 0 && (
            <div className="space-y-2 border-b border-white/10 p-2">
              {headlineMetrics.map((metric) => (
                <MetricCard key={metric.label} {...metric} />
              ))}
            </div>
          )}

          <div className="p-2">
            <p className="mb-1 text-[9px] uppercase tracking-widest text-white/30">Map layers</p>
            {productionLayers.map((layer) => {
              const active = effectiveLayers.includes(layer.id)
              return (
                <button
                  key={layer.id}
                  type="button"
                  disabled={!layer.available}
                  onClick={() => opCtx?.toggleMapLayer(layer.id)}
                  className={cn(
                    'mb-0.5 w-full rounded px-1.5 py-1 text-left text-[10px] transition-colors',
                    !layer.available && 'cursor-not-allowed opacity-30',
                    active
                      ? 'bg-[#07f880]/15 text-[#07f880]'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                  )}
                >
                  {layer.label}
                </button>
              )
            })}
          </div>

          <div className="mt-auto space-y-1.5 border-t border-white/10 p-2">
            <button
              type="button"
              onClick={() =>
                opCtx?.goToModule('harvest', {
                  signalId: summary.signals[0]?.id,
                  timeframe: summary.timeframe,
                })
              }
              className="inline-flex w-full items-center justify-center gap-1.5 rounded bg-[#07f880]/15 px-2 py-1.5 text-[10px] font-medium text-[#07f880]"
            >
              <Sprout className="h-3 w-3" />
              Open harvest forecast
            </button>
            <button
              type="button"
              onClick={() => opCtx?.goToModule('data-analytics', { timeframe: summary.timeframe })}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-white/10 px-2 py-1.5 text-[10px] text-white/70 hover:text-white"
            >
              <BarChart3 className="h-3 w-3" />
              Production analytics
            </button>
          </div>
        </div>

        <div className="relative min-h-[320px] flex-1">
          <SatelliteMap
            locale={locale}
            targetFarmId={targetFarmId}
            targetPointId={targetPointId}
            targetFocusToken={targetFocusToken}
            targetZoom={targetZoom}
            targetCropFilter={targetCropFilter}
            activeMapLayers={effectiveLayers}
            harvestFields={harvestFields}
            selectedHarvestParcelId={selectedParcelId}
            mapTileUrl={mapTileUrl}
            weatherBoundary={weatherBoundary}
            onHarvestFieldClick={(field) =>
              opCtx?.goToModule('harvest', {
                parcelId: field.parcel_id,
                signalId: summary.signals[0]?.id,
                timeframe: summary.timeframe,
              })
            }
            isLateralMode
            lateralPanelOpen={false}
          />
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
  warning,
}: {
  label: string
  value: string
  detail: string
  warning?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-2.5 py-2',
        warning ? 'border-amber-500/30 bg-amber-500/10' : 'border-[#07f880]/25 bg-[#07f880]/10'
      )}
    >
      <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
      <p className="mt-0.5 text-[9px] text-white/45 line-clamp-2">{detail}</p>
    </div>
  )
}
