import type {
  GrowaAlerts,
  GrowaAnalysisContext,
  GrowaCropSnapshot,
  GrowaModule,
  GrowaProducerSnapshot,
  GrowaRankings,
} from './growa-types'
import { buildGrowaDigest } from './growa-digest'
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
    efficiencySpread?: number
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

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function share(value: number, total: number) {
  if (total <= 0) return 0
  return round((value / total) * 100, 1)
}

function rankBy<T>(items: T[], selector: (item: T) => number, direction: 'asc' | 'desc' = 'desc') {
  const sorted = [...items].sort((a, b) => {
    const delta = selector(a) - selector(b)
    return direction === 'asc' ? delta : -delta
  })
  const rankMap = new Map<T, number>()
  sorted.forEach((item, index) => rankMap.set(item, index + 1))
  return rankMap
}

function buildProducerSnapshots(
  insights: InsightRow[],
  polygons: PolygonRow[],
  producerLabelsById: Record<string, string>,
  headline: BuildGrowaContextInput['headline']
): GrowaProducerSnapshot[] {
  const byPoint = new Map<string, GrowaProducerSnapshot>()

  for (const insight of insights) {
    const current = byPoint.get(insight.pointId) || {
      name: normalizePointLabel(insight.pointId, producerLabelsById),
      pointId: insight.pointId,
      efficiencyScore: 0,
      productionTons: 0,
      totalEnergyKwh: 0,
      totalWaterM3: 0,
      resourceIntensity: 0,
      averagePolygonScore: 0,
      cropVarietyCount: 0,
      polygonCount: 0,
      productionSharePercent: 0,
      waterSharePercent: 0,
      energySharePercent: 0,
      waterIntensityM3PerTon: 0,
      energyIntensityKwhPerTon: 0,
      crops: [] as string[],
    }

    current.productionTons += insight.estimatedProductionTons
    current.totalEnergyKwh += insight.energyConsumptionKwh
    current.totalWaterM3 += insight.waterConsumptionM3
    current.resourceIntensity += insight.energyConsumptionKwh + insight.waterConsumptionM3
    if (!current.crops.includes(insight.cropName)) {
      current.crops.push(insight.cropName)
    }
    byPoint.set(insight.pointId, current)
  }

  for (const [pointId, entry] of byPoint.entries()) {
    const pointPolygons = polygons.filter((polygon) => polygon.pointId === pointId)
    const pointScores = pointPolygons.map((polygon) => polygon.score)
    entry.polygonCount = pointPolygons.length
    entry.averagePolygonScore =
      pointScores.length > 0 ? pointScores.reduce((sum, score) => sum + score, 0) / pointScores.length : 0
    entry.cropVarietyCount = entry.crops.length
    entry.efficiencyScore = entry.productionTons / Math.max(1, entry.resourceIntensity)
    entry.productionSharePercent = share(entry.productionTons, headline.totalProduction)
    entry.waterSharePercent = share(entry.totalWaterM3, headline.totalWater)
    entry.energySharePercent = share(entry.totalEnergyKwh, headline.totalEnergy)
    entry.waterIntensityM3PerTon = entry.totalWaterM3 / Math.max(1, entry.productionTons)
    entry.energyIntensityKwhPerTon = entry.totalEnergyKwh / Math.max(1, entry.productionTons)
    byPoint.set(pointId, entry)
  }

  return Array.from(byPoint.values()).sort((a, b) => b.efficiencyScore - a.efficiencyScore)
}

function buildCropSnapshots(
  cropAggregates: IntelligenceAggregate[],
  headline: BuildGrowaContextInput['headline']
): GrowaCropSnapshot[] {
  const productionRank = rankBy(cropAggregates, (crop) => crop.totalProductionTons)
  const scoreRank = rankBy(cropAggregates, (crop) => crop.averageScore)
  const waterRank = rankBy(cropAggregates, (crop) => crop.totalWaterM3 / Math.max(1, crop.totalProductionTons), 'asc')
  const energyRank = rankBy(
    cropAggregates,
    (crop) => crop.totalEnergyKwh / Math.max(1, crop.totalProductionTons),
    'asc'
  )

  return cropAggregates.map((crop) => ({
    cropName: crop.cropName,
    farmsCount: crop.farmsCount,
    polygonsCount: crop.polygonsCount,
    totalProductionTons: crop.totalProductionTons,
    totalEnergyKwh: crop.totalEnergyKwh,
    totalWaterM3: crop.totalWaterM3,
    averageScore: crop.averageScore,
    waterIntensityM3PerTon: round(crop.totalWaterM3 / Math.max(1, crop.totalProductionTons)),
    energyIntensityKwhPerTon: round(crop.totalEnergyKwh / Math.max(1, crop.totalProductionTons)),
    productionSharePercent: share(crop.totalProductionTons, headline.totalProduction),
    waterSharePercent: share(crop.totalWaterM3, headline.totalWater),
    energySharePercent: share(crop.totalEnergyKwh, headline.totalEnergy),
    rankByProduction: productionRank.get(crop) ?? 0,
    rankByScore: scoreRank.get(crop) ?? 0,
    rankByWaterIntensity: waterRank.get(crop) ?? 0,
    rankByEnergyIntensity: energyRank.get(crop) ?? 0,
  }))
}

