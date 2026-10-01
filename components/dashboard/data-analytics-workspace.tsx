'use client'

import { scoreToRampColor } from '@/lib/watchtower/map-layer-colors'

import { useEffect, useMemo, useState } from 'react'
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
  IntelligenceWorkspaceBody,
  IntelligenceWorkspaceCommand,
  IntelligenceWorkspaceHeader,
  IntelligenceWorkspaceRoot,
} from '@/components/dashboard/intelligence-workspace-ui'
import { useMapNavigation } from '@/components/dashboard/intelligence-metrics-shared'
import { OperationalContextBanner } from '@/components/dashboard/operational-context-banner'
import { sharedFetch } from '@/lib/client/shared-fetch'
import { useI18n } from '@/lib/i18n'

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
  // Brand performance ramp (lib/watchtower/map-layer-colors.ts).
  return scoreToRampColor(clampScore(value))
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
  const { tr } = useI18n()
  const { navigateToCropOnMap, navigateToProducerPoint } = useMapNavigation('data-analytics')
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
          sharedFetch('/api/operations/farm-crop-insights'),
          sharedFetch('/api/operations/custom-point-polygons'),
          sharedFetch('/api/operations/custom-map-points'),
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

  return (
    <IntelligenceWorkspaceRoot layout="scroll">
      <IntelligenceWorkspaceHeader>
      <IntelligenceHero
        eyebrow={tr('Operational intelligence layer')}
        title={tr('Data analytics command')}
        description={tr('Unified command view for crop performance, resource pressure, and producer efficiency across all mapped farm points.')}
        icon={BarChart3}
        statusItems={[
          { label: tr('Status'), value: tr('Live'), accent: true },
          { label: tr('Grid'), value: tr('Online') },
          { label: tr('Signal'), value: formatScore(analyticsMeta.avgPolygonScore) },
          { label: tr('Polygons'), value: String(polygons.length) },
        ]}
      />

      </IntelligenceWorkspaceHeader>

      <OperationalContextBanner />

      {loading ? (
        <IntelligenceLoadingState message={tr('Loading analytics…')} />
      ) : error ? (
        <IntelligenceErrorState message={tr(error)} />
      ) : (
        <IntelligenceWorkspaceBody scrollable>
          {/* Six figures in one row were cut to "200,0…": three per row. */}
          <div className="mb-3 grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3">
            <IntelligenceKpiCard label={tr('Crops tracked')} value={String(headline.cropCount)} />
            <IntelligenceKpiCard label={tr('Producers')} value={String(headline.producerCount)} />
            <IntelligenceKpiCard
              label={tr('Production')}
              value={formatNumber(headline.totalProduction, ' t')}
              icon={Activity}
              accent
            />
            <IntelligenceKpiCard
              label={tr('Energy')}
              value={formatNumber(headline.totalEnergy, ' kWh')}
              icon={Cpu}
            />
            <IntelligenceKpiCard
              label={tr('Water')}
              value={formatNumber(headline.totalWater, ' m³')}
              icon={Droplets}
            />
            <IntelligenceKpiCard
              label={tr('Resource / ton')}
              value={formatNumber(analyticsMeta.resourceIntensityPerTon)}
              icon={Gauge}
            />
          </div>

          <IntelligenceWorkspaceCommand variant="stacked">
          <IntelligenceCommandLayout
            variant="stacked"
            main={
              <IntelligencePanel
                title={tr('Crop intelligence matrix')}
                subtitle={tr('Resource and production profile by crop family.')}
                icon={Leaf}
              >
                <IntelligenceDataTable>
                  <IntelligenceTableHead>
                    <tr>
                      <th className="px-3 py-2.5">{tr('Crop')}</th>
                      <th className="px-3 py-2.5">{tr('Farms')}</th>
                      <th className="px-3 py-2.5">{tr('Polygons')}</th>
                      <th className="px-3 py-2.5">{tr('Production')}</th>
                      <th className="px-3 py-2.5">{tr('Energy')}</th>
                      <th className="px-3 py-2.5">{tr('Water')}</th>
                      <th className="px-3 py-2.5">{tr('Score')}</th>
                    </tr>
                  </IntelligenceTableHead>
                  <IntelligenceTableBody>
                    {cropAggregates.map((crop) => (
                      <tr
                        key={crop.cropName}
                        onClick={() => navigateToCropOnMap(crop.cropName)}
                        className="cursor-pointer text-[13px] text-content transition-colors hover:bg-muted"
                      >
                        <td className="px-3 py-2.5" style={{ fontWeight: 500 }}>{crop.cropName}</td>
                        <td className="px-3 py-2.5">{crop.farmsCount}</td>
                        <td className="px-3 py-2.5">{crop.polygonsCount}</td>
                        <td className="px-3 py-2.5">{formatNumber(crop.totalProductionTons, ' t')}</td>
                        <td className="px-3 py-2.5">{formatNumber(crop.totalEnergyKwh, ' kWh')}</td>
                        <td className="px-3 py-2.5">{formatNumber(crop.totalWaterM3, ' m³')}</td>
                        <td className="px-3 py-2.5">
                          <span className="g-tag g-tag--outline-ink tabular-nums" style={{ height: 22, padding: '0 9px', fontSize: 11 }}>
            <span aria-hidden="true" className="w-1.5 h-1.5" style={{ borderRadius: 1, background: scoreColor(crop.averageScore) }} />
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
                <IntelligencePanel title={tr('System pulse')}>
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span>{tr('Average polygon score')}</span>
                        <span style={{ color: scoreColor(analyticsMeta.avgPolygonScore) }}>
                          {formatScore(analyticsMeta.avgPolygonScore)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden" style={{ background: 'var(--growa-stone-200)', borderRadius: 2 }}>
                        <div
                          className="h-2"
                          style={{
                            width: `${clampScore(analyticsMeta.avgPolygonScore)}%`,
                            backgroundColor: scoreColor(analyticsMeta.avgPolygonScore),
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg border border-line bg-card px-3 py-2.5">
                        <p className="text-content-soft">{tr('Top crop')}</p>
                        <p className="mt-1 font-medium">{analyticsMeta.topCrop?.cropName || tr('N/A')}</p>
                      </div>
                      <div className="rounded-lg border border-line bg-card px-3 py-2.5">
                        <p className="text-content-soft">{tr('Efficiency spread')}</p>
                        <p className="mt-1 font-medium">{formatNumber(analyticsMeta.efficiencySpread)}</p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-line bg-card px-3 py-2.5 text-sm">
                      <p className="flex items-center gap-1 text-content-soft">
                        <Flame strokeWidth={1.5} className="h-3.5 w-3.5 text-content-soft" />
                        {tr('Production efficiency')}
                      </p>
                      <p className="mt-1 font-medium">
                        {formatNumber(analyticsMeta.productionEfficiency, ' t / resource-unit')}
                      </p>
                    </div>
                  </div>
                </IntelligencePanel>

                <IntelligencePanel title={tr('Most efficient producers')} icon={TrendingUp} variant="success">
                  <div className="space-y-2">
                    {producerRanking.mostEfficient.length === 0 ? (
                      <p className="text-sm text-content-soft">{tr('No producers available.')}</p>
                    ) : (
                      producerRanking.mostEfficient.map((entry, index) => (
                        <IntelligenceProducerCard
                          key={`${entry.pointId}-best`}
                          rank={index + 1}
                          name={getProducerDisplayName(entry.pointId, producerLabelsById)}
                          lines={[
                            tr('Efficiency {efficiency} · Score {score}', { efficiency: entry.efficiencyScore.toFixed(2), score: formatScore(entry.averagePolygonScore) }),
                            tr('Variety {count} · Production {production}', { count: entry.cropVarietyCount, production: formatNumber(entry.productionTons, ' t') }),
                          ]}
                          onClick={() => navigateToProducerPoint(entry.pointId)}
                          variant="success"
                        />
                      ))
                    )}
                  </div>
                </IntelligencePanel>

                <IntelligencePanel title={tr('Least efficient producers')} icon={TrendingDown} variant="warning">
                  <div className="space-y-2">
                    {producerRanking.leastEfficient.length === 0 ? (
                      <p className="text-sm text-content-soft">{tr('No producers available.')}</p>
                    ) : (
                      producerRanking.leastEfficient.map((entry, index) => (
                        <IntelligenceProducerCard
                          key={`${entry.pointId}-worst`}
                          rank={index + 1}
                          name={getProducerDisplayName(entry.pointId, producerLabelsById)}
                          lines={[
                            tr('Efficiency {efficiency} · Score {score}', { efficiency: entry.efficiencyScore.toFixed(2), score: formatScore(entry.averagePolygonScore) }),
                            tr('Variety {count} · Production {production}', { count: entry.cropVarietyCount, production: formatNumber(entry.productionTons, ' t') }),
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
          </IntelligenceWorkspaceCommand>
        </IntelligenceWorkspaceBody>
      )}
    </IntelligenceWorkspaceRoot>
  )
}
