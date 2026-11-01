import { describe, expect, it } from 'vitest'
import { resolveFarmMapCoordinates, resolveFarmDisplayName } from './farm-map-coordinates'

describe('resolveFarmMapCoordinates', () => {
  it('uses explicit GPS columns when present', () => {
    expect(
      resolveFarmMapCoordinates({
        id: 'farm-1',
        gps_latitude: 25.1,
        gps_longitude: 51.2,
      })
    ).toEqual({ lat: 25.1, lng: 51.2, source: 'gps' })
  })

  it('parses coordinates embedded in the location field', () => {
    expect(
      resolveFarmMapCoordinates({
        id: 'farm-2',
        location: '25.2854, 51.5310',
      })
    ).toEqual({ lat: 25.2854, lng: 51.531, source: 'location' })
  })

  it('falls back to a deterministic Qatar position when GPS is missing', () => {
    const first = resolveFarmMapCoordinates({ id: 'farm-abc', location: 'Al Wakrah' })
    const second = resolveFarmMapCoordinates({ id: 'farm-abc', location: 'Al Wakrah' })
    expect(first?.source).toBe('fallback')
    expect(second).toEqual(first)
  })
})

describe('resolveFarmDisplayName', () => {
  it('prefers English name fields', () => {
    expect(resolveFarmDisplayName({ name_en: 'North Farm', name_ar: 'مزرعة' }, 'id')).toBe('North Farm')
  })
})
