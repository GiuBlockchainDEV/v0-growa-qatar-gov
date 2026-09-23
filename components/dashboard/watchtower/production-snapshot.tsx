'use client'

import type { ProductionSummary, SupplySummary, ClimateSummary } from '@/lib/domain/types'
import { humanizeMetricSource } from '@/lib/watchtower/production-metrics'
import { cn } from '@/lib/utils'

function formatValue(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${unit}`
}

interface ProductionSnapshotProps {
  production: ProductionSummary
  supply: SupplySummary
  climate: ClimateSummary
}

export function WatchtowerProductionSnapshot({
  production,
  supply,
  climate,
}: ProductionSnapshotProps) {
  const cards = [
    {
      label: production.productionEstimate.label,
      value: formatValue(production.productionEstimate.value, production.productionEstimate.unit),
      detail: humanizeMetricSource(production.productionEstimate.source),
      highlight: Boolean(production.productionEstimate.value),
    },
    {
      label: production.fieldsMonitored?.label || 'Fields monitored',
      value: formatValue(production.fieldsMonitored?.value ?? null, production.fieldsMonitored?.unit || 'fields'),
      detail: production.cropTypes?.value
        ? `${production.cropTypes.value} crop types tracked`
        : humanizeMetricSource(production.fieldsMonitored?.source || 'harvest.analytics.predict'),
      highlight: Boolean(production.fieldsMonitored?.value),
    },
    {
      label: production.atRiskProduction?.label || 'Below health threshold',
      value: formatValue(production.atRiskProduction?.value ?? null, production.atRiskProduction?.unit || 'fields'),
      detail: production.avgHealthScore?.value
        ? `Avg score ${production.avgHealthScore.value.toFixed(0)}/100`
        : 'From vegetation indicators',
      highlight: Boolean(production.atRiskProduction?.value),
      warning: Boolean(production.atRiskProduction?.value),
    },
    {
      label: supply.atRiskDeliveries?.value ? 'Supply at risk' : 'Contract volume',
      value: supply.atRiskDeliveries?.value
        ? formatValue(supply.atRiskDeliveries.value, supply.atRiskDeliveries.unit || 'lots')
        : formatValue(supply.availableVolume?.value ?? null, supply.availableVolume?.unit || 't'),
      detail: climate.heatRisk.value
        ? `Peak temp ${climate.heatRisk.value.toFixed(1)}°C sampled`
        : humanizeMetricSource(supply.availableVolume?.source || 'supply_overview_snapshots'),
      highlight: Boolean(supply.atRiskDeliveries?.value || supply.availableVolume?.value || climate.heatRisk.value),
      warning: Boolean(supply.atRiskDeliveries?.value),
    },
  ].filter((card) => card.value)

  if (cards.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn(
            'rounded-lg border px-3 py-2.5',
            card.warning
              ? 'border-amber-500/30 bg-amber-500/[0.06]'
              : card.highlight
                ? 'border-[#07f880]/25 bg-[#07f880]/[0.05]'
                : 'border-white/10 bg-white/[0.02]'
          )}
        >
          <p className="text-[10px] uppercase tracking-wider text-white/40">{card.label}</p>
          <p className="mt-1 text-lg font-semibold text-white">{card.value}</p>
          <p className="mt-1 text-[10px] text-white/45 line-clamp-2">{card.detail}</p>
        </div>
      ))}
    </div>
  )
}
