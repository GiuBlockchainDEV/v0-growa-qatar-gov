'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, RefreshCw, Radio, Shield, Bot } from 'lucide-react'
import type { WatchtowerSummary, WatchtowerTimeframe, IntelligenceSignal } from '@/lib/domain/types'
import { WATCHTOWER_TIMEFRAMES, timeframeLabel } from '@/lib/domain/timeframes'
import { useOperationalContext } from '@/contexts/operational-context-provider'
import { useI18n } from '@/lib/i18n'
import { WatchtowerStatusStrip } from '@/components/dashboard/watchtower/status-strip'
import { SignalCard } from '@/components/dashboard/watchtower/signal-card'
import { WatchtowerChangesPanel } from '@/components/dashboard/watchtower/changes-panel'
import { WatchtowerKpiSummary } from '@/components/dashboard/watchtower/kpi-summary'
import { WatchtowerOutlookPanel } from '@/components/dashboard/watchtower/outlook-panel'
import { WatchtowerDataHealth } from '@/components/dashboard/watchtower/data-health'
import { NationalMapPanel } from '@/components/dashboard/watchtower/national-map-panel'
import { SupplyChainPanel } from '@/components/dashboard/watchtower/supply-chain-panel'
import { ExternalIntelligencePanel } from '@/components/dashboard/watchtower/external-intelligence'
import { FarmIntelligencePanel } from '@/components/dashboard/farm-intelligence-panel'
import { GrowaIntelligencePanel } from '@/components/dashboard/growa-intelligence-panel'
import { buildWatchtowerGrowaContext } from '@/lib/ai/build-watchtower-growa-context'
import { buildDashboardMapProps } from '@/lib/dashboard/map-navigation'
import { partitionSignalsByPriority } from '@/lib/watchtower/signal-priority'
import { cn } from '@/lib/utils'