function buildRankings(crops: GrowaCropSnapshot[]): GrowaRankings {
  const byProduction = [...crops].sort((a, b) => b.totalProductionTons - a.totalProductionTons)
  const byScore = [...crops].sort((a, b) => a.averageScore - b.averageScore)
  const byWater = [...crops].sort((a, b) => b.waterIntensityM3PerTon - a.waterIntensityM3PerTon)
  const byEnergy = [...crops].sort((a, b) => b.energyIntensityKwhPerTon - a.energyIntensityKwhPerTon)

  return {
    topProductionCrops: byProduction.slice(0, 3).map((crop) => crop.cropName),
    lowestScoreCrops: byScore.slice(0, 3).map((crop) => crop.cropName),
    highestWaterIntensityCrops: byWater.slice(0, 3).map((crop) => crop.cropName),
    lowestWaterIntensityCrops: [...byWater].reverse().slice(0, 3).map((crop) => crop.cropName),
    highestEnergyIntensityCrops: byEnergy.slice(0, 3).map((crop) => crop.cropName),
    lowestEnergyIntensityCrops: [...byEnergy].reverse().slice(0, 3).map((crop) => crop.cropName),
  }
}

function buildAlerts(crops: GrowaCropSnapshot[], producers: GrowaProducerSnapshot[]): GrowaAlerts {
  const nationalWaterIntensity =
    producers.reduce((sum, producer) => sum + producer.totalWaterM3, 0) /
    Math.max(1, producers.reduce((sum, producer) => sum + producer.productionTons, 0))
  const nationalEnergyIntensity =
    producers.reduce((sum, producer) => sum + producer.totalEnergyKwh, 0) /
    Math.max(1, producers.reduce((sum, producer) => sum + producer.productionTons, 0))

  return {
    zeroProductionCrops: crops.filter((crop) => crop.totalProductionTons <= 0).map((crop) => crop.cropName),
    zeroPolygonCrops: crops.filter((crop) => crop.polygonsCount <= 0).map((crop) => crop.cropName),
    zeroProductionProducers: producers
      .filter((producer) => producer.productionTons <= 0)
      .map((producer) => producer.name),
    lowScoreProducers: producers
      .filter((producer) => producer.averagePolygonScore > 0 && producer.averagePolygonScore < 40)
      .map((producer) => producer.name),
    highWaterIntensityProducers: producers
      .filter(
        (producer) =>
          producer.productionTons > 0 && producer.waterIntensityM3PerTon > nationalWaterIntensity * 1.25
      )
      .map((producer) => producer.name),
    highEnergyIntensityProducers: producers
      .filter(
        (producer) =>
          producer.productionTons > 0 && producer.energyIntensityKwhPerTon > nationalEnergyIntensity * 1.25
      )
      .map((producer) => producer.name),
  }
}

export function buildGrowaContext(input: BuildGrowaContextInput): GrowaAnalysisContext {
  const {
    module,
    insights,
    polygons,
    producerLabelsById,
    cropAggregates,
    producerRanking,
    headline,
    analyticsMeta,
    waterMeta,
    energyMeta,
  } = input

  const crops = buildCropSnapshots(cropAggregates, headline)
  const producers = buildProducerSnapshots(insights, polygons, producerLabelsById, headline)
  const rankings = buildRankings(crops)
  const alerts = buildAlerts(crops, producers)

  const topProducers = producerRanking.mostEfficient
    .map((entry) => producers.find((producer) => producer.pointId === entry.pointId))
    .filter((producer): producer is GrowaProducerSnapshot => Boolean(producer))

  const atRiskProducers = producerRanking.leastEfficient
    .map((entry) => producers.find((producer) => producer.pointId === entry.pointId))
    .filter((producer): producer is GrowaProducerSnapshot => Boolean(producer))

  const topCropByProduction = crops[0]?.cropName
  const topProducerByEfficiency = topProducers[0]?.name
  const lowestProducerByEfficiency = atRiskProducers[0]?.name
  const efficiencySpread =
    analyticsMeta.efficiencySpread ??
    Math.max(0, (topProducers[0]?.efficiencyScore ?? 0) - (atRiskProducers[0]?.efficiencyScore ?? 0))

  const context: GrowaAnalysisContext = {
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
      efficiencySpread,
      waterIntensityM3PerTon: waterMeta?.avgWaterPerTon,
      irrigationPressurePercent: waterMeta?.irrigationPressure,
      energyPerTonKwh: energyMeta?.energyPerTon,
      averageEnergyPerFarmKwh: energyMeta?.averageEnergyPerFarm,
      topCropByProduction,
      topProducerByEfficiency,
      lowestProducerByEfficiency,
    },
    crops,
    producers,
    topProducers,
    atRiskProducers,
    rankings,
    alerts,
    digest: '',
  }

  context.digest = buildGrowaDigest(context)
  return context
}
