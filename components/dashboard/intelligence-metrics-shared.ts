'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface InsightRow {
  id: string
  pointId: string
  cropName: string
  estimatedProductionTons: number
  energyConsumptionKwh: number
  waterConsumptionM3: number
}

export interface PolygonRow {
  id: string
  pointId: string
  score: number
  crop: {
    cropName: string
  }
}

interface MapPointLabelRow {
  id: string
  label: string
}

export interface IntelligenceAggregate {
  cropName: string
  farmsCount: number
  polygonsCount: number
  totalProductionTons: number
  totalEnergyKwh: number
  totalWaterM3: number
  averageScore: number
}

export interface ProducerRankingEntry {
  pointId: string
  efficiencyScore: number
  productionTons: number
  resourceIntensity: number
  averagePolygonScore: number
  cropVarietyCount: number
}

interface IntelligenceDataset {
  insights: InsightRow[]
  polygons: PolygonRow[]
  producerLabelsById: Record<string, string>
}

interface IntelligenceDatasetState extends IntelligenceDataset {
  loading: boolean
  error: string | null
}

function toPositiveNumber(input: unknown) {
  const value = typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : Number.NaN
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value * 100) / 100
}

export function normalizeInsightRows(input: unknown): InsightRow[] {
  if (!Array.isArray(input)) return []
  return input
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as Record<string, unknown>
      const id = typeof row.id === 'string' ? row.id.trim() : ''
      const pointId =
        (typeof row.pointId === 'string' && row.pointId.trim()) ||
        (typeof row.custom_point_id === 'string' && row.custom_point_id.trim()) ||
        ''
      const cropName =
        (typeof row.cropName === 'string' && row.cropName.trim()) ||
        (typeof row.crop_name === 'string' && row.crop_name.trim()) ||
        ''
      if (!id || !pointId || !cropName) return null
      return {
        id,
        pointId,
        cropName,
        estimatedProductionTons: toPositiveNumber(
          row.estimatedProductionTons ?? row.estimated_production_tons ?? row.estimated_production
        ),
        energyConsumptionKwh: toPositiveNumber(
          row.energyConsumptionKwh ?? row.energy_consumption_kwh ?? row.energy_consumption
        ),
        waterConsumptionM3: toPositiveNumber(
          row.waterConsumptionM3 ?? row.water_consumption_m3 ?? row.water_consumption
        ),
      } satisfies InsightRow
    })
    .filter((row): row is InsightRow => Boolean(row))
}

export function normalizePolygonRows(input: unknown): PolygonRow[] {
  if (!Array.isArray(input)) return []
  return input
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as Record<string, unknown>
      const id = typeof row.id === 'string' ? row.id.trim() : ''
      const pointId =
        (typeof row.pointId === 'string' && row.pointId.trim()) ||
        (typeof row.custom_point_id === 'string' && row.custom_point_id.trim()) ||
        (typeof row.customPointId === 'string' && row.customPointId.trim()) ||
        ''
      const cropSource = row.crop && typeof row.crop === 'object' ? (row.crop as Record<string, unknown>) : null
      const cropName =
        (typeof cropSource?.cropName === 'string' && cropSource.cropName.trim()) ||
        (typeof cropSource?.crop_name === 'string' && cropSource.crop_name.trim()) ||
        (typeof row.cropName === 'string' && row.cropName.trim()) ||
        (typeof row.crop_name === 'string' && row.crop_name.trim()) ||
        ''
      const score = toPositiveNumber(row.score)
      if (!id || !pointId) return null
      return {
        id,
        pointId,
        score: Math.max(0, Math.min(100, score)),
        crop: { cropName },
      } satisfies PolygonRow
    })
    .filter((row): row is PolygonRow => Boolean(row))
}

function normalizePointLabelRows(input: unknown): MapPointLabelRow[] {
  if (!Array.isArray(input)) return []
  return input
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as Record<string, unknown>
      const id = typeof row.id === 'string' ? row.id.trim() : ''
      const label = typeof row.label === 'string' ? row.label.trim() : ''
      if (!id || !label) return null
      return { id, label } satisfies MapPointLabelRow
    })
    .filter((row): row is MapPointLabelRow => Boolean(row))
}

export function labelsByPointId(input: unknown): Record<string, string> {
  return normalizePointLabelRows(input).reduce<Record<string, string>>((acc, row) => {
    acc[row.id] = row.label
    return acc
  }, {})
}

