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
import { useOrganization } from '@/hooks/use-organization'
import { useRoleNavigation } from '@/hooks/use-role-navigation'

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

const statusClasses: Record<string, string> = {
  'on-track': 'bg-[#07f880]/15 text-[#07f880]',
  watch: 'bg-amber-500/15 text-amber-300',
  risk: 'bg-red-500/15 text-red-300',
}

const metricCards = [
  {
    key: 'available_contract_volume_tons',
    deltaKey: 'available_contract_volume_delta_pct',
    title: 'Available Contract Volume',
    icon: Boxes,
    tone: 'text-[#07f880]',
    suffix: 't',
    deltaSuffix: '%',
  },
  {
    key: 'in_transit_tons',
    deltaKey: 'in_transit_delta_pct',
    title: 'In Transit',
    icon: Truck,
    tone: 'text-sky-300',
    suffix: 't',
    deltaSuffix: '%',
  },
  {
    key: 'at_risk_deliveries_count',
    deltaKey: 'at_risk_deliveries_delta_count',
    title: 'At Risk Deliveries',
    icon: AlertTriangle,
    tone: 'text-amber-300',
    suffix: 'lots',
    deltaSuffix: '',
  },
  {
    key: 'avg_lead_time_days',
    deltaKey: 'avg_lead_time_delta_days',
    title: 'Avg. Lead Time',
    icon: Clock3,
    tone: 'text-violet-300',
    suffix: 'days',
    deltaSuffix: 'd',
  },
] as const

function formatValue(value: number | null, suffix: string) {
  if (value === null || Number.isNaN(value)) return '--'
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)} ${suffix}`.trim()
}

function formatDelta(value: number | null, suffix: string) {
  if (value === null || Number.isNaN(value)) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)}${suffix}`
}

export default function SupplyOverviewPage() {
  const supabase = createClient()
  const { organization } = useOrganization()
  const { effectiveRole } = useRoleNavigation()
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
    const loadSupplyOverview = async () => {
      if (!organization?.id) {
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
          .eq('organization_id', organization.id)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('supply_flows')
          .select('id, flow_code, commodity, origin_label, destination_label, status, eta_label')
          .eq('organization_id', organization.id)
          .eq('is_active', true)
          .order('priority', { ascending: true }),
        supabase
          .from('supply_action_queue')
          .select('id, action_text')
          .eq('organization_id', organization.id)
          .eq('is_open', true)
          .order('priority', { ascending: true }),
      ])

      if (snapshotResult.error || flowsResult.error || actionsResult.error) {
        const firstError =
          snapshotResult.error?.message || flowsResult.error?.message || actionsResult.error?.message
        setError(firstError || 'Unable to load supply overview data.')
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
  }, [organization?.id, supabase])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Supply Overview</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hassad Food command view for sourcing capacity, flow health, and delivery risk.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
            {organization?.name || 'No Organization'} • {roleLabel}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load supply overview: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = card.icon
          const metricValue = snapshot ? (snapshot[card.key] as number) : null
          const metricDelta = snapshot ? (snapshot[card.deltaKey] as number) : null
          return (
            <div key={card.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between">
                <p className="text-xs uppercase tracking-wide text-white/50">{card.title}</p>
                <Icon className={`h-4 w-4 ${card.tone}`} />
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">
                {loading ? '...' : formatValue(metricValue, card.suffix)}
              </p>
              <p className={`mt-1 text-xs ${card.tone}`}>
                {loading ? '...' : formatDelta(metricDelta, card.deltaSuffix)}
              </p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Priority Supply Flows</h2>
            <span className="text-xs text-white/50">Live operational queue</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/45">Flow</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/45">
                    Commodity
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/45">Route</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/45">ETA</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/45">Status</th>
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  flows.map((flow) => (
                  <tr key={flow.id} className="border-t border-white/5">
                    <td className="px-3 py-2 text-white">{flow.flow_code}</td>
                    <td className="px-3 py-2 text-white/85">{flow.commodity}</td>
                    <td className="px-3 py-2 text-white/70">
                      {flow.origin_label} <ArrowUpRight className="mx-1 inline h-3 w-3 text-white/35" />
                      {flow.destination_label}
                    </td>
                    <td className="px-3 py-2 text-white/70">{flow.eta_label}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs capitalize ${
                          statusClasses[flow.status] || 'bg-white/10 text-white/80'
                        }`}
                      >
                        {flow.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!loading && flows.length === 0 && (
                  <tr className="border-t border-white/5">
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-white/50">
                      No active supply flows found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center gap-2">
              <Route className="h-4 w-4 text-[#07f880]" />
              <h3 className="text-sm font-semibold text-white">Action Queue</h3>
            </div>
            <ul className="space-y-2 text-sm text-white/75">
              {!loading &&
                actions.map((action) => (
                  <li key={action.id}>• {action.action_text}</li>
                ))}
              {!loading && actions.length === 0 && <li>• No open operational actions.</li>}
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center gap-2">
              <ShoppingBasket className="h-4 w-4 text-sky-300" />
              <h3 className="text-sm font-semibold text-white">Coverage Focus</h3>
            </div>
            <p className="text-sm text-white/70">
              This first release focuses on operational visibility for Hassad Food supply movements.
              Next iteration can connect farm-level throughput, contract utilization, and export readiness.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
