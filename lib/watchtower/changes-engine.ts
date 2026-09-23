import type { SituationChange } from '@/lib/domain/types'
import type { WatchtowerRawData } from '@/lib/watchtower/fetch-context-data'
import type { IntelligenceSignal } from '@/lib/domain/types'

export function generateSituationChanges(
  data: WatchtowerRawData,
  signals: IntelligenceSignal[]
): SituationChange[] {
  const changes: SituationChange[] = []

  const insightProduction = data.insights.reduce((sum, row) => sum + row.estimatedProductionTons, 0)
  const harvestProduction = data.harvestFields.reduce((sum, field) => sum + (field.metrics?.tbp ?? 0), 0)
  const totalProduction = insightProduction > 0 ? insightProduction : harvestProduction
  const avgPolygonScore =
    data.polygons.length > 0
      ? data.polygons.reduce((sum, polygon) => sum + polygon.score, 0) / data.polygons.length
      : null

  if (totalProduction > 0) {
    changes.push({
      id: 'change-production-total',
      domain: 'production',
      direction: 'stable',
      significance: 'medium',
      description: insightProduction > 0
        ? `Observed production at ${totalProduction.toLocaleString('en-US', { maximumFractionDigits: 1 })} t across ${data.insights.length} monitored parcel(s).`
        : `Forecast biomass at ${totalProduction.toLocaleString('en-US', { maximumFractionDigits: 1 })} t across ${data.harvestFields.length} harvest field(s).`,
      currentValue: totalProduction,
      entityCount: insightProduction > 0
        ? new Set(data.insights.map((row) => row.pointId)).size
        : data.harvestFields.length,
      deepLink: insightProduction > 0 ? '/dashboard?module=data-analytics' : '/dashboard?module=harvest',
    })
  }

  const waterSignal = signals.find((signal) => signal.id.startsWith('water-'))
  if (waterSignal) {
    changes.push({
      id: 'change-water-pressure',
      domain: 'water',
      direction: 'up',
      significance: waterSignal.severity === 'high' ? 'high' : 'medium',
      description: 'Irrigation pressure increasing relative to production baseline.',
      currentValue: waterSignal.currentValue,
      previousValue: waterSignal.baselineValue,
      entityCount: waterSignal.pointIds?.length,
      deepLink: waterSignal.deepLink,
    })
  }

  const cropSignal = signals.find((signal) => signal.type === 'crop_health')
  if (cropSignal) {
    changes.push({
      id: 'change-crop-health',
      domain: 'crop_health',
      direction: 'down',
      significance: 'high',
      description: 'Vegetation health indicators declining in monitored polygons.',
      currentValue: cropSignal.currentValue,
      entityCount: cropSignal.pointIds?.length,
      deepLink: cropSignal.deepLink,
    })
  }

  if (avgPolygonScore !== null) {
    changes.push({
      id: 'change-avg-score',
      domain: 'crop_health',
      direction: avgPolygonScore < 50 ? 'down' : 'stable',
      significance: avgPolygonScore < 50 ? 'medium' : 'low',
      description: `Average polygon health score: ${avgPolygonScore.toFixed(1)}/100.`,
      currentValue: avgPolygonScore,
      deepLink: '/dashboard?module=harvest',
    })
  }

  const weatherSignal = signals.find((signal) => signal.type === 'weather')
  if (weatherSignal) {
    changes.push({
      id: 'change-climate-risk',
      domain: 'climate',
      direction: 'up',
      significance: 'high',
      description: 'Short-term agronomic weather risk elevated.',
      currentValue: weatherSignal.currentValue,
      deepLink: weatherSignal.deepLink,
    })
  }

  if (data.supply?.at_risk_deliveries_count) {
    changes.push({
      id: 'change-supply-risk',
      domain: 'supply',
      direction: 'up',
      significance: data.supply.at_risk_deliveries_count >= 3 ? 'high' : 'medium',
      description: `${data.supply.at_risk_deliveries_count} supply delivery lot(s) at risk.`,
      currentValue: data.supply.at_risk_deliveries_count,
      deepLink: '/dashboard/supply-overview',
    })
  }

  if (data.harvestDemo) {
    changes.push({
      id: 'change-demo-mode',
      domain: 'data_quality',
      direction: 'new',
      significance: 'medium',
      description: 'Harvest satellite intelligence running in demo mode — live credentials not configured.',
      deepLink: '/dashboard?module=watchtower',
    })
  }

  if (changes.length === 0) {
    changes.push({
      id: 'change-no-significant',
      domain: 'platform',
      direction: 'stable',
      significance: 'low',
      description: 'No significant changes detected in the current observation window.',
    })
  }

  return changes
}
