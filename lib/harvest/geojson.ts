export interface LatLngVertex {
  lat: number
  lng: number
}

export interface HarvestFieldPolygon {
  parcel_id: string
  name: string
  crop: string
  rings: LatLngVertex[][]
  centroid: LatLngVertex
}

const QATAR_BOUNDS = {
  minLat: 24.47,
  maxLat: 26.18,
  minLng: 50.75,
  maxLng: 51.65,
}

export function isInQatar(lat: number, lng: number) {
  return (
    lat >= QATAR_BOUNDS.minLat &&
    lat <= QATAR_BOUNDS.maxLat &&
    lng >= QATAR_BOUNDS.minLng &&
    lng <= QATAR_BOUNDS.maxLng
  )
}

function toVertex(coordinate: unknown): LatLngVertex | null {
  if (!Array.isArray(coordinate) || coordinate.length < 2) return null
  const lng = Number(coordinate[0])
  const lat = Number(coordinate[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function ringFromCoordinates(coordinates: unknown): LatLngVertex[] {
  if (!Array.isArray(coordinates)) return []
  const ring = coordinates
    .map((coordinate) => toVertex(coordinate))
    .filter((vertex): vertex is LatLngVertex => Boolean(vertex))
  if (ring.length < 3) return []
  return ring
}

function ringsFromGeometry(geometry: unknown): LatLngVertex[][] {
  const record = geometry && typeof geometry === 'object' ? (geometry as Record<string, unknown>) : null
  if (!record) return []

  const type = record.type
  const coordinates = record.coordinates

  if (type === 'Polygon' && Array.isArray(coordinates) && Array.isArray(coordinates[0])) {
    const outerRing = ringFromCoordinates(coordinates[0])
    return outerRing.length >= 3 ? [outerRing] : []
  }

  if (type === 'MultiPolygon' && Array.isArray(coordinates)) {
    return coordinates
      .map((polygon) => (Array.isArray(polygon) ? ringFromCoordinates(polygon[0]) : []))
      .filter((ring) => ring.length >= 3)
  }

  return []
}

function geometryFromGeoJson(geojson: unknown): unknown {
  const record = geojson && typeof geojson === 'object' ? (geojson as Record<string, unknown>) : null
  if (!record) return null

  if (record.type === 'FeatureCollection' && Array.isArray(record.features) && record.features[0]) {
    const feature = record.features[0] as Record<string, unknown>
    return feature.geometry ?? null
  }

  if (record.type === 'Feature') {
    return record.geometry ?? null
  }

  if (record.type === 'Polygon' || record.type === 'MultiPolygon') {
    return record
  }

  return null
}

export function geoJsonToHarvestFieldPolygon(
  geojson: unknown,
  meta: { parcel_id: string; name: string; crop: string }
): HarvestFieldPolygon | null {
  const rings = ringsFromGeometry(geometryFromGeoJson(geojson))
  if (rings.length === 0) return null

  const centroid = computeCentroid(rings[0])
  if (!isInQatar(centroid.lat, centroid.lng)) return null

  return {
    parcel_id: meta.parcel_id,
    name: meta.name,
    crop: meta.crop,
    rings,
    centroid,
  }
}

export function extractBoundsFromGeoJson(geojson: unknown): [[number, number], [number, number]] | null {
  const rings = ringsFromGeometry(geometryFromGeoJson(geojson))
  if (rings.length === 0) return null
  return boundsFromRings(rings)
}

function boundsFromRings(rings: LatLngVertex[][]): [[number, number], [number, number]] {
  const vertices = rings.flat()
  if (vertices.length === 0) return [[25.2, 51.1], [25.5, 51.4]]
  const lats = vertices.map((vertex) => vertex.lat)
  const lngs = vertices.map((vertex) => vertex.lng)
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ]
}

export function computeCentroid(vertices: LatLngVertex[]): LatLngVertex {
  if (vertices.length === 0) return { lat: 25.3548, lng: 51.1839 }
  const totals = vertices.reduce(
    (acc, vertex) => {
      acc.lat += vertex.lat
      acc.lng += vertex.lng
      return acc
    },
    { lat: 0, lng: 0 }
  )
  return {
    lat: totals.lat / vertices.length,
    lng: totals.lng / vertices.length,
  }
}

export function createRectangleRing(
  centerLat: number,
  centerLng: number,
  latSpan = 0.018,
  lngSpan = 0.024
): LatLngVertex[] {
  const halfLat = latSpan / 2
  const halfLng = lngSpan / 2
  return [
    { lat: centerLat - halfLat, lng: centerLng - halfLng },
    { lat: centerLat - halfLat, lng: centerLng + halfLng },
    { lat: centerLat + halfLat, lng: centerLng + halfLng },
    { lat: centerLat + halfLat, lng: centerLng - halfLng },
  ]
}
