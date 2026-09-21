import type {
  HarvestMetricKey,
  HarvestMetricSummary,
  HarvestMode,
  HarvestRasterLegendItem,
  HarvestTrendGranularity,
} from '@/lib/harvest/types'

export type GrowaModule =
  | 'data-analytics'
  | 'water-intelligence'
  | 'energy-intelligence'
  | 'harvest'

export interface GrowaCropSnapshot {
  cropName: string
  farmsCount: number
  polygonsCount: number
  totalProductionTons: number
  totalEnergyKwh: number
  totalWaterM3: number
  averageScore: number
  waterIntensityM3PerTon: number
  energyIntensityKwhPerTon: number
  productionSharePercent: number
  waterSharePercent: number
  energySharePercent: number
  rankByProduction: number
  rankByScore: number
  rankByWaterIntensity: number
  rankByEnergyIntensity: number
}

export interface GrowaProducerSnapshot {
  name: string
  pointId: string
  efficiencyScore: number
  productionTons: number
  totalEnergyKwh: number
  totalWaterM3: number
  resourceIntensity: number
  averagePolygonScore: number
  cropVarietyCount: number
  polygonCount: number
  productionSharePercent: number
  waterSharePercent: number
  energySharePercent: number
  waterIntensityM3PerTon: number
  energyIntensityKwhPerTon: number
  crops: string[]
}

export interface GrowaRankings {
  topProductionCrops: string[]
  lowestScoreCrops: string[]
  highestWaterIntensityCrops: string[]
  lowestWaterIntensityCrops: string[]
  highestEnergyIntensityCrops: string[]
  lowestEnergyIntensityCrops: string[]
}

export interface GrowaAlerts {
  zeroProductionCrops: string[]
  zeroPolygonCrops: string[]
  zeroProductionProducers: string[]
  lowScoreProducers: string[]
  highWaterIntensityProducers: string[]
  highEnergyIntensityProducers: string[]
}

export interface GrowaFarmAnalysisContext {
  module: Exclude<GrowaModule, 'harvest'>
  generatedAt: string
  headline: {
    totalProductionTons: number
    totalEnergyKwh: number
    totalWaterM3: number
    cropCount: number
    producerCount: number
    trackedPolygons: number
    averagePolygonScore: number
    resourceIntensityPerTon: number
    productionEfficiency: number
    efficiencySpread: number
    waterIntensityM3PerTon?: number
    irrigationPressurePercent?: number
    energyPerTonKwh?: number
    averageEnergyPerFarmKwh?: number
    topCropByProduction?: string
    topProducerByEfficiency?: string
    lowestProducerByEfficiency?: string
  }
  crops: GrowaCropSnapshot[]
  producers: GrowaProducerSnapshot[]
  topProducers: GrowaProducerSnapshot[]
  atRiskProducers: GrowaProducerSnapshot[]
  rankings: GrowaRankings
  alerts: GrowaAlerts
  digest: string
}

export interface HarvestGrowaMetricHeadline {
  value: number
  unit: string
  fieldCount: number
  agg: 'sum' | 'mean'
}

export interface HarvestGrowaFieldSnapshot {
  parcel_id: string
  name: string
  crop: string
  areaHa: number
  harvest_date: string
  start_date: string
  metrics: Partial<Record<HarvestMetricKey, number>>
  isCollecting: boolean
}

export interface HarvestGrowaAnalysisContext {
  module: 'harvest'
  generatedAt: string
  view: 'national' | 'field'
  mode: HarvestMode
  usingDemoData: boolean
  digest: string
  headline: {
    fieldCount: number
    totalAreaHa: number
    collectingCount: number
    modeLabel: string
    usingDemoData: boolean
    aeti?: HarvestGrowaMetricHeadline
    npp?: HarvestGrowaMetricHeadline
    tbp?: HarvestGrowaMetricHeadline
    bwp?: HarvestGrowaMetricHeadline
    rwd?: HarvestGrowaMetricHeadline
    wcu?: HarvestGrowaMetricHeadline
    cost?: HarvestGrowaMetricHeadline
  }
  nationalMetrics: HarvestMetricSummary[]
  fields: HarvestGrowaFieldSnapshot[]
  timeseries?: {
    metric: string
    granularity: string
    mode: HarvestMode
    points: Array<{ period: string; value: number }>
  }
  rankings: {
    highestAeti: string[]
    lowestBwp: string[]
    highestTbp: string[]
    highestCost: string[]
  }
  alerts: {
    collectingFields: string[]
    missingAeti: string[]
    missingTbp: string[]
    missingBwp: string[]
    demoDataActive: boolean
  }
  fieldDetail?: {
    parcel_id: string
    season_id: number
    name: string
    crop: string
    areaHa: number
    start_date: string
    harvest_date: string
    metrics: Partial<Record<HarvestMetricKey, number>>
    activeMapMetric: HarvestMetricKey
    mapGranularity: HarvestTrendGranularity
    selectedPeriod: string | null
    trendGranularity: HarvestTrendGranularity
    isCollecting: boolean
    availablePeriods: string[]
    trendHighlights: Partial<
      Record<
        HarvestMetricKey,
        {
          period: string
          value: number
          previousPeriod: string | null
          previousValue: number | null
          changePercent: number | null
        }
      >
    >
    yieldTask?: {
      status: string
      result?: Record<string, unknown>
    }
    raster?: {
      metric: HarvestMetricKey
      granularity: HarvestTrendGranularity
      period: string | null
      vmin: number
      vmax: number
      unit: string
      legend: HarvestRasterLegendItem[]
      image_url: string
      bounds_extent?: 'plot' | 'full_image'
    }
  }
}

export type GrowaAnalysisContext = GrowaFarmAnalysisContext | HarvestGrowaAnalysisContext

export function isHarvestGrowaContext(
  context: GrowaAnalysisContext
): context is HarvestGrowaAnalysisContext {
  return context.module === 'harvest'
}

export function isFarmGrowaContext(context: GrowaAnalysisContext): context is GrowaFarmAnalysisContext {
  return context.module !== 'harvest'
}

export interface GrowaAnalyzeRequest {
  module: GrowaModule
  prompt: string
  context: GrowaAnalysisContext
}

export interface GrowaAnalyzeResponse {
  analysis: string
  model: string
  generatedAt: string
}
