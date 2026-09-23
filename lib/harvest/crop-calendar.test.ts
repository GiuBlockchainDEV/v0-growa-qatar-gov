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

  it('prefers Qatar rows inside Qatar bounds', () => {
    const entry = resolveCropCalendarEntry('tomato', { lat: 25.35, lng: 51.18 }, entries)
    expect(entry.region).toBe('qatar')
    expect(entry.start_month).toBe(10)
    expect(entry.start_day).toBe(15)
  })

  it('falls back to GCC rows outside Qatar', () => {
    const entry = resolveCropCalendarEntry('tomato', { lat: 24.2, lng: 55.3 }, entries)
    expect(entry.region).toBe('gcc')
    expect(entry.start_day).toBe(10)
  })
})
