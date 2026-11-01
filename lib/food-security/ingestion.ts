/**
 * Validates operator-submitted food source records BEFORE any privileged DB access.
 * A submission is always pending_review; client payloads cannot set audit or review fields.
 * Only metric tonnes are accepted in this first ingestion vertical slice.
 */
import { addFoodDays, type FoodFlowType } from './balance'

export const FOOD_SOURCE_TABLES = {
  stock: 'food_balance_stock_snapshots',
  flow: 'food_balance_flows',
  coverage: 'food_balance_coverage',
} as const

export type FoodSourceKind = keyof typeof FOOD_SOURCE_TABLES
export type FoodVerificationStatus = 'pending_review' | 'verified' | 'rejected'

interface SubmissionBase {
  organizationId: string
  commodityId: string
  sourceRef: string
}

export type FoodSourceSubmission =
  | (SubmissionBase & {
      kind: 'stock'
      asOfDate: string
      usableTonnes: number
      dataMode: 'observed' | 'estimated'
    })
  | (SubmissionBase & {
      kind: 'flow'
      externalKey: string
      flowType: FoodFlowType
      effectiveDate: string
      quantityTonnes: number
      dataMode: 'observed' | 'estimated' | 'forecast'
    })
  | (SubmissionBase & {
      kind: 'coverage'
      flowType: FoodFlowType
      startDate: string
      endDate: string
      status: 'complete' | 'partial'
      dataMode: 'observed' | 'estimated' | 'forecast'
    })

export type FoodSourceValidation =
  | { ok: true; value: FoodSourceSubmission }
  | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FLOW_TYPES = new Set<FoodFlowType>(['domestic_production', 'confirmed_import', 'consumption', 'loss'])
const MODES = new Set(['observed', 'estimated', 'forecast'])
const MAX_SOURCE = 180
const MAX_QUANTITY_TONNES = 1_000_000_000

export function validFoodUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

function requiredString(value: unknown, field: string, maxLength = MAX_SOURCE): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`)
  const trimmed = value.trim()
  if (trimmed.length < 3 || trimmed.length > maxLength || /[\x00-\x1F\x7F]/.test(trimmed)) {
    throw new Error(`${field} must contain 3-${maxLength} visible characters`)
  }
  return trimmed
}

function validDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be YYYY-MM-DD`)
  }
  try {
    addFoodDays(value, 0)
  } catch {
    throw new Error(`${field} is not a valid calendar date`)
  }
  if (value.slice(0, 4) < '2000' || value.slice(0, 4) > '2100') {
    throw new Error(`${field} is outside the supported date range`)
  }
  return value
}

function tonnes(value: unknown, field: string): number {
  const raw = typeof value === 'number' || typeof value === 'string' ? String(value).trim() : ''
  if (!/^\d{1,12}(?:\.\d{1,3})?$/.test(raw)) {
    throw new Error(`${field} must be a non-negative number with at most 3 decimals`)
  }
  const amount = Number(raw)
  if (!Number.isFinite(amount) || amount > MAX_QUANTITY_TONNES) {
    throw new Error(`${field} exceeds the allowed quantity`)
  }
  return amount
}

function flowType(value: unknown): FoodFlowType {
  if (typeof value !== 'string' || !FLOW_TYPES.has(value as FoodFlowType)) {
    throw new Error('Invalid flowType')
  }
  return value as FoodFlowType
}

function sourceMode(value: unknown, stock: boolean): 'observed' | 'estimated' | 'forecast' {
  if (typeof value !== 'string' || !MODES.has(value) || (stock && value === 'forecast')) {
    throw new Error('Invalid dataMode for record type')
  }
  return value as 'observed' | 'estimated' | 'forecast'
}

