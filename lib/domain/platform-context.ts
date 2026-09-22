import type { OperationalContext } from '@/lib/domain/operational-context'
import {
  buildOperationalContextParams,
  parseOperationalContext,
  hasOperationalContext,
} from '@/lib/domain/operational-context'

/**
 * Extended platform investigation context (superset of OperationalContext).
 * URL-addressable state for cross-module workflows.
 */
export interface PlatformContext extends OperationalContext {
  departmentId?: string
  regionId?: string
  productionUnitId?: string
  commodityId?: string
  investigationId?: string
  inspectionId?: string
  caseId?: string
}

const EXTENDED_KEYS: Array<keyof PlatformContext> = [
  'departmentId',
  'regionId',
  'productionUnitId',
  'commodityId',
  'investigationId',
  'inspectionId',
  'caseId',
]

export function parsePlatformContext(params: URLSearchParams): PlatformContext {
  const base = parseOperationalContext(params)
  const extended: PlatformContext = { ...base }

  for (const key of EXTENDED_KEYS) {
    const value = params.get(key)?.trim()
    if (value) extended[key] = value as never
  }

  return extended
}

export function buildPlatformContextParams(
  current: URLSearchParams,
  updates: Partial<PlatformContext>
): URLSearchParams {
  return buildOperationalContextParams(current, updates)
}

export function hasPlatformContext(params: URLSearchParams): boolean {
  if (hasOperationalContext(params)) return true
  return EXTENDED_KEYS.some((key) => Boolean(params.get(key)?.trim()))
}
