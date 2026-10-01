'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
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

import { useToast } from '@/components/brand/feedback'
import { Card, CardAction, ErrorState, LoadingState, Notice, PageHeader } from '@/components/brand/layout'
import { Tag } from '@/components/brand/ui'
import { History, SignalHigh } from 'lucide-react'
import { sharedFetch } from '@/lib/client/shared-fetch'

export function WatchtowerWorkspace() {
  const showToast = useToast()
  const { t, tr, locale } = useI18n()
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

      const response = await sharedFetch(`/api/watchtower/summary?timeframe=${timeframe}`, { force: showRefresh })
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
      if (!res.ok) throw new Error(payload.error || tr('Failed to create alert'))
      showToast(t('watchtower.alert_created'), 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr('Failed to create alert'), 'error')
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
      <div className="growa flex h-full items-center justify-center bg-background">
        <LoadingState label={t('watchtower.loading')} />
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="growa flex h-full items-center justify-center bg-background p-8">
        <ErrorState message={error} onRetry={() => loadSummary()} retryLabel={t('common.retry')} className="max-w-sm w-full" />
      </div>
    )
  }

  if (!summary) return null

  const growaContext = buildWatchtowerGrowaContext(summary)
  const selectedParcelId = context.parcelId || searchParams.get('parcelId')
  const { priority: prioritySignals, routine: routineSignals } = partitionSignalsByPriority(summary.signals)
  const visibleSignals = [...prioritySignals, ...routineSignals].slice(0, 6)

  const refreshedAt = new Date(summary.generatedAt).toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  })

  /* Same page grammar as the SaaS: stone-50 page, a Light display title
     with the square, white cards with a header per family. The map and the
     signals sit side by side; the AI briefing is the ink (AI) card. */
  return (
    <div className="growa h-full overflow-y-auto bg-background text-content">
      <div className="mx-auto max-w-[1600px] p-6 space-y-4">
        <PageHeader
          eyebrow={tr('National watchtower')}
          title={t('watchtower.title')}
          subtitle={
            <>
              {t('watchtower.last_refresh')}: {refreshedAt}
            </>
          }
          actions={
            <>
              {summary.isDemo && <Tag variant="muted">{t('watchtower.demo_mode')}</Tag>}
              <CardAction icon={RefreshCw} label={t('watchtower.refresh')} onClick={() => loadSummary(true)} disabled={refreshing} spinning={refreshing} />
            </>
          }
          className="!mb-2"
        />

        {partialErrors.length > 0 && (
          <Notice tone="warning" title={t('watchtower.partial_degradation')}>
            {partialErrors.join(' · ')}
          </Notice>
        )}

        <WatchtowerProductionSnapshot
          production={summary.production}
          supply={summary.supply}
          climate={summary.climate}
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
          <div className="min-h-[520px]">
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

          <Card
            icon={SignalHigh}
            title={t('watchtower.priority_signals')}
            actions={<Tag variant="outline-ink" size="sm">{visibleSignals.length}</Tag>}
            className="relative z-20 max-h-[720px]"
            bodyClassName="overflow-y-auto"
          >
            {visibleSignals.length === 0 ? (
              <p className="text-[13px] text-content-soft">{t('watchtower.no_signals')}</p>
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
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card icon={History} title={t('watchtower.what_changed')}>
            <WatchtowerChangesPanel changes={actionableChanges} />
          </Card>
          {/* The assistant is itself an AI-family card (ink header). */}
          <div className="min-h-[420px]" aria-label={t('watchtower.ai_briefing')}>
            <GrowaIntelligencePanel module="watchtower" context={growaContext} />
          </div>
        </div>

        <WatchtowerContextDeck summary={summary} />
      </div>
    </div>
  )
}
