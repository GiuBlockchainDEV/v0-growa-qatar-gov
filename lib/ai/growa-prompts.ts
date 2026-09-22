import type { GrowaAnalysisContext, GrowaFarmAnalysisContext, GrowaModule } from './growa-types'
import { isHarvestGrowaContext } from './growa-types'

export interface GrowaPromptOption {
  id: string
  label: string
  prompt: string
}

function formatMetric(value: number | undefined, suffix = '', digits = 1) {
  if (value === undefined || !Number.isFinite(value)) return 'n/a'
  return `${value.toLocaleString('en-US', { maximumFractionDigits: digits })}${suffix}`
}

function topCropLine(context: GrowaFarmAnalysisContext) {
  const top = context.crops[0]
  if (!top) return 'No dominant crop identified in the current dataset.'
  return `${top.cropName} leads production at ${formatMetric(top.productionSharePercent, '%')} share (${formatMetric(top.totalProductionTons, ' t')}) with polygon score ${formatMetric(top.averageScore, '/100')}.`
}

function harvestNationalPrompts(context: GrowaAnalysisContext): GrowaPromptOption[] {
  if (!isHarvestGrowaContext(context)) return FALLBACK_PROMPTS.harvest

  const { headline, alerts, rankings } = context
  const aeti = headline.aeti
  const tbp = headline.tbp
  const bwp = headline.bwp

  return [
    {
      id: 'harvest-portfolio-briefing',
      label: 'Portfolio briefing',
      prompt: `Prepare an English government briefing on the national Harvest portfolio using ONLY the digest.

Mandatory metrics:
- ${headline.fieldCount} fields across ${formatMetric(headline.totalAreaHa, ' ha')}
- Mode: ${headline.modeLabel}
- National AETI: ${aeti ? formatMetric(aeti.value, ` ${aeti.unit}`) : 'n/a'}
- National TBP: ${tbp ? formatMetric(tbp.value, ` ${tbp.unit}`) : 'n/a'}
- National BWP: ${bwp ? formatMetric(bwp.value, ` ${bwp.unit}`) : 'n/a'}
- Fields still collecting data: ${alerts.collectingFields.join(', ') || 'none'}

Explain observed vs forecast implications, highlight top outliers (${rankings.highestAeti[0] || 'n/a'} AETI, ${rankings.lowestBwp[0] || 'n/a'} BWP), and recommend ministry monitoring priorities.`,
    },
    {
      id: 'harvest-outliers',
      label: 'Outlier analysis',
      prompt: `Analyze Harvest field outliers and data-quality risks.

Use rankings for highest AETI (${rankings.highestAeti.join('; ') || 'n/a'}), lowest BWP (${rankings.lowestBwp.join('; ') || 'n/a'}), and highest TBP (${rankings.highestTbp.join('; ') || 'n/a'}).

Flag collecting fields (${alerts.collectingFields.join(', ') || 'none'}) and missing metrics (AETI: ${alerts.missingAeti.join(', ') || 'none'}). Recommend field visits or re-collection where confidence is low.`,
    },
    {
      id: 'harvest-water-productivity',
      label: 'Water productivity',
      prompt: `Assess biomass water productivity across the national field registry.

Relate AETI (m³) to TBP (t) and BWP (kg/m³). Identify whether high water use is justified by biomass output or signals inefficiency. Use the national AETI timeseries and field-level metrics from the digest. Recommend irrigation adjustments with measurable targets.`,
    },
  ]
}

function harvestFieldPrompts(context: GrowaAnalysisContext): GrowaPromptOption[] {
  if (!isHarvestGrowaContext(context) || !context.fieldDetail) return FALLBACK_PROMPTS.harvest

  const field = context.fieldDetail
  const raster = field.raster

  return [
    {
      id: 'harvest-field-health',
      label: 'Field health review',
      prompt: `Review the selected field "${field.name}" (${field.crop}) in English.

Cite KPI values (AETI, NPP, TBP, BWP, RWD, WCU, cost), trend highlights, and whether geospatial collection is still in progress (${field.isCollecting ? 'yes' : 'no'}). Explain risks and opportunities before harvest on ${field.harvest_date}.`,
    },
    {
      id: 'harvest-raster-interpretation',
      label: 'Satellite map analysis',
      prompt: raster
        ? `Interpret the active satellite raster for "${field.name}".

Metric: ${raster.metric} (${raster.unit}), range ${raster.vmin}–${raster.vmax}, granularity ${raster.granularity}, period ${raster.period || 'season'}.

Describe spatial patterns visible in the attached raster image (hotspots, uniformity, stress zones) and relate them to field KPIs and trend highlights. If the image is unclear, state limitations explicitly.`
        : `No raster image is currently loaded for "${field.name}". Use KPI and trend data to assess field condition and explain what satellite layers should be checked next.`,
    },
    {
      id: 'harvest-yield-outlook',
      label: 'Yield outlook',
      prompt: `Provide a yield and harvest-readiness outlook for "${field.name}".

Use TBP, BWP, NPP, RWD, and any yield-task result (${field.yieldTask ? field.yieldTask.status : 'not run'}). Recommend whether irrigation, scouting, or re-estimation is needed before ${field.harvest_date}.`,
    },
  ]
}

function dataAnalyticsPrompts(context: GrowaFarmAnalysisContext): GrowaPromptOption[] {
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

function waterIntelligencePrompts(context: GrowaFarmAnalysisContext): GrowaPromptOption[] {
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

function energyIntelligencePrompts(context: GrowaFarmAnalysisContext): GrowaPromptOption[] {
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
    case 'harvest':
      return isHarvestGrowaContext(context) && context.view === 'field'
        ? harvestFieldPrompts(context)
        : harvestNationalPrompts(context)
    case 'water-intelligence':
      return isHarvestGrowaContext(context) ? FALLBACK_PROMPTS.harvest : waterIntelligencePrompts(context)
    case 'energy-intelligence':
      return isHarvestGrowaContext(context) ? FALLBACK_PROMPTS.harvest : energyIntelligencePrompts(context)
    case 'watchtower':
      return FALLBACK_PROMPTS.watchtower
    case 'data-analytics':
    default:
      return isHarvestGrowaContext(context) ? FALLBACK_PROMPTS.harvest : dataAnalyticsPrompts(context)
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
  harvest: [
    {
      id: 'harvest-portfolio-briefing',
      label: 'Portfolio briefing',
      prompt:
        'Prepare an English government briefing on the Harvest field portfolio using AETI, TBP, BWP, outliers, and collecting-field alerts from the digest.',
    },
  ],
  watchtower: [
    {
      id: 'national-situation-briefing',
      label: 'National situation briefing',
      prompt:
        'Prepare an executive national agricultural situation briefing using ONLY the Watchtower digest. Cover national status domains, priority signals, strategic KPIs, and data gaps. Distinguish observed facts from interpretation.',
    },
    {
      id: 'priority-investigations',
      label: 'Recommended investigations',
      prompt:
        'Based on the priority signals and national status in the digest, recommend specific investigations ministry officials should pursue. Name domains, affected entity counts, and which intelligence modules to open.',
    },
    {
      id: 'outlook-assessment',
      label: 'Outlook assessment',
      prompt:
        'Assess the 7-day outlook and strategic KPIs in the digest. Explain operational and food-security implications for Qatar. Flag where outlook is limited by missing or demo data.',
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
    case 'harvest':
      return 'Harvest Prediction'
    case 'watchtower':
      return 'National Agricultural Watchtower'
    default:
      return 'Intelligence Workspace'
  }
}
