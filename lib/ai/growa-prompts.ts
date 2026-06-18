import type { GrowaAnalysisContext, GrowaModule } from './growa-types'

export interface GrowaPromptOption {
  id: string
  label: string
  prompt: string
}

function formatMetric(value: number | undefined, suffix = '', digits = 1) {
  if (value === undefined || !Number.isFinite(value)) return 'n/a'
  return `${value.toLocaleString('en-US', { maximumFractionDigits: digits })}${suffix}`
}

function topCropLine(context: GrowaAnalysisContext) {
  const top = context.crops[0]
  if (!top) return 'No dominant crop identified in the current dataset.'
  return `${top.cropName} leads production at ${formatMetric(top.productionSharePercent, '%')} share (${formatMetric(top.totalProductionTons, ' t')}) with polygon score ${formatMetric(top.averageScore, '/100')}.`
}

function dataAnalyticsPrompts(context: GrowaAnalysisContext): GrowaPromptOption[] {
  const { headline, alerts } = context

  return [
    {
      id: 'executive-briefing',
      label: 'Executive briefing',
      prompt: `Prepare an executive government briefing for Qatar using ONLY the operational digest below.

You must quantify:
- ${formatMetric(headline.totalProductionTons, ' t')} total production across ${headline.producerCount} producers and ${headline.trackedPolygons} polygons
- ${formatMetric(headline.averagePolygonScore, '/100')} average polygon score and ${formatMetric(headline.resourceIntensityPerTon)} resource intensity per ton
- ${topCropLine(context)}
- Efficiency spread between ${headline.topProducerByEfficiency || 'top producer'} and ${headline.lowestProducerByEfficiency || 'lowest producer'}: ${formatMetric(headline.efficiencySpread, '', 4)}

Contrast topProducers vs atRiskProducers, cite productionSharePercent and cropVarietyCount, and translate findings into food-security priorities for ministry leadership.`,
    },
    {
      id: 'intervention-priority',
      label: 'Intervention priorities',
      prompt: `Build a government intervention priority list using the digest data.

Prioritize producers and crops where:
- polygon score is below 40/100 (flagged: ${alerts.lowScoreProducers.join(', ') || 'none'})
- production is zero but the entity remains tracked (${alerts.zeroProductionProducers.join(', ') || 'none'})
- resource use is high relative to output (resourceIntensityPerTon = ${formatMetric(headline.resourceIntensityPerTon)})

For each priority item, cite the exact producer/crop name, the metric that triggered the flag, and a recommended ministry action with a measurable KPI.`,
    },
    {
      id: 'food-security-outlook',
      label: 'Food security outlook',
      prompt: `Assess Qatar food-security implications from the current monitored farm network.

Use crop-level productionSharePercent, farmsCount, polygonsCount, and averageScore to determine:
1. Which crop families anchor national supply today
2. Which crops are underperforming or lack polygon coverage (${alerts.zeroPolygonCrops.join(', ') || 'none'})
3. Whether production concentration in ${headline.topCropByProduction || 'the leading crop'} creates supply risk

Recommend monitoring and policy actions for the next reporting cycle with numeric targets tied to the dataset.`,
    },
  ]
}

function waterIntelligencePrompts(context: GrowaAnalysisContext): GrowaPromptOption[] {
  const { headline, rankings, alerts } = context
  const highest = context.crops.find((crop) => crop.cropName === rankings.highestWaterIntensityCrops[0])
  const lowest = context.crops.find((crop) => crop.cropName === rankings.lowestWaterIntensityCrops[0])

  return [
    {
      id: 'water-policy-briefing',
      label: 'Water policy briefing',
      prompt: `Draft a Qatar government water policy briefing from the digest.

Mandatory metrics to cite:
- Total water: ${formatMetric(headline.totalWaterM3, ' m³')}
- National water intensity: ${formatMetric(headline.waterIntensityM3PerTon, ' m³/t')}
- Irrigation pressure: ${formatMetric(headline.irrigationPressurePercent, '%')}
- Highest-intensity crop: ${highest?.cropName || 'n/a'} at ${formatMetric(highest?.waterIntensityM3PerTon, ' m³/t')}
- Lowest-intensity crop: ${lowest?.cropName || 'n/a'} at ${formatMetric(lowest?.waterIntensityM3PerTon, ' m³/t')}

Explain which producers drive water share (${alerts.highWaterIntensityProducers.join(', ') || 'none flagged'}) and recommend ministry actions to reduce m³/t without compromising food output.`,
    },
    {
      id: 'conservation-priorities',
      label: 'Conservation priorities',
      prompt: `Rank water conservation priorities for government oversight using crop and producer intensity data.

Compare crops by waterIntensityM3PerTon, waterSharePercent, and averageScore. Identify where high water share (${formatMetric(highest?.waterSharePercent, '%')} for ${highest?.cropName || 'top crop'}) is justified by production versus where it signals inefficiency.

Deliver a prioritized action list for farms, crops, and irrigation controls with expected m³ savings ranges grounded in the dataset.`,
    },
    {
      id: 'drought-resilience',
      label: 'Drought resilience',
      prompt: `Assess drought-season resilience across monitored Qatar farms.

Use irrigationPressurePercent (${formatMetric(headline.irrigationPressurePercent, '%')}), polygon scores, and producer waterIntensityM3PerTon to identify vulnerable sites before peak summer demand.

Flag ${alerts.zeroPolygonCrops.join(', ') || 'no crops'} without polygon coverage and ${alerts.highWaterIntensityProducers.join(', ') || 'no producers'} with elevated water intensity. Recommend regulatory and support measures with measurable resilience KPIs.`,
    },
  ]
}

