import type { RasterImageCrop } from '@/lib/harvest/image-process'
import { boundsFromRings } from '@/lib/harvest/geojson'

export type RasterBounds = [[number, number], [number, number]]

const DEFAULT_BOUNDS: RasterBounds = [[25.2, 51.1], [25.5, 51.4]]

function isLat(value: number) {
  return Math.abs(value) <= 90
}

function isLng(value: number) {
  return Math.abs(value) <= 180
}

function normalizeCornerPair(
  first: number[],
  second: number[]
): RasterBounds | null {
  const a0 = Number(first[0])
  const a1 = Number(first[1])
  const b0 = Number(second[0])
  const b1 = Number(second[1])

  if (![a0, a1, b0, b1].every((value) => Number.isFinite(value))) {
    return null
  }

  // GeoJSON-style corner pairs are [longitude, latitude]
  const firstIsLngLat = Math.abs(a0) > Math.abs(a1) && isLat(a1) && isLng(a0)
  const secondIsLngLat = Math.abs(b0) > Math.abs(b1) && isLat(b1) && isLng(b0)

  const latLngPairs = firstIsLngLat || secondIsLngLat
    ? [
        { lat: a1, lng: a0 },
        { lat: b1, lng: b0 },
      ]
    : [
        { lat: a0, lng: a1 },
        { lat: b0, lng: b1 },
      ]

  const lats = latLngPairs.map((point) => point.lat)
  const lngs = latLngPairs.map((point) => point.lng)

  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ]
}

function normalizeFlatBounds(bounds: number[]): RasterBounds | null {
  const [a, b, c, d] = bounds
  if (![a, b, c, d].every((value) => Number.isFinite(value))) return null

  // GeoJSON bbox: [west, south, east, north]
  const looksLikeWestSouthEastNorth =
    Math.abs(a) > Math.abs(b) && Math.abs(c) > Math.abs(d) && isLat(b) && isLat(d) && isLng(a) && isLng(c)
  if (looksLikeWestSouthEastNorth) {
    return [
      [Math.min(b, d), Math.min(a, c)],
      [Math.max(b, d), Math.max(a, c)],
    ]
  }

  // Leaflet-style flat corners: [south, west, north, east]
  const looksLikeSouthWestNorthEast =
    Math.abs(b) > Math.abs(a) && Math.abs(d) > Math.abs(c) && isLat(a) && isLat(c) && isLng(b) && isLng(d)
  if (looksLikeSouthWestNorthEast) {
    return [
      [Math.min(a, c), Math.min(b, d)],
      [Math.max(a, c), Math.max(b, d)],
    ]
  }

  return null
}

export function normalizeRasterBounds(bounds: unknown): RasterBounds {
  if (!Array.isArray(bounds) || bounds.length < 2) return DEFAULT_BOUNDS

  if (bounds.length >= 4 && bounds.every((value) => typeof value === 'number')) {
    const flatBounds = normalizeFlatBounds(bounds as number[])
    if (flatBounds) return flatBounds
  }

  const first = bounds[0]
  const second = bounds[1]
  if (!Array.isArray(first) || !Array.isArray(second) || first.length < 2 || second.length < 2) {
    return DEFAULT_BOUNDS
  }

  return normalizeCornerPair(first as number[], second as number[]) || DEFAULT_BOUNDS
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
  },
  imageSource?: 'view' | 'raster'
): RasterBounds {
  if (!prepared.crop) return apiBounds

  // entity/raster PNG bounds describe the full image; shift bounds after margin crop.
  if (imageSource !== 'view') {
    return adjustRasterBoundsForCrop(
      apiBounds,
      prepared.sourceWidth,
      prepared.sourceHeight,
      prepared.crop
    )
  }

  return apiBounds
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
