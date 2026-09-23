import { describe, expect, it } from 'vitest'
import { parseWatchtowerTimeframe, resolveTimeWindow } from '@/lib/domain/timeframes'

describe('parseWatchtowerTimeframe', () => {
  it('defaults to season for invalid input', () => {
    expect(parseWatchtowerTimeframe(null)).toBe('season')
    expect(parseWatchtowerTimeframe('invalid')).toBe('season')
  })

  it('parses valid timeframes', () => {
    expect(parseWatchtowerTimeframe('24h')).toBe('24h')
    expect(parseWatchtowerTimeframe('season')).toBe('season')
  })
})

describe('resolveTimeWindow', () => {
  it('returns comparison window before current window', () => {
    const reference = new Date('2026-09-22T12:00:00.000Z')
    const window = resolveTimeWindow('7d', reference)
    expect(window.end.getTime()).toBe(reference.getTime())
    expect(window.start.getTime()).toBeLessThan(window.end.getTime())
    expect(window.comparisonStart.getTime()).toBeLessThan(window.comparisonEnd.getTime())
  })
})
