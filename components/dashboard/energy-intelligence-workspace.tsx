'use client'

import { useMemo } from 'react'
import { Bolt, Gauge, LineChart, Zap } from 'lucide-react'
import { buildGrowaContext } from '@/lib/ai/build-growa-context'
import { GrowaIntelligencePanel } from '@/components/dashboard/growa-intelligence-panel'
import {
  normalizePointLabel,
  formatNumber,
  scoreColor,
  scoreSurface,
  useIntelligenceData,
  useMapNavigation,
} from './intelligence-metrics-shared'

export function EnergyIntelligenceWorkspace() {
  const {
    loading,
    error,
    insights,
    cropAggregates,
    producerRanking,
    headline,
    producerLabelsById,
    polygons,
    analyticsMeta,
  } = useIntelligenceData()
  const { navigateToCropOnMap, navigateToProducerPoint } = useMapNavigation('energy-intelligence')

  const totalEnergy = headline.totalEnergy
  const totalProduction = headline.totalProduction
  const avgFarmEnergy = totalEnergy / Math.max(1, headline.producerCount)
  const energyPerTon = totalEnergy / Math.max(1, totalProduction)
  const avgPolygonScore =
    polygons.length > 0 ? polygons.reduce((sum, polygon) => sum + polygon.score, 0) / polygons.length : 0

  const growaContext = useMemo(() => {
    if (loading || error) return null
    return buildGrowaContext({
      module: 'energy-intelligence',
      insights,
      polygons,
      producerLabelsById,
      cropAggregates,
      producerRanking,
      headline,
      analyticsMeta,
      energyMeta: {
        energyPerTon,
        averageEnergyPerFarm: avgFarmEnergy,
      },
    })
  }, [
    analyticsMeta,
    avgFarmEnergy,
    cropAggregates,
    energyPerTon,
    error,
    headline,
    insights,
    loading,
    polygons,
    producerLabelsById,
    producerRanking,
  ])

  return (
    <div className="space-y-6 p-6 pt-20 text-foreground">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_0_0_1px_rgba(7,248,128,0.08),0_24px_60px_rgba(0,0,0,0.32)]">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">Energy Intelligence</p>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold text-foreground">
          <Bolt className="h-7 w-7 text-primary" />
          Energy Intelligence Command
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Real-time energy analytics across farm points, with map-linked focus for crops and producer sites.
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card/60 p-8 text-center text-base text-muted-foreground">
          Loading energy intelligence...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-card/80 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Total Energy</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(totalEnergy, ' kWh')}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Average / Farm</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(avgFarmEnergy, ' kWh')}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Energy / Ton</p>
              <p className="mt-2 text-2xl font-semibold text-amber-300">{formatNumber(energyPerTon, ' kWh/t')}</p>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-primary/90">Average Polygon Score</p>
              <p className="mt-2 text-2xl font-semibold text-primary">{avgPolygonScore.toFixed(1)} / 100</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_0.95fr]">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <LineChart className="h-5 w-5 text-primary" />
                Energy by Crop
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Click a crop row to focus the map laterally on Qatar and view related polygons.
              </p>
              <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border text-left">
                  <thead className="bg-secondary/50 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Crop</th>
                      <th className="px-3 py-2.5 font-medium">Energy</th>
                      <th className="px-3 py-2.5 font-medium">Production</th>
                      <th className="px-3 py-2.5 font-medium">Energy / Ton</th>
                      <th className="px-3 py-2.5 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {cropAggregates.map((crop, index) => {
                      const energyPerCropTon = crop.totalEnergyKwh / Math.max(1, crop.totalProductionTons)
                      return (
                        <tr
                          key={crop.cropName}
                          onClick={() => navigateToCropOnMap(crop.cropName)}
                          className={`cursor-pointer text-sm text-foreground transition-colors hover:bg-primary/10 ${
                            index % 2 === 0 ? 'bg-card/60' : 'bg-secondary/20'
                          }`}
                        >
                          <td className="px-3 py-2.5 font-medium text-foreground">{crop.cropName}</td>
                          <td className="px-3 py-2.5">{formatNumber(crop.totalEnergyKwh, ' kWh')}</td>
                          <td className="px-3 py-2.5">{formatNumber(crop.totalProductionTons, ' t')}</td>
                          <td className="px-3 py-2.5">{formatNumber(energyPerCropTon, ' kWh/t')}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className="rounded-md border px-2 py-1 font-semibold"
                              style={{
                                color: scoreColor(crop.averageScore),
                                borderColor: scoreSurface(crop.averageScore, 0.4),
                                backgroundColor: scoreSurface(crop.averageScore, 0.14),
                              }}
                            >
                              {crop.averageScore.toFixed(1)}/100
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-5">
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                  <Gauge className="h-4 w-4 text-primary" />
                  Highest Efficiency (Energy)
                </h3>
                <div className="space-y-2">
                  {producerRanking.mostEfficient.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No producer data available.</p>
                  ) : (
                    producerRanking.mostEfficient.map((entry, index) => (
                      <div
                        key={`energy-best-${entry.pointId}`}
                        onClick={() => navigateToProducerPoint(entry.pointId)}
                        className="cursor-pointer rounded-lg border border-primary/30 bg-card/70 px-3 py-2.5 transition-colors hover:bg-primary/10"
                      >
                        <p className="text-sm font-medium text-foreground">
                          #{index + 1} {normalizePointLabel(entry.pointId, producerLabelsById)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Score {entry.averagePolygonScore.toFixed(1)}/100 • Energy intensity{' '}
                          {formatNumber(entry.resourceIntensity / Math.max(1, entry.productionTons), ' unit/t')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                  <Zap className="h-4 w-4 text-primary" />
                  Lowest Efficiency (Energy)
                </h3>
                <div className="space-y-2">
                  {producerRanking.leastEfficient.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No producer data available.</p>
                  ) : (
                    producerRanking.leastEfficient.map((entry, index) => (
                      <div
                        key={`energy-worst-${entry.pointId}`}
                        onClick={() => navigateToProducerPoint(entry.pointId)}
                        className="cursor-pointer rounded-lg border border-white/15 bg-card/70 px-3 py-2.5 transition-colors hover:bg-white/10"
                      >
                        <p className="text-sm font-medium text-foreground">
                          #{index + 1} {normalizePointLabel(entry.pointId, producerLabelsById)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Score {entry.averagePolygonScore.toFixed(1)}/100 • Energy intensity{' '}
                          {formatNumber(entry.resourceIntensity / Math.max(1, entry.productionTons), ' unit/t')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <GrowaIntelligencePanel module="energy-intelligence" context={growaContext} disabled={loading} />
        </>
      )}
    </div>
  )
}
