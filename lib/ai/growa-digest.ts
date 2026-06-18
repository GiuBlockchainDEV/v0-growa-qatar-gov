import type { GrowaAnalysisContext, GrowaModule } from './growa-types'
import { getGrowaModuleTitle } from './growa-prompts'

function formatMetric(value: number, suffix = '', digits = 2) {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: digits })}${suffix}`
}

function moduleFocusLines(context: GrowaAnalysisContext): string[] {
  const { module, headline } = context

  if (module === 'water-intelligence') {
    return [
      `- National water intensity: ${formatMetric(headline.waterIntensityM3PerTon ?? 0, ' m³/t')}`,
      `- Irrigation pressure (water share of total resources): ${formatMetric(headline.irrigationPressurePercent ?? 0, '%', 1)}`,
      `- Highest water-intensity crops: ${context.rankings.highestWaterIntensityCrops.join(', ') || 'n/a'}`,
      `- Lowest water-intensity crops: ${context.rankings.lowestWaterIntensityCrops.join(', ') || 'n/a'}`,
    ]
  }

  if (module === 'energy-intelligence') {
    return [
      `- National energy intensity: ${formatMetric(headline.energyPerTonKwh ?? 0, ' kWh/t')}`,
      `- Average energy per farm: ${formatMetric(headline.averageEnergyPerFarmKwh ?? 0, ' kWh')}`,
      `- Highest energy-intensity crops: ${context.rankings.highestEnergyIntensityCrops.join(', ') || 'n/a'}`,
      `- Lowest energy-intensity crops: ${context.rankings.lowestEnergyIntensityCrops.join(', ') || 'n/a'}`,
    ]
  }

  return [
    `- Resource intensity per ton: ${formatMetric(headline.resourceIntensityPerTon, ' resource-units/t')}`,
    `- Production efficiency: ${formatMetric(headline.productionEfficiency, ' t/resource-unit', 4)}`,
    `- Efficiency spread (best vs worst producer): ${formatMetric(headline.efficiencySpread, '', 4)}`,
    `- Top crop by production: ${headline.topCropByProduction || 'n/a'}`,
  ]
}

export function buildGrowaDigest(context: GrowaAnalysisContext): string {
  const { headline, crops, topProducers, atRiskProducers, alerts } = context
  const workspace = getGrowaModuleTitle(context.module)

  const cropLines = crops.map(
    (crop) =>
      `  • ${crop.cropName}: production ${formatMetric(crop.totalProductionTons, ' t')} (${formatMetric(crop.productionSharePercent, '%', 1)} share), water ${formatMetric(crop.totalWaterM3, ' m³')} (${formatMetric(crop.waterSharePercent, '%', 1)}), energy ${formatMetric(crop.totalEnergyKwh, ' kWh')} (${formatMetric(crop.energySharePercent, '%', 1)}), score ${formatMetric(crop.averageScore, '/100', 1)}, farms ${crop.farmsCount}, polygons ${crop.polygonsCount}, water intensity ${formatMetric(crop.waterIntensityM3PerTon, ' m³/t')}, energy intensity ${formatMetric(crop.energyIntensityKwhPerTon, ' kWh/t')}`
  )

  const topProducerLines = topProducers.map(
    (producer, index) =>
      `  ${index + 1}. ${producer.name}: efficiency ${formatMetric(producer.efficiencyScore, '', 4)}, production ${formatMetric(producer.productionTons, ' t')} (${formatMetric(producer.productionSharePercent, '%', 1)}), water ${formatMetric(producer.totalWaterM3, ' m³')}, energy ${formatMetric(producer.totalEnergyKwh, ' kWh')}, score ${formatMetric(producer.averagePolygonScore, '/100', 1)}, crops [${producer.crops.join(', ')}]`
  )

  const atRiskLines = atRiskProducers.map(
    (producer, index) =>
      `  ${index + 1}. ${producer.name}: efficiency ${formatMetric(producer.efficiencyScore, '', 4)}, production ${formatMetric(producer.productionTons, ' t')}, water intensity ${formatMetric(producer.waterIntensityM3PerTon, ' m³/t')}, energy intensity ${formatMetric(producer.energyIntensityKwhPerTon, ' kWh/t')}, score ${formatMetric(producer.averagePolygonScore, '/100', 1)}, polygons ${producer.polygonCount}`
  )

  return [
    `GROWA OPERATIONAL DIGEST`,
    `Workspace: ${workspace}`,
    `Snapshot time: ${context.generatedAt}`,
    ``,
    `NATIONAL HEADLINE`,
    `- Tracked crops: ${headline.cropCount}`,
    `- Tracked producers: ${headline.producerCount}`,
    `- Tracked polygons: ${headline.trackedPolygons}`,
    `- Total production: ${formatMetric(headline.totalProductionTons, ' t')}`,
    `- Total water: ${formatMetric(headline.totalWaterM3, ' m³')}`,
    `- Total energy: ${formatMetric(headline.totalEnergyKwh, ' kWh')}`,
    `- Average polygon score: ${formatMetric(headline.averagePolygonScore, '/100', 1)}`,
    `- Top producer by efficiency: ${headline.topProducerByEfficiency || 'n/a'}`,
    `- Lowest producer by efficiency: ${headline.lowestProducerByEfficiency || 'n/a'}`,
    ...moduleFocusLines(context),
    ``,
    `CROP MATRIX`,
    ...(cropLines.length > 0 ? cropLines : ['  • No crop rows available']),
    ``,
    `TOP PRODUCERS (EFFICIENCY)`,
    ...(topProducerLines.length > 0 ? topProducerLines : ['  • No producer rankings available']),
    ``,
    `AT-RISK PRODUCERS (LOW EFFICIENCY / HIGH PRESSURE)`,
    ...(atRiskLines.length > 0 ? atRiskLines : ['  • No at-risk producers flagged']),
    ``,
    `DATA ALERTS`,
    `- Zero-production crops: ${alerts.zeroProductionCrops.join(', ') || 'none'}`,
    `- Crops without polygons: ${alerts.zeroPolygonCrops.join(', ') || 'none'}`,
    `- Zero-production producers: ${alerts.zeroProductionProducers.join(', ') || 'none'}`,
    `- Low-score producers (<40/100): ${alerts.lowScoreProducers.join(', ') || 'none'}`,
    `- High water-intensity producers: ${alerts.highWaterIntensityProducers.join(', ') || 'none'}`,
    `- High energy-intensity producers: ${alerts.highEnergyIntensityProducers.join(', ') || 'none'}`,
  ].join('\n')
}

export function getModuleAnalysisFramework(module: GrowaModule): string {
  if (module === 'water-intelligence') {
    return `Analysis framework:
