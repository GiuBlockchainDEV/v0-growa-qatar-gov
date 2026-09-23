import type {
  ClimateSummary,
  EnergySummary,
  NationalStatusDomain,
  ProductionSummary,
  SupplySummary,
  WatchtowerSummary,
  WaterSummary,
  MetricSummary,
  OutlookSummary,
} from '@/lib/domain/types'
import type { WatchtowerTimeframe } from '@/lib/domain/types'
import { timeframeComparisonLabel } from '@/lib/domain/timeframes'
import { generateSituationChanges } from '@/lib/watchtower/changes-engine'
import { fetchWatchtowerRawData } from '@/lib/watchtower/fetch-context-data'
import { generateIntelligenceSignals } from '@/lib/watchtower/signals-engine'
import { buildDataQualityStatus, buildSourceStatus } from '@/lib/watchtower/source-health'
import { buildHarvestProductionSnapshot } from '@/lib/watchtower/production-metrics'

function metric(
  value: number | null,
  unit: string,
  label: string,
  source: string,
  options?: Partial<MetricSummary>
): MetricSummary {
  return {
    value,
    unit,
    label,
    source,
    timestamp: new Date().toISOString(),
    ...options,
  }
}

function classifyFromSignals(
  domain: NationalStatusDomain['domain'],
  signals: ReturnType<typeof generateIntelligenceSignals>,
  hasData: boolean
): NationalStatusDomain {
  const domainSignals = signals.filter((signal) => {
    if (domain === 'production') return signal.type === 'production' || signal.type === 'crop_health'
    if (domain === 'water') return signal.type === 'water'
    if (domain === 'climate') return signal.type === 'weather'
    if (domain === 'crop_health') return signal.type === 'crop_health'
    if (domain === 'supply') return signal.type === 'supply'
    return false
  }).filter((signal) => signal.type !== 'data_quality')

  if (!hasData) {
    return {
      domain,
      level: 'unknown',
      reason: 'Insufficient data to determine status',
      comparisonPeriod: timeframeComparisonLabel('7d'),
    }
  }

  if (domainSignals.some((s) => s.severity === 'critical')) {
    return {
      domain,
      level: 'critical',
      reason: domainSignals[0]?.summary || 'Critical signal detected',
      affectedEntityCount: domainSignals[0]?.pointIds?.length || domainSignals[0]?.farmIds?.length,
      comparisonPeriod: timeframeComparisonLabel('7d'),
      confidence: domainSignals[0]?.confidence,
    }
  }

  if (domainSignals.some((s) => s.severity === 'high')) {
    return {
      domain,
      level: 'high',
      reason: domainSignals[0]?.summary || 'Elevated risk detected',
      affectedEntityCount: domainSignals[0]?.pointIds?.length || domainSignals[0]?.farmIds?.length,
      comparisonPeriod: timeframeComparisonLabel('7d'),
      confidence: domainSignals[0]?.confidence,
    }
  }

  if (domainSignals.some((s) => s.severity === 'attention')) {
    return {
      domain,
      level: 'attention',
      reason: domainSignals[0]?.summary || 'Requires monitoring',
      affectedEntityCount: domainSignals[0]?.pointIds?.length,
      comparisonPeriod: timeframeComparisonLabel('7d'),
      confidence: domainSignals[0]?.confidence,
    }
  }

  return {
    domain,
    level: 'normal',
    reason: 'No elevated signals in current window',
    comparisonPeriod: timeframeComparisonLabel('7d'),
    confidence: 0.8,
  }
}

