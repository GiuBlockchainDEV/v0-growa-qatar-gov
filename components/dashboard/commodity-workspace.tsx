'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Bot, PieChart, RefreshCw, ShoppingBasket, Sprout, Truck } from 'lucide-react'
import { OperationalContextBanner } from '@/components/dashboard/operational-context-banner'
import { GrowaIntelligencePanel } from '@/components/dashboard/growa-intelligence-panel'
import {
  IntelligenceInvestigationLayout,
  InvestigationActionBar,
  InvestigationActionButton,
  InvestigationContextHeader,
  InvestigationSection,
} from '@/components/dashboard/intelligence-investigation-layout'
import {
  formatNumber,
  useIntelligenceData,
} from '@/components/dashboard/intelligence-metrics-shared'
import { useOperationalContext } from '@/contexts/operational-context-provider'
import { useI18n } from '@/lib/i18n'
import { COMMODITY_CATALOG, resolveCommodity } from '@/lib/platform/commodity-catalog'
import type { IntelligenceSignal, WatchtowerSummary } from '@/lib/domain/types'
import { cn } from '@/lib/utils'
import { buildWatchtowerGrowaContext } from '@/lib/ai/build-watchtower-growa-context'
import type { WatchtowerGrowaAnalysisContext } from '@/lib/ai/growa-types'
import { Notice, Tile } from '@/components/brand/layout'
import { Metric } from '@/components/brand/ui'
import { StatusTag } from '@/components/brand/status'
import { sharedFetch } from '@/lib/client/shared-fetch'