export function validateFoodSourceSubmission(input: unknown): FoodSourceValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Expected a source record object' }
  }
  const body = input as Record<string, unknown>
  try {
    const kind = body.kind
    if (kind !== 'stock' && kind !== 'flow' && kind !== 'coverage') {
      throw new Error('kind must be stock, flow or coverage')
    }
    const allowed: Record<FoodSourceKind, string[]> = {
      stock: ['kind', 'organizationId', 'commodityId', 'sourceRef', 'asOfDate', 'usableTonnes', 'dataMode'],
      flow: ['kind', 'organizationId', 'commodityId', 'sourceRef', 'externalKey', 'flowType', 'effectiveDate', 'quantityTonnes', 'dataMode'],
      coverage: ['kind', 'organizationId', 'commodityId', 'sourceRef', 'flowType', 'startDate', 'endDate', 'status', 'dataMode'],
    }
    if (Object.keys(body).some((key) => !allowed[kind].includes(key))) {
      throw new Error('Unexpected or privileged source record field')
    }
    if (!validFoodUuid(body.organizationId)) throw new Error('Invalid organizationId')
    if (typeof body.commodityId !== 'string' || !/^[a-z][a-z0-9_-]{1,49}$/.test(body.commodityId)) {
      throw new Error('Invalid commodityId')
    }
    const sourceRef = requiredString(body.sourceRef, 'sourceRef')
    if (/^(demo|synthetic-fixture)[:/]/i.test(sourceRef)) {
      throw new Error('Synthetic source references are not accepted as operational records')
    }
    const common = {
      organizationId: body.organizationId,
      commodityId: body.commodityId,
      sourceRef,
    }
    const dataMode = sourceMode(body.dataMode, kind === 'stock')
    if (kind === 'stock') {
      return {
        ok: true,
        value: {
          ...common, kind,
          asOfDate: validDate(body.asOfDate, 'asOfDate'),
          usableTonnes: tonnes(body.usableTonnes, 'usableTonnes'),
          dataMode: dataMode as 'observed' | 'estimated',
        },
      }
    }
    const type = flowType(body.flowType)
    if (kind === 'flow') {
      const externalKey = requiredString(body.externalKey, 'externalKey', 160)
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_:/.-]*$/.test(externalKey)) {
        throw new Error('externalKey must be a stable source ID without spaces')
      }
      return {
        ok: true,
        value: {
          ...common, kind, externalKey,
          flowType: type,
          effectiveDate: validDate(body.effectiveDate, 'effectiveDate'),
          quantityTonnes: tonnes(body.quantityTonnes, 'quantityTonnes'),
          dataMode,
        },
      }
    }
    const startDate = validDate(body.startDate, 'startDate')
    const endDate = validDate(body.endDate, 'endDate')
    if (startDate > endDate || (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 > 366) {
      throw new Error('Coverage dates must be an ordered interval of at most 367 days')
    }
    if (body.status !== 'partial' && body.status !== 'complete') {
      throw new Error('Coverage status must be complete or partial')
    }
    return {
      ok: true,
      value: { ...common, kind, flowType: type, startDate, endDate, status: body.status, dataMode },
    }
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : 'Invalid source submission' }
  }
}

/** Explicit allowlist: neither verification fields nor organization scope are client-writable columns. */
export function foodSourceInsertPayload(value: FoodSourceSubmission, actorId: string, sourceKind: 'manual' | 'csv' = 'manual') {
  const base = {
    organization_id: value.organizationId,
    commodity_code: value.commodityId,
    source_ref: value.sourceRef,
    source_kind: sourceKind,
    verification_status: 'pending_review',
    submitted_by: actorId,
    data_mode: value.dataMode,
  }
  switch (value.kind) {
    case 'stock': return { ...base, as_of_date: value.asOfDate, usable_tonnes: value.usableTonnes }
    case 'flow': return {
      ...base, external_key: value.externalKey, flow_type: value.flowType,
      effective_date: value.effectiveDate, quantity_tonnes: value.quantityTonnes,
    }
    case 'coverage': return {
      ...base, flow_type: value.flowType, start_date: value.startDate,
      end_date: value.endDate, status: value.status,
    }
  }
}
