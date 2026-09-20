import { calculatePolygonAreaHectares, type LatLngVertex } from '@/lib/harvest/geojson'
import type { HarvestMapField } from '@/lib/harvest/types'

function pointInRing(point: LatLngVertex, ring: LatLngVertex[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lng
    const yi = ring[i].lat
    const xj = ring[j].lng
    const yj = ring[j].lat
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function isPointInHarvestMapField(field: HarvestMapField, lat: number, lng: number): boolean {
  const point = { lat, lng }
  return field.rings.some((ring) => ring.length >= 3 && pointInRing(point, ring))
}

function fieldAreaHectares(field: HarvestMapField): number {
  return field.rings.reduce((sum, ring) => sum + calculatePolygonAreaHectares(ring), 0)
}

/** Prefer the smallest containing polygon when fields overlap. */
export function findHarvestMapFieldAtLatLng(
  fields: HarvestMapField[],
  lat: number,
  lng: number
): HarvestMapField | null {
  const matches = fields.filter((field) => isPointInHarvestMapField(field, lat, lng))
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]

  return matches.reduce((best, current) =>
    fieldAreaHectares(current) < fieldAreaHectares(best) ? current : best
  )
}
