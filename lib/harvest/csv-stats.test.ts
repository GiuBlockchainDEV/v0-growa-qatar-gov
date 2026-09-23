import { describe, expect, it } from 'vitest'
import {
  buildFieldTrendSeries,
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

  it('converts a running total stored in value into dekad increments', () => {
    const csv = [
      'granularity,metric,period_start,period_end,value',
      'dekad,aeti,2025-09-01,2025-09-10,100',
      'dekad,aeti,2025-09-11,2025-09-20,250',
      'dekad,aeti,2025-09-21,2025-09-30,400',
      'season,aeti,2025-09-01,2025-12-31,400',
    ].join('\n')

    const stats = parseHarvestFieldStatsCsv(csv, meta)
    expect(stats.timeseries.dekad.aeti).toEqual([
      { period: '2025-09-01', value: 100 },
      { period: '2025-09-11', value: 150 },
      { period: '2025-09-21', value: 150 },
    ])
  })

  it('keeps rate metrics as period values instead of differencing them', () => {
    const csv = [
      'granularity,metric,period_start,period_end,cumulative_value',
      'dekad,bwp,2025-09-01,2025-09-10,1.1',
      'dekad,bwp,2025-09-11,2025-09-20,1.4',
      'dekad,bwp,2025-09-21,2025-09-30,1.2',
    ].join('\n')

    const stats = parseHarvestFieldStatsCsv(csv, meta)
    expect(stats.timeseries.dekad.bwp).toEqual([
      { period: '2025-09-01', value: 1.1 },
      { period: '2025-09-11', value: 1.4 },
      { period: '2025-09-21', value: 1.2 },
    ])
  })

  it('reads dekad rows whose end date is the harvest date', () => {
    const csv = [
      'date,end_date,aeti_sum,aeti',
      '2025-09-01,2025-12-31,10,1',
      '2025-09-11,2025-12-31,20,2',
      '2025-09-21,2025-12-31,15,1.5',
    ].join('\n')

    const stats = parseHarvestFieldStatsCsv(csv, meta)
    expect(stats.timeseries.dekad.aeti?.map((point) => point.value)).toEqual([10, 20, 15])
    expect(stats.timeseries.season.aeti).toBeUndefined()
  })

  it('builds the season trend as the running total of dekad increments', () => {
    const stats = parseHarvestFieldStatsCsv(
      [
        'granularity,metric,period_start,period_end,value',
        'dekad,aeti,2025-09-01,2025-09-10,10',
        'dekad,aeti,2025-09-11,2025-09-20,25',
        'season,aeti,2025-09-01,2025-12-31,35',
      ].join('\n'),
      meta
    )

    expect(buildFieldTrendSeries(stats, 'season').aeti).toEqual([
      { period: '2025-09-01', value: 10 },
      { period: '2025-09-11', value: 35 },
    ])
    expect(buildFieldTrendSeries(stats, 'dekad').aeti).toEqual(stats.timeseries.dekad.aeti)
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
