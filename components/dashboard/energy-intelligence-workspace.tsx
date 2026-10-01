'use client'

import { useMemo } from 'react'
import { Bolt, Gauge, LineChart, Zap } from 'lucide-react'
import { buildGrowaContext } from '@/lib/ai/build-growa-context'
import { GrowaIntelligencePanel } from '@/components/dashboard/growa-intelligence-panel'
import {
  IntelligenceInvestigationLayout,
  InvestigationContextHeader,
} from '@/components/dashboard/intelligence-investigation-layout'
import {
  IntelligenceMapHint,
  IntelligenceModuleActions,
  IntelligenceWatchtowerChanges,
  IntelligenceWatchtowerForecast,
  IntelligenceWatchtowerSignals,
} from '@/components/dashboard/intelligence-investigation-shared'
import {
  IntelligenceCommandLayout,
  IntelligenceDataTable,
  IntelligenceErrorState,
  IntelligenceKpiCard,
  IntelligenceLoadingState,
  IntelligencePanel,
  IntelligenceProducerCard,
  IntelligenceTableBody,
  IntelligenceTableHead,
  IntelligenceWorkspaceBody,
  IntelligenceWorkspaceHeader,
  IntelligenceWorkspaceRoot,
} from '@/components/dashboard/intelligence-workspace-ui'
import { normalizePointLabel, formatNumber, formatScore, scoreColor, useIntelligenceData, useMapNavigation } from './intelligence-metrics-shared'
import { OperationalContextBanner } from '@/components/dashboard/operational-context-banner'
import { useModuleWatchtowerContext } from '@/lib/intelligence/use-module-watchtower-context'
import { useI18n } from '@/lib/i18n'

