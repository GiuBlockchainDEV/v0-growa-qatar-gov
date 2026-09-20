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

/** ~6 screen px ≈ 1 mm on a 4K display; zoom-independent fine tuning. */
const HARVEST_RASTER_PX_PER_MM = 6

/** Cumulative screen-space tweaks (each mm ≈ 6 px). */
const HARVEST_RASTER_FINE_TUNE = {
  shiftLeftMm: 1, // original 1 mm left
  shiftUpMm: 1, // original 1 mm up
  extraZoomMm: 1, // additional zoom requested on top
  extraShiftLeftMm: 0.5, // additional 0.5 mm left on top
}

function normalizeLeafletBounds(bounds: LeafletBounds): LeafletBounds {
  const [[a0, a1], [b0, b1]] = bounds
  return [
    [Math.min(a0, b0), Math.min(a1, b1)],
    [Math.max(a0, b0), Math.max(a1, b1)],
  ]
}

function isValidLeafletBounds(bounds: LeafletBounds) {
  const [[south, west], [north, east]] = bounds
  return (
    [south, west, north, east].every((value) => Number.isFinite(value)) &&
    north > south &&
    east > west
  )
}

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
  const nudged = map.containerPointToLatLng(L.point(centerPoint.x + offsetX, centerPoint.y + offsetY))

  return normalizeLeafletBounds([
    [nudged.lat - latSpan / 2, nudged.lng - lngSpan / 2],
    [nudged.lat + latSpan / 2, nudged.lng + lngSpan / 2],
  ])
}

function zoomBoundsFromCenterInScreenPixels(
  L: any,
  map: any,
  bounds: LeafletBounds,
  growPxPerSide: number
): LeafletBounds {
  const [[south, west], [north, east]] = bounds
  const southWest = map.latLngToContainerPoint(L.latLng(south, west))
  const northEast = map.latLngToContainerPoint(L.latLng(north, east))

  const centerX = (southWest.x + northEast.x) / 2
  const centerY = (southWest.y + northEast.y) / 2
  const halfWidth = Math.abs(northEast.x - southWest.x) / 2
  const halfHeight = Math.abs(southWest.y - northEast.y) / 2

  if (halfWidth < 1 || halfHeight < 1) return bounds

  const nextHalfWidth = halfWidth + growPxPerSide
  const nextHalfHeight = halfHeight + growPxPerSide

  const nextSouthWest = map.containerPointToLatLng(
    L.point(centerX - nextHalfWidth, centerY + nextHalfHeight)
  )
  const nextNorthEast = map.containerPointToLatLng(
    L.point(centerX + nextHalfWidth, centerY - nextHalfHeight)
  )

  const nextBounds = normalizeLeafletBounds([
    [nextSouthWest.lat, nextSouthWest.lng],
    [nextNorthEast.lat, nextNorthEast.lng],
  ])

  return isValidLeafletBounds(nextBounds) ? nextBounds : bounds
}

function applyFieldRasterFineTune(L: any, map: any, bounds: LeafletBounds): LeafletBounds {
  try {
    map.invalidateSize?.()

    const shiftXPx = -(HARVEST_RASTER_FINE_TUNE.shiftLeftMm + HARVEST_RASTER_FINE_TUNE.extraShiftLeftMm) *
      HARVEST_RASTER_PX_PER_MM
    const shiftYPx = -HARVEST_RASTER_FINE_TUNE.shiftUpMm * HARVEST_RASTER_PX_PER_MM
    const growPxPerSide = (HARVEST_RASTER_FINE_TUNE.extraZoomMm * HARVEST_RASTER_PX_PER_MM) / 2

    let tuned = nudgeBoundsByScreenPixels(L, map, bounds, shiftXPx, shiftYPx)
    tuned = zoomBoundsFromCenterInScreenPixels(L, map, tuned, growPxPerSide)

    return isValidLeafletBounds(tuned) ? tuned : bounds
  } catch {
    return bounds
  }
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

        let renderBounds = prepared.bounds
        if (options.clipRings && options.clipRings.length > 0) {
          renderBounds = applyFieldRasterFineTune(L, map, prepared.bounds)
        }

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
