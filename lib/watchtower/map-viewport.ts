/**
 * Leaflet's non-wrapping world at zoom 2 is only 1024px across. On wide
 * Watchtower displays that left blank columns beside Esri imagery.
 *
 * Find the smallest fractional zoom whose projected Web-Mercator world
 * covers both viewport dimensions. TileLayer itself still wraps across the
 * antimeridian, so panning does not expose empty horizontal bands.
 */
export const WORLD_TILE_PX = 256
export const WORLD_ZOOM_STEP = 0.1
export const MIN_WORLD_ZOOM = 2
export const MAX_WORLD_ZOOM = 19

export function getWorldFillZoom(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) ||
    width <= 0 || height <= 0) return MIN_WORLD_ZOOM

  const pixels = Math.max(width, height)
  const target = Math.log2(pixels / WORLD_TILE_PX)
  const snapped = Math.ceil((target - 1e-10) / WORLD_ZOOM_STEP) * WORLD_ZOOM_STEP
  return Math.max(MIN_WORLD_ZOOM, Math.min(MAX_WORLD_ZOOM, Number(snapped.toFixed(1))))
}

/**
 * Starting viewport for the Watchtower's Qatar-centred maritime corridor.
 * The focus covers the Persian Gulf, Hormuz, Gulf of Oman, Red Sea,
 * Bab el-Mandeb and Gulf of Aden. Coordinates define a VIEW/FILTER, not
 * an assertion of live AIS reception throughout these waters.
 */
export const REGIONAL_WATCHTOWER_VIEW={
  lat:22.5,lon:50,zoom:4.5,
  box:[9,31,36,68] as readonly [number,number,number,number],
} as const