export function WatchtowerWorkspace() {
  const { t, locale } = useI18n()
  const searchParams = useSearchParams()
  const { timeframe, setTimeframe, selectedSignalId, context } = useOperationalContext()
  const mapProps = buildDashboardMapProps(searchParams)

  const [summary, setSummary] = useState<WatchtowerSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [aiFreshness, setAiFreshness] = useState<string | null>(null)
  const [partialErrors, setPartialErrors] = useState<string[]>([])

  const loadSummary = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)
      setPartialErrors([])

      const response = await fetch(`/api/watchtower/summary?timeframe=${timeframe}`, { cache: 'no-store' })
      const payload = await response.json()

      if (!response.ok) throw new Error(payload.error || 'Failed to load watchtower data')

      setSummary(payload as WatchtowerSummary)
      if (payload.sourceStatus) {
        const degraded = (payload.sourceStatus as WatchtowerSummary['sourceStatus'])
          .filter((s) => s.health !== 'healthy')
          .map((s) => `${s.source}: ${s.health}`)
        if (degraded.length) setPartialErrors(degraded)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load watchtower')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [timeframe])

  useEffect(() => { loadSummary() }, [loadSummary])

  const handleCreateAlert = async (signal: IntelligenceSignal) => {
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceSignalId: signal.id,
          title: signal.title,
          summary: signal.summary,
          severity: signal.severity,
          alertType: signal.type,
          farmIds: signal.farmIds || [],
          parcelIds: signal.parcelIds || [],
          pointIds: signal.pointIds || [],
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to create alert')
      alert(t('watchtower.alert_created'))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create alert')
    }
  }

  if (loading && !summary) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050608]">
        <div className="text-center">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#07f880]/60" />
          <p className="mt-3 text-sm text-white/50">{t('watchtower.loading')}</p>
        </div>
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#050608] p-8">
        <AlertTriangle className="h-8 w-8 text-amber-400" />
        <p className="text-sm text-white/70">{error}</p>
        <button onClick={() => loadSummary()} className="rounded-md bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15">
          {t('common.retry')}
        </button>
      </div>
    )
  }

  if (!summary) return null

  const growaContext = buildWatchtowerGrowaContext(summary)
  const healthySources = summary.sourceStatus.filter((s) => s.health === 'healthy').length
  const freshDatasets = summary.dataQuality.filter((d) => d.status === 'fresh' || d.status === 'partial').length
  const selectedFarmId = context.farmId || mapProps.targetFarmId
  const { priority: prioritySignals, routine: routineSignals } = partitionSignalsByPriority(summary.signals)
  const abnormalDomains = summary.nationalStatus.filter(
    (status) => status.level === 'attention' || status.level === 'high' || status.level === 'critical'
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#050608] text-white">
      {/* ── HEADER ── */}
      <header className="shrink-0 border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-[#07f880]/10">
                <Radio className="h-4 w-4 text-[#07f880]" />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight">{t('watchtower.title')}</h1>
                <p className="text-[10px] text-white/40">{t('watchtower.subtitle')}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded border border-white/10 bg-[#0a0d12] p-0.5">
              {WATCHTOWER_TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    'rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors',
                    timeframe === tf ? 'bg-[#07f880] text-black' : 'text-white/45 hover:text-white/80'
                  )}
                >
                  {timeframeLabel(tf)}
                </button>
              ))}
            </div>
            <button
              onClick={() => loadSummary(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1 rounded border border-white/10 px-2.5 py-1 text-[10px] text-white/60 hover:border-white/20 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
              {t('watchtower.refresh')}
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/40">
          <span>{t('watchtower.last_refresh')}: {new Date(summary.generatedAt).toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
          <span className="flex items-center gap-1"><Shield className="h-3 w-3" />{healthySources}/{summary.sourceStatus.length} sources</span>
          <span>{t('watchtower.data_coverage')}: {freshDatasets}/{summary.dataQuality.length}</span>
          <span className="flex items-center gap-1"><Bot className="h-3 w-3" />{aiFreshness ? t('watchtower.ai_ready') : t('watchtower.ai_available')}</span>
          {summary.isDemo && <span className="text-amber-400 font-medium uppercase">{t('watchtower.demo_mode')}</span>}
        </div>

        {partialErrors.length > 0 && (
          <div className="mt-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-[10px] text-amber-200">
            {t('watchtower.partial_degradation')}: {partialErrors.join(' · ')}
          </div>
        )}
      </header>

      {/* ── STATUS STRIP ── */}
      <div className="shrink-0 border-b border-white/10 px-4 py-3 sm:px-5">
        <WatchtowerStatusStrip statuses={summary.nationalStatus} />
      </div>

      {/* ── MAIN GRID: MAP + SIGNALS ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-0 xl:gap-0 min-h-[420px]">
          <div className="p-3 sm:p-4 min-h-[380px]">
            <NationalMapPanel
              locale={locale}
              targetFarmId={mapProps.targetFarmId}
              targetPointId={mapProps.targetPointId}
              targetFocusToken={mapProps.targetFocusToken}
              targetZoom={mapProps.targetZoom}
              targetCropFilter={mapProps.targetCropFilter}
            />
          </div>

          <div className="border-t xl:border-t-0 xl:border-l border-white/10 flex flex-col min-h-[320px]">
            <div className="shrink-0 px-3 py-2 border-b border-white/10">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/45">
                {t('watchtower.priority_signals')} ({summary.signals.length})
              </h2>
              {abnormalDomains.length > 0 && (
                <p className="mt-1 text-[10px] text-amber-300/90">
                  {abnormalDomains.length} domain{abnormalDomains.length > 1 ? 's' : ''} require attention
                </p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {summary.signals.length === 0 ? (
                <p className="text-xs text-white/40">{t('watchtower.no_signals')}</p>
              ) : (
                <>
                  {prioritySignals.map((signal) => (
                    <div key={signal.id} className="ring-1 ring-amber-500/20 rounded-lg">
                      <SignalCard
                        signal={signal}
                        selected={selectedSignalId === signal.id}
                        onCreateAlert={handleCreateAlert}
                        emphasized
                      />
                    </div>
                  ))}
                  {routineSignals.length > 0 && prioritySignals.length > 0 && (
                    <p className="pt-1 text-[9px] uppercase tracking-widest text-white/30">Routine signals</p>
                  )}
                  {routineSignals.slice(0, Math.max(0, 8 - prioritySignals.length)).map((signal) => (
                    <SignalCard
                      key={signal.id}
                      signal={signal}
                      selected={selectedSignalId === signal.id}
                      onCreateAlert={handleCreateAlert}
                      compact
                    />
                  ))}
                </>
              )}
            </div>

            {selectedFarmId && (
              <div className="shrink-0 border-t border-white/10 p-3">
                <FarmIntelligencePanel farmId={selectedFarmId} compact />
              </div>
            )}
          </div>
        </div>

        {/* ── KPI ROW ── */}
        <div className="px-3 sm:px-4 py-3 border-t border-white/10">
          <WatchtowerKpiSummary
            production={summary.production}
            water={summary.water}
            energy={summary.energy}
            climate={summary.climate}
            supply={summary.supply}
            nationalStatus={summary.nationalStatus}
          />
        </div>

        {/* ── CHANGES + OUTLOOK ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-t border-white/10">
          <div className="p-3 sm:p-4 border-b lg:border-b-0 lg:border-r border-white/10">
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/45">{t('watchtower.what_changed')}</h2>
            <WatchtowerChangesPanel changes={summary.changes} />
          </div>
          <div className="p-3 sm:p-4">
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/45">{t('watchtower.outlook')}</h2>
            <WatchtowerOutlookPanel outlook={summary.outlook} />
          </div>
        </div>

        {/* ── BOTTOM ROW ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-0 border-t border-white/10">
          <div className="p-3 sm:p-4 border-b md:border-b-0 md:border-r border-white/10">
            <SupplyChainPanel supply={summary.supply} />
          </div>
          <div className="p-3 sm:p-4 border-b xl:border-b-0 xl:border-r border-white/10">
            <ExternalIntelligencePanel />
          </div>
          <div className="p-3 sm:p-4 border-b xl:border-b-0 xl:border-r border-white/10">
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/45">{t('watchtower.data_health')}</h2>
            <WatchtowerDataHealth dataQuality={summary.dataQuality} sourceStatus={summary.sourceStatus} />
          </div>
          <div className="p-3 sm:p-4 min-h-[280px]">
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/45">{t('watchtower.ai_briefing')}</h2>
            <div className="rounded-lg border border-white/10 bg-[#0a0d12] overflow-hidden h-[calc(100%-24px)] min-h-[240px]">
              <GrowaIntelligencePanel
                module="watchtower"
                context={growaContext}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
