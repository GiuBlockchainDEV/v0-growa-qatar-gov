export const DASHBOARD_MAP_SURFACE_MODULES = new Set([
  'live-map',
  'map',
  'national-map',
  'inspection-map',
])

export const DASHBOARD_WORKSPACE_MODULES = new Set([
  'watchtower',
  'national-overview',
  'rss-feed',
  'data-analytics',
  'water-intelligence',
  'energy-intelligence',
  'weather',
  'harvest',
  'production-harvest',
])

/** Modules that render the National Watchtower workspace */
export const DASHBOARD_WATCHTOWER_MODULES = new Set(['watchtower', 'national-overview'])

function createFocusToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function hasDashboardDeepLinkContext(params: URLSearchParams | null) {
  if (!params) return false
  return Boolean(
    params.get('module') ||
      params.get('farmId') ||
      params.get('pointId') ||
      params.get('zoom') ||
      params.get('focus') ||
      params.get('crop') ||
      params.get('weatherGridId') ||
      params.get('weatherLat') ||
      params.get('weatherLng') ||
      params.get('weatherRequestedAt') ||
      params.get('parcelId') ||
      params.get('harvestMode') ||
      params.get('harvestMetric') ||
      params.get('harvestGranularity') ||
      params.get('harvestPeriod') ||
      params.get('harvestSeasonId') ||
      params.get('harvestCreate') ||
      params.get('harvestDraw') ||
      params.get('timeframe') ||
      params.get('timeRange') ||
      params.get('signalId')
  )
}

export function hasWeatherDashboardContext(params: URLSearchParams) {
  return Boolean(
    params.get('weatherGridId') || params.get('weatherLat') || params.get('weatherLng')
  )
}

export function resolveDashboardPageModule(searchParams: URLSearchParams) {
  const explicitModule = searchParams.get('module')?.trim()
  if (explicitModule === 'national-overview') return 'watchtower'
  if (explicitModule) return explicitModule
  if (hasWeatherDashboardContext(searchParams)) return 'weather'
  return null
}

export function isDashboardWorkspaceModule(moduleKey: string | null | undefined) {
  if (!moduleKey) return false
  return DASHBOARD_WORKSPACE_MODULES.has(moduleKey)
}

export function isDashboardMapSurfaceModule(moduleKey: string | null | undefined) {
  if (!moduleKey) return true
  return DASHBOARD_MAP_SURFACE_MODULES.has(moduleKey)
}

export function resolveDashboardModule(
  currentModule: string | null | undefined,
  fallbackModule = 'live-map'
) {
  const normalized = currentModule?.trim()
  if (!normalized) return fallbackModule
  if (
    DASHBOARD_WORKSPACE_MODULES.has(normalized) ||
    DASHBOARD_MAP_SURFACE_MODULES.has(normalized)
  ) {
    return normalized
  }
  return fallbackModule
}

export function clearIncompatibleDashboardParams(params: URLSearchParams, moduleKey: string) {
  if (moduleKey !== 'weather') {
    params.delete('weatherGridId')
    params.delete('weatherLat')
    params.delete('weatherLng')
    params.delete('weatherRequestedAt')
  }

  if (moduleKey !== 'harvest' && moduleKey !== 'production-harvest') {
    params.delete('parcelId')
    params.delete('harvestMode')
    params.delete('harvestMetric')
    params.delete('harvestGranularity')
    params.delete('harvestPeriod')
    params.delete('harvestSeasonId')
    params.delete('harvestCreate')
    params.delete('harvestDraw')
  }
}

export function buildDashboardMapFocusParams(
  current: URLSearchParams,
  selection: {
    module: string
    pointId?: string
    farmId?: string
    crop?: string
    zoom?: number
    focus?: string
  }
) {
  const params = new URLSearchParams(current.toString())
  params.set('module', selection.module)

  if (selection.pointId) {
    params.set('pointId', selection.pointId)
    params.delete('farmId')
    params.delete('crop')
  } else {
    params.delete('pointId')
  }

  if (selection.farmId) {
    params.set('farmId', selection.farmId)
    params.delete('pointId')
    params.delete('crop')
  } else if (!selection.pointId) {
    params.delete('farmId')
  }

  if (selection.crop) {
    params.set('crop', selection.crop)
    params.delete('pointId')
    params.delete('farmId')
  } else if (!selection.pointId && !selection.farmId) {
    params.delete('crop')
  }

  if (selection.zoom !== undefined) {
    params.set('zoom', String(selection.zoom))
  }

  params.set('focus', selection.focus || createFocusToken())
  clearIncompatibleDashboardParams(params, selection.module)

  return params
}

export function buildDashboardMapProps(searchParams: URLSearchParams) {
  const zoomParam = searchParams.get('zoom')
  const requestedZoom = zoomParam ? Number(zoomParam) : Number.NaN
  const targetZoom =
    Number.isFinite(requestedZoom) && requestedZoom >= 3 && requestedZoom <= 19
      ? requestedZoom
      : undefined

  return {
    targetPointId: searchParams.get('pointId'),
    targetFarmId: searchParams.get('farmId'),
    targetFocusToken: searchParams.get('focus'),
    targetCropFilter: searchParams.get('crop'),
    targetZoom,
  }
}
