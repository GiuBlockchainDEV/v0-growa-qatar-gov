/** Shared domain types for the Growa Qatar platform integration layer. */

export type StatusLevel = 'normal' | 'attention' | 'high' | 'critical' | 'unknown'

export type SignalType =
  | 'production'
  | 'water'
  | 'weather'
  | 'crop_health'
  | 'energy'
  | 'supply'
  | 'compliance'
  | 'data_quality'

export type SignalSeverity = 'info' | 'attention' | 'high' | 'critical'

export type SourceHealth = 'healthy' | 'degraded' | 'stale' | 'offline' | 'unknown'

export type DataQualityState = 'fresh' | 'stale' | 'partial' | 'missing' | 'unavailable'

export type DataSourceMode = 'live' | 'partial' | 'demo' | 'unavailable'

export type ChangeDirection = 'up' | 'down' | 'new' | 'resolved' | 'stable'

export type ChangeSignificance = 'low' | 'medium' | 'high'

export type WatchtowerTimeframe = 'now' | '24h' | '7d' | '30d' | 'season'

export interface IntelligenceSignal {
  id: string
  type: SignalType
  severity: SignalSeverity
  title: string
  summary: string
  detectedAt: string
  updatedAt: string
  farmIds?: string[]
  parcelIds?: string[]
  pointIds?: string[]
  lat?: number
  lng?: number
  metric?: string
  currentValue?: number
  baselineValue?: number
  deviationPercent?: number
  confidence?: number
  recommendedModule?: string
  deepLink?: string
  sourceIds?: string[]
  sourceMode?: DataSourceMode
}

export interface SituationChange {
  id: string
  domain: string
  direction: ChangeDirection
  significance: ChangeSignificance
  description: string
  currentValue?: number
  previousValue?: number
  entityCount?: number
  deepLink?: string
}

export interface DataQualityStatus {
  source: string
  status: DataQualityState
  coveragePercent?: number
  lastUpdated?: string
  expectedUpdateInterval?: number
  entityCount?: number
  missingEntityCount?: number
  sourceMode?: DataSourceMode
}

export interface SourceStatus {
  source: string
  health: SourceHealth
  lastChecked: string
  message?: string
  sourceMode?: DataSourceMode
}

export interface NationalStatusDomain {
  domain: 'production' | 'water' | 'climate' | 'crop_health' | 'supply'
  level: StatusLevel
  reason: string
  comparisonPeriod?: string
  affectedEntityCount?: number
  lastUpdated?: string
  confidence?: number
  coveragePercent?: number
  sourceMode?: DataSourceMode
}

export interface MetricSummary {
  value: number | null
  unit: string
  label: string
  comparisonValue?: number | null
  comparisonLabel?: string
  deviationPercent?: number | null
  timestamp?: string
  source: string
  coveragePercent?: number
  sourceMode?: DataSourceMode
}

export interface ProductionSummary {
  productionEstimate: MetricSummary
  forecast?: MetricSummary
  atRiskProduction?: MetricSummary
  fieldsMonitored?: MetricSummary
  cropTypes?: MetricSummary
  avgHealthScore?: MetricSummary
}

export interface WaterSummary {
  totalDemand: MetricSummary
  intensityM3PerTon?: MetricSummary
  highPressureFarms?: number
}

export interface EnergySummary {
  totalConsumption: MetricSummary
  intensityKwhPerTon?: MetricSummary
  anomalousSites?: number
}

export interface ClimateSummary {
  heatRisk: MetricSummary
  waterStress?: MetricSummary
  diseaseRisk?: MetricSummary
}

export interface SupplySummary {
  availableVolume?: MetricSummary
  atRiskDeliveries?: MetricSummary
  coverage?: MetricSummary
}

export interface OutlookSummary {
  sevenDay?: {
    climate?: string
    irrigationDemand?: string
    cropStress?: string
    operationalRisk?: string
  }
  thirtyDay?: {
    harvest?: string
    production?: string
    waterRequirement?: string
    supplyImplications?: string
  }
}

export interface WatchtowerSummary {
  generatedAt: string
  timeframe: WatchtowerTimeframe
  nationalStatus: NationalStatusDomain[]
  signals: IntelligenceSignal[]
  changes: SituationChange[]
  production: ProductionSummary
  water: WaterSummary
  energy: EnergySummary
  climate: ClimateSummary
  supply: SupplySummary
  outlook?: OutlookSummary
  dataQuality: DataQualityStatus[]
  sourceStatus: SourceStatus[]
  isDemo?: boolean
}

export interface OperationalMapLayer {
  id: string
  label: string
  category: 'agriculture' | 'resources' | 'climate' | 'risk'
  source: string
  available: boolean
  defaultVisible?: boolean
}
