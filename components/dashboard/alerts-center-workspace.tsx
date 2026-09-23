'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  MapPin,
  Radio,
  RefreshCw,
  Search,
} from 'lucide-react'
import { OperationalContextBanner } from '@/components/dashboard/operational-context-banner'
import { buildFarmSearchMapUrl } from '@/lib/dashboard/map-navigation'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type AlertStatus =
  | 'new'
  | 'acknowledged'
  | 'investigating'
  | 'action_required'
  | 'monitoring'
  | 'resolved'
  | 'dismissed'

interface OperationalAlert {
  id: string
  title: string
  summary: string | null
  severity: string
  status: AlertStatus
  alert_type: string | null
  source_signal_id: string | null
  affected_farm_ids: string[]
  created_at: string
  updated_at: string
}

const STATUS_STYLES: Record<AlertStatus, string> = {
  new: 'bg-sky-500/15 text-sky-300',
  acknowledged: 'bg-violet-500/15 text-violet-300',
  investigating: 'bg-amber-500/15 text-amber-300',
  action_required: 'bg-orange-500/15 text-orange-300',
  monitoring: 'bg-blue-500/15 text-blue-300',
  resolved: 'bg-[#07f880]/15 text-[#07f880]',
  dismissed: 'bg-white/10 text-white/40',
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'text-red-300',
  high: 'text-orange-300',
  attention: 'text-amber-300',
  info: 'text-sky-300',
}

const NEXT_STATUS: Partial<Record<AlertStatus, AlertStatus>> = {
  new: 'acknowledged',
  acknowledged: 'investigating',
  investigating: 'action_required',
  action_required: 'monitoring',
  monitoring: 'resolved',
}

export function AlertsCenterWorkspace() {
  const { t } = useI18n()
  const [alerts, setAlerts] = useState<OperationalAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('all')
  const [refreshing, setRefreshing] = useState(false)

  const loadAlerts = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const params = new URLSearchParams({ limit: '50' })
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/alerts?${params}`, { cache: 'no-store' })
      const payload = await res.json()

      if (!res.ok) throw new Error(payload.error || 'Failed to load alerts')

      setUnavailable(Boolean(payload.unavailable))
      setAlerts(Array.isArray(payload.alerts) ? payload.alerts : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load alerts')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  const updateStatus = async (alertId: string, status: AlertStatus) => {
    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to update alert')
      setAlerts((current) =>
        current.map((alert) => (alert.id === alertId ? { ...alert, status, ...payload.alert } : alert))
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update alert')
    }
  }

  const statusCounts = alerts.reduce<Record<string, number>>((acc, alert) => {
    acc[alert.status] = (acc[alert.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#050608] text-white">
      <header className="shrink-0 border-b border-white/10 px-5 py-4 pt-20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-[#07f880]" />
              <h1 className="text-lg font-semibold">{t('alerts.title')}</h1>
            </div>
            <p className="mt-1 text-xs text-white/45">{t('alerts.subtitle')}</p>
          </div>
          <button
            onClick={() => loadAlerts(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:border-white/20 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {t('watchtower.refresh')}
          </button>
        </div>

        <div className="mt-3">
          <OperationalContextBanner />
        </div>

        {unavailable && (
          <div className="mt-3 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
            {t('alerts.migration_required')}
          </div>
        )}
      </header>

      <div className="shrink-0 border-b border-white/10 px-5 py-2 flex flex-wrap gap-2">
        {(['all', 'new', 'acknowledged', 'investigating', 'action_required', 'monitoring', 'resolved'] as const).map(
          (status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'rounded px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors',
                statusFilter === status
                  ? 'bg-[#07f880] text-black'
                  : 'border border-white/10 text-white/50 hover:text-white/80'
              )}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ')}
              {status !== 'all' && statusCounts[status] ? ` (${statusCounts[status]})` : ''}
            </button>
          )
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="h-5 w-5 animate-spin text-white/30" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>
        ) : alerts.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-[#0a0d12] p-8 text-center">
            <Search className="mx-auto h-8 w-8 text-white/20" />
            <p className="mt-3 text-sm text-white/50">{t('alerts.empty')}</p>
            <Link
              href="/dashboard?module=watchtower"
              className="mt-4 inline-flex items-center gap-1 text-xs text-[#07f880] hover:underline"
            >
              <Radio className="h-3 w-3" />
              {t('alerts.from_watchtower')}
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => {
              const nextStatus = NEXT_STATUS[alert.status]
              const farmId = alert.affected_farm_ids?.[0]
              return (
                <div
                  key={alert.id}
                  className="rounded-lg border border-white/10 bg-[#0a0d12] p-4 hover:border-white/15 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold uppercase', STATUS_STYLES[alert.status])}>
                        {alert.status.replace('_', ' ')}
                      </span>
                      <span className={cn('text-[10px] font-medium uppercase', SEVERITY_STYLES[alert.severity] || 'text-white/50')}>
                        {alert.severity}
                      </span>
                      {alert.alert_type && (
                        <span className="text-[10px] text-white/35">{alert.alert_type.replace('_', ' ')}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-white/35 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(alert.created_at).toLocaleString()}
                    </span>
                  </div>

                  <h3 className="mt-2 text-sm font-medium text-white">{alert.title}</h3>
                  {alert.summary && <p className="mt-1 text-xs text-white/55">{alert.summary}</p>}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {farmId && (
                      <Link
                        href={buildFarmSearchMapUrl({ source: 'farm', id: farmId })}
                        className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-white/60 hover:text-[#07f880]"
                      >
                        <MapPin className="h-3 w-3" />
                        View on map
                      </Link>
                    )}
                    {alert.source_signal_id && (
                      <Link
                        href={`/dashboard?module=watchtower&signalId=${alert.source_signal_id}`}
                        className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-white/60 hover:text-[#07f880]"
                      >
                        <Radio className="h-3 w-3" />
                        Source signal
                      </Link>
                    )}
                    {nextStatus && !unavailable && (
                      <button
                        type="button"
                        onClick={() => updateStatus(alert.id, nextStatus)}
                        className="inline-flex items-center gap-1 rounded bg-[#07f880]/12 px-2 py-1 text-[10px] font-medium text-[#07f880] hover:bg-[#07f880]/20"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        → {nextStatus.replace('_', ' ')}
                      </button>
                    )}
                    {alert.status !== 'dismissed' && !unavailable && (
                      <button
                        type="button"
                        onClick={() => updateStatus(alert.id, 'dismissed')}
                        className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-white/40 hover:text-white/70"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span>{t('alerts.workflow_note')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
