export const COORDINATE_SEARCH_ZOOM = 16

export function parseCoordinateQuery(raw: string): { lat: number; lng: number } | null {
  const cleaned = raw.trim().replace(/[()[\]]/g, ' ')
  if (!cleaned) return null

  const labeled = cleaned.match(
    /lat(?:itude)?\s*[:=]?\s*(-?\d+(?:\.\d+)?)\D+lon(?:gitude)?\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i
  )
  const numbers = labeled ? [labeled[1], labeled[2]] : cleaned.match(/-?\d+(?:\.\d+)?/g)
  if (!numbers || numbers.length < 2) return null

  const lat = Number(numbers[0])
  const lng = Number(numbers[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}
