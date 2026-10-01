import { describe, expect, it } from 'vitest'
import {
  normalizeAnalyticsField,
  normalizeAnalyticsResponse,
  normalizeMetricSummary,
  normalizePaginatedFieldsResponse,
  normalizeTimeseriesResponse,
} from '@/lib/harvest/normalize'

/* The Harvest API has answered in several shapes over time: these tests pin
   the variants the parser accepts (it held 6 of the 19 type errors). */

describe('Harvest normalisers', () => {
  it('reads metric summaries and averages the ratio metrics', () => {
    expect(normalizeMetricSummary({ metric: 'aeti', sum: '120.5', fields: 3 })).toEqual({
      key: 'aeti',
      agg: 'sum',
      value: 120.5,
      field_count: 3,
    })
    expect(normalizeMetricSummary({ key: 'bwp', value: 1.4 })?.agg).toBe('mean')
    expect(normalizeMetricSummary({ key: 'unknown', value: 1 })).toBeNull()
    expect(normalizeMetricSummary({ key: 'aeti' })).toBeNull()
    expect(normalizeMetricSummary(null)).toBeNull()
  })

  it('accepts fields in snake_case or camelCase and skips incomplete ones', () => {
    const field = normalizeAnalyticsField({
      parcelId: 'p-1',
      field_name: 'North',
      crop_name: 'tomato',
      area_m2: '5000',
      metrics: { tbp: { value: 12 }, water_consumption: 30 },
    })
    expect(field).toMatchObject({ parcel_id: 'p-1', name: 'North', crop: 'tomato', area: 5000 })
    expect(field?.metrics.tbp).toBe(12)
    expect(field?.metrics.aeti).toBe(30) // alias water_consumption → aeti
    expect(normalizeAnalyticsField({ name: 'No id' })).toBeNull()
  })

  it('keeps only valid metrics and fields in an analytics response', () => {
    const response = normalizeAnalyticsResponse({
      metrics: [{ key: 'npp', value: 2 }, { key: 'nope', value: 1 }],
      fields: [{ parcel_id: 'a', name: 'A' }, { junk: true }],
    })
    expect(response.metrics).toHaveLength(1)
    expect(response.fields).toHaveLength(1)
    expect(normalizeAnalyticsResponse(undefined)).toEqual({ metrics: [], fields: [] })
  })

  it('deduplicates paginated fields', () => {
    const page = normalizePaginatedFieldsResponse({
      results: [
        { parcel_id: 'a', name: 'A' },
        { parcel_id: 'a', name: 'A again' },
        { parcel_id: 'b', name: 'B' },
      ],
    })
    expect(page.results.map((f) => f.parcel_id)).toEqual(['a', 'b'])
    expect(page.total).toBe(2)
  })

  it('reads timeseries points from any of the known keys', () => {
    const series = normalizeTimeseriesResponse(
      { metric: 'npp', series: [{ date: '2025-09-01', y: 3 }, { label: 'bad' }] },
      'current'
    )
    expect(series).toMatchObject({ metric: 'npp', mode: 'current' })
    expect(series.points).toEqual([{ period: '2025-09-01', value: 3 }])
  })
})
