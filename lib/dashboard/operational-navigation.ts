import { buildDashboardMapFocusParams, clearIncompatibleDashboardParams } from '@/lib/dashboard/map-navigation'
import { buildWeatherDashboardParams } from '@/lib/dashboard/weather-url'
import {
  applyHarvestFieldSelectionToParams,
  type HarvestFieldNavTarget,
} from '@/lib/harvest/field-navigation'
import type { HarvestMode } from '@/lib/harvest/types'
import type { IntelligenceSignal } from '@/lib/domain/types'
import type { WatchtowerTimeframe } from '@/lib/domain/types'

export interface NavigationTarget {
  module: string
  farmId?: string
  pointId?: string
  parcelId?: string
  crop?: string
  commodityId?: string
  investigationId?: string
  inspectionId?: string
  caseId?: string
  lat?: number
  lng?: number
  zoom?: number
  signalId?: string
  timeframe?: WatchtowerTimeframe
  mapLayer?: string
  harvestMode?: string
}

function defaultNavigationZoom(target: NavigationTarget): number | undefined {
  if (target.zoom !== undefined) return target.zoom
  if (target.farmId) return 14
  if (target.pointId) return 16
  if (target.crop) return 10
  if (target.parcelId) return 13
  return undefined
}

function signalNavigationZoom(
  signal: Pick<IntelligenceSignal, 'farmIds' | 'pointIds' | 'parcelIds'>
): number | undefined {
  if (signal.farmIds?.[0]) return 14
  if (signal.pointIds?.[0]) return 16
  if (signal.parcelIds?.[0]) return 13
  return undefined
}

function mergeNavigationMetadata(params: URLSearchParams, target: NavigationTarget) {
  if (target.commodityId) params.set('commodityId', target.commodityId)
  if (target.investigationId) params.set('investigationId', target.investigationId)
  if (target.inspectionId) params.set('inspectionId', target.inspectionId)
  if (target.caseId) params.set('caseId', target.caseId)
  if (target.signalId) params.set('signalId', target.signalId)
  if (target.timeframe) {
    params.set('timeframe', target.timeframe)
    params.set('timeRange', target.timeframe)
  }
  if (target.mapLayer) params.set('mapLayer', target.mapLayer)
  if (target.harvestMode) params.set('harvestMode', target.harvestMode)
  if (
    (target.module === 'harvest' || target.module === 'production-harvest') &&
    !params.get('harvestMode')
  ) {
    params.set('harvestMode', 'predict')
  }
}

function buildSignalNavigationTarget(
  signal: IntelligenceSignal,
  module: string,
  timeframe?: WatchtowerTimeframe
): NavigationTarget {
  return {
    module,
    signalId: signal.id,
    farmId: signal.farmIds?.[0],
    pointId: signal.pointIds?.[0],
    parcelId: signal.parcelIds?.[0],
    lat: signal.lat,
    lng: signal.lng,
    zoom: signalNavigationZoom(signal),
    timeframe,
  }
}

export function buildModuleUrl(current: URLSearchParams, target: NavigationTarget): string {
  if (
    target.module === 'weather' &&
    target.lat !== undefined &&
    target.lng !== undefined &&
    Number.isFinite(target.lat) &&
    Number.isFinite(target.lng)
  ) {
    const params = buildWeatherDashboardParams(current, {
      lat: target.lat,
      lng: target.lng,
      zoom: target.zoom ?? 12,
    })
    mergeNavigationMetadata(params, target)
    return `/dashboard?${params.toString()}`
  }

  if (
    (target.module === 'harvest' || target.module === 'production-harvest') &&
    target.parcelId
  ) {
    const params = new URLSearchParams(current.toString())
    params.set('module', target.module)
    applyHarvestFieldSelectionToParams(
      params,
      { parcel_id: target.parcelId },
      {
        mode: (target.harvestMode as HarvestMode | undefined) || 'predict',
        harvestMetric: 'npp',
        harvestGranularity: 'season',
      }
    )
    const zoom = defaultNavigationZoom(target)
    if (zoom !== undefined) params.set('zoom', String(zoom))
    mergeNavigationMetadata(params, target)
    clearIncompatibleDashboardParams(params, target.module)
    return `/dashboard?${params.toString()}`
  }

  const hasGeoFocus = Boolean(target.farmId || target.pointId || target.crop)
  const params = hasGeoFocus
    ? buildDashboardMapFocusParams(current, {
        module: target.module,
        farmId: target.farmId,
        pointId: target.pointId,
        crop: target.crop,
        zoom: defaultNavigationZoom(target),
      })
    : (() => {
        const base = new URLSearchParams(current.toString())
        base.set('module', target.module)
        if (!target.farmId) base.delete('farmId')
        if (!target.pointId) base.delete('pointId')
        if (!target.crop) base.delete('crop')
        if (target.zoom !== undefined) base.set('zoom', String(target.zoom))
        return base
      })()

  if (target.parcelId && target.module !== 'harvest' && target.module !== 'production-harvest') {
    params.set('parcelId', target.parcelId)
  }

  if (target.lat !== undefined && target.lng !== undefined) {
    params.set('lat', String(target.lat))
    params.set('lng', String(target.lng))
  }

  mergeNavigationMetadata(params, target)
  clearIncompatibleDashboardParams(params, target.module)
  return `/dashboard?${params.toString()}`
}

