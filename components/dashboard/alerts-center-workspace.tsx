'use client'

import { useCallback, useEffect, useState } from 'react'
import { DashboardQueryLink } from '@/components/dashboard/dashboard-query-link'
import { CheckCircle2, Clock, MapPin, Radio, RefreshCw } from 'lucide-react'
import { OperationalContextBanner } from '@/components/dashboard/operational-context-banner'
import { buildFarmSearchMapUrl } from '@/lib/dashboard/map-navigation'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/brand/feedback'
import { CardAction, EmptyState, ErrorState, LoadingState, Notice, PageHeader } from '@/components/brand/layout'
import { Button, SegmentedToggle } from '@/components/brand/ui'
import { StatusTag, humanize } from '@/components/brand/status'

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

/* Alert lifecycle → status squares: new is critical-red (act on it),
   work in progress is neutral, resolved is sage. */
const STATUS_LEVEL: Record<AlertStatus, string> = {
  new: 'critical',
  acknowledged: 'attention',
  investigating: 'progress',
  action_required: 'high',
  monitoring: 'progress',
  resolved: 'good',
  dismissed: 'unknown',
} as Record<AlertStatus, string>

/* English labels; translated at render with tr(). */
const STATUS_LABEL: Record<AlertStatus, string> = {
  new: 'New',
  acknowledged: 'Acknowledged',
  investigating: 'Investigating',
  action_required: 'Action required',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
}

const MOVE_LABEL: Partial<Record<AlertStatus, string>> = {
  acknowledged: 'Move to acknowledged',
  investigating: 'Move to investigating',
  action_required: 'Move to action required',
  monitoring: 'Move to monitoring',
  resolved: 'Move to resolved',
}

const NEXT_STATUS: Partial<Record<AlertStatus, AlertStatus>> = {
  new: 'acknowledged',
  acknowledged: 'investigating',
  investigating: 'action_required',
  action_required: 'monitoring',
  monitoring: 'resolved',
}

export function AlertsCenterWorkspace() {
  const showToast = useToast()
  const { t, tr, locale } = useI18n()
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
      if (!res.ok) throw new Error(payload.error || tr('Failed to update alert'))
      setAlerts((current) =>
        current.map((alert) => (alert.id === alertId ? { ...alert, status, ...payload.alert } : alert))
      )
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr('Failed to update alert'), 'error')
    }
  }

  const statusCounts = alerts.reduce<Record<string, number>>((acc, alert) => {
    acc[alert.status] = (acc[alert.status] || 0) + 1
    return acc
  }, {})

  const FILTERS = ['all', 'new', 'acknowledged', 'investigating', 'action_required', 'monitoring', 'resolved'] as const

  return (
    <div className="growa h-full overflow-y-auto bg-background text-content">
      <div className="mx-auto max-w-7xl p-6 space-y-4">
        <PageHeader
          eyebrow={tr('Operations')}
          title={t('alerts.title')}
          subtitle={t('alerts.subtitle')}
          actions={<CardAction icon={RefreshCw} label={t('watchtower.refresh')} onClick={() => loadAlerts(true)} disabled={refreshing} spinning={refreshing} />}
          className="!mb-2"
        />
        <OperationalContextBanner />
        {unavailable && <Notice tone="warning">{t('alerts.migration_required')}</Notice>}

        <div className="overflow-x-auto scrollbar-none">
          <SegmentedToggle
            size="sm"
            ariaLabel={tr('Filter by status')}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as AlertStatus | 'all')}
            options={FILTERS.map((status) => ({
              value: status,
              label: `${status === 'all' ? tr('All') : tr(STATUS_LABEL[status])}${status !== 'all' && statusCounts[status] ? ` · ${statusCounts[status]}` : ''}`,
            }))}
          />
        </div>

        {loading ? (
          <LoadingState label={tr('Loading alerts…')} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadAlerts()} retryLabel={tr('Retry')} />
        ) : alerts.length === 0 ? (
          <div className="bg-card border border-line" style={{ borderRadius: 'var(--radius-xl)' }}>
            <EmptyState
              title={t('alerts.empty')}
              action={
                <DashboardQueryLink href="/dashboard?module=watchtower" className="g-btn g-btn--outline" >
                  <span className="inline-flex items-center gap-2 px-4 h-9 text-[14px]">
                    <Radio strokeWidth={1.5} className="h-4 w-4" />
                    {t('alerts.from_watchtower')}
                  </span>
                </DashboardQueryLink>
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const nextStatus = NEXT_STATUS[alert.status]
              const farmId = alert.affected_farm_ids?.[0]
              return (
                <article
                  key={alert.id}
                  className="bg-card border border-line p-5 hover:border-line-strong transition-colors"
                  style={{ borderRadius: 'var(--radius-xl)' }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusTag level={STATUS_LEVEL[alert.status]} label={tr(STATUS_LABEL[alert.status] ?? humanize(alert.status))} />
                      <StatusTag level={alert.severity} />
                      {alert.alert_type && (
                        <span className="g-tag g-tag--muted" style={{ height: 22, padding: '0 9px', fontSize: 11 }}>{tr(humanize(alert.alert_type))}</span>
                      )}
                    </div>
                    <span className="text-[12px] text-content-soft flex items-center gap-1.5 tabular-nums">
                      <Clock strokeWidth={1.5} className="h-3.5 w-3.5" />
                      {new Date(alert.created_at).toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 className="mt-3 text-[16px] text-content" style={{ fontWeight: 500 }}>{alert.title}</h3>
                  {alert.summary && <p className="mt-1 text-[14px] text-content-soft leading-[1.45]">{alert.summary}</p>}

                  <div className="mt-4 pt-3 border-t border-dotted border-line-strong flex flex-wrap items-center gap-2">
                    {nextStatus && !unavailable && (
                      <Button size="sm" onClick={() => updateStatus(alert.id, nextStatus)}>
                        <CheckCircle2 strokeWidth={1.5} className="h-4 w-4" />
                        {tr(MOVE_LABEL[nextStatus] ?? `Move to ${humanize(nextStatus).toLowerCase()}`)}
                      </Button>
                    )}
                    {farmId && (
                      <DashboardQueryLink
                        href={buildFarmSearchMapUrl({ source: 'farm', id: farmId })}
                        className="g-btn g-btn--outline"
                      >
                        <span className="inline-flex items-center gap-2 px-4 h-8 text-[14px]">
                          <MapPin strokeWidth={1.5} className="h-4 w-4" />
                          {tr('View on map')}
                        </span>
                      </DashboardQueryLink>
                    )}
                    {alert.source_signal_id && (
                      <DashboardQueryLink
                        href={`/dashboard?module=watchtower&signalId=${alert.source_signal_id}`}
                        className="g-btn g-btn--ghost"
                      >
                        <span className="inline-flex items-center gap-2 px-3 h-8 text-[14px]">
                          <Radio strokeWidth={1.5} className="h-4 w-4" />
                          {tr('Source signal')}
                        </span>
                      </DashboardQueryLink>
                    )}
                    {alert.status !== 'dismissed' && !unavailable && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(alert.id, 'dismissed')} className="ms-auto text-content-soft">
                        {tr('Dismiss')}
                      </Button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <Notice tone="info">{t('alerts.workflow_note')}</Notice>
      </div>
    </div>
  )
}
