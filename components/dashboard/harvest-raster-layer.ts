import { prepareHarvestRasterCanvas } from '@/lib/harvest/image-process'
import {
  resolveCenterScaledRasterBounds,
  resolveRasterRenderBounds,
  type RasterBounds,
} from '@/lib/harvest/raster-bounds'

type LeafletBounds = RasterBounds

export interface HarvestRasterLayerOptions {
  imageUrl: string
  bounds: LeafletBounds
  imageSource?: 'view' | 'raster'
  boundsExtent?: 'plot' | 'full_image'
  clipRings?: Array<Array<{ lat: number; lng: number }>>
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

/** ~1 mm left/up on a 4K display; constant in screen pixels so it stays subtle at any zoom. */
const HARVEST_RASTER_SCREEN_NUDGE = { x: -6, y: -6 }

function nudgeBoundsByScreenPixels(
  L: any,
  map: any,
  bounds: LeafletBounds,
  offsetX: number,
  offsetY: number
): LeafletBounds {
  const [[south, west], [north, east]] = bounds
  const centerLat = (south + north) / 2
  const centerLng = (west + east) / 2
  const latSpan = north - south
  const lngSpan = east - west

  const centerPoint = map.latLngToContainerPoint(L.latLng(centerLat, centerLng))
  const nudged = map.containerPointToLatLng(
    L.point(centerPoint.x + offsetX, centerPoint.y + offsetY)
  )

  return [
    [nudged.lat - latSpan / 2, nudged.lng - lngSpan / 2],
    [nudged.lat + latSpan / 2, nudged.lng + lngSpan / 2],
  ]
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
  imageSource?: 'view' | 'raster',
  boundsExtent?: 'plot' | 'full_image',
  clipRings?: Array<Array<{ lat: number; lng: number }>>
) {
  const isViewSource = imageSource === 'view'
  const prepared = prepareHarvestRasterCanvas(image, {
    cropPlotFrame: true,
    transparentBackground: isViewSource || imageSource === 'raster',
  })

  let renderBounds: LeafletBounds
  if (clipRings && clipRings.length > 0) {
    // Center of tight-cropped image ↔ center of field; scale to field envelope.
    renderBounds = resolveCenterScaledRasterBounds(clipRings)
  } else {
    const shouldAdjustBoundsForCrop =
      boundsExtent === 'full_image' || (boundsExtent !== 'plot' && imageSource === 'raster')

    renderBounds = shouldAdjustBoundsForCrop
      ? resolveRasterRenderBounds(apiBounds, {
          crop: prepared.crop,
          sourceWidth: prepared.sourceWidth,
          sourceHeight: prepared.sourceHeight,
        })
      : apiBounds
  }

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

        const prepared = prepareOverlayImage(
          image,
          options.bounds,
          options.imageSource,
          options.boundsExtent,
          options.clipRings
        )
        if (this._overlay) {
          this._overlay.remove?.()
          this._overlay = null
        }

        const renderBounds =
          options.clipRings && options.clipRings.length > 0
            ? nudgeBoundsByScreenPixels(
                L,
                map,
                prepared.bounds,
                HARVEST_RASTER_SCREEN_NUDGE.x,
                HARVEST_RASTER_SCREEN_NUDGE.y
              )
            : prepared.bounds

        this._overlay = L.imageOverlay(prepared.imageUrl, toLatLngBounds(L, renderBounds), {
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
