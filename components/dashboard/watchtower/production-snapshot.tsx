'use client'

import type { ProductionSummary, SupplySummary, ClimateSummary } from '@/lib/domain/types'
import { humanizeMetricSource } from '@/lib/watchtower/production-metrics'
import { Tile } from '@/components/brand/layout'
import { Metric, StatusDot } from '@/components/brand/ui'
import { useI18n } from '@/lib/i18n'

/* Number and unit kept apart: the brand sets the figure LIGHT and large,
   the unit small beside it (Brand Book p.80). */
function formatValue(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  return { number: value.toLocaleString('en-US', { maximumFractionDigits: 1 }), unit }
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
  const { tr } = useI18n()
  // Labels, units and source names below come from the server in English.
  const trSource = (source: string) => tr(humanizeMetricSource(source))
  const cards = [
    {
      label: tr(production.productionEstimate.label),
      value: formatValue(production.productionEstimate.value, production.productionEstimate.unit),
      detail: trSource(production.productionEstimate.source),
      highlight: Boolean(production.productionEstimate.value),
    },
    {
      label: tr(production.fieldsMonitored?.label || 'Fields monitored'),
      value: formatValue(production.fieldsMonitored?.value ?? null, tr(production.fieldsMonitored?.unit || 'fields')),
      detail: production.cropTypes?.value
        ? tr('{count} crop types tracked', { count: production.cropTypes.value })
        : trSource(production.fieldsMonitored?.source || 'harvest.analytics.predict'),
      highlight: Boolean(production.fieldsMonitored?.value),
    },
    {
      label: tr(production.atRiskProduction?.label || 'Below health threshold'),
      value: formatValue(production.atRiskProduction?.value ?? null, tr(production.atRiskProduction?.unit || 'fields')),
      detail: production.avgHealthScore?.value
        ? tr('Avg score {score}/100', { score: production.avgHealthScore.value.toFixed(0) })
        : tr('From vegetation indicators'),
      highlight: Boolean(production.atRiskProduction?.value),
      warning: Boolean(production.atRiskProduction?.value),
    },
    {
      label: supply.atRiskDeliveries?.value ? tr('Supply at risk') : tr('Contract volume'),
      value: supply.atRiskDeliveries?.value
        ? formatValue(supply.atRiskDeliveries.value, tr(supply.atRiskDeliveries.unit || 'lots'))
        : formatValue(supply.availableVolume?.value ?? null, supply.availableVolume?.unit || 't'),
      detail: climate.heatRisk.value
        ? tr('Peak temp {value}°C sampled', { value: climate.heatRisk.value.toFixed(1) })
        : trSource(supply.availableVolume?.source || 'supply_overview_snapshots'),
      highlight: Boolean(supply.atRiskDeliveries?.value || supply.availableVolume?.value || climate.heatRisk.value),
      warning: Boolean(supply.atRiskDeliveries?.value),
    },
  ].filter((card) => card.value)

  if (cards.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Tile key={card.label} className="p-4" style={{ borderRadius: 'var(--radius-xl)' }}>
          <Metric
            label={
              <span className="inline-flex items-center gap-2">
                {card.warning && <StatusDot tone="warning" size={6} />}
                {card.label}
              </span>
            }
            value={card.value!.number}
            unit={card.value!.unit}
            hint={<span className="line-clamp-2">{card.detail}</span>}
          />
        </Tile>
      ))}
    </div>
  )
}
