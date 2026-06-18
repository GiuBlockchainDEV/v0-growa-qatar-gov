import type {
  GrowaAnalysisContext,
  GrowaCropSnapshot,
  GrowaModule,
  GrowaProducerSnapshot,
} from './growa-types'
import type {
  IntelligenceAggregate,
  InsightRow,
  PolygonRow,
  ProducerRankingEntry,
} from '@/components/dashboard/intelligence-metrics-shared'
import { normalizePointLabel } from '@/components/dashboard/intelligence-metrics-shared'

interface BuildGrowaContextInput {
  module: GrowaModule
  insights: InsightRow[]
  polygons: PolygonRow[]
  producerLabelsById: Record<string, string>
  cropAggregates: IntelligenceAggregate[]
  producerRanking: {
    mostEfficient: ProducerRankingEntry[]
    leastEfficient: ProducerRankingEntry[]
  }
  headline: {
    totalProduction: number
    totalEnergy: number
    totalWater: number
    cropCount: number
    producerCount: number
  }
  analyticsMeta: {
    avgPolygonScore: number
    resourceIntensityPerTon: number
    productionEfficiency: number
  }
  waterMeta?: {
    avgWaterPerTon: number
    irrigationPressure: number
  }
  energyMeta?: {
    energyPerTon: number
    averageEnergyPerFarm: number
  }
}

function mapCropSnapshot(crop: IntelligenceAggregate): GrowaCropSnapshot {
  return {
    cropName: crop.cropName,
    farmsCount: crop.farmsCount,
    polygonsCount: crop.polygonsCount,
    totalProductionTons: crop.totalProductionTons,
    totalEnergyKwh: crop.totalEnergyKwh,
    totalWaterM3: crop.totalWaterM3,
    averageScore: crop.averageScore,
    waterIntensityM3PerTon: crop.totalWaterM3 / Math.max(1, crop.totalProductionTons),
    energyIntensityKwhPerTon: crop.totalEnergyKwh / Math.max(1, crop.totalProductionTons),
  }
}

function mapProducerSnapshot(
  entry: ProducerRankingEntry,
  producerLabelsById: Record<string, string>
): GrowaProducerSnapshot {
  return {
    name: normalizePointLabel(entry.pointId, producerLabelsById),
    pointId: entry.pointId,
    efficiencyScore: entry.efficiencyScore,
    productionTons: entry.productionTons,
    resourceIntensity: entry.resourceIntensity,
    averagePolygonScore: entry.averagePolygonScore,
    cropVarietyCount: entry.cropVarietyCount,
  }
}

export function buildGrowaContext(input: BuildGrowaContextInput): GrowaAnalysisContext {
  const {
    module,
    polygons,
    producerLabelsById,
    cropAggregates,
    producerRanking,
    headline,
    analyticsMeta,
    waterMeta,
    energyMeta,
  } = input

  return {
    module,
    generatedAt: new Date().toISOString(),
    headline: {
      totalProductionTons: headline.totalProduction,
      totalEnergyKwh: headline.totalEnergy,
      totalWaterM3: headline.totalWater,
      cropCount: headline.cropCount,
      producerCount: headline.producerCount,
      trackedPolygons: polygons.length,
      averagePolygonScore: analyticsMeta.avgPolygonScore,
      resourceIntensityPerTon: analyticsMeta.resourceIntensityPerTon,
      productionEfficiency: analyticsMeta.productionEfficiency,
      waterIntensityM3PerTon: waterMeta?.avgWaterPerTon,
      irrigationPressurePercent: waterMeta?.irrigationPressure,
      energyPerTonKwh: energyMeta?.energyPerTon,
      averageEnergyPerFarmKwh: energyMeta?.averageEnergyPerFarm,
    },
    crops: cropAggregates.map(mapCropSnapshot),
    topProducers: producerRanking.mostEfficient.map((entry) =>
      mapProducerSnapshot(entry, producerLabelsById)
    ),
    atRiskProducers: producerRanking.leastEfficient.map((entry) =>
      mapProducerSnapshot(entry, producerLabelsById)
    ),
  }
}
