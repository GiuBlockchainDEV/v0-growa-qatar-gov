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

/** ~6 screen px ≈ 1 mm on a 4K display; keeps adjustments subtle and zoom-independent. */
const HARVEST_RASTER_PX_PER_MM = 6

const HARVEST_RASTER_FINE_TUNE = {
  zoomMm: 1,
  shiftLeftMm: 0.5,
}

function adjustFieldRasterBoundsInScreenSpace(
  L: any,
  map: any,
  bounds: LeafletBounds,
  { zoomMm, shiftLeftMm }: { zoomMm: number; shiftLeftMm: number }
): LeafletBounds {
  const [[south, west], [north, east]] = bounds
  const southWest = map.latLngToContainerPoint(L.latLng(south, west))
  const northEast = map.latLngToContainerPoint(L.latLng(north, east))

  const centerX = (southWest.x + northEast.x) / 2
  const centerY = (southWest.y + northEast.y) / 2
  const halfWidth = (northEast.x - southWest.x) / 2
  const halfHeight = (southWest.y - northEast.y) / 2

  const growPx = (zoomMm * HARVEST_RASTER_PX_PER_MM) / 2
  const shiftXPx = -shiftLeftMm * HARVEST_RASTER_PX_PER_MM

  const nextCenterX = centerX + shiftXPx
  const nextHalfWidth = halfWidth + growPx
  const nextHalfHeight = halfHeight + growPx

  const nextSouthWest = map.containerPointToLatLng(
    L.point(nextCenterX - nextHalfWidth, nextCenterY + nextHalfHeight)
  )
  const nextNorthEast = map.containerPointToLatLng(
    L.point(nextCenterX + nextHalfWidth, nextCenterY - nextHalfHeight)
  )

  return [
    [nextSouthWest.lat, nextSouthWest.lng],
    [nextNorthEast.lat, nextNorthEast.lng],
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
            ? adjustFieldRasterBoundsInScreenSpace(L, map, prepared.bounds, HARVEST_RASTER_FINE_TUNE)
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
