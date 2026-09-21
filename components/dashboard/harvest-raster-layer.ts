import type { RasterBounds } from '@/lib/harvest/raster-bounds'

export interface HarvestRasterLayerOptions {
  imageUrl: string
  bounds: RasterBounds
  opacity?: number
}

function isSameOriginUrl(imageUrl: string) {
  if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) return true
  if (imageUrl.startsWith('/') || imageUrl.startsWith('./')) return true
  try {
    const resolved = new URL(imageUrl, window.location.origin)
    return resolved.origin === window.location.origin
  } catch {
    return true
  }
}

function toLatLngBounds(L: any, bounds: RasterBounds) {
  const [[south, west], [north, east]] = bounds
  return L.latLngBounds([south, west], [north, east])
}

export function createHarvestRasterLayer(L: any, options: HarvestRasterLayerOptions) {
  const opacity = options.opacity ?? 0.5

  const PreparedRasterLayer = L.Layer.extend({
    initialize(opts: HarvestRasterLayerOptions) {
      L.setOptions(this, opts)
      this._overlay = null
    },
    onAdd(map: any) {
      this._map = map
      this._overlay = L.imageOverlay(options.imageUrl, toLatLngBounds(L, options.bounds), {
        opacity,
        interactive: false,
        className: 'leaflet-harvest-raster-overlay',
        zIndex: 350,
        ...(isSameOriginUrl(options.imageUrl) ? {} : { crossOrigin: true }),
      }).addTo(map)
    },
    onRemove() {
      this._overlay?.remove?.()
      this._overlay = null
      this._map = null
    },
  })

  return new PreparedRasterLayer(options)
}
