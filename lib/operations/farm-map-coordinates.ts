import { parseCoordinateQuery } from '@/lib/dashboard/coordinate-search'

const QATAR_BOUNDS = {
  minLat: 24.45,
  maxLat: 26.18,
  minLng: 50.74,
  maxLng: 51.65,
}

export type FarmCoordinateSource = 'gps' | 'location' | 'fallback'

export interface ResolvedFarmCoordinates {
  lat: number
  lng: number
  source: FarmCoordinateSource
}

function readNumericField(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key]
    const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
    if (Number.isFinite(numeric)) return numeric
  }
  return null
}

function hashFarmId(id: string): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  }
  return hash
}

function fallbackCoordinatesForFarmId(id: string): ResolvedFarmCoordinates {
  const hash = hashFarmId(id)
  const latSpan = QATAR_BOUNDS.maxLat - QATAR_BOUNDS.minLat
  const lngSpan = QATAR_BOUNDS.maxLng - QATAR_BOUNDS.minLng
  return {
    lat: QATAR_BOUNDS.minLat + ((hash % 1000) / 1000) * latSpan,
    lng: QATAR_BOUNDS.minLng + (((Math.floor(hash / 1000) % 1000) / 1000) * lngSpan),
    source: 'fallback',
  }
}

function coordinatesFromLocationText(location: string): ResolvedFarmCoordinates | null {
  const parsed = parseCoordinateQuery(location)
  if (!parsed) return null
  return { lat: parsed.lat, lng: parsed.lng, source: 'location' }
}

/** Resolve map coordinates for a farm row returned by `/api/operations/farms`. */
export function resolveFarmMapCoordinates(
  row: Record<string, unknown>,
  options?: { allowFallback?: boolean }
): ResolvedFarmCoordinates | null {
  const lat = readNumericField(row, ['gps_latitude', 'gpsLatitude', 'lat', 'latitude'])
  const lng = readNumericField(row, ['gps_longitude', 'gpsLongitude', 'lng', 'longitude'])
  if (lat !== null && lng !== null) {
    return { lat, lng, source: 'gps' }
  }

  const location =
    (typeof row.location === 'string' && row.location.trim()) ||
    (typeof row.address_en === 'string' && row.address_en.trim()) ||
    (typeof row.address_ar === 'string' && row.address_ar.trim()) ||
    ''
  if (location) {
    const fromLocation = coordinatesFromLocationText(location)
    if (fromLocation) return fromLocation
  }

  const id = typeof row.id === 'string' ? row.id : ''
  if (options?.allowFallback !== false && id) {
    return fallbackCoordinatesForFarmId(id)
  }

  return null
}

export function resolveFarmDisplayName(row: Record<string, unknown>, farmId?: string): string {
  const id = farmId || (typeof row.id === 'string' ? row.id : '')
  return (
    (typeof row.name_en === 'string' && row.name_en.trim()) ||
    (typeof row.name === 'string' && row.name.trim()) ||
    (typeof row.name_ar === 'string' && row.name_ar.trim()) ||
    (id ? `Farm ${id.slice(0, 8)}` : 'Farm')
  )
}
