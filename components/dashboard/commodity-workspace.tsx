'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, Bot, PieChart, RefreshCw, ShoppingBasket, Sprout, Truck } from 'lucide-react'
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

export function CommodityWorkspace() {
  const { locale } = useI18n()
  const searchParams = useSearchParams()
  const { goToModule, timeframe } = useOperationalContext()
  const commodityId = searchParams.get('commodityId') || searchParams.get('commodity') || 'tomato'
  const commodity = resolveCommodity(commodityId) || COMMODITY_CATALOG[0]

  const {
    loading: opsLoading,
    error: opsError,
    cropAggregates,
    producerRanking,
    headline,
    producerLabelsById,
  } = useIntelligenceData()

  const [summary, setSummary] = useState<WatchtowerSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const loadSummary = useCallback(async () => {
    try {
      setSummaryLoading(true)
      const res = await fetch(`/api/watchtower/summary?timeframe=${timeframe}`, { cache: 'no-store' })
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
    return producerRanking.slice(0, 6).map((entry, index) => ({
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
      : 'Insufficient data'

  const growaContext = useMemo(() => {
    if (!summary) return null
    return {
      module: 'commodities',
      commodity: commodity.name,
      timeframe,
      productionTons: commodityAggregate?.totalProductionTons ?? null,
      farmsCount: commodityAggregate?.farmsCount ?? null,
      supplyCoverage: coverageValue,
      relatedSignals: relatedSignals.map((signal) => signal.title),
      nationalSupply: summary.supply,
      outlook: summary.outlook,
    }
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
    <div className="flex h-full flex-col overflow-hidden bg-[#050608] text-white">
      <header className="shrink-0 border-b border-white/10 px-5 py-4 pt-20">
        <InvestigationContextHeader
          eyebrow={locale === 'ar' ? 'الأمن الغذائي' : 'Food Security'}
          title={locale === 'ar' ? commodity.nameAr : commodity.name}
          description={
            locale === 'ar'
              ? 'تحليل الإنتاج المحلي، التوريد، التغطية الوطنية والمخاطر المرتبطة.'
              : 'Domestic production, supply position, national coverage and linked risks.'
          }
          icon={PieChart}
          meta={[
            {
              label: locale === 'ar' ? 'الإنتاج المحلي' : 'Domestic production',
              value: commodityAggregate
                ? `${formatNumber(commodityAggregate.totalProductionTons)} t`
                : '—',
            },
            {
              label: locale === 'ar' ? 'التغطية الوطنية' : 'National coverage',
              value: coverageLabel,
              accent: coverageValue !== null && coverageValue !== undefined && coverageValue < 70,
            },
            {
              label: locale === 'ar' ? 'الإشارات' : 'Signals',
              value: String(relatedSignals.length),
              accent: relatedSignals.some((signal) => signal.severity === 'critical' || signal.severity === 'high'),
            },
            {
              label: locale === 'ar' ? 'الفترة' : 'Timeframe',
              value: timeframe,
            },
          ]}
        />
        <div className="mt-4 flex flex-wrap gap-1.5">
          {COMMODITY_CATALOG.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => selectCommodity(entry.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-[11px] transition-colors',
                entry.id === commodity.id
                  ? 'border-[#07f880]/40 bg-[#07f880]/15 text-[#07f880]'
                  : 'border-white/10 text-white/55 hover:text-white'
              )}
            >
              {locale === 'ar' ? entry.nameAr : entry.name}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <OperationalContextBanner />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        <IntelligenceInvestigationLayout
          currentCondition={
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                label="Domestic production"
                value={commodityAggregate ? `${formatNumber(commodityAggregate.totalProductionTons)} t` : '—'}
                loading={opsLoading}
              />
              <MetricTile
                label="Active farms"
                value={commodityAggregate ? String(commodityAggregate.farmsCount) : '—'}
                loading={opsLoading}
              />
              <MetricTile
                label="Contract volume"
                value={
                  summary?.supply.availableVolume?.value
                    ? `${formatNumber(summary.supply.availableVolume.value)} ${summary.supply.availableVolume.unit}`
                    : '—'
                }
                loading={summaryLoading}
              />
              <MetricTile
                label="At-risk deliveries"
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
              <ul className="space-y-2 text-sm text-white/70">
                {summary.changes.slice(0, 5).map((change) => (
                  <li key={change.id} className="flex gap-2">
                    <span className="text-white/35">•</span>
                    <span>{change.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-white/45">No significant commodity-linked changes in the selected timeframe.</p>
            )
          }
          primaryAnalysis={
            <div className="grid gap-3 lg:grid-cols-2">
              <InvestigationSection title="Production chain" compact>
                <div className="space-y-2 text-sm text-white/70">
                  <ChainStep icon={Sprout} label="Agricultural capacity" value={commodityAggregate ? `${commodityAggregate.polygonsCount} active areas` : 'Unknown'} />
                  <ChainStep icon={PieChart} label="Current production" value={commodityAggregate ? `${formatNumber(commodityAggregate.totalProductionTons)} t` : 'Unknown'} />
                  <ChainStep icon={ShoppingBasket} label="Domestic supply position" value={coverageLabel} />
                  <ChainStep icon={Truck} label="Inbound supply" value={summary?.supply.availableVolume?.value ? 'Contracted volume available' : 'Limited linkage'} />
                </div>
              </InvestigationSection>
              <InvestigationSection title="Resource exposure" compact>
                <div className="space-y-2 text-sm text-white/70">
                  <p>Water intensity: {commodityAggregate ? `${formatNumber(commodityAggregate.totalWaterM3 / Math.max(1, commodityAggregate.totalProductionTons))} m³/t` : '—'}</p>
                  <p>Energy intensity: {commodityAggregate ? `${formatNumber(commodityAggregate.totalEnergyKwh / Math.max(1, commodityAggregate.totalProductionTons))} kWh/t` : '—'}</p>
                  <p>Climate exposure: {summary?.climate.heatRisk.value ?? '—'} heat risk index</p>
                  <p>Data confidence: {opsError ? 'Limited' : opsLoading ? 'Loading' : 'Moderate evidence'}</p>
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
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left hover:border-white/20"
                  >
                    <span className="text-sm text-white">#{farm.rank} {farm.name}</span>
                    <span className="text-xs text-white/45">{formatNumber(farm.productionTons)} t</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/45">No producing farms matched for this commodity in current operational data.</p>
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
              <p className="text-sm text-white/45">No active supply or production signals for this commodity.</p>
            )
          }
          forecast={
            <div className="grid gap-3 sm:grid-cols-2 text-sm text-white/70">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40">7-day outlook</p>
                <p className="mt-1">{summary?.outlook?.sevenDay?.operationalRisk || 'Insufficient forecast linkage'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40">30-day outlook</p>
                <p className="mt-1">{summary?.outlook?.thirtyDay?.supplyImplications || summary?.outlook?.thirtyDay?.harvest || 'Insufficient forecast linkage'}</p>
              </div>
            </div>
          }
          aiAnalysis={
            growaContext ? (
              <div className="min-h-[280px] rounded-lg border border-white/10 overflow-hidden">
                <GrowaIntelligencePanel module="commodities" context={growaContext} />
              </div>
            ) : (
              <p className="text-sm text-white/45">Load platform intelligence to enable commodity AI assessment.</p>
            )
          }
          actions={
            <InvestigationActionBar>
              <InvestigationActionButton variant="primary" onClick={startAiMission}>
                <Bot className="h-3.5 w-3.5" />
                Run Food Security mission
              </InvestigationActionButton>
              <InvestigationActionButton href="/dashboard/supply-overview" variant="ghost">
                <Truck className="h-3.5 w-3.5" />
                Supply position
              </InvestigationActionButton>
              <InvestigationActionButton
                onClick={() => goToModule('harvest', { crop: commodity.name })}
                variant="ghost"
              >
                <Sprout className="h-3.5 w-3.5" />
                Satellite & harvest
              </InvestigationActionButton>
              <InvestigationActionButton onClick={loadSummary} variant="ghost">
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
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
    <div
      className={cn(
        'rounded-lg border px-3 py-3',
        accent ? 'border-amber-500/30 bg-amber-500/10' : 'border-white/10 bg-white/[0.02]'
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{loading ? '…' : value}</p>
    </div>
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
      <Icon className="mt-0.5 h-4 w-4 text-[#07f880]/70" />
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
        <p className="text-sm text-white/75">{value}</p>
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
  const severityClass =
    signal.severity === 'critical'
      ? 'text-red-300'
      : signal.severity === 'high'
        ? 'text-orange-300'
        : 'text-amber-300'

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-2 rounded-lg border border-white/10 px-3 py-2 text-left hover:border-white/20"
    >
      <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', severityClass)} />
      <div>
        <p className="text-sm text-white">{signal.title}</p>
        <p className="text-xs text-white/45">{signal.summary}</p>
      </div>
    </button>
  )
}
