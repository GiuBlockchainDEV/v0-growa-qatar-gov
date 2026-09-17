import { harvestGetFieldRaster } from '@/lib/harvest/client'
import { readRasterImageDimensions } from '@/lib/harvest/raster-image'
import { resolveRasterGeoref } from '@/lib/harvest/raster-georef'
import type { RasterBounds } from '@/lib/harvest/raster-bounds'
import type { HarvestRasterGeorefDebug } from '@/lib/harvest/types'

export function resolveRasterGeorefFromMeta({
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
  try {
    return resolveRasterGeoref({
      rawMeta,
      imageWidth,
      imageHeight,
      fieldPolygonBounds,
    })
  } catch (error) {
    if (fieldPolygonBounds) {
      return {
        bounds: fieldPolygonBounds,
        debug: {
          rasterCrs: typeof rawMeta.crs === 'string' ? rawMeta.crs : null,
          rasterTransform: null,
          rawBounds: rawMeta.bounds ?? null,
          rawBbox: Array.isArray(rawMeta.bbox) ? (rawMeta.bbox as number[]) : null,
          imageWidth: imageWidth ?? null,
          imageHeight: imageHeight ?? null,
          computedLeafletBounds: fieldPolygonBounds,
          fieldPolygonBounds,
          boundsSource: 'leaflet_bounds',
          fieldOverlap: 1,
          hasRotation: false,
          rotationWarning:
            error instanceof Error
              ? `Bounds parse failed (${error.message}); using field polygon envelope`
              : 'Bounds parse failed; using field polygon envelope',
        },
      }
    }
    throw error
  }
}

export async function enrichRasterMetaDimensions({
  rasterMode,
  parcelId,
  seasonId,
  metric,
  granularity,
  period,
  imageBuffer,
}: {
  rasterMode: string
  parcelId: string
  seasonId: number
  metric: string
  granularity: string
  period: string | null
  imageBuffer?: ArrayBuffer | null
}): Promise<{ width: number | null; height: number | null }> {
  let buffer = imageBuffer
  if (!buffer?.byteLength) {
    try {
      buffer = await harvestGetFieldRaster(rasterMode, parcelId, seasonId, {
        var: metric,
        granularity,
        ...(granularity === 'dekad' && period ? { period } : {}),
      })
    } catch {
      return { width: null, height: null }
    }
  }

  const dimensions = await readRasterImageDimensions(Buffer.from(buffer))
  return {
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  }
}
