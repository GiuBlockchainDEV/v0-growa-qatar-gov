import { prepareHarvestRasterCanvas } from '@/lib/harvest/image-process'
import { resolveRasterRenderBounds, type RasterBounds } from '@/lib/harvest/raster-bounds'

type LeafletBounds = RasterBounds

export interface HarvestRasterLayerOptions {
  imageUrl: string
  bounds: LeafletBounds
  imageSource?: 'view' | 'raster'
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

function toLatLngBounds(L: any, bounds: LeafletBounds) {
  const [[south, west], [north, east]] = bounds
  return L.latLngBounds([south, west], [north, east])
}

function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    if (!isSameOriginUrl(imageUrl)) {
      image.crossOrigin = 'anonymous'
    }
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Raster image failed to load'))
    image.src = imageUrl
  })
}

function prepareOverlayImage(
  image: HTMLImageElement,
  apiBounds: LeafletBounds,
  imageSource?: 'view' | 'raster'
) {
  const isViewSource = imageSource === 'view'
  const prepared = prepareHarvestRasterCanvas(image, {
    cropPlotFrame: true,
    transparentBackground: isViewSource || imageSource === 'raster',
  })

  const renderBounds = resolveRasterRenderBounds(apiBounds, {
    crop: prepared.crop,
    sourceWidth: prepared.sourceWidth,
    sourceHeight: prepared.sourceHeight,
  })

  return {
    imageUrl: prepared.canvas.toDataURL('image/png'),
    bounds: renderBounds,
    crop: prepared.crop,
  }
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
      void this._loadAndRender()
    },
    onRemove() {
      this._overlay?.remove?.()
      this._overlay = null
      this._map = null
    },
    async _loadAndRender() {
      const map = this._map
      if (!map) return

      try {
        const image = await loadImage(options.imageUrl)
        if (!this._map) return

        const prepared = prepareOverlayImage(image, options.bounds, options.imageSource)
        if (this._overlay) {
          this._overlay.remove?.()
          this._overlay = null
        }

        this._overlay = L.imageOverlay(prepared.imageUrl, toLatLngBounds(L, prepared.bounds), {
          opacity,
          interactive: false,
          className: 'leaflet-harvest-raster-overlay',
          zIndex: 350,
        }).addTo(map)
      } catch (error) {
        console.warn('[harvest-raster] overlay preparation failed', error)
      }
    },
  })

  return new PreparedRasterLayer(options)
}
