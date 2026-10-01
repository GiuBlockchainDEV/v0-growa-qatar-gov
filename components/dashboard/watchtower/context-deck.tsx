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
import { Card } from '@/components/brand/layout'
import { StatusDot } from '@/components/brand/ui'
import { severityTone, severityLabel } from '@/components/brand/status'
import { Compass, Gauge, Telescope } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

const DOMAIN_LABELS: Record<string, string> = {
  production: 'Production',
  water: 'Water',
  climate: 'Climate',
  supply: 'Supply',
}

function formatMetric(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${unit}`
}

function CompactOutlook({ outlook }: { outlook?: WatchtowerSummary['outlook'] }) {
  const { tr } = useI18n()
  const items = [
    ...(outlook?.sevenDay
      ? [
          { label: tr('7d climate'), value: outlook.sevenDay.climate },
          { label: tr('7d irrigation'), value: outlook.sevenDay.irrigationDemand },
          { label: tr('7d crop stress'), value: outlook.sevenDay.cropStress },
        ]
      : []),
    ...(outlook?.thirtyDay
      ? [
          { label: tr('30d harvest'), value: outlook.thirtyDay.harvest },
          { label: tr('30d production'), value: outlook.thirtyDay.production },
          { label: tr('30d water'), value: outlook.thirtyDay.waterRequirement },
          { label: tr('30d supply'), value: outlook.thirtyDay.supplyImplications },
        ]
      : []),
  ].filter((item) => item.value && item.value !== 'Insufficient data' && !item.value.startsWith('Insufficient'))

  if (items.length === 0) return null

  return (
    <Card icon={Telescope} title={tr('Outlook')}>
      <dl className="divide-y divide-dotted divide-line-strong -my-1">
        {items.slice(0, 4).map((item) => (
          <div key={item.label} className="py-2">
            <dt className="text-[12px] text-content-soft">{item.label}</dt>
            <dd className="mt-0.5 text-[13px] leading-snug text-content line-clamp-2">{item.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function ResourceIntensityCard({
  summary,
}: {
  summary: WatchtowerSummary
}) {
  const opCtx = useOperationalContextOptional()
  const { tr } = useI18n()
  const metrics = [
    {
      icon: Droplets,
      label: tr('Water demand'),
      value: formatMetric(summary.water.totalDemand.value, summary.water.totalDemand.unit),
      detail: summary.water.intensityM3PerTon?.value
        ? tr('{value} m³/t intensity', { value: summary.water.intensityM3PerTon.value.toFixed(1) })
        : summary.water.highPressureFarms
          ? tr('{count} high-pressure site(s)', { count: summary.water.highPressureFarms })
          : null,
      module: 'water-intelligence',
    },
    {
      icon: Zap,
      label: tr('Energy use'),
      value: formatMetric(summary.energy.totalConsumption.value, summary.energy.totalConsumption.unit),
      detail: summary.energy.intensityKwhPerTon?.value
        ? tr('{value} kWh/t intensity', { value: summary.energy.intensityKwhPerTon.value.toFixed(0) })
        : summary.energy.anomalousSites
          ? tr('{count} anomalous site(s)', { count: summary.energy.anomalousSites })
          : null,
      module: 'energy-intelligence',
    },
    {
      icon: Sun,
      label: tr('Climate sample'),
      value: formatMetric(summary.climate.heatRisk.value, summary.climate.heatRisk.unit),
      detail: summary.climate.waterStress?.value
        ? tr('Peak VPD {value} kPa', { value: summary.climate.waterStress.value.toFixed(1) })
        : null,
      module: 'weather',
    },
  ].filter((metric) => metric.value)

  if (metrics.length === 0) return null

  return (
    <Card icon={Gauge} title={tr('Resource operations')}>
      <div className="divide-y divide-dotted divide-line-strong -my-1">
        {metrics.map((metric) => {
          const [number, ...unit] = (metric.value || '').split(' ')
          return (
            <button
              key={metric.label}
              type="button"
              onClick={() => opCtx?.goToModule(metric.module)}
              className="group flex w-full items-center gap-3 py-2.5 text-start"
            >
              <metric.icon strokeWidth={1.5} className="h-4 w-4 shrink-0 text-content-soft" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-content-soft">{metric.label}</p>
                <p className="growa-figure text-content" style={{ fontSize: 20 }}>
                  {number}
                  <span className="ms-1 text-[11px] text-content-soft" style={{ fontWeight: 400, letterSpacing: 0 }}>{unit.join(' ')}</span>
                </p>
                {metric.detail && <p className="text-[11px] text-content-soft">{metric.detail}</p>}
              </div>
              <ArrowRight strokeWidth={1.5} className="h-4 w-4 shrink-0 text-stone-300 group-hover:text-ink transition-colors rtl:-scale-x-100" />
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function DomainPosture({ summary }: { summary: WatchtowerSummary }) {
  const { tr, locale } = useI18n()
  return (
    <Card icon={Compass} title={tr('National posture')}>
      <div className="divide-y divide-dotted divide-line-strong -my-1">
        {summary.nationalStatus.map((status) => (
          <div key={status.domain} className="py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] text-content" style={{ fontWeight: 500 }}>
                {DOMAIN_LABELS[status.domain] ? tr(DOMAIN_LABELS[status.domain]) : status.domain}
              </p>
              <StatusDot tone={severityTone(status.level)} size={7} label={<span className="text-content-soft">{severityLabel(status.level, locale)}</span>} />
            </div>
            <p className="mt-1 text-[12px] leading-snug text-content-soft line-clamp-2">{status.reason}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function QuickInvestigations({ summary }: { summary: WatchtowerSummary }) {
  const opCtx = useOperationalContextOptional()
  const { tr } = useI18n()
  const actions = [
    {
      icon: Sprout,
      label: tr('Harvest forecast'),
      detail: summary.production.fieldsMonitored?.value
        ? tr('{count} fields under forecast', { count: summary.production.fieldsMonitored.value })
        : tr('Open production estimation map'),
      module: 'harvest',
    },
    {
      icon: Droplets,
      label: tr('Water intelligence'),
      detail: tr('Review irrigation pressure and demand anomalies'),
      module: 'water-intelligence',
      show: summary.signals.some((s) => s.type === 'water'),
    },
    {
      icon: Zap,
      label: tr('Energy intelligence'),
      detail: tr('Review intensity outliers across sites'),
      module: 'energy-intelligence',
      show: summary.signals.some((s) => s.type === 'energy'),
    },
    {
      icon: ShoppingCart,
      label: tr('Supply overview'),
      detail: summary.supply.atRiskDeliveries?.value
        ? tr('{count} delivery lot(s) at risk', { count: summary.supply.atRiskDeliveries.value })
        : tr('Contract volume and coverage'),
      href: '/dashboard/supply-overview',
    },
    {
      icon: Leaf,
      label: tr('Investigations'),
      detail: tr('Open cross-module case workspace'),
      module: 'investigations',
      show: summary.signals.length > 0,
    },
  ].filter((action) => action.show !== false)

  return (
    <Card family="comando" icon={ArrowRight} title={tr('Quick actions')}>
      <div className="divide-y divide-dotted divide-line-strong -my-1">
        {actions.map((action) => {
          const content = (
            <>
              <action.icon strokeWidth={1.5} className="h-4 w-4 shrink-0 text-content-soft" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-content" style={{ fontWeight: 500 }}>{action.label}</p>
                <p className="text-[12px] text-content-soft line-clamp-1">{action.detail}</p>
              </div>
              <ArrowRight strokeWidth={1.5} className="h-4 w-4 shrink-0 text-stone-300 group-hover:text-ink transition-colors rtl:-scale-x-100" />
            </>
          )

          if (action.href) {
            return (
              <Link
                key={action.label}
                href={action.href}
                className="group flex items-center gap-3 py-2.5"
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
              className="group flex w-full items-center gap-3 py-2.5 text-start"
            >
              {content}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

export function WatchtowerContextDeck({ summary }: { summary: WatchtowerSummary }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-3">
          <DomainPosture summary={summary} />
          <QuickInvestigations summary={summary} />
        </div>
        <div className="space-y-4 xl:col-span-3">
          <ResourceIntensityCard summary={summary} />
          <CompactOutlook outlook={summary.outlook} />
        </div>
        <div className="space-y-4 xl:col-span-3">
          <SupplyChainPanel supply={summary.supply} />
        </div>
        <div className="xl:col-span-3">
          <ExternalIntelligencePanel />
        </div>
    </div>
  )
}
