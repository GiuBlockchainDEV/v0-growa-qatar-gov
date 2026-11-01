import { describe, expect, it } from 'vitest'
import { foodSourceInsertPayload, validateFoodSourceSubmission } from './ingestion'

const organizationId = '11111111-1111-4111-8111-111111111111'
const common = { organizationId, commodityId: 'tomato', sourceRef: 'warehouse:manifest-10' }

const stock = {
  ...common, kind: 'stock', asOfDate: '2026-10-31',
  usableTonnes: 100.125, dataMode: 'observed',
}

const flow = {
  ...common, kind: 'flow', externalKey: 'shipment:2026-10:1',
  flowType: 'confirmed_import', effectiveDate: '2026-11-01',
  quantityTonnes: 12.25, dataMode: 'forecast',
}

const coverage = {
  ...common, kind: 'coverage', flowType: 'consumption',
  startDate: '2026-11-01', endDate: '2026-11-30',
  status: 'partial', dataMode: 'forecast',
}

describe('NFII food source intake validation', () => {
  it('accepts a source-backed usable stock and makes it pending', () => {
    const result = validateFoodSourceSubmission(stock)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(foodSourceInsertPayload(result.value, 'actor-id')).toMatchObject({
      usable_tonnes: 100.125,
      submitted_by: 'actor-id',
      source_kind: 'manual',
      verification_status: 'pending_review',
    })
  })

  it('accepts a stable shipment identifier', () => {
    const result = validateFoodSourceSubmission(flow)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(foodSourceInsertPayload(result.value, 'actor-id')).toMatchObject({
      external_key: 'shipment:2026-10:1',
      quantity_tonnes: 12.25,
      flow_type: 'confirmed_import',
    })
  })

  it('accepts an explicit partial coverage declaration', () => {
    const result = validateFoodSourceSubmission(coverage)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(foodSourceInsertPayload(result.value, 'actor-id')).toMatchObject({
      start_date: '2026-11-01',
      end_date: '2026-11-30',
      status: 'partial',
    })
  })

  it.each([
    null, [], 'not an object', {},
    { ...stock, organizationId: 'fake' },
    { ...stock, commodityId: '__bad' },
    { ...stock, sourceRef: 'demo:test' },
    { ...stock, sourceRef: 'synthetic-fixture:test' },
    { ...stock, sourceRef: 'x' },
    { ...stock, asOfDate: '2026-02-30' },
    { ...stock, asOfDate: '2026-13-01' },
    { ...stock, usableTonnes: -1 },
    { ...stock, usableTonnes: Number.POSITIVE_INFINITY },
    { ...stock, usableTonnes: 3.12345 },
    { ...stock, dataMode: 'forecast' },
    { ...stock, verification_status: 'verified' },
    { ...stock, submitted_by: 'somebody-else' },
    { ...flow, externalKey: 'bad key with spaces' },
    { ...flow, flowType: 'unconfirmed_import' },
    { ...flow, quantityTonnes: 1_000_000_000_001 },
    { ...coverage, startDate: '2026-12-01' },
    { ...coverage, endDate: '2028-12-01' },
    { ...coverage, status: 'verified' },
  ])('rejects malformed, excessive or privileged input %#', (record) => {
    expect(validateFoodSourceSubmission(record).ok).toBe(false)
  })

  it('cannot smuggle a cross-tenant actor or source provenance', () => {
    const attempt = validateFoodSourceSubmission({
      ...flow,
      reviewed_by: 'attacker',
      source_kind: 'api',
    })
    expect(attempt.ok).toBe(false)
  })

  it('never marks submitted records verified', () => {
    for (const entry of [stock, flow, coverage]) {
      const result = validateFoodSourceSubmission(entry)
      expect(result.ok).toBe(true)
      if (result.ok) {
        const payload = foodSourceInsertPayload(result.value, 'actor-id')
        expect(payload.verification_status).toBe('pending_review')
        expect('reviewed_by' in payload).toBe(false)
      }
    }
  })
})
