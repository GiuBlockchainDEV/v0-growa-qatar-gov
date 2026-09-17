export type RasterBounds = [[number, number], [number, number]]

const DEFAULT_BOUNDS: RasterBounds = [[25.2, 51.1], [25.5, 51.4]]

function isLat(value: number) {
  return Math.abs(value) <= 90
}

function isLng(value: number) {
  return Math.abs(value) <= 180
}

export function normalizeRasterBounds(bounds: unknown): RasterBounds {
  if (!Array.isArray(bounds) || bounds.length < 2) return DEFAULT_BOUNDS

  const first = bounds[0]
  const second = bounds[1]
  if (!Array.isArray(first) || !Array.isArray(second) || first.length < 2 || second.length < 2) {
    return DEFAULT_BOUNDS
  }

  const a0 = Number(first[0])
  const a1 = Number(first[1])
  const b0 = Number(second[0])
  const b1 = Number(second[1])

  if (![a0, a1, b0, b1].every((value) => Number.isFinite(value))) {
    return DEFAULT_BOUNDS
  }

  // GeoJSON-style bounds are often [lng, lat]
  const firstIsLngLat = isLng(a0) && isLat(a1) && Math.abs(a0) > Math.abs(a1)
  const secondIsLngLat = isLng(b0) && isLat(b1) && Math.abs(b0) > Math.abs(b1)

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
