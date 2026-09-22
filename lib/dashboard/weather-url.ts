export function buildWeatherDashboardParams(
  current: URLSearchParams,
  selection: {
    lat: number
    lng: number
    gridId?: string
    zoom?: number
    requestedAt?: string | null
  }
) {
  const params = new URLSearchParams(current.toString())
  params.set('module', 'weather')
  params.set('weatherLat', selection.lat.toFixed(6))
  params.set('weatherLng', selection.lng.toFixed(6))
  if (selection.gridId) params.set('weatherGridId', selection.gridId)
  if (selection.zoom !== undefined) params.set('zoom', String(selection.zoom))
  if (selection.requestedAt?.trim()) params.set('weatherRequestedAt', selection.requestedAt.trim())
  params.delete('pointId')
  params.delete('farmId')
  params.delete('crop')
  params.delete('focus')
  params.delete('parcelId')
  return params
}
