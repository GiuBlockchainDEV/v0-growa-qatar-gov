type LeafletBounds = [[number, number], [number, number]]

export interface HarvestRasterLayerOptions {
  imageUrl: string
  bounds: LeafletBounds
  clipRings?: Array<Array<{ lat: number; lng: number }>>
  opacity?: number
}

function toLatLngBounds(L: any, bounds: LeafletBounds) {
  const [[south, west], [north, east]] = bounds
  return L.latLngBounds([south, west], [north, east])
}

function createImageOverlayLayer(L: any, options: HarvestRasterLayerOptions) {
  return L.imageOverlay(options.imageUrl, toLatLngBounds(L, options.bounds), {
    opacity: options.opacity ?? 0.5,
    interactive: false,
    className: 'leaflet-harvest-raster-overlay',
  })
}

function createClippedRasterLayer(L: any, options: HarvestRasterLayerOptions) {
  const rings = (options.clipRings || []).filter((ring) => ring.length >= 3)
  const opacity = options.opacity ?? 0.5

  const ClippedLayer = L.Layer.extend({
    initialize(opts: HarvestRasterLayerOptions) {
      L.setOptions(this, opts)
      this._imageLoaded = false
    },
    onAdd(map: any) {
      this._map = map
      this._canvas = L.DomUtil.create('canvas', 'leaflet-harvest-raster-overlay')
      this._canvas.style.pointerEvents = 'none'
      this._canvas.style.position = 'absolute'
      this._canvas.style.zIndex = '450'
      map.getPanes().overlayPane.appendChild(this._canvas)

      this._image = new Image()
      this._image.crossOrigin = 'anonymous'
      this._image.decoding = 'async'
      this._image.onload = () => {
        this._imageLoaded = true
        this._draw()
      }
      this._image.onerror = () => {
        this._imageLoaded = false
      }
      this._image.src = options.imageUrl

      map.on('zoomend moveend viewreset resize', this._draw, this)
      this._draw()
    },
    onRemove(map: any) {
      L.DomUtil.remove(this._canvas)
      map.off('zoomend moveend viewreset resize', this._draw, this)
      this._image = null
    },
    _draw() {
      if (!this._map || !this._imageLoaded || !this._image) return

      const map = this._map
      const leafletBounds = toLatLngBounds(L, options.bounds)
      const northWest = map.latLngToLayerPoint(leafletBounds.getNorthWest())
      const southEast = map.latLngToLayerPoint(leafletBounds.getSouthEast())
      const width = southEast.x - northWest.x
      const height = southEast.y - northWest.y
      if (width <= 0 || height <= 0) return

      L.DomUtil.setPosition(this._canvas, northWest)
      this._canvas.style.opacity = String(opacity)

      const dpr = window.devicePixelRatio || 1
      const pixelWidth = Math.max(1, Math.round(width * dpr))
      const pixelHeight = Math.max(1, Math.round(height * dpr))
      if (this._canvas.width !== pixelWidth || this._canvas.height !== pixelHeight) {
        this._canvas.width = pixelWidth
        this._canvas.height = pixelHeight
        this._canvas.style.width = `${width}px`
        this._canvas.style.height = `${height}px`
      }

      const ctx = this._canvas.getContext('2d')
      if (!ctx) return

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      for (const ring of rings) {
        ctx.save()
        ctx.beginPath()
        ring.forEach((vertex, index) => {
          const point = map.latLngToLayerPoint(L.latLng(vertex.lat, vertex.lng))
          const x = point.x - northWest.x
          const y = point.y - northWest.y
          if (index === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()
        ctx.clip()
        ctx.drawImage(this._image, 0, 0, width, height)
        ctx.restore()
      }
    },
  })

  return new ClippedLayer(options)
}

export function createHarvestRasterLayer(L: any, options: HarvestRasterLayerOptions) {
  const rings = (options.clipRings || []).filter((ring) => ring.length >= 3)
  if (rings.length === 0) {
    return createImageOverlayLayer(L, options)
  }
  return createClippedRasterLayer(L, options)
}