export function formatNumber(value: number, suffix = '') {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`
}

export function formatScore(value: number) {
  return `${value.toFixed(1)}/100`
}

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, value))
}

export function scoreColor(value: number) {
  const normalized = clampScore(value)
  const hue = (normalized / 100) * 120
  return `hsl(${hue} 100% 56%)`
}

export function scoreSurface(value: number, alpha = 0.16) {
  const normalized = clampScore(value)
  const hue = (normalized / 100) * 120
  return `hsl(${hue} 100% 56% / ${alpha})`
}

export function normalizePointLabel(pointId: string, labelsById: Record<string, string>) {
  return labelsById[pointId] || pointId
}

export async function fetchIntelligenceDataset(): Promise<IntelligenceDataset> {
  const [insightsResponse, polygonsResponse, pointsResponse] = await Promise.all([
    fetch('/api/operations/farm-crop-insights', { cache: 'no-store' }),
    fetch('/api/operations/custom-point-polygons', { cache: 'no-store' }),
    fetch('/api/operations/custom-map-points', { cache: 'no-store' }),
  ])

  const [insightsPayload, polygonsPayload, pointsPayload] = await Promise.all([
    insightsResponse.json().catch(() => null),
    polygonsResponse.json().catch(() => null),
    pointsResponse.json().catch(() => null),
  ])

  if (!insightsResponse.ok) {
    throw new Error((insightsPayload as { error?: string } | null)?.error || 'Failed to load crop insights')
  }
  if (!polygonsResponse.ok) {
    throw new Error((polygonsPayload as { error?: string } | null)?.error || 'Failed to load polygons')
  }
  if (!pointsResponse.ok) {
    throw new Error((pointsPayload as { error?: string } | null)?.error || 'Failed to load map points')
  }

  return {
    insights: normalizeInsightRows(insightsPayload),
    polygons: normalizePolygonRows(polygonsPayload),
    producerLabelsById: labelsByPointId(pointsPayload),
  }
}

export function buildCropAggregates(insights: InsightRow[], polygons: PolygonRow[]): IntelligenceAggregate[] {
  const map = new Map<string, IntelligenceAggregate>()
  const polygonScoresByCrop = new Map<string, number[]>()

  for (const polygon of polygons) {
    const cropName = polygon.crop.cropName.trim()
    if (!cropName) continue
    if (!polygonScoresByCrop.has(cropName)) {
      polygonScoresByCrop.set(cropName, [])
    }
    polygonScoresByCrop.get(cropName)!.push(polygon.score)
  }

  for (const insight of insights) {
    const cropName = insight.cropName.trim()
    if (!cropName) continue
    const current = map.get(cropName) || {
      cropName,
      farmsCount: 0,
      polygonsCount: 0,
      totalProductionTons: 0,
      totalEnergyKwh: 0,
      totalWaterM3: 0,
      averageScore: 0,
    }
    current.totalProductionTons += insight.estimatedProductionTons
    current.totalEnergyKwh += insight.energyConsumptionKwh
    current.totalWaterM3 += insight.waterConsumptionM3
    map.set(cropName, current)
  }

  for (const [cropName, aggregate] of map.entries()) {
    const farms = new Set(insights.filter((item) => item.cropName === cropName).map((item) => item.pointId))
    aggregate.farmsCount = farms.size
    const cropPolygons = polygons.filter((polygon) => polygon.crop.cropName.trim() === cropName)
    aggregate.polygonsCount = cropPolygons.length
    const scores = polygonScoresByCrop.get(cropName) || []
    aggregate.averageScore =
      scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0
    map.set(cropName, aggregate)
  }

  return Array.from(map.values()).sort((a, b) => b.totalProductionTons - a.totalProductionTons)
}

export function buildProducerRanking(insights: InsightRow[], polygons: PolygonRow[]) {
  const byPoint = new Map<string, ProducerRankingEntry>()

  for (const insight of insights) {
    const current = byPoint.get(insight.pointId) || {
      pointId: insight.pointId,
      efficiencyScore: 0,
      productionTons: 0,
      resourceIntensity: 0,
      averagePolygonScore: 0,
      cropVarietyCount: 0,
    }
    current.productionTons += insight.estimatedProductionTons
    current.resourceIntensity += insight.energyConsumptionKwh + insight.waterConsumptionM3
    byPoint.set(insight.pointId, current)
  }

  for (const [pointId, entry] of byPoint.entries()) {
    const pointPolygons = polygons.filter((polygon) => polygon.pointId === pointId)
    const pointScores = pointPolygons.map((polygon) => polygon.score)
    const avgScore =
      pointScores.length > 0 ? pointScores.reduce((sum, score) => sum + score, 0) / pointScores.length : 0
    const cropVariety = new Set(
      insights
        .filter((insight) => insight.pointId === pointId)
        .map((insight) => insight.cropName.trim().toLowerCase())
        .filter(Boolean)
    )

    entry.averagePolygonScore = avgScore
    entry.cropVarietyCount = cropVariety.size
    entry.efficiencyScore = entry.productionTons / Math.max(1, entry.resourceIntensity)
    byPoint.set(pointId, entry)
  }

  const list = Array.from(byPoint.values()).sort((a, b) => b.efficiencyScore - a.efficiencyScore)
  return {
    mostEfficient: list.slice(0, 5),
    leastEfficient: [...list].reverse().slice(0, 5),
  }
}

export function useIntelligenceDatasetState(): IntelligenceDatasetState {
  const [insights, setInsights] = useState<InsightRow[]>([])
  const [polygons, setPolygons] = useState<PolygonRow[]>([])
  const [producerLabelsById, setProducerLabelsById] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchIntelligenceDataset()
        if (cancelled) return
        setInsights(data.insights)
        setPolygons(data.polygons)
        setProducerLabelsById(data.producerLabelsById)
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load intelligence data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { insights, polygons, producerLabelsById, loading, error }
}

export function useIntelligenceData() {
  const dataset = useIntelligenceDatasetState()
  const { insights, polygons } = dataset

  const cropAggregates = useMemo(() => buildCropAggregates(insights, polygons), [insights, polygons])
  const producerRanking = useMemo(() => buildProducerRanking(insights, polygons), [insights, polygons])
  const headline = useMemo(() => {
    const totalProduction = insights.reduce((sum, row) => sum + row.estimatedProductionTons, 0)
    const totalEnergy = insights.reduce((sum, row) => sum + row.energyConsumptionKwh, 0)
    const totalWater = insights.reduce((sum, row) => sum + row.waterConsumptionM3, 0)
    return {
      totalProduction,
      totalEnergy,
      totalWater,
      cropCount: cropAggregates.length,
      producerCount: new Set(insights.map((row) => row.pointId)).size,
    }
  }, [cropAggregates.length, insights])

  const analyticsMeta = useMemo(() => {
    const avgPolygonScore =
      polygons.length > 0 ? polygons.reduce((sum, polygon) => sum + polygon.score, 0) / polygons.length : 0
    const totalResources = headline.totalEnergy + headline.totalWater
    const resourceIntensityPerTon = totalResources / Math.max(1, headline.totalProduction)
    const productionEfficiency = headline.totalProduction / Math.max(1, totalResources)
    const topCrop = cropAggregates[0] ?? null
    const topEfficiency = producerRanking.mostEfficient[0]?.efficiencyScore ?? 0
    const lowEfficiency = producerRanking.leastEfficient[0]?.efficiencyScore ?? 0
    return {
      avgPolygonScore,
      totalResources,
      resourceIntensityPerTon,
      productionEfficiency,
      topCrop,
      efficiencySpread: Math.max(0, topEfficiency - lowEfficiency),
    }
  }, [cropAggregates, headline.totalEnergy, headline.totalProduction, headline.totalWater, polygons, producerRanking])

  return {
    ...dataset,
    cropAggregates,
    producerRanking,
    headline,
    analyticsMeta,
  }
}

export function useMapNavigation(moduleKey: string) {
  const router = useRouter()

  const navigateToCropOnMap = (cropName: string) => {
    const normalized = cropName.trim()
    if (!normalized) return
    const focusToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const params = new URLSearchParams({
      module: moduleKey,
      crop: normalized,
      zoom: '10',
      focus: focusToken,
    })
    params.delete('pointId')
    router.push(`/dashboard?${params.toString()}`)
  }

  const navigateToProducerPoint = (pointId: string) => {
    const normalizedPointId = pointId.trim()
    if (!normalizedPointId) return
    const focusToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const params = new URLSearchParams({
      module: moduleKey,
      pointId: normalizedPointId,
      zoom: '16',
      focus: focusToken,
    })
    params.delete('crop')
    router.push(`/dashboard?${params.toString()}`)
  }

  return { navigateToCropOnMap, navigateToProducerPoint }
}
