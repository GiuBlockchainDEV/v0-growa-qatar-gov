import { describe, expect, it } from 'vitest'
import { parseDashboardMapLayers } from './parse-map-layers'

describe('parseDashboardMapLayers', () => {
  it('defaults live map to farms and intelligence signals', () => {
    expect(parseDashboardMapLayers(new URLSearchParams('module=live-map'))).toEqual([
      'farms',
      'intelligence-signals',
    ])
  })

  it('keeps farms visible when only a watchtower mapLayer is carried on live map', () => {
    expect(parseDashboardMapLayers(new URLSearchParams('module=live-map&mapLayer=crop-health'))).toEqual([
      'farms',
      'intelligence-signals',
      'crop-health',
    ])
  })

  it('merges farms back when mapLayers from watchtower omit them', () => {
    expect(
      parseDashboardMapLayers(
        new URLSearchParams('module=live-map&mapLayers=fields,production,crop-health,intelligence-signals')
      )
    ).toEqual(['farms', 'fields', 'production', 'crop-health', 'intelligence-signals'])
  })
})
