'use client'

import { useMemo } from 'react'
import { Droplets, Gauge, Target, Waves } from 'lucide-react'
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
import { type IntelligenceAggregate, clampScore, formatNumber, formatScore, normalizePointLabel, scoreColor, useIntelligenceData, useMapNavigation } from './intelligence-metrics-shared'
import { OperationalContextBanner } from '@/components/dashboard/operational-context-banner'
import { useModuleWatchtowerContext } from '@/lib/intelligence/use-module-watchtower-context'
import { useI18n } from '@/lib/i18n'

export function WaterIntelligenceWorkspace() {
  const { tr } = useI18n()
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
  const watchtower = useModuleWatchtowerContext(['water', 'crop_health', 'production'])

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

  const renderCropRow = (crop: IntelligenceAggregate) => {
    const waterPerTon = crop.totalWaterM3 / Math.max(1, crop.totalProductionTons)
    return (
      <tr
        key={crop.cropName}
        onClick={() => navigateToCropOnMap(crop.cropName)}
        className="cursor-pointer text-[13px] text-content transition-colors hover:bg-muted"
      >
        <td className="px-3 py-2.5" style={{ fontWeight: 500 }}>{crop.cropName}</td>
        <td className="px-3 py-2.5">{formatNumber(crop.totalWaterM3, ' m³')}</td>
        <td className="px-3 py-2.5">{formatNumber(waterPerTon, ' m³/t')}</td>
        <td className="px-3 py-2.5">{crop.polygonsCount}</td>
        <td className="px-3 py-2.5">
          <span className="g-tag g-tag--outline-ink tabular-nums" style={{ height: 22, padding: '0 9px', fontSize: 11 }}>
            <span aria-hidden="true" className="w-1.5 h-1.5" style={{ borderRadius: 1, background: scoreColor(crop.averageScore) }} />
            {formatScore(crop.averageScore)}
          </span>
        </td>
      </tr>
    )
  }

  return (
    <IntelligenceWorkspaceRoot layout="scroll">
      <IntelligenceWorkspaceHeader>
        <InvestigationContextHeader
          eyebrow={tr('Intelligence · resources')}
          title={tr('Water intelligence')}
          description={tr('Irrigation pressure, crop water intensity and farm-level consumption. Investigate anomalies and link to national signals.')}
          icon={Droplets}
          meta={[
            { label: tr('Status'), value: tr('Live'), accent: true },
            { label: tr('Polygons'), value: String(polygons.length) },
            { label: tr('Pressure'), value: formatNumber(waterMeta.irrigationPressure, '%') },
            { label: tr('Signals'), value: String(watchtower.signals.length), accent: watchtower.signals.length > 0 },
          ]}
        />
      </IntelligenceWorkspaceHeader>

      <OperationalContextBanner />

      {loading ? (
        <IntelligenceLoadingState message={tr('Loading water intelligence…')} />
      ) : error ? (
        <IntelligenceErrorState message={tr(error)} />
      ) : (
        <IntelligenceWorkspaceBody scrollable>
          <IntelligenceInvestigationLayout
              wideAnalysis
            currentCondition={
              <div className="grid grid-cols-2 gap-3">
                <IntelligenceKpiCard label={tr('Total water')} value={formatNumber(headline.totalWater, ' m³')} icon={Droplets} accent />
                <IntelligenceKpiCard label={tr('Water intensity')} value={formatNumber(waterMeta.avgWaterPerTon, ' m³/t')} />
                <IntelligenceKpiCard label={tr('Irrigation pressure')} value={formatNumber(waterMeta.irrigationPressure, '%')} tone="sky" />
                <IntelligenceKpiCard label={tr('Polygon score')} value={formatScore(analyticsMeta.avgPolygonScore)} />
              </div>
            }
            whatChanged={<IntelligenceWatchtowerChanges changes={watchtower.changes} loading={watchtower.loading} />}
            primaryAnalysis={
              <IntelligenceCommandLayout
                main={
                  <IntelligencePanel
                    title={tr('Crop water matrix')}
                    subtitle={tr('Sorted by water intensity (m³ per production ton).')}
                    icon={Waves}
                  >
                    <IntelligenceDataTable>
                      <IntelligenceTableHead>
                        <tr>
                          <th className="px-3 py-2.5">{tr('Crop')}</th>
                          <th className="px-3 py-2.5">{tr('Water')}</th>
                          <th className="px-3 py-2.5">{tr('Intensity')}</th>
                          <th className="px-3 py-2.5">{tr('Polygons')}</th>
                          <th className="px-3 py-2.5">{tr('Score')}</th>
                        </tr>
                      </IntelligenceTableHead>
                      <IntelligenceTableBody>
                        {waterLeaders.map((crop) => renderCropRow(crop))}
                      </IntelligenceTableBody>
                    </IntelligenceDataTable>
                  </IntelligencePanel>
                }
                insights={
                  <>
                    <IntelligencePanel title={tr('System baseline')} icon={Gauge}>
                      <div className="mb-2 h-2 overflow-hidden" style={{ background: 'var(--growa-stone-200)', borderRadius: 2 }}>
                        <div
                          className="h-2"
                          style={{
                            width: `${clampScore(analyticsMeta.avgPolygonScore)}%`,
                            backgroundColor: scoreColor(analyticsMeta.avgPolygonScore),
                          }}
                        />
                      </div>
                      <p className="text-xs text-content-soft">
                        {tr('Water performance baseline across {count} monitored producers.', { count: headline.producerCount })}
                      </p>
                    </IntelligencePanel>
                    <IntelligencePanel title={tr('Low-intensity leaders')} variant="success">
                      <div className="space-y-2">
                        {producerRanking.mostEfficient.length === 0 ? (
                          <p className="text-sm text-content-soft">{tr('No farms available.')}</p>
                        ) : (
                          producerRanking.mostEfficient.map((farm, index) => (
                            <IntelligenceProducerCard
                              key={`${farm.pointId}-water-good`}
                              rank={index + 1}
                              name={normalizePointLabel(farm.pointId, producerLabelsById)}
                              lines={[
                                tr('Efficiency {efficiency} · Score {score}', { efficiency: farm.efficiencyScore.toFixed(2), score: formatScore(farm.averagePolygonScore) }),
                              ]}
                              onClick={() => navigateToProducerPoint(farm.pointId)}
                              variant="success"
                            />
                          ))
                        )}
                      </div>
                    </IntelligencePanel>
                    <IntelligencePanel title={tr('High-use farms')} icon={Target} variant="warning">
                      <div className="space-y-2">
                        {producerRanking.leastEfficient.length === 0 ? (
                          <p className="text-sm text-content-soft">{tr('No farms available.')}</p>
                        ) : (
                          producerRanking.leastEfficient.map((farm, index) => (
                            <IntelligenceProducerCard
                              key={`${farm.pointId}-water-risk`}
                              rank={index + 1}
                              name={normalizePointLabel(farm.pointId, producerLabelsById)}
                              lines={[
                                tr('Resource {resource} · Variety {count}', { resource: formatNumber(farm.resourceIntensity), count: farm.cropVarietyCount }),
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
                assistant={null}
              />
            }
            mapOrTimeseries={<IntelligenceMapHint moduleLabel={tr('water demand and irrigation pressure')} />}
            affectedEntities={
              <div className="space-y-2">
                {producerRanking.leastEfficient.slice(0, 5).map((farm, index) => (
                  <IntelligenceProducerCard
                    key={`${farm.pointId}-affected`}
                    rank={index + 1}
                    name={normalizePointLabel(farm.pointId, producerLabelsById)}
                    lines={[tr('Water stress candidate · Intensity {intensity}', { intensity: formatNumber(farm.resourceIntensity) })]}
                    onClick={() => navigateToProducerPoint(farm.pointId)}
                    variant="warning"
                  />
                ))}
              </div>
            }
            signals={<IntelligenceWatchtowerSignals signals={watchtower.signals} loading={watchtower.loading} />}
            forecast={
              <IntelligenceWatchtowerForecast
                outlook={watchtower.outlook}
                loading={watchtower.loading}
                domain="climate"
              />
            }
            aiAnalysis={<GrowaIntelligencePanel module="water-intelligence" context={growaContext} />}
            actions={
              <IntelligenceModuleActions
                module="water-intelligence"
                mapLayers={['water-demand', 'irrigation-pressure', 'farms']}
              />
            }
          />
        </IntelligenceWorkspaceBody>
      )}
    </IntelligenceWorkspaceRoot>
  )
}
