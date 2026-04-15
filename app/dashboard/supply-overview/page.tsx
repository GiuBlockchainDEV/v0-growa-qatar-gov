'use client'

import { useMemo } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Clock3,
  Route,
  ShoppingBasket,
  Truck,
} from 'lucide-react'
import { useOrganization } from '@/hooks/use-organization'
import { useRoleNavigation } from '@/hooks/use-role-navigation'

const SUMMARY_CARDS = [
  {
    title: 'Available Contract Volume',
    value: '12,450 t',
    delta: '+8.4%',
    icon: Boxes,
    tone: 'text-[#07f880]',
  },
  {
    title: 'In Transit',
    value: '2,140 t',
    delta: '+3.1%',
    icon: Truck,
    tone: 'text-sky-300',
  },
  {
    title: 'At Risk Deliveries',
    value: '7 lots',
    delta: '+2',
    icon: AlertTriangle,
    tone: 'text-amber-300',
  },
  {
    title: 'Avg. Lead Time',
    value: '4.6 days',
    delta: '-0.4d',
    icon: Clock3,
    tone: 'text-violet-300',
  },
]

const PRIORITY_FLOWS = [
  {
    id: 'HF-1021',
    commodity: 'Fresh Tomatoes',
    origin: 'Northern Farm Cluster',
    destination: 'Doha Distribution Hub',
    status: 'on-track',
    eta: 'Tomorrow 08:30',
  },
  {
    id: 'HF-1044',
    commodity: 'Poultry Feed',
    origin: 'Industrial Feed Mill',
    destination: 'Al Wakra Poultry Network',
    status: 'watch',
    eta: 'Today 22:10',
  },
  {
    id: 'HF-1098',
    commodity: 'Greenhouse Cucumbers',
    origin: 'Umm Salal Controlled Farms',
    destination: 'West Bay Retail Chain',
    status: 'risk',
    eta: 'Delayed +9h',
  },
]

const statusClasses: Record<string, string> = {
  'on-track': 'bg-[#07f880]/15 text-[#07f880]',
  watch: 'bg-amber-500/15 text-amber-300',
  risk: 'bg-red-500/15 text-red-300',
}

export default function SupplyOverviewPage() {
  const { organization } = useOrganization()
  const { effectiveRole } = useRoleNavigation()

  const roleLabel = useMemo(() => {
    if (!effectiveRole) return 'Unassigned'
    return effectiveRole.replace(/_/g, ' ')
  }, [effectiveRole])

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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between">
                <p className="text-xs uppercase tracking-wide text-white/50">{card.title}</p>
                <Icon className={`h-4 w-4 ${card.tone}`} />
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
              <p className={`mt-1 text-xs ${card.tone}`}>{card.delta}</p>
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
                {PRIORITY_FLOWS.map((flow) => (
                  <tr key={flow.id} className="border-t border-white/5">
                    <td className="px-3 py-2 text-white">{flow.id}</td>
                    <td className="px-3 py-2 text-white/85">{flow.commodity}</td>
                    <td className="px-3 py-2 text-white/70">
                      {flow.origin} <ArrowUpRight className="mx-1 inline h-3 w-3 text-white/35" />
                      {flow.destination}
                    </td>
                    <td className="px-3 py-2 text-white/70">{flow.eta}</td>
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
              <li>• Validate delayed greenhouse corridor dispatches</li>
              <li>• Re-route poultry feed lots to south corridor</li>
              <li>• Confirm customs slot for imported grain shipment</li>
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
