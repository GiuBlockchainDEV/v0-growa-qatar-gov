import type { OperationalMapLayer } from '@/lib/domain/types'

export const WATCHTOWER_MAP_LAYERS: OperationalMapLayer[] = [
  {
    id: 'farms',
    label: 'Farms',
    category: 'agriculture',
    source: 'supabase.farms',
    available: true,
    defaultVisible: true,
  },
  {
    id: 'fields',
    label: 'Fields / parcels',
    category: 'agriculture',
    source: 'harvest.map.fields',
    available: true,
    defaultVisible: true,
  },
  {
    id: 'crop-type',
    label: 'Crop type',
    category: 'agriculture',
    source: 'operations.polygons',
    available: true,
  },
  {
    id: 'production',
    label: 'Production',
    category: 'agriculture',
    source: 'operations.farm_crop_insights',
    available: true,
  },
  {
    id: 'harvest-forecast',
    label: 'Harvest forecast',
    category: 'agriculture',
    source: 'harvest.analytics',
    available: true,
  },
  {
    id: 'crop-health',
    label: 'Crop health',
    category: 'agriculture',
    source: 'harvest.analytics + operations.polygons',
    available: true,
  },
  {
    id: 'water-demand',
    label: 'Water demand',
    category: 'resources',
    source: 'operations.farm_crop_insights',
    available: true,
  },
  {
    id: 'irrigation-pressure',
    label: 'Irrigation pressure',
    category: 'resources',
    source: 'harvest.metrics.aeti',
    available: true,
  },
  {
    id: 'energy-intensity',
    label: 'Energy intensity',
    category: 'resources',
    source: 'operations.farm_crop_insights',
    available: true,
  },
  {
    id: 'temperature',
    label: 'Temperature',
    category: 'climate',
    source: 'weather.api',
    available: true,
  },
  {
    id: 'vpd',
    label: 'VPD',
    category: 'climate',
    source: 'weather.api',
    available: true,
  },
  {
    id: 'et0',
    label: 'ET0',
    category: 'climate',
    source: 'weather.api',
    available: true,
  },
  {
    id: 'rainfall',
    label: 'Rainfall',
    category: 'climate',
    source: 'weather.api',
    available: true,
  },
  {
    id: 'heat-stress',
    label: 'Heat stress',
    category: 'climate',
    source: 'weather.api',
    available: true,
  },
  {
    id: 'intelligence-signals',
    label: 'Intelligence signals',
    category: 'risk',
    source: 'watchtower.signals',
    available: true,
    defaultVisible: true,
  },
  {
    id: 'active-alerts',
    label: 'Active alerts',
    category: 'risk',
    source: 'alerts (upcoming)',
    available: false,
  },
]

export function getLayersForSignalType(type: string): string[] {
  switch (type) {
    case 'water':
      return ['water-demand', 'irrigation-pressure', 'farms']
    case 'energy':
      return ['energy-intensity', 'farms']
    case 'crop_health':
    case 'production':
      return ['crop-health', 'fields', 'harvest-forecast']
    case 'weather':
      return ['temperature', 'vpd', 'et0', 'heat-stress']
    case 'supply':
      return ['production', 'farms']
    default:
      return ['intelligence-signals', 'farms']
  }
}
