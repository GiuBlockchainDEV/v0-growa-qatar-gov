'use client'

import type { ClimateSummary, EnergySummary, ProductionSummary, SupplySummary, WaterSummary } from '@/lib/domain/types'

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
}

export function WatchtowerKpiSummary({
  production,
  water,
  energy,
  climate,
  supply,
}: KpiSummaryProps) {
  const cards = [
    {
      title: 'Production',
      primary: formatMetric(production.productionEstimate.value, production.productionEstimate.unit),
      secondary: production.atRiskProduction?.value
        ? `${production.atRiskProduction.value} at risk`
        : null,
    },
    {
      title: 'Water',
      primary: formatMetric(water.totalDemand.value, water.totalDemand.unit),
      secondary: water.intensityM3PerTon?.value
        ? `${water.intensityM3PerTon.value.toFixed(1)} m³/t`
        : null,
    },
    {
      title: 'Energy',
      primary: formatMetric(energy.totalConsumption.value, energy.totalConsumption.unit),
      secondary: energy.anomalousSites ? `${energy.anomalousSites} anomalous` : null,
    },
    {
      title: 'Climate',
      primary: formatMetric(climate.heatRisk.value, climate.heatRisk.unit),
      secondary: climate.waterStress?.value ? `VPD ${climate.waterStress.value.toFixed(1)} kPa` : null,
    },
    {
      title: 'Supply',
      primary: formatMetric(supply.availableVolume?.value ?? null, supply.availableVolume?.unit || 't'),
      secondary: supply.atRiskDeliveries?.value ? `${supply.atRiskDeliveries.value} at risk` : null,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3"
        >
          <p className="text-[10px] uppercase tracking-wider text-white/40">{card.title}</p>
          <p className="mt-1 text-lg font-semibold text-white">{card.primary.display}</p>
          {card.primary.sublabel && (
            <p className="text-[10px] text-white/40">{card.primary.sublabel}</p>
          )}
          {card.secondary && (
            <p className="mt-1 text-[11px] text-white/50">{card.secondary}</p>
          )}
        </div>
      ))}
    </div>
  )
}
