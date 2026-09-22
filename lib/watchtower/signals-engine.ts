import type { IntelligenceSignal } from '@/lib/domain/types'
import { signalRecommendedModule } from '@/lib/dashboard/operational-navigation'
import { SIGNAL_RULES } from '@/lib/watchtower/config/signal-rules'
import type { WatchtowerRawData } from '@/lib/watchtower/fetch-context-data'

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function createSignalId(prefix: string, key: string) {
  return `${prefix}-${key}`
}

export function generateIntelligenceSignals(data: WatchtowerRawData): IntelligenceSignal[] {
  const signals: IntelligenceSignal[] = []
  const now = data.fetchedAt

  // Water intensity anomalies
  const waterIntensities = data.insights
    .filter((row) => row.estimatedProductionTons > 0)
    .map((row) => ({
      pointId: row.pointId,
      crop: row.cropName,
      intensity: row.waterConsumptionM3 / row.estimatedProductionTons,
    }))
    .filter((row) => row.intensity > 0)

  if (waterIntensities.length >= SIGNAL_RULES.water.minDataPoints) {
    const baseline = median(waterIntensities.map((row) => row.intensity))
    const threshold = baseline * SIGNAL_RULES.water.threshold
    const affected = waterIntensities.filter((row) => row.intensity > threshold)

    if (affected.length > 0) {
      const avgDeviation =
        affected.reduce((sum, row) => sum + ((row.intensity - baseline) / baseline) * 100, 0) / affected.length
      signals.push({
        id: createSignalId('water', 'intensity-anomaly'),
        type: 'water',
        severity: avgDeviation > 30 ? 'high' : 'attention',
        title: 'Water demand anomaly',
        summary: `Irrigation intensity +${avgDeviation.toFixed(0)}% vs cohort baseline across ${affected.length} producer(s).`,
        detectedAt: now,
        updatedAt: now,
        pointIds: affected.map((row) => row.pointId),
        metric: SIGNAL_RULES.water.metric,
        currentValue: affected[0].intensity,
        baselineValue: baseline,
        deviationPercent: avgDeviation,
        confidence: SIGNAL_RULES.water.confidenceBase,
        recommendedModule: signalRecommendedModule('water'),
        deepLink: `/dashboard?module=water-intelligence&signalId=${createSignalId('water', 'intensity-anomaly')}`,
        sourceMode: 'live',
      })
    }
  }

  // Energy intensity anomalies
  const energyIntensities = data.insights
    .filter((row) => row.estimatedProductionTons > 0)
    .map((row) => ({
      pointId: row.pointId,
      intensity: row.energyConsumptionKwh / row.estimatedProductionTons,
    }))
    .filter((row) => row.intensity > 0)

  if (energyIntensities.length >= SIGNAL_RULES.energy.minDataPoints) {
    const baseline = median(energyIntensities.map((row) => row.intensity))
    const threshold = baseline * SIGNAL_RULES.energy.threshold
    const affected = energyIntensities.filter((row) => row.intensity > threshold)

    if (affected.length > 0) {
      const avgDeviation =
        affected.reduce((sum, row) => sum + ((row.intensity - baseline) / baseline) * 100, 0) / affected.length
      signals.push({
        id: createSignalId('energy', 'intensity-anomaly'),
        type: 'energy',
        severity: avgDeviation > 35 ? 'high' : 'attention',
        title: 'Energy intensity anomaly',
        summary: `${affected.length} site(s) exceed energy intensity baseline by ${avgDeviation.toFixed(0)}%.`,
        detectedAt: now,
        updatedAt: now,
        pointIds: affected.map((row) => row.pointId),
        metric: SIGNAL_RULES.energy.metric,
        currentValue: affected[0].intensity,
        baselineValue: baseline,
        deviationPercent: avgDeviation,
        confidence: SIGNAL_RULES.energy.confidenceBase,
        recommendedModule: signalRecommendedModule('energy'),
        deepLink: `/dashboard?module=energy-intelligence&signalId=${createSignalId('energy', 'intensity-anomaly')}`,
        sourceMode: 'live',
      })
    }
  }

  // Crop health from polygon scores
  const lowScorePolygons = data.polygons.filter((polygon) => polygon.score < SIGNAL_RULES.cropHealth.threshold)
  if (lowScorePolygons.length > 0) {
    const avgScore = lowScorePolygons.reduce((sum, polygon) => sum + polygon.score, 0) / lowScorePolygons.length
    signals.push({
      id: createSignalId('crop', 'low-health'),
      type: 'crop_health',
      severity: lowScorePolygons.length >= 5 ? 'high' : 'attention',
      title: 'Declining vegetation indicators',
      summary: `${lowScorePolygons.length} polygon(s) below health score threshold (avg ${avgScore.toFixed(0)}/100).`,
      detectedAt: now,
      updatedAt: now,
      pointIds: [...new Set(lowScorePolygons.map((polygon) => polygon.pointId))],
      metric: SIGNAL_RULES.cropHealth.metric,
      currentValue: avgScore,
      baselineValue: SIGNAL_RULES.cropHealth.threshold,
      confidence: SIGNAL_RULES.cropHealth.confidenceBase,
      recommendedModule: signalRecommendedModule('crop_health'),
      deepLink: `/dashboard?module=harvest&signalId=${createSignalId('crop', 'low-health')}&mapLayer=crop-health`,
      sourceMode: 'live',
    })
  }

  // Harvest BWP elevation
  const elevatedBwp = data.harvestFields.filter((field) => (field.metrics?.bwp ?? 0) > SIGNAL_RULES.harvestBwp.threshold)
  if (elevatedBwp.length > 0 && data.harvestAvailable) {
    signals.push({
      id: createSignalId('harvest', 'bwp-elevated'),
      type: 'production',
      severity: 'attention',
      title: 'Elevated biomass water productivity variance',
      summary: `${elevatedBwp.length} field(s) show elevated BWP — review irrigation and biomass balance.`,
      detectedAt: now,
      updatedAt: now,
      parcelIds: elevatedBwp.map((field) => field.parcel_id),
      metric: SIGNAL_RULES.harvestBwp.metric,
      currentValue: elevatedBwp[0].metrics?.bwp,
      baselineValue: SIGNAL_RULES.harvestBwp.threshold,
      confidence: SIGNAL_RULES.harvestBwp.confidenceBase,
      recommendedModule: signalRecommendedModule('production'),
      deepLink: `/dashboard?module=harvest&signalId=${createSignalId('harvest', 'bwp-elevated')}`,
      sourceMode: data.harvestDemo ? 'demo' : 'live',
    })
  }

  // Weather risks
  const weatherRisks = data.weatherSamples.filter(
    (sample) =>
      sample.available &&
      ((sample.vpd ?? 0) > SIGNAL_RULES.weatherVpd.threshold ||
        (sample.temperature ?? 0) > SIGNAL_RULES.weatherHeat.threshold)
  )

  if (weatherRisks.length > 0 && data.weatherAvailable) {
    const maxTemp = Math.max(...weatherRisks.map((sample) => sample.temperature ?? 0))
    const maxVpd = Math.max(...weatherRisks.map((sample) => sample.vpd ?? 0))
    signals.push({
      id: createSignalId('weather', 'agronomic-risk'),
      type: 'weather',
      severity: maxTemp > 45 || maxVpd > 2.5 ? 'high' : 'attention',
      title: 'Agronomic weather risk',
      summary: `Elevated heat/VPD detected across ${weatherRisks.length} monitoring zone(s). Max temp ${maxTemp.toFixed(1)}°C, VPD ${maxVpd.toFixed(1)} kPa.`,
      detectedAt: now,
      updatedAt: now,
      lat: weatherRisks[0].lat,
      lng: weatherRisks[0].lng,
      metric: 'vpd_kpa / temperature_c',
      currentValue: maxVpd,
      baselineValue: SIGNAL_RULES.weatherVpd.threshold,
      confidence: SIGNAL_RULES.weatherVpd.confidenceBase,
      recommendedModule: signalRecommendedModule('weather'),
      deepLink: `/dashboard?module=weather&signalId=${createSignalId('weather', 'agronomic-risk')}`,
      sourceMode: 'live',
    })
  }

  // Supply at-risk deliveries
  if (data.supplyAvailable && (data.supply?.at_risk_deliveries_count ?? 0) > 0) {
    signals.push({
      id: createSignalId('supply', 'at-risk-deliveries'),
      type: 'supply',
      severity: (data.supply?.at_risk_deliveries_count ?? 0) >= 3 ? 'high' : 'attention',
      title: 'Supply delivery risk',
      summary: `${data.supply?.at_risk_deliveries_count} delivery lot(s) flagged at risk in supply overview.`,
      detectedAt: now,
      updatedAt: now,
      metric: 'at_risk_deliveries',
      currentValue: data.supply?.at_risk_deliveries_count ?? 0,
      confidence: 0.9,
      recommendedModule: signalRecommendedModule('supply'),
      deepLink: '/dashboard/supply-overview',
      sourceMode: 'live',
    })
  }

  // Data quality signals
  const farmsWithoutGps = data.farms.filter(
    (farm) => farm.gps_latitude == null || farm.gps_longitude == null
  )
  if (farmsWithoutGps.length >= SIGNAL_RULES.gpsMissing.threshold) {
    signals.push({
      id: createSignalId('data', 'missing-gps'),
      type: 'data_quality',
      severity: 'attention',
      title: 'Farm geolocation gaps',
      summary: `${farmsWithoutGps.length} farm record(s) missing GPS coordinates — map fly-to unavailable.`,
      detectedAt: now,
      updatedAt: now,
      farmIds: farmsWithoutGps.map((farm) => farm.id),
      metric: SIGNAL_RULES.gpsMissing.metric,
      currentValue: farmsWithoutGps.length,
      confidence: 1,
      recommendedModule: 'watchtower',
      deepLink: `/dashboard?module=watchtower&signalId=${createSignalId('data', 'missing-gps')}`,
      sourceMode: 'live',
    })
  }

  if (!data.harvestAvailable) {
    signals.push({
      id: createSignalId('data', 'harvest-unavailable'),
      type: 'data_quality',
      severity: 'attention',
      title: 'Harvest intelligence unavailable',
      summary: 'Satellite harvest analytics could not be loaded. Crop health signals may be incomplete.',
      detectedAt: now,
      updatedAt: now,
      confidence: 1,
      recommendedModule: 'watchtower',
      sourceMode: 'unavailable',
    })
  }

  if (!data.weatherAvailable) {
    signals.push({
      id: createSignalId('data', 'weather-unavailable'),
      type: 'data_quality',
      severity: 'attention',
      title: 'Weather intelligence unavailable',
      summary: 'Climate risk assessment is degraded — weather API not reachable or not configured.',
      detectedAt: now,
      updatedAt: now,
      confidence: 1,
      recommendedModule: 'weather',
      sourceMode: 'unavailable',
    })
  }

  return signals.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, attention: 2, info: 3 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}
