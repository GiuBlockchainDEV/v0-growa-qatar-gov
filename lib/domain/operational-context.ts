import type { WatchtowerTimeframe } from '@/lib/domain/types'
import { parseWatchtowerTimeframe } from '@/lib/domain/timeframes'

export interface OperationalContext {
  countryCode?: string
  organizationId?: string
  departmentId?: string
  regionId?: string
  farmId?: string
  siteId?: string
  productionUnitId?: string
  parcelId?: string
  cropId?: string
  growingCycleId?: string
  commodityId?: string
  lat?: number
  lng?: number
  zoom?: number
  timeRange?: WatchtowerTimeframe
  startDate?: string
  endDate?: string
  alertId?: string
  signalId?: string
  investigationId?: string
  inspectionId?: string
  caseId?: string
  mapLayer?: string
  focus?: string
  module?: string
  pointId?: string
  crop?: string
}

const CONTEXT_PARAM_KEYS: Array<keyof OperationalContext> = [
  'countryCode',
  'organizationId',
  'departmentId',
  'regionId',
  'farmId',
  'siteId',
  'productionUnitId',
  'parcelId',
  'cropId',
  'growingCycleId',
  'commodityId',
  'startDate',
  'endDate',
  'alertId',
  'signalId',
  'investigationId',
  'inspectionId',
  'caseId',
  'mapLayer',
  'focus',
  'module',
  'pointId',
  'crop',
]

const NUMERIC_KEYS = new Set<keyof OperationalContext>(['lat', 'lng', 'zoom'])

export function parseOperationalContext(params: URLSearchParams): OperationalContext {
  const context: OperationalContext = {}

  for (const key of CONTEXT_PARAM_KEYS) {
    const value = params.get(key)?.trim()
    if (value) {
      context[key] = value as never
    }
  }

  const lat = Number(params.get('lat') ?? params.get('weatherLat'))
  const lng = Number(params.get('lng') ?? params.get('weatherLng'))
  const zoom = Number(params.get('zoom'))

  if (Number.isFinite(lat)) context.lat = lat
  if (Number.isFinite(lng)) context.lng = lng
  if (Number.isFinite(zoom) && zoom >= 3 && zoom <= 19) context.zoom = zoom

  const timeRange = params.get('timeRange') ?? params.get('timeframe')
  context.timeRange = parseWatchtowerTimeframe(timeRange)

  if (!context.module) {
    const moduleParam = params.get('module')?.trim()
    if (moduleParam) context.module = moduleParam
  }

  if (!context.parcelId) {
    const parcelId = params.get('parcelId')?.trim()
    if (parcelId) context.parcelId = parcelId
  }

  if (!context.commodityId) {
    const commodityId = params.get('commodityId')?.trim() || params.get('commodity')?.trim()
    if (commodityId) context.commodityId = commodityId
  }

  return context
}

export function buildOperationalContextParams(
  current: URLSearchParams,
  updates: Partial<OperationalContext>
): URLSearchParams {
  const params = new URLSearchParams(current.toString())

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || value === '') {
      params.delete(key)
      continue
    }

    if (NUMERIC_KEYS.has(key as keyof OperationalContext)) {
      params.set(key, String(value))
    } else {
      params.set(key, String(value))
    }
  }

  if (updates.timeRange) {
    params.set('timeframe', updates.timeRange)
  }

  return params
}

export function hasOperationalContext(params: URLSearchParams): boolean {
  const context = parseOperationalContext(params)
  return Boolean(
    context.farmId ||
      context.siteId ||
      context.parcelId ||
      context.cropId ||
      context.pointId ||
      context.crop ||
      context.signalId ||
      context.alertId ||
      context.investigationId ||
      context.inspectionId ||
      context.caseId ||
      context.commodityId ||
      (context.lat !== undefined && context.lng !== undefined)
  )
}