export function EnergyIntelligenceWorkspace() {
  const { tr } = useI18n()
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
  const watchtower = useModuleWatchtowerContext(['energy', 'production'])

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
    <IntelligenceWorkspaceRoot layout="scroll">
      <IntelligenceWorkspaceHeader>
        <InvestigationContextHeader
          eyebrow={tr('Intelligence · resources')}
          title={tr('Energy intelligence')}
          description={tr('Grid pressure, crop energy intensity and producer efficiency. Connect anomalies to national signals and farm context.')}
          icon={Bolt}
          meta={[
            { label: tr('Status'), value: tr('Live'), accent: true },
            { label: tr('Polygons'), value: String(polygons.length) },
            { label: tr('Energy / ton'), value: formatNumber(energyMeta.energyPerTon, ' kWh/t') },
            { label: tr('Signals'), value: String(watchtower.signals.length), accent: watchtower.signals.length > 0 },
          ]}
        />
      </IntelligenceWorkspaceHeader>

      <OperationalContextBanner />

      {loading ? (
        <IntelligenceLoadingState message={tr('Loading energy intelligence…')} />
      ) : error ? (
        <IntelligenceErrorState message={tr(error)} />
      ) : (
        <IntelligenceWorkspaceBody scrollable>
          <IntelligenceInvestigationLayout
              wideAnalysis
            currentCondition={
              <div className="grid grid-cols-2 gap-3">
                <IntelligenceKpiCard label={tr('Total energy')} value={formatNumber(headline.totalEnergy, ' kWh')} icon={Bolt} />
                <IntelligenceKpiCard label={tr('Average / farm')} value={formatNumber(energyMeta.averageEnergyPerFarm, ' kWh')} />
                <IntelligenceKpiCard label={tr('Energy / ton')} value={formatNumber(energyMeta.energyPerTon, ' kWh/t')} tone="amber" />
                <IntelligenceKpiCard label={tr('Polygon score')} value={formatScore(analyticsMeta.avgPolygonScore)} accent />
              </div>
            }
            whatChanged={<IntelligenceWatchtowerChanges changes={watchtower.changes} loading={watchtower.loading} />}
            primaryAnalysis={
              <IntelligenceCommandLayout
                main={
                  <IntelligencePanel
                    title={tr('Energy by crop')}
                    subtitle={tr('Click a crop row to focus the map on related polygons.')}
                    icon={LineChart}
                  >
                    <IntelligenceDataTable>
                      <IntelligenceTableHead>
                        <tr>
                          <th className="px-3 py-2.5">{tr('Crop')}</th>
                          <th className="px-3 py-2.5">{tr('Energy')}</th>
                          <th className="px-3 py-2.5">{tr('Production')}</th>
                          <th className="px-3 py-2.5">{tr('Energy / ton')}</th>
                          <th className="px-3 py-2.5">{tr('Score')}</th>
                        </tr>
                      </IntelligenceTableHead>
                      <IntelligenceTableBody>
                        {cropAggregates.map((crop) => {
                          const energyPerCropTon = crop.totalEnergyKwh / Math.max(1, crop.totalProductionTons)
                          return (
                            <tr
                              key={crop.cropName}
                              onClick={() => navigateToCropOnMap(crop.cropName)}
                              className="cursor-pointer text-[13px] text-content transition-colors hover:bg-muted"
                            >
                              <td className="px-3 py-2.5" style={{ fontWeight: 500 }}>{crop.cropName}</td>
                              <td className="px-3 py-2.5">{formatNumber(crop.totalEnergyKwh, ' kWh')}</td>
                              <td className="px-3 py-2.5">{formatNumber(crop.totalProductionTons, ' t')}</td>
                              <td className="px-3 py-2.5">{formatNumber(energyPerCropTon, ' kWh/t')}</td>
                              <td className="px-3 py-2.5">
                                <span className="g-tag g-tag--outline-ink tabular-nums" style={{ height: 22, padding: '0 9px', fontSize: 11 }}>
            <span aria-hidden="true" className="w-1.5 h-1.5" style={{ borderRadius: 1, background: scoreColor(crop.averageScore) }} />
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
                    <IntelligencePanel title={tr('Highest efficiency')} icon={Gauge} variant="success">
                      <div className="space-y-2">
                        {producerRanking.mostEfficient.length === 0 ? (
                          <p className="text-sm text-content-soft">{tr('No producer data available.')}</p>
                        ) : (
                          producerRanking.mostEfficient.map((entry, index) => (
                            <IntelligenceProducerCard
                              key={`energy-best-${entry.pointId}`}
                              rank={index + 1}
                              name={normalizePointLabel(entry.pointId, producerLabelsById)}
                              lines={[
                                tr('Score {score} · Intensity {intensity}', { score: `${entry.averagePolygonScore.toFixed(1)}/100`, intensity: formatNumber(entry.resourceIntensity / Math.max(1, entry.productionTons), ' unit/t') }),
                              ]}
                              onClick={() => navigateToProducerPoint(entry.pointId)}
                              variant="success"
                            />
                          ))
                        )}
                      </div>
                    </IntelligencePanel>
                    <IntelligencePanel title={tr('Lowest efficiency')} icon={Zap}>
                      <div className="space-y-2">
                        {producerRanking.leastEfficient.length === 0 ? (
                          <p className="text-sm text-content-soft">{tr('No producer data available.')}</p>
                        ) : (
                          producerRanking.leastEfficient.map((entry, index) => (
                            <IntelligenceProducerCard
                              key={`energy-worst-${entry.pointId}`}
                              rank={index + 1}
                              name={normalizePointLabel(entry.pointId, producerLabelsById)}
                              lines={[
                                tr('Score {score} · Intensity {intensity}', { score: `${entry.averagePolygonScore.toFixed(1)}/100`, intensity: formatNumber(entry.resourceIntensity / Math.max(1, entry.productionTons), ' unit/t') }),
                              ]}
                              onClick={() => navigateToProducerPoint(entry.pointId)}
                            />
                          ))
                        )}
                      </div>
                    </IntelligencePanel>
                  </>
                }
                assistant={null}
              />
            }
            mapOrTimeseries={<IntelligenceMapHint moduleLabel={tr('energy intensity across farms')} />}
            affectedEntities={
              <div className="space-y-2">
                {producerRanking.leastEfficient.slice(0, 5).map((entry, index) => (
                  <IntelligenceProducerCard
                    key={`${entry.pointId}-energy-affected`}
                    rank={index + 1}
                    name={normalizePointLabel(entry.pointId, producerLabelsById)}
                    lines={[tr('High energy intensity · {total} total resource use', { total: formatNumber(entry.resourceIntensity) })]}
                    onClick={() => navigateToProducerPoint(entry.pointId)}
                    variant="warning"
                  />
                ))}
              </div>
            }
            signals={<IntelligenceWatchtowerSignals signals={watchtower.signals} loading={watchtower.loading} />}
            forecast={<IntelligenceWatchtowerForecast outlook={watchtower.outlook} loading={watchtower.loading} />}
            aiAnalysis={<GrowaIntelligencePanel module="energy-intelligence" context={growaContext} />}
            actions={
              <IntelligenceModuleActions
                module="energy-intelligence"
                mapLayers={['energy-intensity', 'farms']}
              />
            }
          />
        </IntelligenceWorkspaceBody>
      )}
    </IntelligenceWorkspaceRoot>
  )
}
