'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, BarChart3, Cpu, Droplets, Flame, Gauge, Leaf, TrendingDown, TrendingUp } from 'lucide-react'
import { buildGrowaContext } from '@/lib/ai/build-growa-context'
import { GrowaIntelligencePanel } from '@/components/dashboard/growa-intelligence-panel'
import {
  IntelligenceCommandLayout,
  IntelligenceDataTable,
  IntelligenceErrorState,
  IntelligenceHero,
  IntelligenceKpiCard,
  IntelligenceLoadingState,
  IntelligencePanel,
  IntelligenceProducerCard,
  IntelligenceTableBody,
  IntelligenceTableHead,
  IntelligenceWorkspaceRoot,
} from '@/components/dashboard/intelligence-workspace-ui'

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
    <IntelligenceWorkspaceRoot>
      <IntelligenceHero
        eyebrow="Operational Intelligence Layer"
        title="Data Analytics Command"
        description="Unified command view for crop performance, resource pressure, and producer efficiency across all mapped farm points."
        icon={BarChart3}
        statusItems={[
          { label: 'Status', value: 'Live', accent: true },
          { label: 'Grid', value: 'Online' },
          { label: 'Signal', value: formatScore(analyticsMeta.avgPolygonScore) },
          { label: 'Polygons', value: String(polygons.length) },
        ]}
      />

      {loading ? (
        <IntelligenceLoadingState message="Loading analytics..." />
      ) : error ? (
        <IntelligenceErrorState message={error} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <IntelligenceKpiCard label="Crops tracked" value={String(headline.cropCount)} />
            <IntelligenceKpiCard label="Producers" value={String(headline.producerCount)} />
            <IntelligenceKpiCard
              label="Production"
              value={formatNumber(headline.totalProduction, ' t')}
              icon={Activity}
              accent
            />
            <IntelligenceKpiCard
              label="Energy"
              value={formatNumber(headline.totalEnergy, ' kWh')}
              icon={Cpu}
            />
            <IntelligenceKpiCard
              label="Water"
              value={formatNumber(headline.totalWater, ' m³')}
              icon={Droplets}
            />
            <IntelligenceKpiCard
              label="Resource / Ton"
              value={formatNumber(analyticsMeta.resourceIntensityPerTon)}
              icon={Gauge}
            />
          </div>

          <IntelligenceCommandLayout
            main={
              <IntelligencePanel
                title="Crop Intelligence Matrix"
                subtitle="Resource and production profile by crop family."
                icon={Leaf}
              >
                <IntelligenceDataTable>
                  <IntelligenceTableHead>
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Crop</th>
                      <th className="px-3 py-2.5 font-medium">Farms</th>
                      <th className="px-3 py-2.5 font-medium">Polygons</th>
                      <th className="px-3 py-2.5 font-medium">Production</th>
                      <th className="px-3 py-2.5 font-medium">Energy</th>
                      <th className="px-3 py-2.5 font-medium">Water</th>
                      <th className="px-3 py-2.5 font-medium">Score</th>
                    </tr>
                  </IntelligenceTableHead>
                  <IntelligenceTableBody>
                    {cropAggregates.map((crop, index) => (
                      <tr
                        key={crop.cropName}
                        onClick={() => navigateToCropOnMap(crop.cropName)}
                        className={`cursor-pointer text-sm text-foreground transition-colors hover:bg-primary/10 ${
                          index % 2 === 0 ? 'bg-card/60' : 'bg-secondary/20'
                        }`}
                      >
                        <td className="px-3 py-2.5 font-medium">{crop.cropName}</td>
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
                  </IntelligenceTableBody>
                </IntelligenceDataTable>
              </IntelligencePanel>
            }
            insights={
              <>
                <IntelligencePanel title="System Pulse">
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-sm">
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
                      <div className="rounded-md border border-border bg-secondary/40 px-2.5 py-2">
                        <p className="text-muted-foreground">Top crop</p>
                        <p className="mt-1 font-medium">{analyticsMeta.topCrop?.cropName || 'N/A'}</p>
                      </div>
                      <div className="rounded-md border border-border bg-secondary/40 px-2.5 py-2">
                        <p className="text-muted-foreground">Efficiency spread</p>
                        <p className="mt-1 font-medium">{formatNumber(analyticsMeta.efficiencySpread)}</p>
                      </div>
                    </div>
                    <div className="rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-sm">
                      <p className="flex items-center gap-1 text-muted-foreground">
                        <Flame className="h-3.5 w-3.5 text-primary" />
                        Production efficiency
                      </p>
                      <p className="mt-1 font-medium">
                        {formatNumber(analyticsMeta.productionEfficiency, ' t / resource-unit')}
                      </p>
                    </div>
                  </div>
                </IntelligencePanel>

                <IntelligencePanel title="Most Efficient Producers" icon={TrendingUp} variant="success">
                  <div className="space-y-2">
                    {producerRanking.mostEfficient.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No producers available.</p>
                    ) : (
                      producerRanking.mostEfficient.map((entry, index) => (
                        <IntelligenceProducerCard
                          key={`${entry.pointId}-best`}
                          rank={index + 1}
                          name={getProducerDisplayName(entry.pointId, producerLabelsById)}
                          lines={[
                            `Efficiency ${entry.efficiencyScore.toFixed(2)} • Score ${formatScore(entry.averagePolygonScore)}`,
                            `Variety ${entry.cropVarietyCount} • Production ${formatNumber(entry.productionTons, ' t')}`,
                          ]}
                          onClick={() => navigateToProducerPoint(entry.pointId)}
                          variant="success"
                        />
                      ))
                    )}
                  </div>
                </IntelligencePanel>

                <IntelligencePanel title="Least Efficient Producers" icon={TrendingDown} variant="warning">
                  <div className="space-y-2">
                    {producerRanking.leastEfficient.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No producers available.</p>
                    ) : (
                      producerRanking.leastEfficient.map((entry, index) => (
                        <IntelligenceProducerCard
                          key={`${entry.pointId}-worst`}
                          rank={index + 1}
                          name={getProducerDisplayName(entry.pointId, producerLabelsById)}
                          lines={[
                            `Efficiency ${entry.efficiencyScore.toFixed(2)} • Score ${formatScore(entry.averagePolygonScore)}`,
                            `Variety ${entry.cropVarietyCount} • Production ${formatNumber(entry.productionTons, ' t')}`,
                          ]}
                          onClick={() => navigateToProducerPoint(entry.pointId)}
                          variant="warning"
                        />
                      ))
                    )}
                  </div>
                </IntelligencePanel>
              </>
            }
            assistant={<GrowaIntelligencePanel module="data-analytics" context={growaContext} />}
          />
        </>
      )}
    </IntelligenceWorkspaceRoot>
  )
}
