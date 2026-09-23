import { buildDashboardMapFocusParams, clearIncompatibleDashboardParams } from '@/lib/dashboard/map-navigation'
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

export function buildModuleUrl(current: URLSearchParams, target: NavigationTarget): string {
  const params = new URLSearchParams(current.toString())
  params.set('module', target.module)

  if (target.farmId) {
    params.set('farmId', target.farmId)
    params.delete('pointId')
    params.delete('crop')
  } else if (target.pointId) {
    params.set('pointId', target.pointId)
    params.delete('farmId')
    params.delete('crop')
  } else if (target.crop) {
    params.set('crop', target.crop)
    params.delete('farmId')
    params.delete('pointId')
  }

  if (target.parcelId) params.set('parcelId', target.parcelId)
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
  if (target.lat !== undefined) params.set('lat', String(target.lat))
  if (target.lng !== undefined) params.set('lng', String(target.lng))
  if (target.zoom !== undefined) params.set('zoom', String(target.zoom))

  if (target.harvestMode) params.set('harvestMode', target.harvestMode)
  if (
    (target.module === 'harvest' || target.module === 'production-harvest') &&
    !params.get('harvestMode')
  ) {
    params.set('harvestMode', 'predict')
  }

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
  options?: { module?: string; zoom?: number }
) {
  const params = new URLSearchParams(current.toString())
  params.set('module', options?.module || 'harvest')
  params.set('parcelId', parcelId)
  if (options?.zoom) params.set('zoom', String(options.zoom))
  clearIncompatibleDashboardParams(params, params.get('module') || 'harvest')
  return `/dashboard?${params.toString()}`
}

export function navigateToSignal(
  current: URLSearchParams,
  signal: IntelligenceSignal,
  options?: { stayOnWatchtower?: boolean }
) {
  if (!options?.stayOnWatchtower && signal.deepLink) return signal.deepLink

  const targetModule = options?.stayOnWatchtower
    ? 'watchtower'
    : signal.recommendedModule || signalRecommendedModule(signal.type)

  const target: NavigationTarget = {
    module: targetModule,
    signalId: signal.id,
    farmId: signal.farmIds?.[0],
    pointId: signal.pointIds?.[0],
    parcelId: signal.parcelIds?.[0],
  }

  if (!options?.stayOnWatchtower) {
    if (signal.type === 'water') target.module = 'water-intelligence'
    if (signal.type === 'energy') target.module = 'energy-intelligence'
    if (signal.type === 'crop_health' || signal.type === 'production') target.module = 'harvest'
    if (signal.type === 'weather') target.module = 'weather'
    if (signal.type === 'supply') return '/dashboard/supply-overview'
  }

  return buildModuleUrl(current, target)
}

export function navigateToSignalOnMap(current: URLSearchParams, signal: IntelligenceSignal) {
  return navigateToSignalEstimation(current, signal)
}

export function navigateToSignalEstimation(current: URLSearchParams, signal: IntelligenceSignal) {
  const module = signal.recommendedModule || signalRecommendedModule(signal.type)
  if (module === 'supply-overview') return '/dashboard/supply-overview'

  return buildModuleUrl(current, {
    module,
    signalId: signal.id,
    farmId: signal.farmIds?.[0],
    pointId: signal.pointIds?.[0],
    parcelId: signal.parcelIds?.[0],
    timeframe: current.get('timeframe') as WatchtowerTimeframe | undefined,
  })
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
