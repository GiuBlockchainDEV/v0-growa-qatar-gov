'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, RefreshCw, Radio } from 'lucide-react'
import type { WatchtowerSummary, IntelligenceSignal } from '@/lib/domain/types'
import { useOperationalContext } from '@/contexts/operational-context-provider'
import { useI18n } from '@/lib/i18n'
import { SignalCard } from '@/components/dashboard/watchtower/signal-card'
import { WatchtowerChangesPanel } from '@/components/dashboard/watchtower/changes-panel'
import { WatchtowerProductionSnapshot } from '@/components/dashboard/watchtower/production-snapshot'
import { NationalMapPanel } from '@/components/dashboard/watchtower/national-map-panel'
import { GrowaIntelligencePanel } from '@/components/dashboard/growa-intelligence-panel'
import { WatchtowerContextDeck } from '@/components/dashboard/watchtower/context-deck'
import { buildWatchtowerGrowaContext } from '@/lib/ai/build-watchtower-growa-context'
import { buildDashboardMapProps } from '@/lib/dashboard/map-navigation'
import { partitionSignalsByPriority } from '@/lib/watchtower/signal-priority'
import { cn } from '@/lib/utils'

export function WatchtowerWorkspace() {
  const { t, locale } = useI18n()
  const searchParams = useSearchParams()
  const { timeframe, selectedSignalId, context } = useOperationalContext()
  const mapProps = buildDashboardMapProps(searchParams)

  const [summary, setSummary] = useState<WatchtowerSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
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

  const actionableChanges = useMemo(
    () =>
      summary?.changes.filter(
        (change) => change.significance === 'high' || change.significance === 'medium'
      ).slice(0, 4) ?? [],
    [summary?.changes]
  )

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
  const selectedParcelId = context.parcelId || searchParams.get('parcelId')
  const { priority: prioritySignals, routine: routineSignals } = partitionSignalsByPriority(summary.signals)
  const visibleSignals = [...prioritySignals, ...routineSignals].slice(0, 6)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#050608] text-white">
      <header className="shrink-0 border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-[#07f880]/10">
              <Radio className="h-4 w-4 text-[#07f880]" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">{t('watchtower.title')}</h1>
              <p className="text-[10px] text-white/40">
                {t('watchtower.last_refresh')}:{' '}
                {new Date(summary.generatedAt).toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: 'numeric',
                  month: 'short',
                })}
                {summary.isDemo ? ` · ${t('watchtower.demo_mode')}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

        {partialErrors.length > 0 && (
          <div className="mt-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-[10px] text-amber-200">
            {t('watchtower.partial_degradation')}: {partialErrors.join(' · ')}
          </div>
        )}
      </header>

      <div className="shrink-0 border-b border-white/10 px-4 py-3 sm:px-5">
        <WatchtowerProductionSnapshot
          production={summary.production}
          supply={summary.supply}
          climate={summary.climate}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid min-h-[420px] grid-cols-1 xl:grid-cols-[1fr_300px]">
          <div className="min-h-[380px] p-3 sm:p-4">
            <NationalMapPanel
              summary={summary}
              locale={locale}
              targetFarmId={mapProps.targetFarmId}
              targetPointId={mapProps.targetPointId}
              targetFocusToken={mapProps.targetFocusToken}
              targetZoom={mapProps.targetZoom}
              targetCropFilter={mapProps.targetCropFilter}
              selectedParcelId={selectedParcelId}
            />
          </div>

          <div className="relative z-20 flex min-h-[320px] flex-col border-t border-white/10 bg-[#050608] xl:border-l xl:border-t-0">
            <div className="shrink-0 border-b border-white/10 px-3 py-2">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/45">
                {t('watchtower.priority_signals')} ({visibleSignals.length})
              </h2>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {visibleSignals.length === 0 ? (
                <p className="text-xs text-white/40">{t('watchtower.no_signals')}</p>
              ) : (
                visibleSignals.map((signal) => (
                  <SignalCard
                    key={signal.id}
                    signal={signal}
                    selected={selectedSignalId === signal.id}
                    onCreateAlert={handleCreateAlert}
                    emphasized={prioritySignals.some((entry) => entry.id === signal.id)}
                    compact={!prioritySignals.some((entry) => entry.id === signal.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid min-h-[280px] grid-cols-1 border-t border-white/10 lg:grid-cols-2">
          <div className="border-b border-white/10 p-3 sm:p-4 lg:border-b-0 lg:border-r">
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/45">
              {t('watchtower.what_changed')}
            </h2>
            <WatchtowerChangesPanel changes={actionableChanges} />
          </div>
          <div className="flex min-h-[280px] flex-col p-3 sm:p-4">
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/45">
              {t('watchtower.ai_briefing')}
            </h2>
            <div className="min-h-[240px] flex-1 overflow-hidden rounded-lg border border-white/10 bg-[#0a0d12]">
              <GrowaIntelligencePanel module="watchtower" context={growaContext} />
            </div>
          </div>
        </div>

        <WatchtowerContextDeck summary={summary} />
      </div>
    </div>
  )
}
