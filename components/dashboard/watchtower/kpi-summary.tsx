'use client'

import type {
  ClimateSummary,
  EnergySummary,
  NationalStatusDomain,
  ProductionSummary,
  SupplySummary,
  WaterSummary,
} from '@/lib/domain/types'
import { cn } from '@/lib/utils'

function formatMetric(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { display: '—', sublabel: 'Insufficient data' }
  }
  return {
    display: `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${unit}`,
    sublabel: null,
  }
}

interface KpiSummaryProps {
  production: ProductionSummary
  water: WaterSummary
  energy: EnergySummary
  climate: ClimateSummary
  supply: SupplySummary
  nationalStatus?: NationalStatusDomain[]
}

export function WatchtowerKpiSummary({
  production,
  water,
  energy,
  climate,
  supply,
  nationalStatus = [],
}: KpiSummaryProps) {
  const statusByDomain = new Map(nationalStatus.map((status) => [status.domain, status]))

  const cards = [
    {
      title: 'Production',
      domain: 'production' as const,
      abnormal: false,
      primary: formatMetric(production.productionEstimate.value, production.productionEstimate.unit),
      secondary: production.atRiskProduction?.value
        ? `${production.atRiskProduction.value} at risk`
        : null,
    },
    {
      title: 'Water',
      domain: 'water' as const,
      abnormal: false,
      primary: formatMetric(water.totalDemand.value, water.totalDemand.unit),
      secondary: water.intensityM3PerTon?.value
        ? `${water.intensityM3PerTon.value.toFixed(1)} m³/t`
        : null,
    },
    {
      title: 'Energy',
      abnormal: Boolean(energy.anomalousSites && energy.anomalousSites > 0),
      primary: formatMetric(energy.totalConsumption.value, energy.totalConsumption.unit),
      secondary: energy.anomalousSites ? `${energy.anomalousSites} anomalous` : null,
    },
    {
      title: 'Climate',
      domain: 'climate' as const,
      abnormal: false,
      primary: formatMetric(climate.heatRisk.value, climate.heatRisk.unit),
      secondary: climate.waterStress?.value ? `VPD ${climate.waterStress.value.toFixed(1)} kPa` : null,
    },
    {
      title: 'Supply',
      domain: 'supply' as const,
      abnormal: false,
      primary: formatMetric(supply.availableVolume?.value ?? null, supply.availableVolume?.unit || 't'),
      secondary: supply.atRiskDeliveries?.value ? `${supply.atRiskDeliveries.value} at risk` : null,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
      {cards.map((card) => {
        const domainStatus = card.domain ? statusByDomain.get(card.domain) : undefined
        const abnormal =
          card.abnormal ||
          domainStatus?.level === 'attention' ||
          domainStatus?.level === 'high' ||
          domainStatus?.level === 'critical'

        return (
          <div
            key={card.title}
            className={cn(
              'rounded-lg border px-3 py-3 transition-colors',
              abnormal
                ? 'border-amber-500/30 bg-amber-500/[0.06] lg:col-span-1'
                : 'border-white/10 bg-white/[0.02] opacity-90'
            )}
          >
            <p className="text-[10px] uppercase tracking-wider text-white/40">{card.title}</p>
            <p className={cn('mt-1 font-semibold text-white', abnormal ? 'text-xl' : 'text-lg')}>
              {card.primary.display}
            </p>
            {card.primary.sublabel && (
              <p className="text-[10px] text-white/40">{card.primary.sublabel}</p>
            )}
            {abnormal && domainStatus?.reason && (
              <p className="mt-1 text-[10px] text-amber-200/90 line-clamp-2">{domainStatus.reason}</p>
            )}
            {card.secondary && (
              <p className="mt-1 text-[11px] text-white/50">{card.secondary}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