function energyIntelligencePrompts(context: GrowaAnalysisContext): GrowaPromptOption[] {
  const { headline, rankings, alerts } = context
  const highest = context.crops.find((crop) => crop.cropName === rankings.highestEnergyIntensityCrops[0])
  const lowest = context.crops.find((crop) => crop.cropName === rankings.lowestEnergyIntensityCrops[0])

  return [
    {
      id: 'energy-efficiency-assessment',
      label: 'Energy efficiency assessment',
      prompt: `Prepare a government energy efficiency assessment for Qatar agricultural operations.

Cite these headline metrics explicitly:
- Total energy: ${formatMetric(headline.totalEnergyKwh, ' kWh')}
- Energy per ton: ${formatMetric(headline.energyPerTonKwh, ' kWh/t')}
- Average energy per farm: ${formatMetric(headline.averageEnergyPerFarmKwh, ' kWh')}
- Highest-intensity crop: ${highest?.cropName || 'n/a'} at ${formatMetric(highest?.energyIntensityKwhPerTon, ' kWh/t')}
- Lowest-intensity crop: ${lowest?.cropName || 'n/a'} at ${formatMetric(lowest?.energyIntensityKwhPerTon, ' kWh/t')}

Compare crop energySharePercent vs productionSharePercent and identify producers flagged for high energy intensity (${alerts.highEnergyIntensityProducers.join(', ') || 'none'}).`,
    },
    {
      id: 'grid-pressure',
      label: 'Grid pressure analysis',
      prompt: `Analyze grid pressure across the monitored farm network.

Identify which crops and producers contribute most to totalEnergyKwh and energyIntensityKwhPerTon. Contrast ${headline.topProducerByEfficiency || 'the most efficient producer'} with ${headline.lowestProducerByEfficiency || 'the least efficient producer'}.

Recommend intervention priorities that reduce kWh/t while protecting ${formatMetric(headline.totalProductionTons, ' t')} national tracked production.`,
    },
    {
      id: 'decarbonization-roadmap',
      label: 'Decarbonization roadmap',
      prompt: `Create a practical decarbonization roadmap for Qatar agricultural producers based on the digest.

Segment actions into:
1. Quick wins for producers above national energy intensity
2. Crop-specific upgrades for ${rankings.highestEnergyIntensityCrops.join(', ') || 'high-intensity crops'}
3. Structural investments for farms with low polygon scores and high energy share

Every recommendation must reference a dataset metric and a KPI target (kWh/t, kWh per farm, or score improvement).`,
    },
  ]
}

export function getGrowaPrompts(module: GrowaModule, context?: GrowaAnalysisContext | null): GrowaPromptOption[] {
  if (!context) {
    return FALLBACK_PROMPTS[module]
  }

  switch (module) {
    case 'water-intelligence':
      return waterIntelligencePrompts(context)
    case 'energy-intelligence':
      return energyIntelligencePrompts(context)
    case 'data-analytics':
    default:
      return dataAnalyticsPrompts(context)
  }
}

const FALLBACK_PROMPTS: Record<GrowaModule, GrowaPromptOption[]> = {
  'data-analytics': [
    {
      id: 'executive-briefing',
      label: 'Executive briefing',
      prompt:
        'Prepare an executive government briefing on crop production efficiency, resource pressure, and producer performance across all monitored Qatar farms. Cite headline metrics, crop shares, and producer rankings from the digest.',
    },
  ],
  'water-intelligence': [
    {
      id: 'water-policy-briefing',
      label: 'Water policy briefing',
      prompt:
        'Draft a government water policy briefing using total water, water intensity, irrigation pressure, crop rankings, and producer alerts from the digest.',
    },
  ],
  'energy-intelligence': [
    {
      id: 'energy-efficiency-assessment',
      label: 'Energy efficiency assessment',
      prompt:
        'Prepare a government energy efficiency assessment using total energy, kWh/t, per-farm averages, crop intensity rankings, and producer alerts from the digest.',
    },
  ],
}

export function getGrowaModuleTitle(module: GrowaModule): string {
  switch (module) {
    case 'data-analytics':
      return 'Data Analytics Command'
    case 'water-intelligence':
      return 'Water Intelligence'
    case 'energy-intelligence':
      return 'Energy Intelligence Command'
    default:
      return 'Intelligence Workspace'
  }
}