function buildOutlook(
  data: Awaited<ReturnType<typeof fetchWatchtowerRawData>>,
  harvestSnapshot: ReturnType<typeof buildHarvestProductionSnapshot>
): OutlookSummary {
  const availableWeather = data.weatherSamples.filter((s) => s.available)
  const maxTemp = availableWeather.length > 0 ? Math.max(...availableWeather.map((s) => s.temperature ?? 0)) : null
  const maxVpd = availableWeather.length > 0 ? Math.max(...availableWeather.map((s) => s.vpd ?? 0)) : null
  const maxEt0 = availableWeather.length > 0 ? Math.max(...availableWeather.map((s) => s.et0 ?? 0)) : null

  const sevenDay: OutlookSummary['sevenDay'] = {}

  if (data.weatherAvailable && maxTemp !== null) {
    sevenDay.climate =
      maxTemp > 42
        ? 'Elevated heat stress likely to persist — monitor irrigation and crop stress.'
        : 'Climate conditions within typical range for the observation window.'
    sevenDay.operationalRisk =
      (maxVpd ?? 0) > 2
        ? 'High VPD may increase transpiration demand and spray drift risk.'
        : 'No acute operational weather risk detected.'
    sevenDay.irrigationDemand =
      (maxEt0 ?? 0) > 5
        ? 'ET0 levels suggest sustained irrigation requirement.'
        : 'Irrigation demand within expected seasonal range.'
    sevenDay.cropStress =
      maxTemp > 40 || (maxVpd ?? 0) > 2.2
        ? 'Crop stress indicators elevated in sampled zones.'
        : 'Crop stress indicators stable.'
  } else {
    sevenDay.climate = 'Insufficient weather data'
    sevenDay.irrigationDemand = 'Insufficient weather data'
    sevenDay.cropStress = 'Insufficient weather data'
    sevenDay.operationalRisk = 'Insufficient weather data'
  }

  const thirtyDay: OutlookSummary['thirtyDay'] = {}
  if (harvestSnapshot.fieldCount > 0) {
    const biomass =
      harvestSnapshot.forecastBiomassTons !== null
        ? `${harvestSnapshot.forecastBiomassTons.toLocaleString('en-US', { maximumFractionDigits: 1 })} t biomass`
        : 'biomass forecast pending'
    thirtyDay.harvest = `${harvestSnapshot.fieldCount} fields · ${harvestSnapshot.cropCount} crop types`
    thirtyDay.production = `Forecast ${biomass}${data.harvestDemo ? ' (demo model)' : ''}.`
  }

  if (data.insights.length > 0) {
    const totalWater = data.insights.reduce((sum, row) => sum + row.waterConsumptionM3, 0)
    thirtyDay.waterRequirement = `${totalWater.toLocaleString('en-US', { maximumFractionDigits: 0 })} m³ tracked across monitored parcels.`
  }

  if (data.supplyAvailable) {
    thirtyDay.supplyImplications = data.supply?.at_risk_deliveries_count
      ? `${data.supply.at_risk_deliveries_count} delivery lot(s) may affect near-term coverage.`
      : `${(data.supply?.available_contract_volume_tons ?? 0).toLocaleString('en-US')} t contract volume available.`
  }

  return { sevenDay, thirtyDay }
}

