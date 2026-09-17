import type { RasterImageCrop } from '@/lib/harvest/image-process'
import { boundsFromRings } from '@/lib/harvest/geojson'

export type RasterBounds = [[number, number], [number, number]]

const QATAR_LAT_MIN = 24
const QATAR_LAT_MAX = 27
const QATAR_LNG_MIN = 50
const QATAR_LNG_MAX = 52

function isFinitePair(pair: unknown): pair is [number, number] {
  return (
    Array.isArray(pair) &&
    pair.length >= 2 &&
    Number.isFinite(Number(pair[0])) &&
    Number.isFinite(Number(pair[1]))
  )
}

function looksLikeQatarLat(value: number) {
  return value >= QATAR_LAT_MIN && value <= QATAR_LAT_MAX
}

function looksLikeQatarLng(value: number) {
  return value >= QATAR_LNG_MIN && value <= QATAR_LNG_MAX
}

function envelopeFromCorners(
  firstLat: number,
  firstLng: number,
  secondLat: number,
  secondLng: number
): RasterBounds | null {
  if (![firstLat, firstLng, secondLat, secondLng].every((value) => Number.isFinite(value))) {
    return null
  }

  const south = Math.min(firstLat, secondLat)
  const north = Math.max(firstLat, secondLat)
  const west = Math.min(firstLng, secondLng)
  const east = Math.max(firstLng, secondLng)

  if (north <= south || east <= west) return null

  return [[south, west], [north, east]]
}

/** Parse Harvest raster_meta.bounds as Leaflet [[south,west],[north,east]]. */
export function parseLeafletCornerBounds(bounds: unknown): RasterBounds | null {
  if (!Array.isArray(bounds) || bounds.length < 2) return null

  const first = bounds[0]
  const second = bounds[1]
  if (!isFinitePair(first) || !isFinitePair(second)) return null

  const a0 = Number(first[0])
  const a1 = Number(first[1])
  const b0 = Number(second[0])
  const b1 = Number(second[1])

  // Canonical Harvest format: [latitude, longitude] per corner.
  const asLatLng = envelopeFromCorners(a0, a1, b0, b1)
  if (
    asLatLng &&
    looksLikeQatarLat(asLatLng[0][0]) &&
    looksLikeQatarLat(asLatLng[1][0]) &&
    looksLikeQatarLng(asLatLng[0][1]) &&
    looksLikeQatarLng(asLatLng[1][1])
  ) {
    return asLatLng
  }

  // GeoJSON corner order: [longitude, latitude].
  const asLngLat = envelopeFromCorners(a1, a0, b1, b0)
  if (
    asLngLat &&
    looksLikeQatarLat(asLngLat[0][0]) &&
    looksLikeQatarLat(asLngLat[1][0]) &&
    looksLikeQatarLng(asLngLat[0][1]) &&
    looksLikeQatarLng(asLngLat[1][1])
  ) {
    return asLngLat
  }

  // Generic lat/lng envelope (fields outside Qatar or slightly outside the strict box).
  if (asLatLng && asLatLng[1][0] > asLatLng[0][0] && asLatLng[1][1] > asLatLng[0][1]) {
    return asLatLng
  }
  if (asLngLat && asLngLat[1][0] > asLngLat[0][0] && asLngLat[1][1] > asLngLat[0][1]) {
    return asLngLat
  }

  return asLatLng || asLngLat
}

function parseGeoJsonFlatBbox(bounds: number[]): RasterBounds | null {
  const [a, b, c, d] = bounds
  if (![a, b, c, d].every((value) => Number.isFinite(value))) return null

  // GeoJSON bbox: [west, south, east, north]
  const geoJsonBbox = envelopeFromCorners(b, a, d, c)
  if (
    geoJsonBbox &&
    looksLikeQatarLat(geoJsonBbox[0][0]) &&
    looksLikeQatarLng(geoJsonBbox[0][1])
  ) {
    return geoJsonBbox
  }

  // Leaflet flat: [south, west, north, east]
  const leafletFlat = envelopeFromCorners(a, b, c, d)
  if (
    leafletFlat &&
    looksLikeQatarLat(leafletFlat[0][0]) &&
    looksLikeQatarLng(leafletFlat[0][1])
  ) {
    return leafletFlat
  }

  return geoJsonBbox || leafletFlat
}

export function normalizeRasterBounds(bounds: unknown): RasterBounds {
  const parsed = parseLeafletCornerBounds(bounds)
  if (parsed) return parsed

  if (
    Array.isArray(bounds) &&
    bounds.length >= 4 &&
    bounds.every((value) => typeof value === 'number')
  ) {
    const flat = parseGeoJsonFlatBbox(bounds as number[])
    if (flat) return flat
  }

  throw new Error('Unable to parse raster bounds into Leaflet [[south,west],[north,east]] format')
}

export function tryNormalizeRasterBounds(bounds: unknown): RasterBounds | null {
  try {
    return normalizeRasterBounds(bounds)
  } catch {
    return null
  }
}

export function resolveRasterDisplayBounds(
  apiBounds: RasterBounds,
  clipRings: Array<Array<{ lat: number; lng: number }>>
): RasterBounds {
  if (clipRings.length === 0) return apiBounds
  return boundsFromRings(clipRings)
}

export function resolveRasterRenderBounds(
  apiBounds: RasterBounds,
  prepared: {
    crop: RasterImageCrop | null
    sourceWidth: number
    sourceHeight: number
  }
): RasterBounds {
  if (!prepared.crop) return apiBounds
  return adjustRasterBoundsForCrop(
    apiBounds,
    prepared.sourceWidth,
    prepared.sourceHeight,
    prepared.crop
  )
}

export function adjustRasterBoundsForCrop(
  bounds: RasterBounds,
  sourceWidth: number,
  sourceHeight: number,
  crop: RasterImageCrop
): RasterBounds {
  if (sourceWidth <= 0 || sourceHeight <= 0 || crop.width <= 0 || crop.height <= 0) {
    return bounds
  }

  const [[south, west], [north, east]] = bounds
  const latSpan = north - south
  const lngSpan = east - west

  const newWest = west + lngSpan * (crop.left / sourceWidth)
  const newEast = west + lngSpan * ((crop.left + crop.width) / sourceWidth)
  const newNorth = north - latSpan * (crop.top / sourceHeight)
  const newSouth = north - latSpan * ((crop.top + crop.height) / sourceHeight)

  return [
    [newSouth, newWest],
    [newNorth, newEast],
  ]
}

export function normalizeRasterLegend(
  legend: unknown
): Array<{ color: string; label: string }> {
  if (!Array.isArray(legend)) return []

  return legend
    .map((entry) => {
      const record = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null
      if (!record) return null
      const color =
        typeof record.color === 'string'
          ? record.color
          : typeof record.hex === 'string'
            ? record.hex
            : ''
      const label = typeof record.label === 'string' ? record.label : ''
      if (!color || !label) return null
      return { color, label }
    })
    .filter((entry): entry is { color: string; label: string } => Boolean(entry))
}
