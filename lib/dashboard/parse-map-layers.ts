import { DASHBOARD_MAP_SURFACE_MODULES } from '@/lib/dashboard/map-navigation'

export const WATCHTOWER_DEFAULT_MAP_LAYERS = [
  'fields',
  'production',
  'harvest-forecast',
  'crop-health',
  'intelligence-signals',
] as const

export const LIVE_MAP_DEFAULT_MAP_LAYERS = ['farms', 'intelligence-signals'] as const

function splitLayerParam(raw: string | null): string[] {
  if (!raw) return []
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean)
}

function defaultLayersForModule(moduleKey: string | null): string[] {
  if (moduleKey === 'watchtower' || moduleKey === 'national-overview' || !moduleKey) {
    return [...WATCHTOWER_DEFAULT_MAP_LAYERS]
  }
  if (DASHBOARD_MAP_SURFACE_MODULES.has(moduleKey)) {
    return [...LIVE_MAP_DEFAULT_MAP_LAYERS]
  }
  return [...LIVE_MAP_DEFAULT_MAP_LAYERS]
}

/** Parse map layer toggles from dashboard URL params. */
export function parseDashboardMapLayers(params: URLSearchParams): string[] {
  const moduleKey = params.get('module')
  const explicitLayers = splitLayerParam(params.get('mapLayers'))
  if (explicitLayers.length > 0) {
    if (moduleKey && DASHBOARD_MAP_SURFACE_MODULES.has(moduleKey) && !explicitLayers.includes('farms')) {
      return ['farms', ...explicitLayers]
    }
    return explicitLayers
  }

  const singleLayer = params.get('mapLayer')?.trim()
  if (!singleLayer) {
    return defaultLayersForModule(moduleKey)
  }

  if (moduleKey && DASHBOARD_MAP_SURFACE_MODULES.has(moduleKey)) {
    const merged = new Set<string>([...LIVE_MAP_DEFAULT_MAP_LAYERS, singleLayer])
    return [...merged]
  }

  return [singleLayer]
}