export async function buildWatchtowerSummary(timeframe: WatchtowerTimeframe): Promise<WatchtowerSummary> {
  const data = await fetchWatchtowerRawData()
  const harvestSnapshot = buildHarvestProductionSnapshot(data)
  const signals = generateIntelligenceSignals(data).filter((signal) => signal.type !== 'data_quality')
  const changes = generateSituationChanges(data, signals)

  const insightProduction = data.insights.reduce((sum, row) => sum + row.estimatedProductionTons, 0)
  const totalProduction = insightProduction > 0 ? insightProduction : harvestSnapshot.forecastBiomassTons ?? 0
  const totalWater = data.insights.reduce((sum, row) => sum + row.waterConsumptionM3, 0)
  const totalEnergy = data.insights.reduce((sum, row) => sum + row.energyConsumptionKwh, 0)
  const waterIntensity = totalProduction > 0 ? totalWater / totalProduction : null
  const energyIntensity = totalProduction > 0 ? totalEnergy / totalProduction : null

  const waterSignal = signals.find((s) => s.type === 'water')
  const energySignal = signals.find((s) => s.type === 'energy')
  const weatherSignal = signals.find((s) => s.type === 'weather')

  const highWaterPoints = waterSignal?.pointIds?.length ?? 0
  const highEnergyPoints = energySignal?.pointIds?.length ?? 0

  const atRiskCount =
    harvestSnapshot.lowHealthPolygonCount > 0
      ? harvestSnapshot.lowHealthPolygonCount
      : signals
          .filter((s) => s.type === 'crop_health' || s.type === 'production')
          .reduce((sum, s) => sum + (s.pointIds?.length || s.parcelIds?.length || 0), 0) || null

  const production: ProductionSummary = {
    productionEstimate: metric(
      totalProduction > 0 ? totalProduction : null,
      't',
      insightProduction > 0 ? 'Observed production' : 'Forecast biomass',
      insightProduction > 0 ? 'operations.farm_crop_insights' : 'harvest.analytics.predict',
      { sourceMode: totalProduction > 0 ? (data.harvestDemo ? 'demo' : 'live') : 'unavailable' }
    ),
    forecast: metric(
      harvestSnapshot.forecastBiomassTons,
      't',
      'Forecast biomass (TBP)',
      'harvest.analytics.predict',
      { sourceMode: harvestSnapshot.forecastBiomassTons ? (data.harvestDemo ? 'demo' : 'live') : 'unavailable' }
    ),
    atRiskProduction: metric(
      atRiskCount,
      atRiskCount === 1 ? 'field' : 'fields',
      'Below health threshold',
      'watchtower.signals',
      { sourceMode: atRiskCount ? 'live' : 'unavailable' }
    ),
    fieldsMonitored: metric(
      harvestSnapshot.fieldCount > 0 ? harvestSnapshot.fieldCount : null,
      harvestSnapshot.fieldCount === 1 ? 'field' : 'fields',
      'Fields monitored',
      'harvest.analytics.predict',
      { sourceMode: harvestSnapshot.fieldCount > 0 ? (data.harvestDemo ? 'demo' : 'live') : 'unavailable' }
    ),
    cropTypes: metric(
      harvestSnapshot.cropCount > 0 ? harvestSnapshot.cropCount : null,
      harvestSnapshot.cropCount === 1 ? 'crop' : 'crops',
      'Crop types',
      'harvest.analytics.predict'
    ),
    avgHealthScore: metric(
      harvestSnapshot.avgPolygonScore,
      '/100',
      'Avg vegetation score',
      'operations.polygons',
      { sourceMode: harvestSnapshot.avgPolygonScore ? 'live' : 'unavailable' }
    ),
  }

  const water: WaterSummary = {
    totalDemand: metric(totalWater > 0 ? totalWater : null, 'm³', 'Total water demand', 'operations.farm_crop_insights'),
    intensityM3PerTon: metric(waterIntensity, 'm³/t', 'Water intensity', 'operations.farm_crop_insights', {
      deviationPercent: waterSignal?.deviationPercent ?? null,
      comparisonLabel: timeframeComparisonLabel(timeframe),
    }),
    highPressureFarms: highWaterPoints,
  }

  const energy: EnergySummary = {
    totalConsumption: metric(totalEnergy > 0 ? totalEnergy : null, 'kWh', 'Total energy consumption', 'operations.farm_crop_insights'),
    intensityKwhPerTon: metric(energyIntensity, 'kWh/t', 'Energy intensity', 'operations.farm_crop_insights', {
      deviationPercent: energySignal?.deviationPercent ?? null,
    }),
    anomalousSites: highEnergyPoints,
  }

  const maxTemp = data.weatherSamples.reduce((max, s) => Math.max(max, s.temperature ?? 0), 0)
  const maxVpd = data.weatherSamples.reduce((max, s) => Math.max(max, s.vpd ?? 0), 0)

  const climate: ClimateSummary = {
    heatRisk: metric(
      data.weatherAvailable && maxTemp > 0 ? maxTemp : null,
      '°C',
      'Peak temperature (sampled)',
      'weather.api',
      { sourceMode: data.weatherAvailable ? 'live' : 'unavailable' }
    ),
    waterStress: metric(
      data.weatherAvailable && maxVpd > 0 ? maxVpd : null,
      'kPa',
      'Peak VPD (sampled)',
      'weather.api',
      { sourceMode: data.weatherAvailable ? 'live' : 'unavailable' }
    ),
    diseaseRisk: metric(
      weatherSignal ? 1 : 0,
      'signals',
      'Active weather risk signals',
      'watchtower.signals'
    ),
  }

  const supply: SupplySummary = {
    availableVolume: metric(
      data.supply?.available_contract_volume_tons ?? null,
      't',
      'Available contract volume',
      'supply_overview_snapshots',
      { sourceMode: data.supplyAvailable ? 'live' : 'unavailable' }
    ),
    atRiskDeliveries: metric(
      data.supply?.at_risk_deliveries_count ?? null,
      'lots',
      'At-risk deliveries',
      'supply_overview_snapshots',
      { sourceMode: data.supplyAvailable ? 'live' : 'unavailable' }
    ),
  }

  const nationalStatus: NationalStatusDomain[] = [
    classifyFromSignals('production', signals, data.insights.length > 0 || data.harvestFields.length > 0),
    classifyFromSignals('water', signals, data.insights.length > 0),
    classifyFromSignals('climate', signals, data.weatherAvailable),
    classifyFromSignals('supply', signals, data.supplyAvailable),
  ].map((status) => ({
    ...status,
    lastUpdated: data.fetchedAt,
    comparisonPeriod: timeframeComparisonLabel(timeframe),
    sourceMode: data.harvestDemo ? 'demo' : 'live',
  }))

  return {
    generatedAt: data.fetchedAt,
    timeframe,
    nationalStatus,
    signals: signals.slice(0, 20),
    changes: changes.slice(0, 10),
    production,
    water,
    energy,
    climate,
    supply,
    outlook: buildOutlook(data, harvestSnapshot),
    dataQuality: buildDataQualityStatus(data),
    sourceStatus: buildSourceStatus(data),
    isDemo: data.harvestDemo,
  }
}