1. Quantify national water burden using totalWaterM3, waterIntensityM3PerTon, and irrigationPressurePercent.
2. Compare crops using waterIntensityM3PerTon, waterSharePercent, polygonsCount, and averageScore.
3. Identify producers driving water risk using totalWaterM3, waterIntensityM3PerTon, and atRiskProducers.
4. Separate structural water demand (high-production crops) from inefficiency (high m³/t with low score).
5. Recommend targeted ministry actions with measurable KPIs tied to the cited metrics.`
  }

  if (module === 'energy-intelligence') {
    return `Analysis framework:
1. Quantify national energy burden using totalEnergyKwh, energyPerTonKwh, and averageEnergyPerFarmKwh.
2. Compare crops using energyIntensityKwhPerTon, energySharePercent, productionSharePercent, and averageScore.
3. Identify producers driving grid pressure using totalEnergyKwh, energyIntensityKwhPerTon, and atRiskProducers.
4. Distinguish energy-intensive but productive systems from low-output/high-energy outliers.
5. Recommend decarbonization and efficiency actions with KPIs tied to the cited metrics.`
  }

  return `Analysis framework:
1. Quantify national performance using totalProductionTons, averagePolygonScore, resourceIntensityPerTon, and productionEfficiency.
2. Compare crop families using productionSharePercent, averageScore, water/energy intensity, farmsCount, and polygonsCount.
3. Contrast topProducers vs atRiskProducers using efficiencyScore, productionTons, resourceIntensity, and cropVarietyCount.
4. Flag structural food-security risks vs operational inefficiency using alerts and rankings.
5. Recommend government interventions with measurable KPIs tied to the cited metrics.`
}
