'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Clock3,
  Route,
  ShoppingBasket,
  Truck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import { useSharedRoleNavigation } from '@/contexts/role-navigation-context'
import { Card, EmptyState, ErrorState, LoadingState, PageBody, PageHeader } from '@/components/brand/layout'
import { Metric, StatusDot, Tag } from '@/components/brand/ui'
import { StatusTag, humanize } from '@/components/brand/status'

type SupplySnapshot = {
  available_contract_volume_tons: number
  available_contract_volume_delta_pct: number
  in_transit_tons: number
  in_transit_delta_pct: number
  at_risk_deliveries_count: number
  at_risk_deliveries_delta_count: number
  avg_lead_time_days: number
  avg_lead_time_delta_days: number
}

type SupplyFlow = {
  id: string
  flow_code: string
  commodity: string
  origin_label: string
  destination_label: string
  status: 'on-track' | 'watch' | 'risk'
  eta_label: string
}

type SupplyAction = {
  id: string
  action_text: string
}

const FLOW_LEVEL: Record<string, string> = {
  'on-track': 'good',
  watch: 'attention',
  risk: 'critical',
}

const metricCards = [
  {
    key: 'available_contract_volume_tons',
    deltaKey: 'available_contract_volume_delta_pct',
    title: 'Available contract volume',
    icon: Boxes,
    tone: 'text-sage-700',
    suffix: 't',
    deltaSuffix: '%',
  },
  {
    key: 'in_transit_tons',
    deltaKey: 'in_transit_delta_pct',
    title: 'In transit',
    icon: Truck,
    tone: 'text-content-soft',
    suffix: 't',
    deltaSuffix: '%',
  },
  {
    key: 'at_risk_deliveries_count',
    deltaKey: 'at_risk_deliveries_delta_count',
    title: 'At risk deliveries',
    icon: AlertTriangle,
    tone: 'text-warning-strong',
    suffix: 'lots',
    deltaSuffix: '',
  },
  {
    key: 'avg_lead_time_days',
    deltaKey: 'avg_lead_time_delta_days',
    title: 'Avg. lead time',
    icon: Clock3,
    tone: 'text-content-soft',
    suffix: 'days',
    deltaSuffix: 'd',
  },
] as const

function formatNumber(value: number | null) {
  if (value === null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)
}

