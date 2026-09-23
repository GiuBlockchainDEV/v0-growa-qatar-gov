import { describe, expect, it } from 'vitest'
import {
  mergeHarvestFieldStats,
  normalizeHarvestPeriodDate,
  parseHarvestFieldStatsCsv,
} from '@/lib/harvest/csv-stats'

const meta = { parcel_id: 'field-1', season_id: 7 }

describe('parseHarvestFieldStatsCsv', () => {
  it('keeps dekad increments separate from the season total', () => {
    const csv = [
      'granularity,metric,period_start,period_end,value,cumulative_value',
      'Dekad,aeti,2025-09-11,2025-09-20,20,170',
      'dekad,aeti,2025-09-01T00:00:00,2025-09-10,10,150',
      'season,aeti,2025-01-01,2025-06-20,900,900',
      ',aeti,2025-01-01,2025-06-30,999,999',
    ].join('\n')

    const stats = parseHarvestFieldStatsCsv(csv, meta)

    expect(stats.periods.map((period) => period.value)).toEqual(['2025-09-01', '2025-09-11'])
    expect(stats.timeseries.dekad.aeti).toEqual([
      { period: '2025-09-01', value: 10 },
      { period: '2025-09-11', value: 20 },
    ])
    expect(stats.timeseries.season.aeti?.at(-1)?.value).toBe(999)
  })

  it('turns cumulative dekad values into per-dekad increments', () => {
    const csv = [
      'granularity,metric,period_start,period_end,cumulative_value',
      'dekad,aeti,2025-09-01,2025-09-10,100',
      'dekad,aeti,2025-09-11,2025-09-20,150',
    ].join('\n')

    const stats = parseHarvestFieldStatsCsv(csv, meta)
    expect(stats.timeseries.dekad.aeti).toEqual([
      { period: '2025-09-01', value: 100 },
      { period: '2025-09-11', value: 50 },
    ])
  })

  it('normalizes raster period dates', () => {
    expect(normalizeHarvestPeriodDate('2025-09-01T00:00:00Z')).toBe('2025-09-01')
  })
})

describe('mergeHarvestFieldStats', () => {
  it('keeps the longer observed dekad series and the forecast season total', () => {
    const observed = parseHarvestFieldStatsCsv(
      [
        'granularity,metric,period_start,period_end,value',
        'dekad,aeti,2025-09-01,2025-09-10,10',
        'dekad,aeti,2025-09-11,2025-09-20,12',
        'season,aeti,2025-01-01,2025-06-20,22',
      ].join('\n'),
      meta
    )
    const forecast = parseHarvestFieldStatsCsv(
      [
        'granularity,metric,period_start,period_end,value',
        'dekad,aeti,2025-09-01,2025-09-10,99',
        'season,aeti,2025-01-01,2025-06-20,400',
      ].join('\n'),
      meta
    )

    const merged = mergeHarvestFieldStats(observed, forecast)
    expect(merged.timeseries.dekad.aeti).toEqual(observed.timeseries.dekad.aeti)
    expect(merged.timeseries.season.aeti).toEqual([{ period: 'Season total', value: 400 }])
    expect(merged.periods).toHaveLength(2)
  })
})
