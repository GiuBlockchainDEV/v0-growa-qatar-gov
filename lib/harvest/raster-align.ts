import type { RasterBounds } from '@/lib/harvest/raster-bounds'

export interface BoundsEnvelope {
  south: number
  west: number
  north: number
  east: number
}

export function envelopeFromBounds(bounds: RasterBounds): BoundsEnvelope {
  const [[south, west], [north, east]] = bounds
  return {
    south: Math.min(south, north),
    west: Math.min(west, east),
    north: Math.max(south, north),
    east: Math.max(west, east),
  }
}

export function boundsOverlapRatio(raster: RasterBounds, field: RasterBounds): number {
  const rasterEnvelope = envelopeFromBounds(raster)
  const fieldEnvelope = envelopeFromBounds(field)

  const overlapSouth = Math.max(rasterEnvelope.south, fieldEnvelope.south)
  const overlapNorth = Math.min(rasterEnvelope.north, fieldEnvelope.north)
  const overlapWest = Math.max(rasterEnvelope.west, fieldEnvelope.west)
  const overlapEast = Math.min(rasterEnvelope.east, fieldEnvelope.east)

  if (overlapNorth <= overlapSouth || overlapEast <= overlapWest) return 0

  const overlapArea = (overlapNorth - overlapSouth) * (overlapEast - overlapWest)
  const fieldArea =
    (fieldEnvelope.north - fieldEnvelope.south) * (fieldEnvelope.east - fieldEnvelope.west)

  return fieldArea > 0 ? overlapArea / fieldArea : 0
}

export function boundsCentroid(bounds: RasterBounds) {
  const envelope = envelopeFromBounds(bounds)
  return {
    lat: (envelope.south + envelope.north) / 2,
    lng: (envelope.west + envelope.east) / 2,
  }
}

export function centroidDistanceDegrees(a: RasterBounds, b: RasterBounds) {
  const ca = boundsCentroid(a)
  const cb = boundsCentroid(b)
  return Math.hypot(ca.lat - cb.lat, ca.lng - cb.lng)
}

/** Interpret each corner as [lng, lat] instead of [lat, lng]. */
export function swapCornerLatLng(bounds: RasterBounds): RasterBounds {
  const [[a0, a1], [b0, b1]] = bounds
  const lats = [a1, b1]
  const lngs = [a0, b0]
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ]
}

export function pickBestRasterBounds(
  candidates: Array<{ bounds: RasterBounds; source: string }>,
  fieldBounds: RasterBounds | null
): { bounds: RasterBounds; source: string; overlap: number } | null {
  if (candidates.length === 0) return null

  if (!fieldBounds) {
    const first = candidates[0]
    return { bounds: first.bounds, source: first.source, overlap: 1 }
  }

  let best = candidates[0]
  let bestOverlap = boundsOverlapRatio(best.bounds, fieldBounds)

  for (const candidate of candidates.slice(1)) {
    const overlap = boundsOverlapRatio(candidate.bounds, fieldBounds)
    if (overlap > bestOverlap + 0.05) {
      best = candidate
      bestOverlap = overlap
    } else if (Math.abs(overlap - bestOverlap) <= 0.05) {
      const candidateDistance = centroidDistanceDegrees(candidate.bounds, fieldBounds)
      const bestDistance = centroidDistanceDegrees(best.bounds, fieldBounds)
      if (candidateDistance < bestDistance) {
        best = candidate
        bestOverlap = overlap
      }
    }
  }

  return { bounds: best.bounds, source: best.source, overlap: bestOverlap }
}
