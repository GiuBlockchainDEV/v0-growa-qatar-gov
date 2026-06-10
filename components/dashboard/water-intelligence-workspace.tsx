'use client'

import { useMemo } from 'react'
import { Droplets, Gauge, Target, Waves } from 'lucide-react'
import {
  type IntelligenceAggregate,
  clampScore,
  formatNumber,
  formatScore,
  normalizePointLabel,
  scoreColor,
  scoreSurface,
  useIntelligenceData,
  useMapNavigation,
} from './intelligence-metrics-shared'

export function WaterIntelligenceWorkspace() {
  const { loading, error, cropAggregates, producerRanking, headline, analyticsMeta, producerLabelsById } =
    useIntelligenceData()
  const { navigateToCropOnMap, navigateToProducerPoint } = useMapNavigation('water-intelligence')

  const waterMeta = useMemo(() => {
    const avgWaterPerTon = headline.totalWater / Math.max(1, headline.totalProduction)
    const totalResource = headline.totalEnergy + headline.totalWater
    const irrigationPressure = totalResource > 0 ? (headline.totalWater / totalResource) * 100 : 0
    return { avgWaterPerTon, irrigationPressure }
  }, [headline.totalEnergy, headline.totalProduction, headline.totalWater])

  const waterLeaders = useMemo(
    () =>
      [...cropAggregates]
        .sort((a, b) => {
          const aIntensity = a.totalWaterM3 / Math.max(1, a.totalProductionTons)
          const bIntensity = b.totalWaterM3 / Math.max(1, b.totalProductionTons)
          return bIntensity - aIntensity
        })
        .slice(0, 8),
    [cropAggregates]
  )

  const topHydrationFarms = producerRanking.mostEfficient.slice(0, 5)
  const atRiskFarms = producerRanking.leastEfficient.slice(0, 5)

  const renderCropRow = (crop: IntelligenceAggregate, index: number) => {
    const waterPerTon = crop.totalWaterM3 / Math.max(1, crop.totalProductionTons)
    return (
      <tr
        key={crop.cropName}
        onClick={() => navigateToCropOnMap(crop.cropName)}
        className={`cursor-pointer text-sm text-foreground transition-colors hover:bg-primary/10 ${
          index % 2 === 0 ? 'bg-card/60' : 'bg-secondary/20'
        }`}
      >
        <td className="px-3 py-2.5 font-medium text-foreground">{crop.cropName}</td>
        <td className="px-3 py-2.5">{formatNumber(crop.totalWaterM3, ' m³')}</td>
        <td className="px-3 py-2.5">{formatNumber(waterPerTon, ' m³/t')}</td>
        <td className="px-3 py-2.5">{crop.polygonsCount}</td>
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
    )
  }

  return (
    <div className="space-y-6 p-6 pt-20 text-foreground">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_0_0_1px_rgba(7,248,128,0.08),0_20px_50px_rgba(0,0,0,0.35)]">
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <Droplets className="h-6 w-6 text-primary" />
          Water Intelligence
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Live water intelligence with crop and farm focus actions. Click a crop or producer card to move the lateral
          map to the relevant polygons/farm.
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card/60 p-8 text-center text-base text-muted-foreground">
          Loading water intelligence...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
              <p className="text-xs uppercase tracking-wide text-primary/90">Total Water</p>
              <p className="mt-2 text-2xl font-semibold text-primary">{formatNumber(headline.totalWater, ' m³')}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Water Intensity</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatNumber(waterMeta.avgWaterPerTon, ' m³/t')}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Irrigation Pressure</p>
              <p className="mt-2 text-2xl font-semibold text-sky-300">{formatNumber(waterMeta.irrigationPressure, '%')}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Average Polygon Score</p>
              <p
                className="mt-2 text-2xl font-semibold"
                style={{ color: scoreColor(analyticsMeta.avgPolygonScore) }}
              >
                {formatScore(analyticsMeta.avgPolygonScore)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
            <div className="rounded-xl border border-border bg-card p-5 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.06)]">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Waves className="h-4 w-4 text-primary" />
                Crop Water Matrix
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">Sorted by water intensity (m³ per production ton).</p>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border text-left">
                  <thead className="bg-secondary/50 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Crop</th>
                      <th className="px-3 py-2.5 font-medium">Water</th>
                      <th className="px-3 py-2.5 font-medium">Intensity</th>
                      <th className="px-3 py-2.5 font-medium">Polygons</th>
                      <th className="px-3 py-2.5 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {waterLeaders.map((crop, index) => renderCropRow(crop, index))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Gauge className="h-4 w-4 text-primary" />
                  Low-intensity leaders
                </h3>
                <div className="mt-3 space-y-2">
                  {topHydrationFarms.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No farms available.</p>
                  ) : (
                    topHydrationFarms.map((farm, index) => (
                      <button
                        key={`${farm.pointId}-water-good`}
                        type="button"
                        onClick={() => navigateToProducerPoint(farm.pointId)}
                        className="w-full rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-left hover:bg-primary/15"
                      >
                        <p className="text-sm font-medium text-foreground">
                          #{index + 1} {normalizePointLabel(farm.pointId, producerLabelsById)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Efficiency {farm.efficiencyScore.toFixed(2)} • Score {formatScore(farm.averagePolygonScore)}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Target className="h-4 w-4 text-amber-300" />
                  High-use farms
                </h3>
                <div className="mt-3 space-y-2">
                  {atRiskFarms.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No farms available.</p>
                  ) : (
                    atRiskFarms.map((farm, index) => (
                      <button
                        key={`${farm.pointId}-water-risk`}
                        type="button"
                        onClick={() => navigateToProducerPoint(farm.pointId)}
                        className="w-full rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-left hover:bg-amber-500/15"
                      >
                        <p className="text-sm font-medium text-foreground">
                          #{index + 1} {normalizePointLabel(farm.pointId, producerLabelsById)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Resource {formatNumber(farm.resourceIntensity)} • Variety {farm.cropVarietyCount}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 h-2 rounded bg-secondary/70">
              <div
                className="h-2 rounded"
                style={{
                  width: `${clampScore(analyticsMeta.avgPolygonScore)}%`,
                  backgroundColor: scoreColor(analyticsMeta.avgPolygonScore),
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              System water performance baseline follows polygon score distribution across all monitored farms.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
