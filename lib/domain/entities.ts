/**
 * Domain entity mapping — maps platform concepts to existing schema/API sources.
 * See docs/PLATFORM_INTEGRATION_AUDIT.md for full inventory.
 */

export const DOMAIN_ENTITY_SOURCES = {
  Organization: { table: 'organizations', api: null },
  User: { table: 'profiles', api: null },
  Role: { table: 'role_templates / user_organization_members.role', api: null },
  Farm: { table: 'farms', api: '/api/operations/farms' },
  Site: { table: 'farms (alias)', api: '/api/operations/farms' },
  ProductionUnit: { table: 'production_units', api: null },
  Field: { table: 'harvest fields', api: '/api/harvest/fields' },
  Parcel: { table: 'harvest parcel', api: '/api/harvest/parcel/[id]' },
  Crop: { table: 'gcc_crop_types / farm_crop_insights', api: '/api/operations/crop-types' },
  GrowingCycle: { table: 'growing_cycles', api: null },
  Observation: { table: 'farm_activities', api: null },
  WeatherObservation: { table: null, api: '/api/weather/by-coordinates' },
  SatelliteObservation: { table: null, api: '/api/harvest/field/[id]/raster' },
  WaterMetric: { table: 'farm_crop_insights.water_consumption_m3', api: '/api/operations/farm-crop-insights' },
  EnergyMetric: { table: 'farm_crop_insights.energy_consumption_kwh', api: '/api/operations/farm-crop-insights' },
  ProductionMetric: { table: 'farm_crop_insights.estimated_production_tons', api: '/api/operations/farm-crop-insights' },
  HarvestForecast: { table: null, api: '/api/harvest/analytics' },
  SupplyMetric: { table: 'supply_overview_snapshots', api: null },
  Alert: { table: 'operational_alerts', api: '/api/alerts' },
  IntelligenceSignal: { table: null, api: '/api/watchtower/summary (computed)' },
  DataQualityRecord: { table: null, api: '/api/watchtower/summary (computed)' },
  Inspection: { table: null, api: null, status: 'placeholder' },
  ComplianceCase: { table: null, api: null, status: 'placeholder' },
} as const

export type DomainEntityName = keyof typeof DOMAIN_ENTITY_SOURCES
