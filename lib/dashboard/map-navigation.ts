export const DASHBOARD_MAP_SURFACE_MODULES = new Set([
  'live-map',
  'map',
  'national-map',
  'inspection-map',
])

export const DASHBOARD_WORKSPACE_MODULES = new Set([
  'rss-feed',
  'data-analytics',
  'water-intelligence',
  'energy-intelligence',
  'weather',
  'harvest',
  'production-harvest',
])

function createFocusToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

function clearIncompatibleDashboardParams(params: URLSearchParams, module: string) {
  if (module !== 'weather') {
    params.delete('weatherGridId')
    params.delete('weatherLat')
    params.delete('weatherLng')
    params.delete('weatherRequestedAt')
  }

  if (module !== 'harvest' && module !== 'production-harvest') {
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
