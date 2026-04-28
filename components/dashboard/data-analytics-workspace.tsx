'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Leaf, TrendingDown, TrendingUp } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

interface InsightRow {
  id: string
  pointId: string
  cropName: string
  estimatedProductionTons: number
  energyConsumptionKwh: number
  waterConsumptionM3: number
}

interface PolygonRow {
  id: string
  pointId: string
  score: number
  crop: {
    cropName: string
  }
}

interface CropAggregate {
  cropName: string
  farmsCount: number
  polygonsCount: number
  totalProductionTons: number
  totalEnergyKwh: number
  totalWaterM3: number
  averageScore: number
}

interface ProducerRanking {
  pointId: string
  efficiencyScore: number
  productionTons: number
  resourceIntensity: number
  averagePolygonScore: number
  cropVarietyCount: number
}

function toPositiveNumber(input: unknown) {
  const value = typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : Number.NaN
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value * 100) / 100
}

function normalizeInsightRows(input: unknown): InsightRow[] {
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

function normalizePolygonRows(input: unknown): PolygonRow[] {
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
        crop: {
          cropName,
        },
      } satisfies PolygonRow
    })
    .filter((row): row is PolygonRow => Boolean(row))
}

function formatScore(value: number) {
  return `${value.toFixed(1)}/100`
}

