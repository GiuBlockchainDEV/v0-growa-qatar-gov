'use client'

import { useMemo } from 'react'
import { Droplets, Gauge, Target, Waves } from 'lucide-react'
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
  const {
    loading,
    error,
    insights,
    polygons,
    cropAggregates,
    producerRanking,
    headline,
    analyticsMeta,
    producerLabelsById,
  } = useIntelligenceData()
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

  const growaContext = useMemo(() => {
    if (loading || error) return null
    return buildGrowaContext({
      module: 'water-intelligence',
      insights,
      polygons,
      producerLabelsById,
      cropAggregates,
      producerRanking,
      headline,
      analyticsMeta,
      waterMeta,
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
    waterMeta,
  ])

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
        <td className="px-3 py-2.5 font-medium">{crop.cropName}</td>
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
    <IntelligenceWorkspaceRoot>
      <IntelligenceHero
        eyebrow="Resource Intelligence Layer"
        title="Water Intelligence"
        description="Monitor irrigation pressure, crop water intensity, and farm-level consumption. Click any row or producer to focus the map."
        icon={Droplets}
        statusItems={[
          { label: 'Status', value: 'Live', accent: true },
          { label: 'Polygons', value: String(polygons.length) },
          { label: 'Signal', value: formatScore(analyticsMeta.avgPolygonScore) },
          { label: 'Pressure', value: formatNumber(waterMeta.irrigationPressure, '%') },
        ]}
      />

      {loading ? (
        <IntelligenceLoadingState message="Loading water intelligence..." />
      ) : error ? (
        <IntelligenceErrorState message={error} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <IntelligenceKpiCard
              label="Total Water"
              value={formatNumber(headline.totalWater, ' m³')}
              icon={Droplets}
              accent
            />
            <IntelligenceKpiCard
              label="Water Intensity"
              value={formatNumber(waterMeta.avgWaterPerTon, ' m³/t')}
            />
            <IntelligenceKpiCard
              label="Irrigation Pressure"
              value={formatNumber(waterMeta.irrigationPressure, '%')}
              tone="sky"
            />
            <IntelligenceKpiCard label="Polygon Score" value={formatScore(analyticsMeta.avgPolygonScore)} />
          </div>

          <IntelligenceCommandLayout
            main={
              <IntelligencePanel
                title="Crop Water Matrix"
                subtitle="Sorted by water intensity (m³ per production ton)."
                icon={Waves}
              >
                <IntelligenceDataTable>
                  <IntelligenceTableHead>
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Crop</th>
                      <th className="px-3 py-2.5 font-medium">Water</th>
                      <th className="px-3 py-2.5 font-medium">Intensity</th>
                      <th className="px-3 py-2.5 font-medium">Polygons</th>
                      <th className="px-3 py-2.5 font-medium">Score</th>
                    </tr>
                  </IntelligenceTableHead>
                  <IntelligenceTableBody>
                    {waterLeaders.map((crop, index) => renderCropRow(crop, index))}
                  </IntelligenceTableBody>
                </IntelligenceDataTable>
              </IntelligencePanel>
            }
            insights={
              <>
                <IntelligencePanel title="System Baseline" icon={Gauge}>
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
                    Water performance baseline across {headline.producerCount} monitored producers.
                  </p>
                </IntelligencePanel>

                <IntelligencePanel title="Low-intensity Leaders" variant="success">
                  <div className="space-y-2">
                    {producerRanking.mostEfficient.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No farms available.</p>
                    ) : (
                      producerRanking.mostEfficient.map((farm, index) => (
                        <IntelligenceProducerCard
                          key={`${farm.pointId}-water-good`}
                          rank={index + 1}
                          name={normalizePointLabel(farm.pointId, producerLabelsById)}
                          lines={[
                            `Efficiency ${farm.efficiencyScore.toFixed(2)} • Score ${formatScore(farm.averagePolygonScore)}`,
                          ]}
                          onClick={() => navigateToProducerPoint(farm.pointId)}
                          variant="success"
                        />
                      ))
                    )}
                  </div>
                </IntelligencePanel>

                <IntelligencePanel title="High-use Farms" icon={Target} variant="warning">
                  <div className="space-y-2">
                    {producerRanking.leastEfficient.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No farms available.</p>
                    ) : (
                      producerRanking.leastEfficient.map((farm, index) => (
                        <IntelligenceProducerCard
                          key={`${farm.pointId}-water-risk`}
                          rank={index + 1}
                          name={normalizePointLabel(farm.pointId, producerLabelsById)}
                          lines={[
                            `Resource ${formatNumber(farm.resourceIntensity)} • Variety ${farm.cropVarietyCount}`,
                          ]}
                          onClick={() => navigateToProducerPoint(farm.pointId)}
                          variant="warning"
                        />
                      ))
                    )}
                  </div>
                </IntelligencePanel>
              </>
            }
            assistant={<GrowaIntelligencePanel module="water-intelligence" context={growaContext} />}
          />
        </>
      )}
    </IntelligenceWorkspaceRoot>
  )
}
