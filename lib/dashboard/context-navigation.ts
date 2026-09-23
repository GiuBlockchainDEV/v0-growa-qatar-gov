const OPERATIONAL_OVERLAY_KEYS = [
  'signalId',
  'farmId',
  'pointId',
  'crop',
  'investigationId',
  'inspectionId',
  'caseId',
  'commodityId',
] as const

const HARVEST_NAV_KEYS = [
  'parcelId',
  'harvestMode',
  'harvestMetric',
  'harvestGranularity',
  'harvestPeriod',
  'harvestSeasonId',
  'harvestCreate',
  'harvestDraw',
  'zoom',
  'focus',
] as const

export function isHarvestDashboardModule(moduleKey: string | null | undefined) {
  return moduleKey === 'harvest' || moduleKey === 'production-harvest'
}

export function clearOperationalOverlayParams(params: URLSearchParams) {
  for (const key of OPERATIONAL_OVERLAY_KEYS) {
    params.delete(key)
  }
  return params
}

export function hasOperationalOverlayContext(
  params: URLSearchParams,
  options?: { ignoreParcelId?: boolean }
) {
  if (params.get('signalId')) return true
  if (params.get('farmId')) return true
  if (params.get('pointId')) return true
  if (params.get('crop')) return true
  if (params.get('investigationId')) return true
  if (params.get('inspectionId')) return true
  if (params.get('caseId')) return true
  if (params.get('commodityId')) return true
  if (!options?.ignoreParcelId && params.get('parcelId')) return true
  return false
}

export function buildDashboardNavHref(
  current: URLSearchParams,
  targetPath: string,
  options?: { preserveWhenActive?: boolean; active?: boolean }
) {
  if (options?.preserveWhenActive && options.active && current.toString()) {
    return `/dashboard?${current.toString()}`
  }
  return targetPath
}

export function preservedHarvestParams(current: URLSearchParams) {
  const preserved = new URLSearchParams()
  for (const key of HARVEST_NAV_KEYS) {
    const value = current.get(key)
    if (value) preserved.set(key, value)
  }
  return preserved
}
