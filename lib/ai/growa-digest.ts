import { HARVEST_METRIC_META } from '@/lib/harvest/metrics'
import type { GrowaAnalysisContext, GrowaFarmAnalysisContext, GrowaModule, HarvestGrowaAnalysisContext } from './growa-types'
import { isHarvestGrowaContext } from './growa-types'
import { getGrowaModuleTitle } from './growa-prompts'

function formatMetric(value: number, suffix = '', digits = 2) {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: digits })}${suffix}`
}

function moduleFocusLines(context: GrowaFarmAnalysisContext): string[] {
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

export function buildGrowaDigest(context: GrowaFarmAnalysisContext): string {
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

export function buildHarvestGrowaDigest(context: HarvestGrowaAnalysisContext): string {
  const { headline, fields, rankings, alerts, timeseries, fieldDetail } = context

  const nationalMetricLines = (['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost'] as const)
    .map((key) => {
      const metric = headline[key]
      if (!metric) return null
      const meta = HARVEST_METRIC_META[key]
      return `  • ${meta.label}: ${formatMetric(metric.value, ` ${metric.unit}`)} (${metric.agg}, ${metric.fieldCount} fields)`
    })
    .filter(Boolean)

  const fieldLines = fields.map(
    (field) =>
      `  • ${field.name} (${field.crop}, ${formatMetric(field.areaHa, ' ha')}): AETI ${field.metrics.aeti ?? 'n/a'}, TBP ${field.metrics.tbp ?? 'n/a'}, BWP ${field.metrics.bwp ?? 'n/a'}, harvest ${field.harvest_date}${field.isCollecting ? ' [COLLECTING]' : ''}`
  )

  const timeseriesLines = (timeseries?.points || []).map(
    (point) => `  • ${point.period}: ${formatMetric(point.value, ` ${HARVEST_METRIC_META.aeti.unit}`)}`
  )

  const sections = [
    'GROWA HARVEST OPERATIONAL DIGEST',
    `Workspace: Harvest Prediction`,
    `Snapshot time: ${context.generatedAt}`,
    `View: ${context.view}`,
    `Mode: ${headline.modeLabel}`,
    `Demo data active: ${alerts.demoDataActive ? 'yes' : 'no'}`,
    '',
    'NATIONAL HEADLINE',
    `- Tracked fields: ${headline.fieldCount}`,
    `- Total area: ${formatMetric(headline.totalAreaHa, ' ha')}`,
    `- Fields still collecting geospatial data: ${headline.collectingCount}`,
    ...(nationalMetricLines.length > 0 ? nationalMetricLines : ['  • No national metric summaries available']),
    '',
    'FIELD REGISTRY',
    ...(fieldLines.length > 0 ? fieldLines : ['  • No fields available']),
    '',
    'FIELD RANKINGS',
    `- Highest AETI: ${rankings.highestAeti.join('; ') || 'n/a'}`,
    `- Lowest BWP: ${rankings.lowestBwp.join('; ') || 'n/a'}`,
    `- Highest TBP: ${rankings.highestTbp.join('; ') || 'n/a'}`,
    `- Highest irrigation cost: ${rankings.highestCost.join('; ') || 'n/a'}`,
    '',
    'NATIONAL AETI TIMESERIES (latest points)',
    ...(timeseriesLines.length > 0 ? timeseriesLines : ['  • No timeseries available']),
    '',
    'DATA ALERTS',
    `- Collecting fields: ${alerts.collectingFields.join(', ') || 'none'}`,
    `- Missing AETI: ${alerts.missingAeti.join(', ') || 'none'}`,
    `- Missing TBP: ${alerts.missingTbp.join(', ') || 'none'}`,
    `- Missing BWP: ${alerts.missingBwp.join(', ') || 'none'}`,
  ]

  if (fieldDetail) {
    const raster = fieldDetail.raster
    const trendLines = Object.entries(fieldDetail.trendHighlights).map(([key, trend]) => {
      const meta = HARVEST_METRIC_META[key as keyof typeof HARVEST_METRIC_META]
      const change =
        trend.changePercent === null ? 'n/a' : `${formatMetric(trend.changePercent, '%', 1)} vs prior period`
      return `  • ${meta.label}: ${formatMetric(trend.value, ` ${meta.unit}`)} at ${trend.period} (${change})`
    })

    sections.push(
      '',
      'ACTIVE FIELD DETAIL',
      `- Field: ${fieldDetail.name} (${fieldDetail.crop})`,
      `- Parcel: ${fieldDetail.parcel_id} • Season: ${fieldDetail.season_id}`,
      `- Area: ${formatMetric(fieldDetail.areaHa, ' ha')} • Season window: ${fieldDetail.start_date} → ${fieldDetail.harvest_date}`,
      `- Collecting: ${fieldDetail.isCollecting ? 'yes' : 'no'}`,
      `- KPI snapshot: AETI ${fieldDetail.metrics.aeti ?? 'n/a'}, NPP ${fieldDetail.metrics.npp ?? 'n/a'}, TBP ${fieldDetail.metrics.tbp ?? 'n/a'}, BWP ${fieldDetail.metrics.bwp ?? 'n/a'}, RWD ${fieldDetail.metrics.rwd ?? 'n/a'}, WCU ${fieldDetail.metrics.wcu ?? 'n/a'}, Cost ${fieldDetail.metrics.cost ?? 'n/a'}`,
      '',
      'FIELD TREND HIGHLIGHTS',
      ...(trendLines.length > 0 ? trendLines : ['  • No trend highlights available']),
      '',
      'SATELLITE RASTER LAYER',
      raster
        ? `- Active metric: ${HARVEST_METRIC_META[raster.metric].label} (${raster.unit})`
        : '- No raster layer loaded',
      raster ? `- Granularity: ${raster.granularity} • Period: ${raster.period || 'season aggregate'}` : '',
      raster ? `- Value range: ${raster.vmin} – ${raster.vmax} ${raster.unit}` : '',
      raster
        ? `- Legend: ${raster.legend.map((item) => `${item.label} (${item.color})`).join(', ')}`
        : '',
      raster ? `- Image available for visual interpretation: yes` : '',
      '',
      'YIELD TASK',
      fieldDetail.yieldTask
        ? `- Status: ${fieldDetail.yieldTask.status}`
        : '- No yield estimate task loaded',
      fieldDetail.yieldTask?.result
        ? `- Result: ${JSON.stringify(fieldDetail.yieldTask.result)}`
        : ''
    )
  }

  return sections.filter((line) => line !== undefined).join('\n')
}

export function getModuleAnalysisFramework(module: GrowaModule): string {
  if (module === 'watchtower') {
    return `Analysis framework:
1. Summarize the national situation using status domains (production, water, climate, crop health, supply) and distinguish normal vs elevated vs unknown states.
2. Prioritize the top signals by severity — cite exact metrics, deviations, and affected entity counts from the digest.
3. Explain what changed compared to the observation window using the change records provided.
4. Assess outlook implications only where outlook text exists in the digest; otherwise state insufficient data.
5. List data gaps and source health issues that limit confidence.
6. Recommend investigations mapped to specific intelligence modules (water, harvest, weather, supply) without inventing new metrics.`
  }

  if (module === 'harvest') {
    return `Analysis framework:
1. Quantify national harvest performance using AETI (m³), TBP (t), BWP (kg/m³), NPP (gC/m²), RWD, WCU (%), and irrigation cost (QAR).
2. Compare fields using observed vs forecast mode and explain what the active mode means for interpretation.
3. Identify outliers using rankings (highest AETI, lowest BWP, highest TBP/cost) and collecting-field alerts.
4. For field view, interpret KPI snapshots, trend highlights, and satellite raster ranges/legend bands.
5. When a raster image is attached, describe spatial patterns (uniformity, hotspots, stress zones) and relate them to water productivity metrics.
6. Recommend targeted actions with measurable KPIs tied to the cited metrics.`
  }

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
