import type { WatchtowerSummary } from '@/lib/domain/types'
import type { WatchtowerGrowaAnalysisContext } from './growa-types'

function formatMetric(value: number | null | undefined, unit = '', digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a'
  return `${value.toLocaleString('en-US', { maximumFractionDigits: digits })}${unit}`
}

export function buildWatchtowerGrowaDigest(summary: WatchtowerSummary): string {
  const statusLines = summary.nationalStatus.map(
    (status) =>
      `  • ${status.domain}: ${status.level} — ${status.reason}${status.affectedEntityCount ? ` (${status.affectedEntityCount} affected)` : ''}`
  )

  const signalLines = summary.signals.slice(0, 12).map(
    (signal) =>
      `  • [${signal.severity}] ${signal.title}: ${signal.summary}${signal.deviationPercent !== undefined ? ` (${signal.deviationPercent > 0 ? '+' : ''}${signal.deviationPercent.toFixed(0)}%)` : ''}`
  )

  const changeLines = summary.changes.map((change) => `  • ${change.domain}: ${change.description}`)

  const qualityLines = summary.dataQuality.map(
    (item) =>
      `  • ${item.source}: ${item.status}${item.coveragePercent !== undefined ? ` (${item.coveragePercent}% coverage)` : ''}`
  )

  const sourceLines = summary.sourceStatus.map(
    (source) => `  • ${source.source}: ${source.health} — ${source.message || 'checked'}`
  )

  return [
    'GROWA WATCHTOWER OPERATIONAL DIGEST',
    `Snapshot time: ${summary.generatedAt}`,
    `Timeframe: ${summary.timeframe}`,
    `Demo data active: ${summary.isDemo ? 'yes' : 'no'}`,
    '',
    'NATIONAL STATUS',
    ...(statusLines.length > 0 ? statusLines : ['  • No status domains available']),
    '',
    'STRATEGIC KPIs',
    `- Production estimate: ${formatMetric(summary.production.productionEstimate.value, ` ${summary.production.productionEstimate.unit}`)}`,
    `- Water demand: ${formatMetric(summary.water.totalDemand.value, ` ${summary.water.totalDemand.unit}`)}`,
    `- Water intensity: ${formatMetric(summary.water.intensityM3PerTon?.value, ' m³/t')}`,
    `- Energy consumption: ${formatMetric(summary.energy.totalConsumption.value, ` ${summary.energy.totalConsumption.unit}`)}`,
    `- Peak temperature: ${formatMetric(summary.climate.heatRisk.value, ' °C')}`,
    `- Peak VPD: ${formatMetric(summary.climate.waterStress?.value, ' kPa')}`,
    `- Supply volume: ${formatMetric(summary.supply.availableVolume?.value, ` ${summary.supply.availableVolume?.unit || 't'}`)}`,
    `- At-risk deliveries: ${formatMetric(summary.supply.atRiskDeliveries?.value, ' lots', 0)}`,
    '',
    'PRIORITY SIGNALS',
    ...(signalLines.length > 0 ? signalLines : ['  • No priority signals detected']),
    '',
    'WHAT CHANGED',
    ...(changeLines.length > 0 ? changeLines : ['  • No significant changes']),
    '',
    'DATA QUALITY',
    ...(qualityLines.length > 0 ? qualityLines : ['  • No quality records']),
    '',
    'SOURCE HEALTH',
    ...(sourceLines.length > 0 ? sourceLines : ['  • No source checks']),
    '',
    'OUTLOOK (7-DAY)',
    `- Climate: ${summary.outlook?.sevenDay?.climate || 'n/a'}`,
    `- Irrigation demand: ${summary.outlook?.sevenDay?.irrigationDemand || 'n/a'}`,
    `- Crop stress: ${summary.outlook?.sevenDay?.cropStress || 'n/a'}`,
    `- Operational risk: ${summary.outlook?.sevenDay?.operationalRisk || 'n/a'}`,
  ].join('\n')
}

export function buildWatchtowerGrowaContext(summary: WatchtowerSummary): WatchtowerGrowaAnalysisContext {
  const digest = buildWatchtowerGrowaDigest(summary)

  return {
    module: 'watchtower',
    generatedAt: summary.generatedAt,
    timeframe: summary.timeframe,
    usingDemoData: Boolean(summary.isDemo),
    digest,
    headline: {
      productionTons: summary.production.productionEstimate.value,
      waterDemandM3: summary.water.totalDemand.value,
      energyKwh: summary.energy.totalConsumption.value,
      peakTemperatureC: summary.climate.heatRisk.value,
      peakVpdKpa: summary.climate.waterStress?.value ?? null,
      signalCount: summary.signals.length,
      criticalDomains: summary.nationalStatus.filter((s) => s.level === 'critical' || s.level === 'high').length,
      unknownDomains: summary.nationalStatus.filter((s) => s.level === 'unknown').length,
    },
    nationalStatus: summary.nationalStatus.map((status) => ({
      domain: status.domain,
      level: status.level,
      reason: status.reason,
      affectedEntityCount: status.affectedEntityCount,
    })),
    prioritySignals: summary.signals.slice(0, 12).map((signal) => ({
      id: signal.id,
      type: signal.type,
      severity: signal.severity,
      title: signal.title,
      summary: signal.summary,
      recommendedModule: signal.recommendedModule,
    })),
    changes: summary.changes.map((change) => ({
      domain: change.domain,
      direction: change.direction,
      significance: change.significance,
      description: change.description,
    })),
    dataGaps: summary.dataQuality
      .filter((item) => item.status !== 'fresh')
      .map((item) => `${item.source}: ${item.status}`),
  }
}
