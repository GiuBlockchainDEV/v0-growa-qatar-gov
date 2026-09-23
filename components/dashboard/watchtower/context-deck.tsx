'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Droplets,
  Leaf,
  ShoppingCart,
  Sprout,
  Sun,
  Zap,
} from 'lucide-react'
import type { WatchtowerSummary } from '@/lib/domain/types'
import { useOperationalContextOptional } from '@/contexts/operational-context-provider'
import { SupplyChainPanel } from '@/components/dashboard/watchtower/supply-chain-panel'
import { ExternalIntelligencePanel } from '@/components/dashboard/watchtower/external-intelligence'
import { cn } from '@/lib/utils'

const DOMAIN_LABELS: Record<string, string> = {
  production: 'Production',
  water: 'Water',
  climate: 'Climate',
  supply: 'Supply',
}

const LEVEL_STYLES = {
  normal: 'border-[#07f880]/25 bg-[#07f880]/5 text-[#07f880]',
  attention: 'border-amber-500/25 bg-amber-500/5 text-amber-200',
  high: 'border-orange-500/25 bg-orange-500/5 text-orange-200',
  critical: 'border-red-500/25 bg-red-500/5 text-red-200',
  unknown: 'border-white/10 bg-white/[0.02] text-white/45',
}

function formatMetric(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${unit}`
}

function CompactOutlook({ outlook }: { outlook?: WatchtowerSummary['outlook'] }) {
  const items = [
    ...(outlook?.sevenDay
      ? [
          { label: '7d climate', value: outlook.sevenDay.climate },
          { label: '7d irrigation', value: outlook.sevenDay.irrigationDemand },
          { label: '7d crop stress', value: outlook.sevenDay.cropStress },
        ]
      : []),
    ...(outlook?.thirtyDay
      ? [
          { label: '30d harvest', value: outlook.thirtyDay.harvest },
          { label: '30d production', value: outlook.thirtyDay.production },
          { label: '30d water', value: outlook.thirtyDay.waterRequirement },
          { label: '30d supply', value: outlook.thirtyDay.supplyImplications },
        ]
      : []),
  ].filter((item) => item.value && item.value !== 'Insufficient data' && !item.value.startsWith('Insufficient'))

  if (items.length === 0) return null

  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0d12] p-3">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/45">Outlook</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {items.slice(0, 4).map((item) => (
          <div key={item.label} className="rounded border border-white/5 bg-white/[0.02] px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-wider text-white/35">{item.label}</p>
            <p className="mt-1 text-[11px] leading-snug text-white/75 line-clamp-2">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResourceIntensityCard({
  summary,
}: {
  summary: WatchtowerSummary
}) {
  const metrics = [
    {
      icon: Droplets,
      label: 'Water demand',
      value: formatMetric(summary.water.totalDemand.value, summary.water.totalDemand.unit),
      detail: summary.water.intensityM3PerTon?.value
        ? `${summary.water.intensityM3PerTon.value.toFixed(1)} m³/t intensity`
        : summary.water.highPressureFarms
          ? `${summary.water.highPressureFarms} high-pressure site(s)`
          : null,
      module: 'water-intelligence',
    },
    {
      icon: Zap,
      label: 'Energy use',
      value: formatMetric(summary.energy.totalConsumption.value, summary.energy.totalConsumption.unit),
      detail: summary.energy.intensityKwhPerTon?.value
        ? `${summary.energy.intensityKwhPerTon.value.toFixed(0)} kWh/t intensity`
        : summary.energy.anomalousSites
          ? `${summary.energy.anomalousSites} anomalous site(s)`
          : null,
      module: 'energy-intelligence',
    },
    {
      icon: Sun,
      label: 'Climate sample',
      value: formatMetric(summary.climate.heatRisk.value, summary.climate.heatRisk.unit),
      detail: summary.climate.waterStress?.value
        ? `Peak VPD ${summary.climate.waterStress.value.toFixed(1)} kPa`
        : null,
      module: 'weather',
    },
  ].filter((metric) => metric.value)

  if (metrics.length === 0) return null

  const opCtx = useOperationalContextOptional()

  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0d12] p-3">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/45">Resource operations</h3>
      <div className="mt-2 space-y-2">
        {metrics.map((metric) => (
          <button
            key={metric.label}
            type="button"
            onClick={() => opCtx?.goToModule(metric.module)}
            className="flex w-full items-start gap-2.5 rounded border border-white/5 bg-white/[0.02] px-2.5 py-2 text-left hover:border-[#07f880]/25"
          >
            <metric.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#07f880]/70" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-white/40">{metric.label}</p>
              <p className="text-sm font-semibold text-white">{metric.value}</p>
              {metric.detail && <p className="text-[10px] text-white/45">{metric.detail}</p>}
            </div>
            <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-white/25" />
          </button>
        ))}
      </div>
    </div>
  )
}

function DomainPosture({ summary }: { summary: WatchtowerSummary }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0d12] p-3">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/45">National posture</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {summary.nationalStatus.map((status) => (
          <div
            key={status.domain}
            className={cn('rounded border px-2.5 py-2', LEVEL_STYLES[status.level])}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide">
              {DOMAIN_LABELS[status.domain] || status.domain}
            </p>
            <p className="mt-1 text-[11px] leading-snug opacity-90 line-clamp-2">{status.reason}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuickInvestigations({ summary }: { summary: WatchtowerSummary }) {
  const opCtx = useOperationalContextOptional()
  const actions = [
    {
      icon: Sprout,
      label: 'Harvest forecast',
      detail: summary.production.fieldsMonitored?.value
        ? `${summary.production.fieldsMonitored.value} fields under forecast`
        : 'Open production estimation map',
      module: 'harvest',
    },
    {
      icon: Droplets,
      label: 'Water intelligence',
      detail: 'Review irrigation pressure and demand anomalies',
      module: 'water-intelligence',
      show: summary.signals.some((s) => s.type === 'water'),
    },
    {
      icon: Zap,
      label: 'Energy intelligence',
      detail: 'Review intensity outliers across sites',
      module: 'energy-intelligence',
      show: summary.signals.some((s) => s.type === 'energy'),
    },
    {
      icon: ShoppingCart,
      label: 'Supply overview',
      detail: summary.supply.atRiskDeliveries?.value
        ? `${summary.supply.atRiskDeliveries.value} delivery lot(s) at risk`
        : 'Contract volume and coverage',
      href: '/dashboard/supply-overview',
    },
    {
      icon: Leaf,
      label: 'Investigations',
      detail: 'Open cross-module case workspace',
      module: 'investigations',
      show: summary.signals.length > 0,
    },
  ].filter((action) => action.show !== false)

  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0d12] p-3">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/45">Quick actions</h3>
      <div className="mt-2 space-y-1.5">
        {actions.map((action) => {
          const content = (
            <>
              <action.icon className="h-3.5 w-3.5 shrink-0 text-[#07f880]/70" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white/85">{action.label}</p>
                <p className="text-[10px] text-white/45 line-clamp-1">{action.detail}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/25" />
            </>
          )

          if (action.href) {
            return (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-2 rounded border border-white/5 bg-white/[0.02] px-2.5 py-2 hover:border-[#07f880]/25"
              >
                {content}
              </Link>
            )
          }

          return (
            <button
              key={action.label}
              type="button"
              onClick={() => action.module && opCtx?.goToModule(action.module)}
              className="flex w-full items-center gap-2 rounded border border-white/5 bg-white/[0.02] px-2.5 py-2 text-left hover:border-[#07f880]/25"
            >
              {content}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function WatchtowerContextDeck({ summary }: { summary: WatchtowerSummary }) {
  return (
    <div className="border-t border-white/10 bg-[#050608] p-3 sm:p-4">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-3">
          <DomainPosture summary={summary} />
          <QuickInvestigations summary={summary} />
        </div>
        <div className="space-y-3 xl:col-span-3">
          <ResourceIntensityCard summary={summary} />
          <CompactOutlook outlook={summary.outlook} />
        </div>
        <div className="space-y-3 xl:col-span-3">
          <SupplyChainPanel supply={summary.supply} />
        </div>
        <div className="xl:col-span-3">
          <ExternalIntelligencePanel />
        </div>
      </div>
    </div>
  )
}
