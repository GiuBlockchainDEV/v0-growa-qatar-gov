import { boundsFromRings } from '@/lib/harvest/geojson'
import type { HarvestRasterGeorefDebug } from '@/lib/harvest/types'
import {
  parseLeafletCornerBounds,
  tryNormalizeRasterBounds,
  type RasterBounds,
} from '@/lib/harvest/raster-bounds'
import {
  boundsOverlapRatio,
  pickBestRasterBounds,
  swapCornerLatLng,
} from '@/lib/harvest/raster-align'

export type RasterBoundsSource = HarvestRasterGeorefDebug['boundsSource']
export type { HarvestRasterGeorefDebug }

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
  if (process.env.NODE_ENV === 'production') return
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
    fieldOverlap: debug.fieldOverlap,
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

  let hasRotation = false
  let rotationWarning: string | null = null

  if (crs && !EPSG_4326_ALIASES.has(crs)) {
    rotationWarning = `Raster CRS ${crs} is not EPSG:4326; bounds were not reprojected in the BFF`
  }

  const candidates: Array<{ bounds: RasterBounds; source: RasterBoundsSource }> = []

  const leafletParsed = parseLeafletCornerBounds(rawBounds)
  if (leafletParsed) {
    candidates.push({ bounds: leafletParsed, source: 'leaflet_bounds' })
    candidates.push({ bounds: swapCornerLatLng(leafletParsed), source: 'leaflet_bounds' })
  }

  const normalizedRaw = tryNormalizeRasterBounds(rawBounds)
  if (normalizedRaw && !candidates.some((entry) => entry.source === 'leaflet_bounds')) {
    candidates.push({ bounds: normalizedRaw, source: 'leaflet_bounds' })
  }

  if (transform && imageWidth && imageHeight && imageWidth > 0 && imageHeight > 0) {
    const affine = leafletBoundsFromAffine(transform, imageWidth, imageHeight)
    candidates.push({ bounds: affine.bounds, source: 'affine_transform' })
    hasRotation = affine.hasRotation
    if (hasRotation) {
      rotationWarning =
        'Raster affine transform includes rotation/shear; overlay uses axis-aligned envelope only'
    }
  }

  if (rawBbox) {
    const bboxBounds = leafletBoundsFromGeoJsonBbox(rawBbox)
    if (bboxBounds) {
      candidates.push({ bounds: bboxBounds, source: 'geojson_bbox' })
    }
  }

  const picked = pickBestRasterBounds(
    candidates.map((entry) => ({ bounds: entry.bounds, source: entry.source })),
    fieldPolygonBounds ?? null
  )

  if (!picked) {
    throw new Error('Unable to resolve raster georeferencing bounds from Harvest metadata')
  }

  const bounds = picked.bounds
  const boundsSource = picked.source as RasterBoundsSource
  const fieldOverlap =
    fieldPolygonBounds ? boundsOverlapRatio(bounds, fieldPolygonBounds) : null

  if (fieldPolygonBounds && fieldOverlap !== null && fieldOverlap < 0.15) {
    rotationWarning = [
      rotationWarning,
      `Raster bounds overlap only ${(fieldOverlap * 100).toFixed(1)}% of the field polygon — image margins will be cropped client-side`,
    ]
      .filter(Boolean)
      .join('; ')
  }

  const debug: HarvestRasterGeorefDebug = {
    rasterCrs: crs,
    rasterTransform: transform,
    rawBounds,
    rawBbox,
    imageWidth: imageWidth ?? null,
    imageHeight: imageHeight ?? null,
    computedLeafletBounds: bounds,
    fieldPolygonBounds: fieldPolygonBounds ?? null,
    boundsSource,
    fieldOverlap,
    hasRotation,
    rotationWarning,
  }

  return { bounds, debug }
}

export function fieldBoundsFromClipRings(
  clipRings: Array<Array<{ lat: number; lng: number }>>
): RasterBounds | null {
  if (clipRings.length === 0) return null
  return boundsFromRings(clipRings)
}
