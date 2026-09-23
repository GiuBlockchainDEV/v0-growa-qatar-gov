export type PolygonColorMode =
  | 'default'
  | 'crop-health'
  | 'crop-type'
  | 'production'
  | 'water-demand'
  | 'irrigation-pressure'
  | 'energy-intensity'
  | 'harvest-forecast'

export interface MapLayerVisibility {
  showFarms: boolean
  showFields: boolean
  showPolygons: boolean
  polygonColorMode: PolygonColorMode
  showWeatherClimate: boolean
  showIntelligenceSignals: boolean
}

const DEFAULT_LAYERS = ['farms', 'intelligence-signals']

export function resolveMapLayerVisibility(activeLayers: string[]): MapLayerVisibility {
  const layers = activeLayers.length > 0 ? activeLayers : DEFAULT_LAYERS
  const has = (id: string) => layers.includes(id)

  const resourceLayers = ['water-demand', 'irrigation-pressure', 'energy-intensity']
  const agricultureLayers = ['crop-type', 'production', 'harvest-forecast', 'crop-health', 'fields']
  const climateLayers = ['temperature', 'vpd', 'et0', 'rainfall', 'heat-stress']

  let polygonColorMode: PolygonColorMode = 'default'
  if (has('water-demand') || has('irrigation-pressure')) polygonColorMode = 'water-demand'
  else if (has('energy-intensity')) polygonColorMode = 'energy-intensity'
  else if (has('production')) polygonColorMode = 'production'
  else if (has('harvest-forecast')) polygonColorMode = 'harvest-forecast'
  else if (has('crop-health') || has('crop-type')) polygonColorMode = 'crop-health'

  return {
    showFarms: has('farms'),
    showFields: has('fields') || has('harvest-forecast') || has('crop-health'),
    showPolygons:
      agricultureLayers.some(has) || resourceLayers.some(has) || has('farms'),
    polygonColorMode,
    showWeatherClimate: climateLayers.some(has),
    showIntelligenceSignals: has('intelligence-signals'),
  }
}
