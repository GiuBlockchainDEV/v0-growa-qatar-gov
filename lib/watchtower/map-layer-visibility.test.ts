import { describe, expect, it } from 'vitest'
import { resolveMapLayerVisibility } from '@/lib/watchtower/map-layer-visibility'

describe('resolveMapLayerVisibility', () => {
  it('defaults to farms and intelligence signals', () => {
    const visibility = resolveMapLayerVisibility([])
    expect(visibility.showFarms).toBe(true)
    expect(visibility.showIntelligenceSignals).toBe(true)
  })

  it('enables water polygon coloring when water-demand is active', () => {
    const visibility = resolveMapLayerVisibility(['water-demand', 'farms'])
    expect(visibility.showPolygons).toBe(true)
    expect(visibility.polygonColorMode).toBe('water-demand')
  })

  it('hides farms when farms layer is off', () => {
    const visibility = resolveMapLayerVisibility(['intelligence-signals'])
    expect(visibility.showFarms).toBe(false)
    expect(visibility.showIntelligenceSignals).toBe(true)
  })
})
