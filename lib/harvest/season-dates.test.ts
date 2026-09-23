import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCropCalendarCsv } from '@/lib/harvest/crop-calendar'
import { suggestHarvestSeasonDates } from '@/lib/harvest/season-dates'

const calendar = parseCropCalendarCsv(
  readFileSync(join(process.cwd(), 'lib/harvest/data/qatar-gcc-crop-calendar.csv'), 'utf8')
)

describe('suggestHarvestSeasonDates', () => {
  it('uses the previous season when the current one has not started yet', () => {
    const result = suggestHarvestSeasonDates({
      cropName: 'tomato',
      location: { lat: 25.35, lng: 51.18 },
      reference: new Date('2026-09-23T12:00:00.000Z'),
      calendar,
    })

    expect(result.start_date).toBe('2025-10-15')
    expect(result.harvest_date).toBe('2026-03-20')
  })

  it('shifts start earlier for northern Qatar locations', () => {
    const result = suggestHarvestSeasonDates({
      cropName: 'tomato',
      location: { lat: 26.1, lng: 51.21 },
      reference: new Date('2026-12-01T12:00:00.000Z'),
      calendar,
    })

    expect(result.start_date).toBe('2026-10-10')
    expect(result.harvest_date).toBe('2027-03-20')
  })

  it('falls back to the prior season when the latest start would be too recent', () => {
    const result = suggestHarvestSeasonDates({
      cropName: 'cucumber',
      location: { lat: 25.17, lng: 51.6 },
      reference: new Date('2026-11-10T12:00:00.000Z'),
      calendar,
    })

    expect(result.start_date).toBe('2025-11-06')
    expect(result.harvest_date).toBe('2026-02-28')
  })
})
