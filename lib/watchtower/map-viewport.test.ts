import { describe, expect, it } from 'vitest'
import { getWorldFillZoom, MIN_WORLD_ZOOM, WORLD_TILE_PX } from './map-viewport'

describe('Watchtower fullscreen world coverage', () => {
  it('fills wide desktops without blank map edges at the overview zoom', () => {
    for (const [width, height] of [[1736, 864], [1920, 1080], [2560, 1440], [3840, 2160]]) {
      const zoom = getWorldFillZoom(width, height)
      expect(WORLD_TILE_PX * 2 ** zoom).toBeGreaterThanOrEqual(Math.max(width, height) - 0.001)
    }
  })
  it('keeps a usable global overview on phones', () => {
    expect(getWorldFillZoom(390, 844)).toBe(MIN_WORLD_ZOOM)
  })
  it('returns a safe zoom while measuring or on invalid input', () => {
    expect(getWorldFillZoom(0, 0)).toBe(MIN_WORLD_ZOOM)
    expect(getWorldFillZoom(Number.NaN, 840)).toBe(MIN_WORLD_ZOOM)
  })
  it('increases the minimum zoom on resize for ultrawide screens', () => {
    expect(getWorldFillZoom(3840, 2160)).toBeGreaterThan(getWorldFillZoom(1280, 720))
  })
})
