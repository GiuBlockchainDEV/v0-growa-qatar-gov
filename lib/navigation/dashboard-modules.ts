export const DASHBOARD_MAP_MODULES = new Set([
  'live-map',
  'map',
  'national-map',
  'inspection-map',
])

export const DASHBOARD_PANEL_MODULES = new Set([
  'weather',
  'rss-feed',
  'data-analytics',
  'water-intelligence',
  'energy-intelligence',
])

export function readBrowserSearchParams(): URLSearchParams | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search)
}

export function resolveDashboardModule(
  searchParams: Pick<URLSearchParams, 'get'>
): string | null {
  const moduleFromHook = searchParams.get('module')
  if (moduleFromHook) return moduleFromHook
  return readBrowserSearchParams()?.get('module') ?? null
}

export function hasWeatherContextInUrl(
  searchParams: Pick<URLSearchParams, 'get'>
): boolean {
  if (searchParams.get('weatherGridId') || searchParams.get('weatherLat')) {
    return true
  }
  const browserParams = readBrowserSearchParams()
  return Boolean(
    browserParams?.get('weatherGridId') || browserParams?.get('weatherLat')
  )
}

export function hasTargetContextInUrl(
  searchParams: Pick<URLSearchParams, 'get'>
): boolean {
  if (
    searchParams.get('farmId') ||
    searchParams.get('pointId') ||
    searchParams.get('zoom') ||
    searchParams.get('focus') ||
    searchParams.get('weatherGridId') ||
    searchParams.get('weatherLat')
  ) {
    return true
  }

  const browserParams = readBrowserSearchParams()
  if (!browserParams) return false

  return Boolean(
    browserParams.get('farmId') ||
      browserParams.get('pointId') ||
      browserParams.get('zoom') ||
      browserParams.get('focus') ||
      browserParams.get('weatherGridId') ||
      browserParams.get('weatherLat')
  )
}

export function shouldRenderDashboardMapSurface(moduleKey: string | null): boolean {
  if (!moduleKey) return true
  if (DASHBOARD_PANEL_MODULES.has(moduleKey)) return false
  return DASHBOARD_MAP_MODULES.has(moduleKey)
}
