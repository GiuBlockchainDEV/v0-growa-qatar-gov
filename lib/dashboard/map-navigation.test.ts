import { describe, expect, it } from 'vitest'
import { buildFarmSearchMapUrl, WATCHTOWER_DEFAULT_URL, canonicalWatchtowerEntry, lateralMapInitialZoom } from '@/lib/dashboard/map-navigation'

describe('buildFarmSearchMapUrl', () => {
  it('opens live map focused on a farm', () => {
    const url = buildFarmSearchMapUrl({ source: 'farm', id: 'farm-abc' })

    expect(url).toContain('module=live-map')
    expect(url).toContain('farmId=farm-abc')
    expect(url).toContain('zoom=17')
    expect(url).toContain('focus=')
    expect(url).not.toContain('parcelId=')
  })

  it('opens live map focused on a custom point', () => {
    const url = buildFarmSearchMapUrl({ source: 'point', id: 'point-123' }, 16)

    expect(url).toContain('module=live-map')
    expect(url).toContain('pointId=point-123')
    expect(url).toContain('zoom=16')
    expect(url).not.toContain('farmId=')
  })
})


describe('canonical Watchtower landing URL', () => {
  it('opens the global map after login or from plain /dashboard', () => {
    expect(WATCHTOWER_DEFAULT_URL).toBe('/dashboard?module=watchtower#watchtower-map')
    expect(canonicalWatchtowerEntry(new URLSearchParams(), '')).toBe(WATCHTOWER_DEFAULT_URL)
    expect(canonicalWatchtowerEntry(new URLSearchParams('module=watchtower'), '')).toBe(WATCHTOWER_DEFAULT_URL)
  })
  it('never hijacks explicit modules, field deep links, or non-map Watchtower tabs', () => {
    expect(canonicalWatchtowerEntry(new URLSearchParams('module=live-map'), '')).toBeNull()
    expect(canonicalWatchtowerEntry(new URLSearchParams('parcelId=plot-1'), '')).toBeNull()
    expect(canonicalWatchtowerEntry(new URLSearchParams('module=watchtower'), '#watchtower-scenarios')).toBeNull()
    expect(canonicalWatchtowerEntry(new URLSearchParams('module=watchtower'), '#watchtower-markets')).toBeNull()
    expect(canonicalWatchtowerEntry(new URLSearchParams(), '#watchtower-markets')).toBe('/dashboard?module=watchtower#watchtower-markets')
    expect(canonicalWatchtowerEntry(new URLSearchParams(), '#watchtower-operations')).toBe('/dashboard?module=watchtower#watchtower-operations')
  })
})

describe('lateral national map zoom',()=>{
 it('starts all four intelligence side maps at zoom 8',()=>{
  for(const module of ['data-analytics','weather','water-intelligence','energy-intelligence'])
   expect(lateralMapInitialZoom(module)).toBe(8)
 })
 it('leaves the full live map and other side panels at zoom 10',()=>{
  for(const module of ['live-map','harvest','production-harvest','rss-feed'])
   expect(lateralMapInitialZoom(module)).toBe(10)
 })
})