function formatDelta(value: number | null, suffix: string) {
  if (value === null || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)}${suffix}`
}

export default function SupplyOverviewPage() {
  const { tr } = useI18n()
  const supabase = createClient()
  const { organization } = useOrganization()
  const { effectiveRole } = useSharedRoleNavigation()
  const [resolvedOrgId, setResolvedOrgId] = useState<string | null>(organization?.id || null)
  const [resolvedOrgName, setResolvedOrgName] = useState<string | null>(organization?.name || null)
  const [snapshot, setSnapshot] = useState<SupplySnapshot | null>(null)
  const [flows, setFlows] = useState<SupplyFlow[]>([])
  const [actions, setActions] = useState<SupplyAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const roleLabel = useMemo(() => {
    if (!effectiveRole) return 'Unassigned'
    return effectiveRole.replace(/_/g, ' ')
  }, [effectiveRole])

  useEffect(() => {
    const resolveOrganizationContext = async () => {
      if (organization?.id) {
        setResolvedOrgId(organization.id)
        setResolvedOrgName(organization.name)
        return
      }

      const { data: authData } = await supabase.auth.getUser()
      const user = authData.user
      if (!user?.email?.endsWith('@growa.ai')) {
        setResolvedOrgId(null)
        setResolvedOrgName(null)
        return
      }

      const { data: roleData, error: roleError } = await supabase.rpc('get_effective_role', {
        user_id: user.id,
      })
      const fallbackRoleData =
        roleError?.code === 'PGRST202' || roleError?.code === 'PGRST203'
          ? (await supabase.rpc('get_effective_role')).data
          : null
      const role = roleData?.[0] as
        | { is_impersonating?: boolean; org_id?: string; org_name?: string }
        | undefined
      const fallbackRole = fallbackRoleData?.[0] as
        | { is_impersonating?: boolean; org_id?: string; org_name?: string }
        | undefined
      const resolvedRole = role || fallbackRole

      if (resolvedRole?.is_impersonating && resolvedRole?.org_id) {
        setResolvedOrgId(resolvedRole.org_id)
        setResolvedOrgName(resolvedRole.org_name || null)
      } else {
        setResolvedOrgId(null)
        setResolvedOrgName(null)
      }
    }

    resolveOrganizationContext()
  }, [organization?.id, organization?.name, supabase])

  useEffect(() => {
    const loadSupplyOverview = async () => {
      if (!resolvedOrgId) {
        setSnapshot(null)
        setFlows([])
        setActions([])
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const [snapshotResult, flowsResult, actionsResult] = await Promise.all([
        supabase
          .from('supply_overview_snapshots')
          .select(
            'available_contract_volume_tons, available_contract_volume_delta_pct, in_transit_tons, in_transit_delta_pct, at_risk_deliveries_count, at_risk_deliveries_delta_count, avg_lead_time_days, avg_lead_time_delta_days'
          )
          .eq('organization_id', resolvedOrgId)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('supply_flows')
          .select('id, flow_code, commodity, origin_label, destination_label, status, eta_label')
          .eq('organization_id', resolvedOrgId)
          .eq('is_active', true)
          .order('priority', { ascending: true }),
        supabase
          .from('supply_action_queue')
          .select('id, action_text')
          .eq('organization_id', resolvedOrgId)
          .eq('is_open', true)
          .order('priority', { ascending: true }),
      ])

      if (snapshotResult.error || flowsResult.error || actionsResult.error) {
        const firstError =
          snapshotResult.error?.message || flowsResult.error?.message || actionsResult.error?.message
        setError(firstError || tr('Unable to load supply overview data.'))
        setSnapshot(null)
        setFlows([])
        setActions([])
        setLoading(false)
        return
      }

      setSnapshot((snapshotResult.data as SupplySnapshot | null) || null)
      setFlows((flowsResult.data as SupplyFlow[]) || [])
      setActions((actionsResult.data as SupplyAction[]) || [])
      setLoading(false)
    }

    loadSupplyOverview()
  }, [resolvedOrgId, supabase])

  return (
    <div className="h-full overflow-y-auto bg-background">
      <PageBody>
        <PageHeader
          eyebrow={tr('Supply')}
          title={tr('Supply overview')}
          subtitle={tr('Hassad Food command view for sourcing capacity, flow health and delivery risk.')}
          actions={
            <Tag size="sm" variant="outline-ink">
              {resolvedOrgName || organization?.name || tr('No organisation')} · {tr(humanize(roleLabel))}
            </Tag>
          }
        />

        {error && <ErrorState className="mb-4" message={tr('Failed to load supply overview: {error}', { error })} />}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => {
            const Icon = card.icon
            const metricValue = snapshot ? (snapshot[card.key] as number) : null
            const metricDelta = snapshot ? (snapshot[card.deltaKey] as number) : null
            return (
              <Card key={card.title} icon={Icon} title={tr(card.title)}>
                <Metric
                  size="display-3"
                  value={loading ? '…' : formatNumber(metricValue)}
                  unit={loading ? undefined : tr(card.suffix)}
                  hint={
                    <span className={card.tone}>
                      {loading ? '…' : formatDelta(metricDelta, card.deltaSuffix)} <span className="text-content-soft">{tr('vs last snapshot')}</span>
                    </span>
                  }
                />
              </Card>
            )
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
          <Card
            icon={Truck}
            title={tr('Priority supply flows')}
            subtitle={tr('Live operational queue')}
            actions={<StatusTag level="good" label={String(flows.length)} />}
            flush
          >
            {loading ? (
              <LoadingState />
            ) : flows.length === 0 ? (
              <EmptyState compact title={tr('No active supply flows found')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="g-table g-table--pad w-full">
                  <thead>
                    <tr>
                      <th>{tr('Flow')}</th>
                      <th>{tr('Commodity')}</th>
                      <th>{tr('Route')}</th>
                      <th>{tr('ETA')}</th>
                      <th>{tr('Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flows.map((flow) => (
                      <tr key={flow.id}>
                        <td className="font-mono text-[13px]">{flow.flow_code}</td>
                        <td>{flow.commodity}</td>
                        <td>
                          <span className="inline-flex items-center gap-1.5">
                            {flow.origin_label}
                            <ArrowUpRight strokeWidth={1.5} className="h-3.5 w-3.5 text-content-soft rtl:-scale-x-100" aria-hidden="true" />
                            {flow.destination_label}
                          </span>
                        </td>
                        <td className="tabular-nums">{flow.eta_label}</td>
                        <td>
                          <StatusTag level={FLOW_LEVEL[flow.status] || 'unknown'} label={tr(humanize(flow.status))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <Card family="comando" icon={Route} title={tr('Action queue')}>
              {loading ? (
                <LoadingState />
              ) : (
                <ul className="space-y-2.5 text-[14px] text-content">
                  {actions.map((action) => (
                    <li key={action.id} className="flex items-start gap-2.5">
                      <StatusDot tone="var(--growa-ink)" size={6} className="mt-[7px] shrink-0" />
                      <span>{action.action_text}</span>
                    </li>
                  ))}
                  {actions.length === 0 && <li className="text-content-soft">{tr('No open operational actions.')}</li>}
                </ul>
              )}
            </Card>

            <Card icon={ShoppingBasket} title={tr('Coverage focus')}>
              <p className="text-[14px] leading-[1.5] text-content-soft">
                {tr(
                  'This first release focuses on operational visibility for Hassad Food supply movements. The next iteration can connect farm-level throughput, contract utilisation and export readiness.'
                )}
              </p>
            </Card>
          </div>
        </div>
      </PageBody>
    </div>
  )
}
