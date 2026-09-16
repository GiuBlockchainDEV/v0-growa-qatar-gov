export type HarvestMode = 'current' | 'predict'

export type HarvestMetricKey =
  | 'aeti'
  | 'npp'
  | 'tbp'
  | 'bwp'
  | 'rwd'
  | 'wcu'
  | 'cost'

export interface HarvestMetricSummary {
  key: HarvestMetricKey
  agg: 'sum' | 'mean'
  value: number
  field_count: number
}

export interface HarvestFieldMetrics {
  aeti?: number
  npp?: number
  tbp?: number
  bwp?: number
  rwd?: number
  wcu?: number
  cost?: number
}

export interface HarvestAnalyticsField {
  parcel_id: string
  season_id?: number
  name: string
  crop: string
  cultivation?: string
  area: number
  start_date: string
  harvest_date: string
  metrics: HarvestFieldMetrics
}

export interface HarvestAnalyticsResponse {
  metrics: HarvestMetricSummary[]
  fields: HarvestAnalyticsField[]
}

export interface HarvestPaginatedFieldsResponse {
  total: number
  results: HarvestAnalyticsField[]
}

export interface HarvestEntityField {
  parcel_id: string
  name: string
  area: number
  season_id: number
  crop: string
  start_date: string
  harvest_date: string
}

export interface HarvestTaskStatus {
  task_id: string
  status: 'in progress' | 'completed' | 'failed'
  result?: Record<string, unknown>
}

export interface HarvestYieldResponse {
  task_id: string
}

export interface HarvestTimeseriesPoint {
  period: string
  value: number
}

export interface HarvestTimeseriesResponse {
  metric: string
  granularity: string
  mode: HarvestMode
  points: HarvestTimeseriesPoint[]
}

export interface HarvestMapFieldRing {
  lat: number
  lng: number
}

export interface HarvestMapField {
  parcel_id: string
  name: string
  crop: string
  rings: HarvestMapFieldRing[][]
  centroid: HarvestMapFieldRing
}

export interface HarvestMapFieldsResponse {
  fields: HarvestMapField[]
}