export function navigateToFarm(current: URLSearchParams, farmId: string, module = 'harvest', zoom = 14) {
  const params = buildDashboardMapFocusParams(current, { module, farmId, zoom })
  return `/dashboard?${params.toString()}`
}

export function navigateToParcel(
  current: URLSearchParams,
  parcelId: string,
  options?: { module?: string; zoom?: number; seasonId?: number; harvestMode?: HarvestMode }
) {
  const module = options?.module || 'harvest'
  const params = new URLSearchParams(current.toString())
  params.set('module', module)

  if (module === 'harvest' || module === 'production-harvest') {
    applyHarvestFieldSelectionToParams(
      params,
      { parcel_id: parcelId, season_id: options?.seasonId },
      {
        mode: options?.harvestMode || 'predict',
        harvestMetric: 'npp',
        harvestGranularity: 'season',
      }
    )
    if (options?.zoom) params.set('zoom', String(options.zoom))
  } else {
    params.set('parcelId', parcelId)
    if (options?.zoom) params.set('zoom', String(options.zoom))
  }

  clearIncompatibleDashboardParams(params, module)
  return `/dashboard?${params.toString()}`
}

export function navigateToHarvestField(
  current: URLSearchParams,
  field: HarvestFieldNavTarget,
  options?: {
    mode?: HarvestMode
    signalId?: string
    timeframe?: WatchtowerTimeframe
  }
) {
  const params = new URLSearchParams(current.toString())
  params.set('module', 'harvest')
  applyHarvestFieldSelectionToParams(params, field, {
    mode: options?.mode || 'predict',
    harvestMetric: 'npp',
    harvestGranularity: 'season',
  })
  if (options?.signalId) params.set('signalId', options.signalId)
  if (options?.timeframe) {
    params.set('timeframe', options.timeframe)
    params.set('timeRange', options.timeframe)
  }
  clearIncompatibleDashboardParams(params, 'harvest')
  return `/dashboard?${params.toString()}`
}

export function navigateToSignal(
  current: URLSearchParams,
  signal: IntelligenceSignal,
  options?: { stayOnWatchtower?: boolean }
) {
  const targetModule = options?.stayOnWatchtower
    ? 'watchtower'
    : signal.recommendedModule || signalRecommendedModule(signal.type)

  if (!options?.stayOnWatchtower && signal.type === 'supply') {
    return '/dashboard/supply-overview'
  }

  const target = buildSignalNavigationTarget(
    signal,
    targetModule,
    current.get('timeframe') as WatchtowerTimeframe | undefined
  )

  if (!options?.stayOnWatchtower) {
    if (signal.type === 'water') target.module = 'water-intelligence'
    if (signal.type === 'energy') target.module = 'energy-intelligence'
    if (signal.type === 'crop_health' || signal.type === 'production') target.module = 'harvest'
    if (signal.type === 'weather') target.module = 'weather'
  }

  return buildModuleUrl(current, target)
}

export function navigateToSignalOnMap(current: URLSearchParams, signal: IntelligenceSignal) {
  return navigateToSignalEstimation(current, signal)
}

export function navigateToSignalEstimation(current: URLSearchParams, signal: IntelligenceSignal) {
  const module = signal.recommendedModule || signalRecommendedModule(signal.type)
  if (module === 'supply-overview') return '/dashboard/supply-overview'

  return buildModuleUrl(
    current,
    buildSignalNavigationTarget(
      signal,
      module,
      current.get('timeframe') as WatchtowerTimeframe | undefined
    )
  )
}

export function navigateToModuleWithContext(
  current: URLSearchParams,
  module: string,
  context?: Partial<NavigationTarget>
) {
  return buildModuleUrl(current, { module, ...context })
}

export function signalRecommendedModule(type: IntelligenceSignal['type']): string {
  switch (type) {
    case 'water':
      return 'water-intelligence'
    case 'energy':
      return 'energy-intelligence'
    case 'crop_health':
    case 'production':
      return 'harvest'
    case 'weather':
      return 'weather'
    case 'supply':
      return 'supply-overview'
    case 'compliance':
      return 'alerts-center'
    case 'data_quality':
      return 'watchtower'
    default:
      return 'watchtower'
  }
}
