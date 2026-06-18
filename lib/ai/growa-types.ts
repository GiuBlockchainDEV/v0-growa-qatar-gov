export type GrowaModule = 'data-analytics' | 'water-intelligence' | 'energy-intelligence'

export interface GrowaCropSnapshot {
  cropName: string
  farmsCount: number
  polygonsCount: number
  totalProductionTons: number
  totalEnergyKwh: number
  totalWaterM3: number
  averageScore: number
  waterIntensityM3PerTon?: number
  energyIntensityKwhPerTon?: number
}

export interface GrowaProducerSnapshot {
  name: string
  pointId: string
  efficiencyScore: number
  productionTons: number
  resourceIntensity: number
  averagePolygonScore: number
  cropVarietyCount: number
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
    resourceIntensityPerTon?: number
    productionEfficiency?: number
    waterIntensityM3PerTon?: number
    irrigationPressurePercent?: number
    energyPerTonKwh?: number
    averageEnergyPerFarmKwh?: number
  }
  crops: GrowaCropSnapshot[]
  topProducers: GrowaProducerSnapshot[]
  atRiskProducers: GrowaProducerSnapshot[]
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
