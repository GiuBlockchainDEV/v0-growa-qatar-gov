export function buildLiveMapTargetHref(options: {
  pointId?: string
  farmId?: string
  lat?: number
  lng?: number
  zoom?: number
}) {
  const params = new URLSearchParams({
    module: 'live-map',
    zoom: String(options.zoom ?? 17),
    focus: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  })

  if (options.pointId) {
    params.set('pointId', options.pointId)
  }
  if (options.farmId) {
    params.set('farmId', options.farmId)
  }
  if (Number.isFinite(options.lat) && Number.isFinite(options.lng)) {
    params.set('farmLat', options.lat!.toFixed(6))
    params.set('farmLng', options.lng!.toFixed(6))
  }

  return `/dashboard?${params.toString()}`
}
