import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCropCalendarCsv, resolveCropCalendarEntry } from '@/lib/harvest/crop-calendar'

const csv = readFileSync(join(process.cwd(), 'lib/harvest/data/qatar-gcc-crop-calendar.csv'), 'utf8')
const entries = parseCropCalendarCsv(csv)

describe('crop-calendar', () => {
  it('loads Qatar and GCC rows from the CSV calendar', () => {
    expect(entries.length).toBeGreaterThan(20)
    expect(entries.some((entry) => entry.region === 'qatar' && entry.crop_key === 'tomato')).toBe(true)
    expect(entries.some((entry) => entry.region === 'gcc' && entry.crop_key === 'tomato')).toBe(true)
  })

  it('prefers Qatar open-field rows inside Qatar bounds', () => {
    const entry = resolveCropCalendarEntry('tomato', { lat: 25.35, lng: 51.18 }, entries)
    expect(entry.region).toBe('qatar')
    expect(entry.production_system).toBe('open_field_or_passive_protected')
    expect(entry.calendar_type).toBe('active_or_commercial_window')
    expect(entry.start_month).toBe(9)
    expect(entry.start_day).toBe(15)
  })

  it('falls back to GCC rows outside Qatar', () => {
    const entry = resolveCropCalendarEntry('tomato', { lat: 24.2, lng: 55.3 }, entries)
    expect(entry.region).toBe('gcc')
    expect(entry.start_month).toBe(9)
    expect(entry.start_day).toBe(1)
  })

  it('loads v2 metadata columns from the CSV', () => {
    const tomato = entries.find(
      (entry) =>
        entry.region === 'qatar' &&
        entry.crop_key === 'tomato' &&
        entry.production_system === 'open_field_or_passive_protected'
    )
    expect(tomato?.confidence).toBe('high')
    expect(tomato?.source_url).toContain('psa.gov.qa')
  })
})