export function CommodityWorkspace() {
  const { tr, locale } = useI18n()
  const searchParams = useSearchParams()
  const { goToModule, timeframe } = useOperationalContext()
  const commodityId = searchParams.get('commodityId') || searchParams.get('commodity') || 'tomato'
  const commodity = resolveCommodity(commodityId) || COMMODITY_CATALOG[0]

  const {
    loading: opsLoading,
    error: opsError,
    cropAggregates,
    producerRanking,
    producerLabelsById,
  } = useIntelligenceData()

  const [summary, setSummary] = useState<WatchtowerSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const loadSummary = useCallback(async (force = false) => {
    try {
      setSummaryLoading(true)
      const res = await sharedFetch(`/api/watchtower/summary?timeframe=${timeframe}`, { force })
      const payload = await res.json()
      if (res.ok) setSummary(payload as WatchtowerSummary)
    } catch {
      setSummary(null)
    } finally {
      setSummaryLoading(false)
    }
  }, [timeframe])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const commodityAggregate = useMemo(() => {
    const aliases = commodity.cropAliases.map((alias) => alias.toLowerCase())
    return cropAggregates.find((row) =>
      aliases.some((alias) => row.cropName.toLowerCase().includes(alias))
    )
  }, [commodity, cropAggregates])

  const relatedSignals = useMemo(() => {
    if (!summary) return []
    const aliases = commodity.cropAliases.map((alias) => alias.toLowerCase())
    return summary.signals.filter((signal) => {
      const haystack = `${signal.title} ${signal.summary} ${signal.metric || ''}`.toLowerCase()
      return aliases.some((alias) => haystack.includes(alias)) || signal.type === 'supply'
    })
  }, [commodity, summary])

  const producingFarms = useMemo(() => {
    if (!commodityAggregate) return []
    /* `producerRanking` is { mostEfficient, leastEfficient }, not a list. */
    return [...producerRanking.mostEfficient]
      .sort((a, b) => b.productionTons - a.productionTons)
      .slice(0, 6)
      .map((entry, index) => ({
      rank: index + 1,
      name: producerLabelsById[entry.pointId] || entry.pointId,
      productionTons: entry.productionTons,
      pointId: entry.pointId,
    }))
  }, [commodityAggregate, producerLabelsById, producerRanking])

  const coverageValue = summary?.supply.coverage?.value
  const coverageLabel =
    coverageValue !== null && coverageValue !== undefined
      ? `${coverageValue.toFixed(0)}%`
      : tr('Insufficient data')

  /* The panel expects a full analysis context (it keys sessions on
     `generatedAt`): the commodity view used an ad-hoc object and crashed the
     panel. Reuse the national context and put the commodity focus first. */
  const growaContext = useMemo<WatchtowerGrowaAnalysisContext | null>(() => {
    if (!summary) return null
    const base = buildWatchtowerGrowaContext(summary)
    const focus = [
      `Commodity focus: ${commodity.name} (${timeframe}).`,
      `Domestic production: ${commodityAggregate ? `${formatNumber(commodityAggregate.totalProductionTons)} t` : 'unknown'}; farms: ${commodityAggregate?.farmsCount ?? 'unknown'}.`,
      `National coverage: ${coverageValue ?? 'unknown'}%.`,
      relatedSignals.length ? `Linked signals: ${relatedSignals.map((signal) => signal.title).join('; ')}.` : 'No linked signals.',
    ].join('\n')
    return { ...base, digest: `${focus}\n\n${base.digest}` }
  }, [commodity.name, commodityAggregate, coverageValue, relatedSignals, summary, timeframe])

  const selectCommodity = (id: string) => {
    goToModule('commodities', { commodityId: id })
  }

  const startAiMission = () => {
    goToModule('ai-mission-control', {
      commodityId: commodity.id,
      crop: commodity.name,
    })
  }

  return (
    <div className="growa h-full overflow-y-auto overscroll-contain bg-background p-6 text-content">
      <header className="space-y-4">
        <InvestigationContextHeader
          eyebrow={tr('Food security')}
          title={locale === 'ar' ? commodity.nameAr : commodity.name}
          description={tr('Domestic production, supply position, national coverage and linked risks.')}
          icon={PieChart}
          meta={[
            {
              label: tr('Domestic production'),
              value: commodityAggregate
                ? `${formatNumber(commodityAggregate.totalProductionTons)} t`
                : '—',
            },
            {
              label: tr('National coverage'),
              value: coverageLabel,
              accent: coverageValue !== null && coverageValue !== undefined && coverageValue < 70,
            },
            {
              label: tr('Signals'),
              value: String(relatedSignals.length),
              accent: relatedSignals.some((signal) => signal.severity === 'critical' || signal.severity === 'high'),
            },
            {
              label: tr('Timeframe'),
              value: tr(timeframe),
            },
          ]}
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={tr('Commodities')}>
          {COMMODITY_CATALOG.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => selectCommodity(entry.id)}
              aria-pressed={entry.id === commodity.id}
              className={cn(
                'inline-flex h-8 items-center rounded-pill border px-3.5 text-[13px] transition-colors',
                entry.id === commodity.id
                  ? 'border-ink bg-ink text-white'
                  : 'border-line-strong bg-card text-content hover:border-ink'
              )}
            >
              {locale === 'ar' ? entry.nameAr : entry.name}
            </button>
          ))}
        </div>
        <OperationalContextBanner />
      </header>

      <div className="mt-4">
        <IntelligenceInvestigationLayout
          currentCondition={
            <div className="grid grid-cols-2 gap-3">
              <MetricTile
                label={tr('Domestic production')}
                value={commodityAggregate ? `${formatNumber(commodityAggregate.totalProductionTons)} t` : '—'}
                loading={opsLoading}
              />
              <MetricTile
                label={tr('Active farms')}
                value={commodityAggregate ? String(commodityAggregate.farmsCount) : '—'}
                loading={opsLoading}
              />
              <MetricTile
                label={tr('Contract volume')}
                value={
                  summary?.supply.availableVolume?.value
                    ? `${formatNumber(summary.supply.availableVolume.value)} ${summary.supply.availableVolume.unit}`
                    : '—'
                }
                loading={summaryLoading}
              />
              <MetricTile
                label={tr('At-risk deliveries')}
                value={
                  summary?.supply.atRiskDeliveries?.value
                    ? String(summary.supply.atRiskDeliveries.value)
                    : '—'
                }
                loading={summaryLoading}
                accent={Boolean(summary?.supply.atRiskDeliveries?.value)}
              />
            </div>
          }
          whatChanged={
            summary?.changes.length ? (
              <ul className="space-y-2 text-[14px] text-content">
                {summary.changes.slice(0, 5).map((change) => (
                  <li key={change.id} className="flex items-start gap-2.5">
                    <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 bg-ink" style={{ borderRadius: 1 }} />
                    <span>{change.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-content-soft">{tr('No significant commodity-linked changes in the selected timeframe.')}</p>
            )
          }
          primaryAnalysis={
            <div className="grid gap-3 lg:grid-cols-2">
              <InvestigationSection title={tr('Production chain')} compact>
                <div className="space-y-2 text-sm text-content">
                  <ChainStep icon={Sprout} label={tr('Agricultural capacity')} value={commodityAggregate ? tr('{count} active areas', { count: commodityAggregate.polygonsCount }) : tr('Unknown')} />
                  <ChainStep icon={PieChart} label={tr('Current production')} value={commodityAggregate ? `${formatNumber(commodityAggregate.totalProductionTons)} t` : tr('Unknown')} />
                  <ChainStep icon={ShoppingBasket} label={tr('Domestic supply position')} value={coverageLabel} />
                  <ChainStep icon={Truck} label={tr('Inbound supply')} value={summary?.supply.availableVolume?.value ? tr('Contracted volume available') : tr('Limited linkage')} />
                </div>
              </InvestigationSection>
              <InvestigationSection title={tr('Resource exposure')} compact>
                <div className="space-y-2 text-sm text-content">
                  <p>{tr('Water intensity: {value}', { value: commodityAggregate ? `${formatNumber(commodityAggregate.totalWaterM3 / Math.max(1, commodityAggregate.totalProductionTons))} m³/t` : '—' })}</p>
                  <p>{tr('Energy intensity: {value}', { value: commodityAggregate ? `${formatNumber(commodityAggregate.totalEnergyKwh / Math.max(1, commodityAggregate.totalProductionTons))} kWh/t` : '—' })}</p>
                  <p>{tr('Climate exposure: {value} heat risk index', { value: summary?.climate.heatRisk.value ?? '—' })}</p>
                  <p>{tr('Data confidence: {value}', { value: opsError ? tr('Limited') : opsLoading ? tr('Loading') : tr('Moderate evidence') })}</p>
                </div>
              </InvestigationSection>
            </div>
          }
          affectedEntities={
            producingFarms.length > 0 ? (
              <div className="space-y-2">
                {producingFarms.map((farm) => (
                  <button
                    key={farm.pointId}
                    type="button"
                    onClick={() => goToModule('water-intelligence', { pointId: farm.pointId, crop: commodity.name })}
                    className="flex w-full items-center justify-between gap-3 border border-line bg-card px-3.5 py-2.5 text-start transition-colors hover:border-line-strong"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  >
                    <span className="text-[14px] text-content"><span className="text-content-soft tabular-nums">#{farm.rank}</span> {farm.name}</span>
                    <span className="text-[13px] text-content-soft tabular-nums">{formatNumber(farm.productionTons)} t</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-content-soft">{tr('No producing farms matched for this commodity in current operational data.')}</p>
            )
          }
          signals={
            relatedSignals.length > 0 ? (
              <div className="space-y-2">
                {relatedSignals.slice(0, 5).map((signal) => (
                  <SignalRow key={signal.id} signal={signal} onOpen={() => goToModule('watchtower', { signalId: signal.id })} />
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-content-soft">{tr('No active supply or production signals for this commodity.')}</p>
            )
          }
          forecast={
            <div className="grid gap-3 sm:grid-cols-2 text-sm text-content">
              <div>
                <p className="text-[11px] text-content-soft">{tr('7-day outlook')}</p>
                <p className="mt-1">{summary?.outlook?.sevenDay?.operationalRisk || tr('Insufficient forecast linkage')}</p>
              </div>
              <div>
                <p className="text-[11px] text-content-soft">{tr('30-day outlook')}</p>
                <p className="mt-1">{summary?.outlook?.thirtyDay?.supplyImplications || summary?.outlook?.thirtyDay?.harvest || tr('Insufficient forecast linkage')}</p>
              </div>
            </div>
          }
          aiAnalysis={
            growaContext ? (
              <GrowaIntelligencePanel module="watchtower" context={growaContext} />
            ) : (
              <Notice tone="info">{tr('Load platform intelligence to enable the commodity AI assessment.')}</Notice>
            )
          }
          actions={
            <InvestigationActionBar>
              <InvestigationActionButton variant="primary" onClick={startAiMission}>
                <Bot strokeWidth={1.5} className="h-3.5 w-3.5" />
                {tr('Run food security mission')}
              </InvestigationActionButton>
              <InvestigationActionButton href="/dashboard/supply-overview" variant="ghost">
                <Truck strokeWidth={1.5} className="h-3.5 w-3.5" />
                {tr('Supply position')}
              </InvestigationActionButton>
              <InvestigationActionButton
                onClick={() => goToModule('harvest', { crop: commodity.name })}
                variant="ghost"
              >
                <Sprout strokeWidth={1.5} className="h-3.5 w-3.5" />
                {tr('Satellite and harvest')}
              </InvestigationActionButton>
              <InvestigationActionButton onClick={() => loadSummary(true)} variant="ghost">
                <RefreshCw strokeWidth={1.5} className="h-3.5 w-3.5" />
                {tr('Refresh')}
              </InvestigationActionButton>
            </InvestigationActionBar>
          }
        />
      </div>
    </div>
  )
}

function MetricTile({
  label,
  value,
  loading,
  accent,
}: {
  label: string
  value: string
  loading?: boolean
  accent?: boolean
}) {
  return (
    <Tile className={accent ? 'border-warning-line bg-warning-soft' : undefined}>
      <Metric label={label} value={loading ? '…' : value} size="heading" />
    </Tile>
  )
}

function ChainStep({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Sprout
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon strokeWidth={1.5} className="mt-0.5 h-4 w-4 text-content-soft" />
      <div>
        <p className="text-[12px] text-content-soft">{label}</p>
        <p className="text-[14px] text-content">{value}</p>
      </div>
    </div>
  )
}

function SignalRow({
  signal,
  onOpen,
}: {
  signal: IntelligenceSignal
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start justify-between gap-3 border border-line bg-card px-3.5 py-2.5 text-start transition-colors hover:border-line-strong"
      style={{ borderRadius: 'var(--radius-lg)' }}
    >
      <div className="min-w-0">
        <p className="text-[14px] text-content">{signal.title}</p>
        <p className="mt-0.5 text-[12px] text-content-soft">{signal.summary}</p>
      </div>
      <StatusTag level={signal.severity} className="shrink-0" />
    </button>
  )
}
