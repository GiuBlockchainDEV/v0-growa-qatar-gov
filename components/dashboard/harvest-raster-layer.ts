import { maskHarvestRasterToRings, prepareHarvestRasterCanvas } from '@/lib/harvest/image-process'
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

/**
 * Screen-space fine tuning (~6 px ≈ 1 mm on 4K). Values below are the
 * cumulative result of all user requests — edit only these four numbers.
 */
const HARVEST_RASTER_PX_PER_MM = 6

const HARVEST_RASTER_ADJUST = {
  /** Sposta tutto l'overlay: sinistra (+) / su (+) in mm */
  panLeftMm: 1.5,
  panUpMm: 0.5,
  /** Ingrandisce uniformemente dal centro */
  zoomMm: 1,
  /** Allarga solo il bordo destro / basso (mm) */
  stretchRightMm: 0.6,
  stretchDownMm: 0.2,
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

function stretchBoundsRightInScreenPixels(
  L: any,
  map: any,
  bounds: LeafletBounds,
  stretchMm: number
): LeafletBounds {
  const stretchPx = stretchMm * HARVEST_RASTER_PX_PER_MM
  const [[south, west], [north, east]] = bounds
  const southWest = map.latLngToContainerPoint(L.latLng(south, west))
  const northEast = map.latLngToContainerPoint(L.latLng(north, east))

  const nextSouthWest = map.containerPointToLatLng(southWest)
  const nextNorthEast = map.containerPointToLatLng(L.point(northEast.x + stretchPx, northEast.y))

  const nextBounds = normalizeLeafletBounds([
    [nextSouthWest.lat, nextSouthWest.lng],
    [nextNorthEast.lat, nextNorthEast.lng],
  ])

  return isValidLeafletBounds(nextBounds) ? nextBounds : bounds
}

function stretchBoundsDownInScreenPixels(
  L: any,
  map: any,
  bounds: LeafletBounds,
  stretchMm: number
): LeafletBounds {
  const stretchPx = stretchMm * HARVEST_RASTER_PX_PER_MM
  const [[south, west], [north, east]] = bounds
  const southWest = map.latLngToContainerPoint(L.latLng(south, west))
  const northEast = map.latLngToContainerPoint(L.latLng(north, east))

  const nextSouthWest = map.containerPointToLatLng(L.point(southWest.x, southWest.y + stretchPx))
  const nextNorthEast = map.containerPointToLatLng(northEast)

  const nextBounds = normalizeLeafletBounds([
    [nextSouthWest.lat, nextSouthWest.lng],
    [nextNorthEast.lat, nextNorthEast.lng],
  ])

  return isValidLeafletBounds(nextBounds) ? nextBounds : bounds
}

function applyFieldRasterFineTune(L: any, map: any, bounds: LeafletBounds): LeafletBounds {
  try {
    map.invalidateSize?.()

    const { panLeftMm, panUpMm, zoomMm, stretchRightMm, stretchDownMm } = HARVEST_RASTER_ADJUST
    const panXPx = -panLeftMm * HARVEST_RASTER_PX_PER_MM
    const panYPx = -panUpMm * HARVEST_RASTER_PX_PER_MM
    const zoomPxPerSide = (zoomMm * HARVEST_RASTER_PX_PER_MM) / 2

    let tuned = nudgeBoundsByScreenPixels(L, map, bounds, panXPx, panYPx)
    tuned = zoomBoundsFromCenterInScreenPixels(L, map, tuned, zoomPxPerSide)
    tuned = stretchBoundsRightInScreenPixels(L, map, tuned, stretchRightMm)
    tuned = stretchBoundsDownInScreenPixels(L, map, tuned, stretchDownMm)

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
    canvas: prepared.canvas,
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
        let overlayCanvas = prepared.canvas

        if (options.clipRings && options.clipRings.length > 0) {
          renderBounds = applyFieldRasterFineTune(L, map, prepared.bounds)
          overlayCanvas = maskHarvestRasterToRings(overlayCanvas, options.clipRings, renderBounds)
        }

        this._overlay = L.imageOverlay(overlayCanvas.toDataURL('image/png'), toLatLngBounds(L, renderBounds), {
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
