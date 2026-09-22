'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, RefreshCw, Radio, Shield } from 'lucide-react'
import type { WatchtowerSummary, WatchtowerTimeframe } from '@/lib/domain/types'
import { WATCHTOWER_TIMEFRAMES, timeframeLabel } from '@/lib/domain/timeframes'
import { WatchtowerStatusStrip } from '@/components/dashboard/watchtower/status-strip'
import { WatchtowerSignalQueue } from '@/components/dashboard/watchtower/signal-queue'
import { WatchtowerChangesPanel } from '@/components/dashboard/watchtower/changes-panel'
import { WatchtowerKpiSummary } from '@/components/dashboard/watchtower/kpi-summary'
import { WatchtowerOutlookPanel } from '@/components/dashboard/watchtower/outlook-panel'
import { WatchtowerDataHealth } from '@/components/dashboard/watchtower/data-health'
import { cn } from '@/lib/utils'

export function WatchtowerWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [summary, setSummary] = useState<WatchtowerSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const timeframe = (searchParams.get('timeframe') || searchParams.get('timeRange') || '7d') as WatchtowerTimeframe

  const loadSummary = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const response = await fetch(`/api/watchtower/summary?timeframe=${timeframe}`, {
        cache: 'no-store',
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load watchtower data')
      }

      setSummary(payload as WatchtowerSummary)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load watchtower')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [timeframe])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const setTimeframe = (next: WatchtowerTimeframe) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('module', 'watchtower')
    params.set('timeframe', next)
    params.set('timeRange', next)
    router.replace(`/dashboard?${params.toString()}`, { scroll: false })
  }

  if (loading && !summary) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-white/40" />
          <p className="mt-3 text-sm text-white/50">Loading national watchtower...</p>
        </div>
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <AlertTriangle className="h-8 w-8 text-amber-400" />
        <p className="text-sm text-white/70">{error}</p>
        <button
          onClick={() => loadSummary()}
          className="rounded-md bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!summary) return null

  const systemHealth = summary.sourceStatus.filter((s) => s.health === 'healthy').length
  const totalSources = summary.sourceStatus.length

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-white/10 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-[#07f880]" />
              <h1 className="text-lg font-semibold text-white">Qatar Agricultural Watchtower</h1>
            </div>
            <p className="mt-1 text-xs text-white/50">
              National situational awareness · Last refresh{' '}
              {new Date(summary.generatedAt).toLocaleString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                day: 'numeric',
                month: 'short',
              })}
              {summary.isDemo && (
                <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300">
                  Demo data active
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-white/10 bg-white/[0.02] p-0.5">
              {WATCHTOWER_TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors',
                    timeframe === tf
                      ? 'bg-[#07f880]/20 text-[#07f880]'
                      : 'text-white/50 hover:text-white/80'
                  )}
                >
                  {timeframeLabel(tf)}
                </button>
              ))}
            </div>
            <button
              onClick={() => loadSummary(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:border-white/20 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-white/40">
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            System health: {systemHealth}/{totalSources} sources
          </span>
          <span>
            Data coverage:{' '}
            {summary.dataQuality.filter((d) => d.status === 'fresh' || d.status === 'partial').length}/
            {summary.dataQuality.length} datasets
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-6">
        {/* National Status Strip */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
            National status
          </h2>
          <WatchtowerStatusStrip statuses={summary.nationalStatus} />
        </section>

        {/* KPI Summary */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
            Strategic KPIs
          </h2>
          <WatchtowerKpiSummary
            production={summary.production}
            water={summary.water}
            energy={summary.energy}
            climate={summary.climate}
            supply={summary.supply}
          />
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Priority Signals */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
              Priority signals
            </h2>
            <WatchtowerSignalQueue signals={summary.signals} />
          </section>

          {/* What Changed */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
              What changed
            </h2>
            <WatchtowerChangesPanel changes={summary.changes} />
          </section>
        </div>

        {/* Outlook */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
            Outlook
          </h2>
          <WatchtowerOutlookPanel outlook={summary.outlook} />
        </section>

        {/* Data Health */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
            Data confidence & source health
          </h2>
          <WatchtowerDataHealth
            dataQuality={summary.dataQuality}
            sourceStatus={summary.sourceStatus}
          />
        </section>
      </div>
    </div>
  )
}
