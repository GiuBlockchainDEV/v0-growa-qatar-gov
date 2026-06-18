'use client'

import { useMemo } from 'react'
import { Bolt, Gauge, LineChart, Zap } from 'lucide-react'
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
  normalizePointLabel,
  formatNumber,
  formatScore,
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

  const energyMeta = useMemo(() => {
    const energyPerTon = headline.totalEnergy / Math.max(1, headline.totalProduction)
    const averageEnergyPerFarm = headline.totalEnergy / Math.max(1, headline.producerCount)
    return { energyPerTon, averageEnergyPerFarm }
  }, [headline.totalEnergy, headline.totalProduction, headline.producerCount])

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
      energyMeta,
    })
  }, [
    analyticsMeta,
    cropAggregates,
    energyMeta,
    error,
    headline,
    insights,
    loading,
    polygons,
    producerLabelsById,
    producerRanking,
  ])

  return (
    <IntelligenceWorkspaceRoot>
      <IntelligenceHero
        eyebrow="Resource Intelligence Layer"
        title="Energy Intelligence Command"
        description="Track grid pressure, crop energy intensity, and producer efficiency. Click any row or producer to focus the map."
        icon={Bolt}
        statusItems={[
          { label: 'Status', value: 'Live', accent: true },
          { label: 'Polygons', value: String(polygons.length) },
          { label: 'Energy / Ton', value: formatNumber(energyMeta.energyPerTon, ' kWh/t') },
          { label: 'Signal', value: formatScore(analyticsMeta.avgPolygonScore) },
        ]}
      />

      {loading ? (
        <IntelligenceLoadingState message="Loading energy intelligence..." />
      ) : error ? (
        <IntelligenceErrorState message={error} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <IntelligenceKpiCard
              label="Total Energy"
              value={formatNumber(headline.totalEnergy, ' kWh')}
              icon={Bolt}
            />
            <IntelligenceKpiCard
              label="Average / Farm"
              value={formatNumber(energyMeta.averageEnergyPerFarm, ' kWh')}
            />
            <IntelligenceKpiCard
              label="Energy / Ton"
              value={formatNumber(energyMeta.energyPerTon, ' kWh/t')}
              tone="amber"
            />
            <IntelligenceKpiCard
              label="Polygon Score"
              value={formatScore(analyticsMeta.avgPolygonScore)}
              accent
            />
          </div>

          <IntelligenceCommandLayout
            main={
              <IntelligencePanel
                title="Energy by Crop"
                subtitle="Click a crop row to focus the map on related polygons."
                icon={LineChart}
              >
                <IntelligenceDataTable>
                  <IntelligenceTableHead>
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Crop</th>
                      <th className="px-3 py-2.5 font-medium">Energy</th>
                      <th className="px-3 py-2.5 font-medium">Production</th>
                      <th className="px-3 py-2.5 font-medium">Energy / Ton</th>
                      <th className="px-3 py-2.5 font-medium">Score</th>
                    </tr>
                  </IntelligenceTableHead>
                  <IntelligenceTableBody>
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
                          <td className="px-3 py-2.5 font-medium">{crop.cropName}</td>
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
                  </IntelligenceTableBody>
                </IntelligenceDataTable>
              </IntelligencePanel>
            }
            insights={
              <>
                <IntelligencePanel title="Highest Efficiency" icon={Gauge} variant="success">
                  <div className="space-y-2">
                    {producerRanking.mostEfficient.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No producer data available.</p>
                    ) : (
                      producerRanking.mostEfficient.map((entry, index) => (
                        <IntelligenceProducerCard
                          key={`energy-best-${entry.pointId}`}
                          rank={index + 1}
                          name={normalizePointLabel(entry.pointId, producerLabelsById)}
                          lines={[
                            `Score ${entry.averagePolygonScore.toFixed(1)}/100 • Intensity ${formatNumber(entry.resourceIntensity / Math.max(1, entry.productionTons), ' unit/t')}`,
                          ]}
                          onClick={() => navigateToProducerPoint(entry.pointId)}
                          variant="success"
                        />
                      ))
                    )}
                  </div>
                </IntelligencePanel>

                <IntelligencePanel title="Lowest Efficiency" icon={Zap}>
                  <div className="space-y-2">
                    {producerRanking.leastEfficient.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No producer data available.</p>
                    ) : (
                      producerRanking.leastEfficient.map((entry, index) => (
                        <IntelligenceProducerCard
                          key={`energy-worst-${entry.pointId}`}
                          rank={index + 1}
                          name={normalizePointLabel(entry.pointId, producerLabelsById)}
                          lines={[
                            `Score ${entry.averagePolygonScore.toFixed(1)}/100 • Intensity ${formatNumber(entry.resourceIntensity / Math.max(1, entry.productionTons), ' unit/t')}`,
                          ]}
                          onClick={() => navigateToProducerPoint(entry.pointId)}
                        />
                      ))
                    )}
                  </div>
                </IntelligencePanel>
              </>
            }
            assistant={<GrowaIntelligencePanel module="energy-intelligence" context={growaContext} />}
          />
        </>
      )}
    </IntelligenceWorkspaceRoot>
  )
}
