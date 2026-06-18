'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, BarChart3, Cpu, Droplets, Flame, Gauge, Leaf, TrendingDown, TrendingUp } from 'lucide-react'
import { buildGrowaContext } from '@/lib/ai/build-growa-context'
import { GrowaIntelligencePanel } from '@/components/dashboard/growa-intelligence-panel'

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

interface MapPointLabelRow {
  id: string
  label: string
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

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value))
}

function scoreColor(value: number) {
  const normalized = clampScore(value)
  const hue = (normalized / 100) * 120
  return `hsl(${hue} 100% 56%)`
}

function scoreSurface(value: number, alpha = 0.16) {
  const normalized = clampScore(value)
  const hue = (normalized / 100) * 120
  return `hsl(${hue} 100% 56% / ${alpha})`
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

function getProducerDisplayName(pointId: string, labelsById: Record<string, string>) {
  const mapped = labelsById[pointId]
  if (mapped) return mapped
  return pointId
}

export function DataAnalyticsWorkspace() {
  const router = useRouter()
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
          throw new Error(
            (insightsPayload as { error?: string } | null)?.error || 'Failed to load crop insights'
          )
        }
        if (!polygonsResponse.ok) {
          throw new Error(
            (polygonsPayload as { error?: string } | null)?.error || 'Failed to load polygons'
          )
        }
        if (!pointsResponse.ok) {
          throw new Error((pointsPayload as { error?: string } | null)?.error || 'Failed to load map points')
        }

        if (cancelled) return
        setInsights(normalizeInsightRows(insightsPayload))
        setPolygons(normalizePolygonRows(polygonsPayload))
        const labelsById = normalizePointLabelRows(pointsPayload).reduce<Record<string, string>>((acc, row) => {
          acc[row.id] = row.label
          return acc
        }, {})
        setProducerLabelsById(labelsById)
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
      entry.efficiencyScore = entry.productionTons / denom
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

  const growaContext = useMemo(() => {
    if (loading || error) return null
    return buildGrowaContext({
      module: 'data-analytics',
      insights,
      polygons,
      producerLabelsById,
      cropAggregates,
      producerRanking,
      headline,
      analyticsMeta,
    })
  }, [
    analyticsMeta,
    cropAggregates,
    error,
    headline,
    insights,
    loading,
    polygons,
    producerLabelsById,
    producerRanking,
  ])

  const navigateToCropOnMap = (cropName: string) => {
    const normalized = cropName.trim()
    if (!normalized) return
    const focusToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const params = new URLSearchParams({
      module: 'data-analytics',
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
      module: 'data-analytics',
      pointId: normalizedPointId,
      zoom: '16',
      focus: focusToken,
    })
    router.push(`/dashboard?${params.toString()}`)
  }

  return (
    <div className="space-y-7 p-6 pt-20 text-foreground">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 shadow-[0_0_0_1px_rgba(7,248,128,0.08),0_24px_60px_rgba(0,0,0,0.38)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(7,248,128,0.14),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(7,248,128,0.08),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-primary">Operational Intelligence Layer</p>
              <h1 className="mt-2 flex items-center gap-2 text-4xl font-semibold text-foreground">
                <BarChart3 className="h-7 w-7 text-primary" />
                Data Analytics Command
              </h1>
              <p className="mt-3 max-w-2xl text-base text-muted-foreground">
                Unified command view for crop performance, resource pressure, and producer efficiency across all mapped
                farm points.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-primary">STATUS: LIVE</div>
              <div className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-foreground">GRID: ONLINE</div>
              <div className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-foreground">
                SIGNAL: {formatScore(analyticsMeta.avgPolygonScore)}
              </div>
              <div className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-foreground">
                TRACKED POLYGONS: {polygons.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card/60 p-8 text-center text-base text-muted-foreground">
          Loading analytics...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-xl border border-border bg-card/80 p-5 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)]">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Crops tracked</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{headline.cropCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 p-5 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)]">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Producers</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{headline.producerCount}</p>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-5 shadow-[inset_0_0_0_1px_rgba(7,248,128,0.16)]">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-primary/90">
                <Activity className="h-3.5 w-3.5" /> Production
              </p>
              <p className="mt-2 text-3xl font-semibold text-primary">{formatNumber(headline.totalProduction, ' t')}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 p-5 shadow-[inset_0_0_0_1px_rgba(7,248,128,0.08)]">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <Cpu className="h-3.5 w-3.5" /> Energy
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{formatNumber(headline.totalEnergy, ' kWh')}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 p-5 shadow-[inset_0_0_0_1px_rgba(7,248,128,0.08)]">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <Droplets className="h-3.5 w-3.5" /> Water
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{formatNumber(headline.totalWater, ' m³')}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 p-5 shadow-[inset_0_0_0_1px_rgba(7,248,128,0.08)]">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" /> Resource / Ton
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {formatNumber(analyticsMeta.resourceIntensityPerTon)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.8fr]">
            <div className="rounded-xl border border-border bg-card p-5 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.06)]">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Leaf className="h-5 w-5 text-primary" />
                Crop Intelligence Matrix
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Resource and production profile by crop family.</p>
              <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border text-left">
                  <thead className="bg-secondary/50 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Crop</th>
                      <th className="px-3 py-2.5 font-medium">Farms</th>
                      <th className="px-3 py-2.5 font-medium">Polygons</th>
                      <th className="px-3 py-2.5 font-medium">Production</th>
                      <th className="px-3 py-2.5 font-medium">Energy</th>
                      <th className="px-3 py-2.5 font-medium">Water</th>
                      <th className="px-3 py-2.5 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {cropAggregates.map((crop, index) => (
                      <tr
                        key={crop.cropName}
                        onClick={() => navigateToCropOnMap(crop.cropName)}
                        className={`cursor-pointer text-sm text-foreground transition-colors hover:bg-primary/10 ${
                          index % 2 === 0 ? 'bg-card/60' : 'bg-secondary/20'
                        }`}
                      >
                        <td className="px-3 py-2.5 font-medium text-foreground">{crop.cropName}</td>
                        <td className="px-3 py-2.5">{crop.farmsCount}</td>
                        <td className="px-3 py-2.5">{crop.polygonsCount}</td>
                        <td className="px-3 py-2.5">{formatNumber(crop.totalProductionTons, ' t')}</td>
                        <td className="px-3 py-2.5">{formatNumber(crop.totalEnergyKwh, ' kWh')}</td>
                        <td className="px-3 py-2.5">{formatNumber(crop.totalWaterM3, ' m³')}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className="rounded-md border px-2 py-1 font-semibold"
                            style={{
                              color: scoreColor(crop.averageScore),
                              borderColor: scoreSurface(crop.averageScore, 0.4),
                              backgroundColor: scoreSurface(crop.averageScore, 0.14),
                            }}
                          >
                            {formatScore(crop.averageScore)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-5 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.06)]">
                <h3 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">System pulse</h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm text-foreground">
                      <span>Average polygon score</span>
                      <span style={{ color: scoreColor(analyticsMeta.avgPolygonScore) }}>
                        {formatScore(analyticsMeta.avgPolygonScore)}
                      </span>
                    </div>
                    <div className="h-2 rounded bg-secondary/70">
                      <div
                        className="h-2 rounded"
                        style={{
                          width: `${clampScore(analyticsMeta.avgPolygonScore)}%`,
                          backgroundColor: scoreColor(analyticsMeta.avgPolygonScore),
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-foreground">
                      <p className="text-muted-foreground">Top crop</p>
                      <p className="mt-1 font-medium text-foreground">
                        {analyticsMeta.topCrop?.cropName || 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-foreground">
                      <p className="text-muted-foreground">Efficiency spread</p>
                      <p className="mt-1 font-medium text-foreground">
                        {formatNumber(analyticsMeta.efficiencySpread)}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-sm text-foreground">
                    <p className="flex items-center gap-1 text-muted-foreground">
                      <Flame className="h-3.5 w-3.5 text-primary" />
                      Production efficiency
                    </p>
                    <p className="mt-1 text-base font-medium text-foreground">
                      {formatNumber(analyticsMeta.productionEfficiency, ' t / resource-unit')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-primary/30 bg-primary/10 p-5">
                <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Most Efficient Producers
                </h2>
                <div className="mt-3 space-y-2">
                  {producerRanking.mostEfficient.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No producers available.</p>
                  ) : (
                    producerRanking.mostEfficient.map((entry, index) => (
                      <div
                        key={`${entry.pointId}-best`}
                        onClick={() => navigateToProducerPoint(entry.pointId)}
                        className="cursor-pointer rounded-lg border border-primary/30 bg-card/70 px-3 py-2.5 transition-colors hover:bg-primary/10"
                      >
                        <p className="text-sm font-medium text-foreground">
                          #{index + 1} {getProducerDisplayName(entry.pointId, producerLabelsById)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Efficiency {entry.efficiencyScore.toFixed(2)} • Score {formatScore(entry.averagePolygonScore)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Variety {entry.cropVarietyCount} • Production {formatNumber(entry.productionTons, ' t')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5">
                <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  Least Efficient Producers
                </h2>
                <div className="mt-3 space-y-2">
                  {producerRanking.leastEfficient.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No producers available.</p>
                  ) : (
                    producerRanking.leastEfficient.map((entry, index) => (
                      <div
                        key={`${entry.pointId}-worst`}
                        onClick={() => navigateToProducerPoint(entry.pointId)}
                        className="cursor-pointer rounded-lg border border-destructive/30 bg-card/70 px-3 py-2.5 transition-colors hover:bg-destructive/20"
                      >
                        <p className="text-sm font-medium text-foreground">
                          #{index + 1} {getProducerDisplayName(entry.pointId, producerLabelsById)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Efficiency {entry.efficiencyScore.toFixed(2)} • Score {formatScore(entry.averagePolygonScore)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Variety {entry.cropVarietyCount} • Production {formatNumber(entry.productionTons, ' t')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <GrowaIntelligencePanel module="data-analytics" context={growaContext} disabled={loading} />
        </>
      )}
    </div>
  )
}
