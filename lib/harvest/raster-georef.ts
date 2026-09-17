import { boundsFromRings } from '@/lib/harvest/raster'
import type { RasterBounds } from '@/lib/harvest/raster-bounds'
import { normalizeRasterBounds } from '@/lib/harvest/raster-bounds'

export type RasterBoundsSource =
  | 'affine_transform'
  | 'geojson_bbox'
  | 'leaflet_bounds'
  | 'default'

export interface HarvestRasterGeorefDebug {
  rasterCrs: string | null
  rasterTransform: number[] | null
  rawBounds: unknown
  rawBbox: number[] | null
  imageWidth: number | null
  imageHeight: number | null
  computedLeafletBounds: RasterBounds
  fieldPolygonBounds: RasterBounds | null
  boundsSource: RasterBoundsSource
  hasRotation: boolean
  rotationWarning: string | null
}

const DEFAULT_BOUNDS: RasterBounds = [[25.2, 51.1], [25.5, 51.4]]
const EPSG_4326_ALIASES = new Set(['EPSG:4326', 'epsg:4326', 'OGC:CRS84', 'WGS84', 'EPSG:4326/WGS84'])

function isLat(value: number) {
  return Math.abs(value) <= 90
}

function isLng(value: number) {
  return Math.abs(value) <= 180
}

function toNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  const numbers = value.map((entry) => Number(entry))
  if (!numbers.every((entry) => Number.isFinite(entry))) return null
  return numbers
}

function parseCrs(rawMeta: Record<string, unknown>): string | null {
  const crs =
    typeof rawMeta.crs === 'string'
      ? rawMeta.crs
      : typeof rawMeta.srs === 'string'
        ? rawMeta.srs
        : typeof rawMeta.CRS === 'string'
          ? rawMeta.CRS
          : null
  return crs
}

function parseTransform(rawMeta: Record<string, unknown>): number[] | null {
  const candidates = [
    rawMeta.transform,
    rawMeta.geotransform,
    rawMeta.out_transform,
    rawMeta.affine,
    rawMeta.geo_transform,
  ]

  for (const candidate of candidates) {
    const values = toNumberArray(candidate)
    if (values && values.length >= 6) {
      return values.slice(0, 6)
    }
  }

  return null
}

function parseBbox(rawMeta: Record<string, unknown>): number[] | null {
  const values = toNumberArray(rawMeta.bbox)
  if (values && values.length >= 4) return values.slice(0, 4)
  return null
}

function leafletBoundsFromGeoJsonBbox(bbox: number[]): RasterBounds | null {
  const [west, south, east, north] = bbox
  if (![west, south, east, north].every((value) => Number.isFinite(value))) return null
  if (!isLng(west) || !isLng(east) || !isLat(south) || !isLat(north)) return null
  return [
    [Math.min(south, north), Math.min(west, east)],
    [Math.max(south, north), Math.max(west, east)],
  ]
}

function affineCornerLngLat(
  transform: number[],
  column: number,
  row: number
): { lng: number; lat: number } {
  const [a, b, c, d, e, f] = transform
  return {
    lng: c + column * a + row * b,
    lat: f + column * d + row * e,
  }
}

function leafletBoundsFromAffine(
  transform: number[],
  width: number,
  height: number
): { bounds: RasterBounds; hasRotation: boolean } {
  const corners = [
    affineCornerLngLat(transform, 0, 0),
    affineCornerLngLat(transform, width, 0),
    affineCornerLngLat(transform, width, height),
    affineCornerLngLat(transform, 0, height),
  ]

  const lats = corners.map((corner) => corner.lat)
  const lngs = corners.map((corner) => corner.lng)
  const hasRotation = Math.abs(transform[1]) > 1e-12 || Math.abs(transform[3]) > 1e-12

  return {
    bounds: [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ],
    hasRotation,
  }
}

export function logRasterGeorefDebug(debug: HarvestRasterGeorefDebug, context?: string) {
  const prefix = context ? `[harvest-raster-georef:${context}]` : '[harvest-raster-georef]'
  console.info(prefix, {
    rasterCrs: debug.rasterCrs,
    rasterTransform: debug.rasterTransform,
    rasterBounds: debug.rawBounds,
    rawBbox: debug.rawBbox,
    imageWidth: debug.imageWidth,
    imageHeight: debug.imageHeight,
    finalEpsg4326Bounds: debug.computedLeafletBounds,
    fieldPolygonBounds: debug.fieldPolygonBounds,
    boundsSource: debug.boundsSource,
    hasRotation: debug.hasRotation,
    rotationWarning: debug.rotationWarning,
  })
}

export function resolveRasterGeoref({
  rawMeta,
  imageWidth,
  imageHeight,
  fieldPolygonBounds,
}: {
  rawMeta: Record<string, unknown>
  imageWidth?: number | null
  imageHeight?: number | null
  fieldPolygonBounds?: RasterBounds | null
}): { bounds: RasterBounds; debug: HarvestRasterGeorefDebug } {
  const crs = parseCrs(rawMeta)
  const transform = parseTransform(rawMeta)
  const rawBbox = parseBbox(rawMeta)
  const rawBounds = rawMeta.bounds ?? null

  let boundsSource: RasterBoundsSource = 'default'
  let computedBounds: RasterBounds = DEFAULT_BOUNDS
  let hasRotation = false
  let rotationWarning: string | null = null

  if (crs && !EPSG_4326_ALIASES.has(crs)) {
    rotationWarning = `Raster CRS ${crs} is not EPSG:4326; bounds were not reprojected in the BFF`
  }

  if (transform && imageWidth && imageHeight && imageWidth > 0 && imageHeight > 0) {
    const affine = leafletBoundsFromAffine(transform, imageWidth, imageHeight)
    computedBounds = affine.bounds
    boundsSource = 'affine_transform'
    hasRotation = affine.hasRotation
    if (hasRotation) {
      rotationWarning =
        'Raster affine transform includes rotation/shear; overlay uses axis-aligned envelope only'
    }
  } else if (rawBbox) {
    const bboxBounds = leafletBoundsFromGeoJsonBbox(rawBbox)
    if (bboxBounds) {
      computedBounds = bboxBounds
      boundsSource = 'geojson_bbox'
    }
  } else if (rawBounds) {
    computedBounds = normalizeRasterBounds(rawBounds)
    boundsSource = 'leaflet_bounds'
  }

  const debug: HarvestRasterGeorefDebug = {
    rasterCrs: crs,
    rasterTransform: transform,
    rawBounds,
    rawBbox,
    imageWidth: imageWidth ?? null,
    imageHeight: imageHeight ?? null,
    computedLeafletBounds: computedBounds,
    fieldPolygonBounds: fieldPolygonBounds ?? null,
    boundsSource,
    hasRotation,
    rotationWarning,
  }

  return { bounds: computedBounds, debug }
}

export function fieldBoundsFromClipRings(
  clipRings: Array<Array<{ lat: number; lng: number }>>
): RasterBounds | null {
  if (clipRings.length === 0) return null
  return boundsFromRings(clipRings)
}
