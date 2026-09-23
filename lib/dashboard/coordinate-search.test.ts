import { describe, expect, it } from 'vitest'
import { parseCoordinateQuery } from './coordinate-search'

describe('parseCoordinateQuery', () => {
  it('parses latitude then longitude separated by a comma', () => {
    expect(parseCoordinateQuery('25.2854, 51.5310')).toEqual({ lat: 25.2854, lng: 51.531 })
  })

  it('parses spaces, semicolons, and labeled pairs', () => {
    expect(parseCoordinateQuery('25.2854 51.5310')).toEqual({ lat: 25.2854, lng: 51.531 })
    expect(parseCoordinateQuery('25.2854; 51.5310')).toEqual({ lat: 25.2854, lng: 51.531 })
    expect(parseCoordinateQuery('lat 25.2854 lng 51.5310')).toEqual({ lat: 25.2854, lng: 51.531 })
  })

  it('rejects missing, swapped-range, and out-of-range values', () => {
    expect(parseCoordinateQuery('')).toBeNull()
    expect(parseCoordinateQuery('25.2854')).toBeNull()
    expect(parseCoordinateQuery('91, 51')).toBeNull()
    expect(parseCoordinateQuery('25, 181')).toBeNull()
  })
})
