'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Layers, Sprout, TrendingUp } from 'lucide-react'
import { SatelliteMap } from '@/components/dashboard/lazy-modules'
import { WATCHTOWER_MAP_LAYERS } from '@/lib/watchtower/map-layers'
import { humanizeMetricSource } from '@/lib/watchtower/production-metrics'
import { useOperationalContextOptional } from '@/contexts/operational-context-provider'
import { useI18n } from '@/lib/i18n'
import type { WatchtowerSummary } from '@/lib/domain/types'
import type { HarvestMapField } from '@/lib/harvest/types'
import { getQatarBoundaryCoordinates } from '@/lib/weather/qatar-grid'
import { cn } from '@/lib/utils'
import { CardHeader } from '@/components/brand/layout'
import { Button, StatusDot, Tag } from '@/components/brand/ui'

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
  const { t, tr } = useI18n()
  // Labels, units and source names below come from the server in English.
  const trSource = (source: string) => tr(humanizeMetricSource(source))
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

  const productionSignal = summary.signals.find(
    (signal) => signal.type === 'production' || signal.type === 'crop_health'
  )

  const headlineMetrics = [
    {
      label: tr(summary.production.productionEstimate.label),
      value: formatMetricValue(
        summary.production.productionEstimate.value,
        summary.production.productionEstimate.unit
      ),
      detail: trSource(summary.production.productionEstimate.source),
      onClick: () =>
        opCtx?.goToModule('harvest', {
          harvestMode: 'predict',
          signalId: productionSignal?.id,
          parcelId: productionSignal?.parcelIds?.[0],
          farmId: productionSignal?.farmIds?.[0],
          pointId: productionSignal?.pointIds?.[0],
          timeframe: summary.timeframe,
          zoom: 13,
        }),
    },
    {
      label: tr(summary.production.fieldsMonitored?.label || 'Fields monitored'),
      value: formatMetricValue(
        summary.production.fieldsMonitored?.value ?? harvestFields.length,
        tr(summary.production.fieldsMonitored?.unit || 'fields')
      ),
      detail: summary.production.cropTypes?.value
        ? tr('{count} crop types', { count: summary.production.cropTypes.value })
        : tr('Harvest forecast coverage'),
      onClick: () =>
        opCtx?.goToModule('harvest', {
          harvestMode: 'predict',
          parcelId: productionSignal?.parcelIds?.[0],
          farmId: productionSignal?.farmIds?.[0],
          pointId: productionSignal?.pointIds?.[0],
          timeframe: summary.timeframe,
          zoom: 12,
        }),
    },
    {
      label: tr(summary.production.atRiskProduction?.label || 'Below health threshold'),
      value: formatMetricValue(
        summary.production.atRiskProduction?.value ?? null,
        tr(summary.production.atRiskProduction?.unit || 'fields')
      ),
      detail: summary.production.avgHealthScore?.value
        ? tr('Avg vegetation {score}/100', { score: summary.production.avgHealthScore.value.toFixed(0) })
        : tr('From satellite indicators'),
      warning: Boolean(summary.production.atRiskProduction?.value),
      onClick: () =>
        opCtx?.goToModule('harvest', {
          harvestMode: 'predict',
          mapLayer: 'crop-health',
          signalId: productionSignal?.id,
          parcelId: productionSignal?.parcelIds?.[0],
          timeframe: summary.timeframe,
        }),
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

  /* A card like every other one (white frame, dotted header rule); the
     left rail is the card's own legend: headline figures in Light, the map
     layers as square-marked toggles, then the two onward commands. */
  return (
    <section
      data-famiglia="monitoraggio"
      className="growa flex h-full min-h-[360px] flex-col bg-card border border-line overflow-hidden"
      style={{ borderRadius: 'var(--radius-xl)' }}
    >
      <CardHeader
        icon={TrendingUp}
        title={t('watchtower.national_estimations')}
        actions={
          <>
            {mapLoading && <span className="text-[12px] text-content-soft">{tr('Loading…')}</span>}
            {summary.isDemo && <Tag variant="muted" size="sm">{tr('Demo')}</Tag>}
            <Tag variant="outline-ink" size="sm">
              <Layers strokeWidth={1.5} className="h-3 w-3" aria-hidden="true" />
              {effectiveLayers.length} {t('watchtower.layers_active')}
            </Tag>
          </>
        }
      />

      <div className="flex flex-1 min-h-0">
        <div className="relative z-20 hidden sm:flex w-48 shrink-0 flex-col border-e border-dotted border-line-strong overflow-y-auto bg-card">
          {headlineMetrics.length > 0 && (
            <div className="space-y-2 p-3">
              {headlineMetrics.map((metric) => (
                <MetricCard key={metric.label} {...metric} value={metric.value ?? '—'} />
              ))}
            </div>
          )}

          <div className="px-3 pb-3">
            <hr className="growa-dotted-rule mb-3" />
            <p className="mb-1.5 text-[12px] text-content-soft">{tr('Map layers')}</p>
            {productionLayers.map((layer) => {
              const active = effectiveLayers.includes(layer.id)
              return (
                <button
                  key={layer.id}
                  type="button"
                  disabled={!layer.available}
                  aria-pressed={active}
                  onClick={() => opCtx?.toggleMapLayer(layer.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-pill px-2 h-8 text-start text-[12px] transition-colors',
                    !layer.available && 'cursor-not-allowed opacity-40',
                    active ? 'text-content' : 'text-content-soft hover:bg-muted hover:text-content'
                  )}
                  style={{ fontWeight: active ? 500 : 400 }}
                >
                  <StatusDot tone={active ? 'ink' : 'neutral'} size={7} />
                  {tr(layer.label)}
                </button>
              )
            })}
          </div>

          <div className="mt-auto space-y-2 p-3">
            <hr className="growa-dotted-rule mb-3" />
            <Button
              size="sm"
              variant="secondary"
              fullWidth
              onClick={() =>
                opCtx?.goToModule('harvest', {
                  harvestMode: 'predict',
                  signalId: productionSignal?.id,
                  timeframe: summary.timeframe,
                })
              }
              style={{ fontSize: 12 }}
            >
              <Sprout strokeWidth={1.5} className="h-3.5 w-3.5" />
              {tr('Harvest forecast')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              fullWidth
              onClick={() => opCtx?.goToModule('data-analytics', { timeframe: summary.timeframe })}
              style={{ fontSize: 12 }}
            >
              <BarChart3 strokeWidth={1.5} className="h-3.5 w-3.5" />
              {tr('Production analytics')}
            </Button>
          </div>
        </div>

        <div className="relative z-0 min-h-[320px] flex-1 overflow-hidden">
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
              opCtx?.goToHarvestField(field, {
                mode: 'predict',
                signalId: productionSignal?.id,
              })
            }
            isLateralMode
            lateralPanelOpen={false}
          />
        </div>
      </div>
    </section>
  )
}

/* Headline figure as a clickable tile: Light number, unit small, the
   warning said with the square, not with a tinted box. */
function MetricCard({
  label,
  value,
  detail,
  warning,
  onClick,
}: {
  label: string
  value: string
  detail: string
  warning?: boolean
  onClick?: () => void
}) {
  const [number, ...unitParts] = value.split(' ')
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-card border border-line px-3 py-2.5 text-start transition-colors hover:border-line-strong"
      style={{ borderRadius: 'var(--radius-lg)' }}
    >
      <p className="flex items-center gap-1.5 text-[11px] text-content-soft">
        {warning && <StatusDot tone="warning" size={6} />}
        {label}
      </p>
      <p className="growa-figure mt-1 text-content" style={{ fontSize: 22 }}>
        {number}
        {unitParts.length > 0 && (
          <span className="ms-1 text-[11px] text-content-soft" style={{ fontWeight: 400, letterSpacing: 0 }}>
            {unitParts.join(' ')}
          </span>
        )}
      </p>
      <p className="mt-1 text-[11px] text-content-soft line-clamp-2">{detail}</p>
    </button>
  )
}
