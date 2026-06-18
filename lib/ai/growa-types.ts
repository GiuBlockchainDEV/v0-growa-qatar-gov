export type GrowaModule = 'data-analytics' | 'water-intelligence' | 'energy-intelligence'

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

export interface GrowaAnalysisContext {
  module: GrowaModule
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