function formatNumber(value: number, suffix = '') {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`
}

function readPointLabelsById(userId?: string) {
  if (typeof window === 'undefined') return {}

  const keyCandidates = userId
    ? [`growa-custom-map-points:${userId}`, 'growa-custom-map-points:anonymous']
    : ['growa-custom-map-points:anonymous']

  const labelsById: Record<string, string> = {}

  for (const storageKey of keyCandidates) {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) continue
      for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') continue
        const row = entry as Record<string, unknown>
        const id = typeof row.id === 'string' ? row.id.trim() : ''
        const label =
          (typeof row.label === 'string' && row.label.trim()) ||
          (typeof row.name === 'string' && row.name.trim()) ||
          ''
        if (!id || !label) continue
        labelsById[id] = label
      }
    } catch {
      // Ignore malformed local storage payloads.
    }
  }

  return labelsById
}

function getProducerDisplayName(pointId: string, labelsById: Record<string, string>) {
  const mapped = labelsById[pointId]
  if (mapped) return mapped
  return `Producer ${pointId.slice(0, 8)}`
}

export function DataAnalyticsWorkspace() {
  const { user } = useAuth()
  const [insights, setInsights] = useState<InsightRow[]>([])
  const [polygons, setPolygons] = useState<PolygonRow[]>([])
  const [producerLabelsById, setProducerLabelsById] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setProducerLabelsById(readPointLabelsById(user?.id))
  }, [user?.id])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const [insightsResponse, polygonsResponse] = await Promise.all([
          fetch('/api/operations/farm-crop-insights', { cache: 'no-store' }),
          fetch('/api/operations/custom-point-polygons', { cache: 'no-store' }),
        ])

        const [insightsPayload, polygonsPayload] = await Promise.all([
          insightsResponse.json().catch(() => null),
          polygonsResponse.json().catch(() => null),
        ])

        if (!insightsResponse.ok) {
          throw new Error(
            (insightsPayload as { error?: string } | null)?.error || 'Failed to load crop insights'
          )
        }
        if (!polygonsResponse.ok) {
          throw new Error(
            (polygonsPayload as { error?: string } | null)?.error || 'Failed to load polygons'
          )
        }

        if (cancelled) return
        setInsights(normalizeInsightRows(insightsPayload))
        setPolygons(normalizePolygonRows(polygonsPayload))
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load analytics data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const cropAggregates = useMemo(() => {
    const map = new Map<string, CropAggregate>()
    const polygonScoresByCrop = new Map<string, number[]>()

    for (const polygon of polygons) {
      const cropName = polygon.crop.cropName.trim() || 'Unassigned crop'
      if (!polygonScoresByCrop.has(cropName)) {
        polygonScoresByCrop.set(cropName, [])
      }
      polygonScoresByCrop.get(cropName)!.push(polygon.score)
    }

    for (const insight of insights) {
      const cropName = insight.cropName.trim() || 'Unassigned crop'
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
      const cropPolygons = polygons.filter((polygon) => (polygon.crop.cropName.trim() || 'Unassigned crop') === cropName)
      aggregate.polygonsCount = cropPolygons.length
      const scores = polygonScoresByCrop.get(cropName) || []
      aggregate.averageScore =
        scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0
      map.set(cropName, aggregate)
    }

    return Array.from(map.values()).sort((a, b) => b.totalProductionTons - a.totalProductionTons)
  }, [insights, polygons])

  const producerRanking = useMemo(() => {
    const byPoint = new Map<string, ProducerRanking>()

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
      const resources = insight.energyConsumptionKwh + insight.waterConsumptionM3
      current.resourceIntensity += resources
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
      const denom = Math.max(1, entry.resourceIntensity)
      entry.efficiencyScore = (entry.productionTons * 1000) / denom + avgScore * 0.4 + entry.cropVarietyCount * 2
      byPoint.set(pointId, entry)
    }

    const list = Array.from(byPoint.values()).sort((a, b) => b.efficiencyScore - a.efficiencyScore)
    return {
      mostEfficient: list.slice(0, 5),
      leastEfficient: [...list].reverse().slice(0, 5),
    }
  }, [insights, polygons])

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

  return (
    <div className="space-y-5 p-6 pt-20">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
          <BarChart3 className="h-5 w-5 text-[#07f880]" />
          Data Analytics
        </h1>
        <p className="mt-2 text-sm text-white/65">
          Cross-farm crop statistics with efficiency ranking of producers.
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/65">
          Loading analytics...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wide text-white/50">Crops tracked</p>
              <p className="mt-2 text-2xl font-semibold text-white">{headline.cropCount}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wide text-white/50">Producers</p>
              <p className="mt-2 text-2xl font-semibold text-white">{headline.producerCount}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wide text-white/50">Production</p>
              <p className="mt-2 text-2xl font-semibold text-[#07f880]">{formatNumber(headline.totalProduction, ' t')}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wide text-white/50">Energy</p>
              <p className="mt-2 text-2xl font-semibold text-sky-300">{formatNumber(headline.totalEnergy, ' kWh')}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wide text-white/50">Water</p>
              <p className="mt-2 text-2xl font-semibold text-cyan-300">{formatNumber(headline.totalWater, ' m³')}</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Leaf className="h-4 w-4 text-[#07f880]" />
              Crop Portfolio Statistics
            </h2>
            <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-left">
                <thead className="bg-white/[0.05] text-[11px] uppercase tracking-wide text-white/60">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Crop</th>
                    <th className="px-3 py-2.5 font-medium">Farms</th>
                    <th className="px-3 py-2.5 font-medium">Polygons</th>
                    <th className="px-3 py-2.5 font-medium">Production</th>
                    <th className="px-3 py-2.5 font-medium">Energy</th>
                    <th className="px-3 py-2.5 font-medium">Water</th>
                    <th className="px-3 py-2.5 font-medium">Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cropAggregates.map((crop, index) => (
                    <tr
                      key={crop.cropName}
                      className={`text-xs text-white/85 ${index % 2 === 0 ? 'bg-white/[0.01]' : 'bg-transparent'}`}
                    >
                      <td className="px-3 py-2.5 font-medium text-white">{crop.cropName}</td>
                      <td className="px-3 py-2.5">{crop.farmsCount}</td>
                      <td className="px-3 py-2.5">{crop.polygonsCount}</td>
                      <td className="px-3 py-2.5">{formatNumber(crop.totalProductionTons, ' t')}</td>
                      <td className="px-3 py-2.5">{formatNumber(crop.totalEnergyKwh, ' kWh')}</td>
                      <td className="px-3 py-2.5">{formatNumber(crop.totalWaterM3, ' m³')}</td>
                      <td className="px-3 py-2.5 text-[#07f880]">{formatScore(crop.averageScore)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/[0.08] p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                <TrendingUp className="h-4 w-4" />
                Most Efficient Producers
              </h2>
              <div className="mt-3 space-y-2">
                {producerRanking.mostEfficient.length === 0 ? (
                  <p className="text-xs text-emerald-100/70">No producers available.</p>
                ) : (
                  producerRanking.mostEfficient.map((entry, index) => (
                    <div key={`${entry.pointId}-best`} className="rounded-lg border border-emerald-300/25 bg-black/20 px-3 py-2">
                      <p className="text-xs font-medium text-emerald-100">
                        #{index + 1} {getProducerDisplayName(entry.pointId, producerLabelsById)}
                      </p>
                      <p className="mt-1 text-[11px] text-emerald-100/80">
                        Efficiency {entry.efficiencyScore.toFixed(2)} • Score {formatScore(entry.averagePolygonScore)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-red-400/30 bg-red-500/[0.08] p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-red-200">
                <TrendingDown className="h-4 w-4" />
                Least Efficient Producers
              </h2>
              <div className="mt-3 space-y-2">
                {producerRanking.leastEfficient.length === 0 ? (
                  <p className="text-xs text-red-100/70">No producers available.</p>
                ) : (
                  producerRanking.leastEfficient.map((entry, index) => (
                    <div key={`${entry.pointId}-worst`} className="rounded-lg border border-red-300/25 bg-black/20 px-3 py-2">
                      <p className="text-xs font-medium text-red-100">
                        #{index + 1} {getProducerDisplayName(entry.pointId, producerLabelsById)}
                      </p>
                      <p className="mt-1 text-[11px] text-red-100/80">
                        Efficiency {entry.efficiencyScore.toFixed(2)} • Score {formatScore(entry.averagePolygonScore)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
