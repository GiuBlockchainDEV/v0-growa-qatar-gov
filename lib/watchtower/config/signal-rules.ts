/**
 * Configurable signal detection thresholds.
 * See docs/METRIC_DEFINITIONS.md for methodology.
 */

export interface SignalRuleConfig {
  metric: string
  threshold: number
  comparisonWindow: string
  minDataPoints: number
  confidenceBase: number
  description: string
}

export const WATER_INTENSITY_RULE: SignalRuleConfig = {
  metric: 'water_m3_per_ton',
  threshold: 1.2,
  comparisonWindow: 'seasonal_baseline',
  minDataPoints: 3,
  confidenceBase: 0.75,
  description: 'Water intensity exceeds 120% of cohort median m³/ton',
}

export const ENERGY_INTENSITY_RULE: SignalRuleConfig = {
  metric: 'energy_kwh_per_ton',
  threshold: 1.25,
  comparisonWindow: 'seasonal_baseline',
  minDataPoints: 3,
  confidenceBase: 0.75,
  description: 'Energy intensity exceeds 125% of cohort median kWh/ton',
}

export const CROP_HEALTH_SCORE_RULE: SignalRuleConfig = {
  metric: 'polygon_score',
  threshold: 40,
  comparisonWindow: 'current',
  minDataPoints: 1,
  confidenceBase: 0.7,
  description: 'Polygon health score below 40/100',
}

export const HARVEST_BWP_RULE: SignalRuleConfig = {
  metric: 'bwp',
  threshold: 1.35,
  comparisonWindow: 'field_baseline',
  minDataPoints: 1,
  confidenceBase: 0.8,
  description: 'Biomass water productivity (BWP) above elevated threshold',
}

export const WEATHER_VPD_RULE: SignalRuleConfig = {
  metric: 'vpd_kpa',
  threshold: 2.0,
  comparisonWindow: 'current',
  minDataPoints: 1,
  confidenceBase: 0.85,
  description: 'Vapor pressure deficit above 2.0 kPa',
}

export const WEATHER_HEAT_RULE: SignalRuleConfig = {
  metric: 'temperature_c',
  threshold: 42,
  comparisonWindow: 'current',
  minDataPoints: 1,
  confidenceBase: 0.9,
  description: 'Air temperature above 42°C',
}

export const DATA_STALE_DAYS_RULE: SignalRuleConfig = {
  metric: 'days_since_update',
  threshold: 14,
  comparisonWindow: 'rolling',
  minDataPoints: 1,
  confidenceBase: 1.0,
  description: 'Operational dataset not updated within expected interval',
}

export const GPS_MISSING_RULE: SignalRuleConfig = {
  metric: 'farms_without_gps',
  threshold: 1,
  comparisonWindow: 'current',
  minDataPoints: 1,
  confidenceBase: 1.0,
  description: 'Farm records missing GPS coordinates',
}

export const SIGNAL_RULES = {
  water: WATER_INTENSITY_RULE,
  energy: ENERGY_INTENSITY_RULE,
  cropHealth: CROP_HEALTH_SCORE_RULE,
  harvestBwp: HARVEST_BWP_RULE,
  weatherVpd: WEATHER_VPD_RULE,
  weatherHeat: WEATHER_HEAT_RULE,
  dataStale: DATA_STALE_DAYS_RULE,
  gpsMissing: GPS_MISSING_RULE,
} as const
