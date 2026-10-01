import { describe, expect, it } from 'vitest'
import {
  calculatePolygonAreaHectares,
  createCircleVertices,
  createRectangleVertices,
  escapeHtml,
  normalizeDbCustomPointRows,
  normalizeExternalLink,
  normalizeMetricValue,
  normalizePointPolygon,
  normalizePolygonScore,
} from '@/components/dashboard/map/map-model'

// ~100 m × ~100 m square near Doha (latitude 25.3°).
const LAT = 25.3
const dLat = 100 / 111_320
const dLng = 100 / (111_320 * Math.cos((LAT * Math.PI) / 180))
const SQUARE = [
  { lat: LAT, lng: 51.5 },
  { lat: LAT, lng: 51.5 + dLng },
  { lat: LAT + dLat, lng: 51.5 + dLng },
  { lat: LAT + dLat, lng: 51.5 },
]

describe('map geometry', () => {
  it('measures a 100 m square as about one hectare', () => {
    expect(calculatePolygonAreaHectares(SQUARE)).toBeCloseTo(1, 1)
    expect(calculatePolygonAreaHectares(SQUARE.slice(0, 2))).toBe(0)
  })

  it('builds rectangles from two corners', () => {
    const rect = createRectangleVertices(SQUARE[0]!, SQUARE[2]!)
    expect(rect).toHaveLength(4)
    expect(calculatePolygonAreaHectares(rect)).toBeCloseTo(1, 1)
  })

  it('builds circles with the requested segments and the right radius', () => {
    const edge = { lat: LAT, lng: 51.5 + dLng } // 100 m east
    const circle = createCircleVertices(SQUARE[0]!, edge, 72)
    expect(circle).toHaveLength(72)
    expect(calculatePolygonAreaHectares(circle)).toBeCloseTo(Math.PI, 1) // π·100² m² ≈ 3.14 ha
    expect(createCircleVertices(SQUARE[0]!, SQUARE[0]!)).toEqual([])
  })
})

describe('map row parsing', () => {
  it('clamps scores and falls back on junk', () => {
    expect(normalizePolygonScore(140)).toBe(100)
    expect(normalizePolygonScore(-3)).toBe(0)
    expect(normalizePolygonScore('abc', 42)).toBe(42)
  })

  it('reads metric values from numbers and strings', () => {
    expect(normalizeMetricValue('12.5')).toBe(12.5)
    expect(normalizeMetricValue(null)).toBe(0)
  })

  it('accepts snake_case and camelCase polygon rows and rejects incomplete ones', () => {
    const polygon = normalizePointPolygon({
      id: 'p1',
      custom_point_id: 'pt1',
      name: 'North block',
      vertices: SQUARE,
      polygon_score: 71,
      crop_name: 'tomato',
      estimated_production_tons: '12',
    })
    expect(polygon?.customPointId).toBe('pt1')
    expect(polygon?.score).toBe(71)
    expect(polygon?.crop.cropName).toBe('tomato')
    expect(normalizePointPolygon({ id: 'p1', name: 'x', vertices: SQUARE })).toBeNull()
    expect(normalizePointPolygon({ id: 'p1', customPointId: 'pt', name: 'x', vertices: SQUARE.slice(0, 2) })).toBeNull()
  })

  it('parses custom points from the database', () => {
    const [point] = normalizeDbCustomPointRows([
      { id: 'a', lat: '25.3', lng: 51.5, label: 'Farm A', point_type: 'farm' },
      { id: 'b', lat: 'x', lng: 51.5 },
    ])
    expect(point).toMatchObject({ id: 'a', lat: 25.3, lng: 51.5, label: 'Farm A', pointType: 'farm' })
    expect(normalizeDbCustomPointRows('nope')).toEqual([])
  })
})

describe('map formatting', () => {
  it('escapes HTML placed in popups', () => {
    expect(escapeHtml('<b>"A&B"</b>')).not.toContain('<b>')
    expect(escapeHtml('<b>"A&B"</b>')).toContain('&amp;')
  })

  it('normalises external links', () => {
    expect(normalizeExternalLink('example.qa')).toBe('https://example.qa')
    expect(normalizeExternalLink(' https://x.qa ')).toBe('https://x.qa')
    expect(normalizeExternalLink('')).toBe('')
  })
})
