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

export type HarvestTrendGranularity = 'dekad' | 'season'

export interface HarvestFieldPeriodOption {
  value: string
  label: string
}

export interface HarvestFieldStatsResponse {
  parcel_id: string
  season_id: number
  periods: HarvestFieldPeriodOption[]
  timeseries: {
    dekad: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>>
    season: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>>
  }
}

export interface HarvestRasterLegendItem {
  color: string
  label: string
}

export interface HarvestRasterResponse {
  metric: HarvestMetricKey
  granularity: HarvestTrendGranularity
  period: string | null
  image_url: string
  bounds: [[number, number], [number, number]]
  vmin: number
  vmax: number
  unit: string
  legend: HarvestRasterLegendItem[]
}

export interface HarvestRasterOverlay {
  imageUrl: string
  bounds: [[number, number], [number, number]]
  opacity: number
  metric: HarvestMetricKey
  vmin: number
  vmax: number
  unit: string
  legend: HarvestRasterLegendItem[]
}

export interface HarvestCropOption {
  id: number
  name: string
  field_type: string
  cultivation_method: string
}

export interface HarvestCropGroup {
  label: string
  options: Array<{ value: number; label: string }>
}

export interface HarvestCreateFieldRequest {
  name: string
  start_date: string
  harvest_date: string
  crop_id: number
  geojson: unknown
}

export interface HarvestCreateFieldResponse {
  parcel_id: string
  season_id?: number
  task_id?: string
  name?: string
}
