import { describe, expect, it } from 'vitest'
import {
  FIELD_KPI_METRICS,
  fillMissingHarvestMetrics,
  hasHarvestTableMetrics,
  hasSeasonFieldStats,
  metricsFromFieldStats,
  missingHarvestTableMetrics,
} from '@/lib/harvest/field-metrics'
import type { HarvestFieldStatsResponse } from '@/lib/harvest/types'

function buildStats(
  season: Partial<Record<string, number>>,
  dekad: Partial<Record<string, number[]>> = {}
): HarvestFieldStatsResponse {
  const toSeasonSeries = (values: Partial<Record<string, number>>) =>
    Object.fromEntries(
      Object.entries(values).map(([metric, value]) => [metric, [{ period: 'Season total', value }]])
    )

  const toDekadSeries = (values: Partial<Record<string, number[]>>) =>
    Object.fromEntries(
      Object.entries(values).map(([metric, points]) => [
        metric,
        points.map((value, index) => ({ period: `2025-09-${String(index + 1).padStart(2, '0')}`, value })),
      ])
    )

  return {
    parcel_id: 'field-1',
    season_id: 42,
    periods: [],
    timeseries: {
      season: toSeasonSeries(season),
      dekad: toDekadSeries(dekad),
    },
  }
}

describe('field-metrics', () => {
  it('treats partial table metrics as incomplete', () => {
    expect(hasHarvestTableMetrics({ aeti: 1200 })).toBe(false)
    expect(missingHarvestTableMetrics({ aeti: 1200 })).toEqual(['tbp', 'bwp'])
  })

  it('treats full table metrics as complete', () => {
    expect(
      hasHarvestTableMetrics({
        aeti: 1200,
        tbp: 80,
        bwp: 1.1,
      })
    ).toBe(true)
    expect(missingHarvestTableMetrics({ aeti: 1200, tbp: 80, bwp: 1.1 })).toEqual([])
  })

  it('prefers explicit season totals over dekad values', () => {
    const stats = buildStats({ aeti: 1200, tbp: 80, bwp: 1.1 }, { aeti: [300], tbp: [20], bwp: [0.4] })

    expect(metricsFromFieldStats(stats)).toEqual({
      aeti: 1200,
      tbp: 80,
      bwp: 1.1,
    })
  })

  it('does not invent season totals from dekad rows', () => {
    const stats = buildStats({}, { aeti: [100, 50, 80], tbp: [10, 5, 8], bwp: [0.8, 0.9, 1.0] })

    expect(metricsFromFieldStats(stats)).toEqual({})
  })

  it('extracts all KPI metrics from season totals', () => {
    const stats = buildStats({
      aeti: 1200,
      npp: 900,
      tbp: 80,
      bwp: 1.1,
      rwd: 0.8,
      wcu: 2.4,
      cost: 150,
    })

    expect(Object.keys(metricsFromFieldStats(stats)).sort()).toEqual([...FIELD_KPI_METRICS].sort())
  })

  it('detects season stats availability separately from dekad-only data', () => {
    expect(hasSeasonFieldStats(buildStats({ aeti: 1200 }))).toBe(true)
    expect(hasSeasonFieldStats(buildStats({}, { aeti: [300] }))).toBe(false)
  })

  it('fills only missing KPI values and keeps analytics numbers', () => {
    expect(
      fillMissingHarvestMetrics(
        { aeti: 1200, npp: 450, bwp: 1.1 },
        { aeti: 300, tbp: 80, bwp: 0.4 }
      )
    ).toEqual({
      aeti: 1200,
      npp: 450,
      tbp: 80,
      bwp: 1.1,
    })
  })
})
