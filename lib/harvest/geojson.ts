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

export function isValidLatLng(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
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

function featurePropertiesFromGeoJson(geojson: unknown): Record<string, unknown> | null {
  const record = geojson && typeof geojson === 'object' ? (geojson as Record<string, unknown>) : null
  if (!record) return null

  if (record.type === 'FeatureCollection' && Array.isArray(record.features) && record.features[0]) {
    const feature = record.features[0] as Record<string, unknown>
    const properties = feature.properties
    return properties && typeof properties === 'object'
      ? (properties as Record<string, unknown>)
      : null
  }

  if (record.type === 'Feature') {
    const properties = record.properties
    return properties && typeof properties === 'object'
      ? (properties as Record<string, unknown>)
      : null
  }

  return null
}

function geometriesFromGeoJson(geojson: unknown): unknown[] {
  const record = geojson && typeof geojson === 'object' ? (geojson as Record<string, unknown>) : null
  if (!record) return []

  if (record.type === 'FeatureCollection' && Array.isArray(record.features)) {
    return record.features
      .map((feature) => {
        const featureRecord = feature as Record<string, unknown>
        return featureRecord.geometry ?? null
      })
      .filter(Boolean)
  }

  if (record.type === 'Feature') {
    return record.geometry ? [record.geometry] : []
  }

  if (record.type === 'Polygon' || record.type === 'MultiPolygon') {
    return [record]
  }

  return []
}

function geometryFromGeoJson(geojson: unknown): unknown {
  return geometriesFromGeoJson(geojson)[0] ?? null
}

function pickGeoJsonString(properties: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!properties) return undefined
  for (const key of keys) {
    const value = properties[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return undefined
}

export function geoJsonToHarvestFieldPolygon(
  geojson: unknown,
  meta: { parcel_id: string; name: string; crop: string }
): HarvestFieldPolygon | null {
  const geometries = geometriesFromGeoJson(geojson)
  const rings = geometries.flatMap((geometry) => ringsFromGeometry(geometry))
  if (rings.length === 0) return null

  const centroid = computeCentroid(rings[0])
  if (!isValidLatLng(centroid.lat, centroid.lng)) return null

  const properties = featurePropertiesFromGeoJson(geojson)
  const parcelId =
    pickGeoJsonString(properties, ['parcel_id', 'parcelId']) || meta.parcel_id
  const name = pickGeoJsonString(properties, ['name', 'field_name', 'label']) || meta.name
  const crop = pickGeoJsonString(properties, ['crop', 'crop_name']) || meta.crop

  return {
    parcel_id: parcelId,
    name,
    crop,
    rings,
    centroid,
  }
}

export function extractBoundsFromGeoJson(geojson: unknown): [[number, number], [number, number]] | null {
  const rings = ringsFromGeometry(geometryFromGeoJson(geojson))
  if (rings.length === 0) return null
  return boundsFromRings(rings)
}

export function boundsFromRings(rings: LatLngVertex[][]): [[number, number], [number, number]] {
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

export function calculatePolygonAreaHectares(vertices: LatLngVertex[]): number {
  if (vertices.length < 3) return 0
  const earthRadiusMeters = 6371008.8
  const toRadians = (value: number) => (value * Math.PI) / 180
  const meanLatRadians =
    vertices.reduce((sum, vertex) => sum + toRadians(vertex.lat), 0) / vertices.length
  const cartesianVertices = vertices.map((vertex) => ({
    x: earthRadiusMeters * toRadians(vertex.lng) * Math.cos(meanLatRadians),
    y: earthRadiusMeters * toRadians(vertex.lat),
  }))

  let doubleArea = 0
  for (let i = 0; i < cartesianVertices.length; i += 1) {
    const current = cartesianVertices[i]
    const next = cartesianVertices[(i + 1) % cartesianVertices.length]
    doubleArea += current.x * next.y - next.x * current.y
  }

  const areaSquareMeters = Math.abs(doubleArea) * 0.5
  return areaSquareMeters / 10_000
}

export function closePolygonRing(vertices: LatLngVertex[]): LatLngVertex[] {
  if (vertices.length < 3) return vertices
  const first = vertices[0]
  const last = vertices[vertices.length - 1]
  if (first.lat === last.lat && first.lng === last.lng) return vertices
  return [...vertices, first]
}

export function calculateRingsAreaHectares(rings: LatLngVertex[][]): number {
  return rings.reduce((total, ring) => total + calculatePolygonAreaHectares(ring), 0)
}

export function ringsToCreateGeoJson(rings: LatLngVertex[][]) {
  const closedRings = rings
    .filter((ring) => ring.length >= 3)
    .map((ring) => closePolygonRing(ring))

  if (closedRings.length === 0) {
    throw new Error('At least one polygon ring is required.')
  }

  const coordinates = closedRings.map((ring) => [ring.map((vertex) => [vertex.lng, vertex.lat])])

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry:
          closedRings.length === 1
            ? {
                type: 'Polygon',
                coordinates: coordinates[0],
              }
            : {
                type: 'MultiPolygon',
                coordinates,
              },
      },
    ],
  }
}

export function verticesToCreateGeoJson(vertices: LatLngVertex[]) {
  return ringsToCreateGeoJson([vertices])
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
