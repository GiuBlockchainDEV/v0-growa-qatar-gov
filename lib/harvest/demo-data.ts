import type {
  HarvestAnalyticsField,
  HarvestAnalyticsResponse,
  HarvestMode,
  HarvestTaskStatus,
  HarvestTimeseriesResponse,
} from '@/lib/harvest/types'

export const DEMO_PARCEL_NORTH = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
export const DEMO_PARCEL_SOUTH = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'

const DEMO_FIELDS: HarvestAnalyticsField[] = [
  {
    parcel_id: DEMO_PARCEL_NORTH,
    season_id: 12,
    name: 'Al Shamal Open Field',
    crop: 'tomato',
    cultivation: 'soil',
    area: 185_000,
    start_date: '2025-10-15',
    harvest_date: '2026-03-20',
    metrics: { aeti: 12450.3, npp: 892.1, tbp: 156.8, bwp: 1.26, rwd: 0.18, wcu: 82.4, cost: 66028 },
  },
  {
    parcel_id: DEMO_PARCEL_SOUTH,
    season_id: 18,
    name: 'Al Wakrah Greenhouse Block',
    crop: 'cucumber',
    cultivation: 'hydroponics',
    area: 42_500,
    start_date: '2025-11-01',
    harvest_date: '2026-02-28',
    metrics: { aeti: 4820.7, npp: 410.5, tbp: 68.2, bwp: 1.41, rwd: 0.12, wcu: 91.2, cost: 25550 },
  },
  {
    parcel_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    season_id: 7,
    name: 'Umm Salal Trial Plot',
    crop: 'sweet pepper',
    cultivation: 'soil',
    area: 96_000,
    start_date: '2025-09-20',
    harvest_date: '2026-01-15',
    metrics: { aeti: 7310.2, npp: 620.4, tbp: 102.5, bwp: 1.18, rwd: 0.22, wcu: 76.8, cost: 38744 },
  },
]

export function isHarvestDemoMode(): boolean {
  return process.env.HARVEST_DEMO_MODE === 'true'
}

export function getDemoAnalytics(mode: HarvestMode): HarvestAnalyticsResponse {
  const factor = mode === 'predict' ? 1.12 : 1
  return {
    metrics: [
      { key: 'aeti', agg: 'sum', value: Math.round(24581.2 * factor), field_count: 3 },
      { key: 'tbp', agg: 'sum', value: Math.round(327.5 * factor * 10) / 10, field_count: 3 },
      { key: 'bwp', agg: 'mean', value: 1.28, field_count: 3 },
      { key: 'cost', agg: 'sum', value: Math.round(130322 * factor), field_count: 3 },
    ],
    fields: DEMO_FIELDS.map((field) => ({
      ...field,
      metrics: Object.fromEntries(
        Object.entries(field.metrics).map(([key, value]) => [
          key,
          typeof value === 'number' ? Math.round(value * factor * 10) / 10 : value,
        ])
      ) as HarvestAnalyticsField['metrics'],
    })),
  }
}

export function getDemoAnalyticsFields(mode: HarvestMode) {
  const analytics = getDemoAnalytics(mode)
  return {
    total: analytics.fields.length,
    results: analytics.fields,
  }
}

export function getDemoTimeseries(mode: HarvestMode): HarvestTimeseriesResponse {
  const factor = mode === 'predict' ? 1.08 : 1
  const base = [1820, 1940, 2105, 2280, 2410, 2555, 2680, 2795, 2910, 3025, 3140, 3260]
  return {
    metric: 'aeti',
    granularity: 'dekad',
    mode,
    points: base.map((value, index) => ({
      period: `2025-${String(10 + Math.floor(index / 3)).padStart(2, '0')}-${String((index % 3) * 10 + 1).padStart(2, '0')}`,
      value: Math.round(value * factor * (1 + index * 0.02)),
    })),
  }
}

export function getDemoEntity(parcelId: string) {
  const field = DEMO_FIELDS.find((entry) => entry.parcel_id === parcelId)
  if (!field) return null
  return {
    parcel_id: field.parcel_id,
    name: field.name,
    area: field.area,
    field_type: 'open_field',
    seasons: [
      {
        id: field.season_id,
        crop: field.crop,
        start_date: field.start_date,
        harvest_date: field.harvest_date,
        stage: 'flowering',
      },
    ],
  }
}

const demoYieldTasks = new Map<string, HarvestTaskStatus>()

export function getDemoYieldTask(mode: HarvestMode, parcelId: string, seasonId: string) {
  const field = DEMO_FIELDS.find((entry) => entry.parcel_id === parcelId)
  const taskId = `demo-yield-${parcelId}--${seasonId}`
  const baseYield = field?.metrics.tbp ? field.metrics.tbp * 0.62 : 95.4
  const factor = mode === 'predict' ? 1.08 : 1

  const completed: HarvestTaskStatus = {
    task_id: taskId,
    status: 'completed',
    result: {
      parcel_id: parcelId,
      season_id: Number(seasonId),
      mode,
      yield_min: Math.round(baseYield * 0.85 * factor * 10) / 10,
      yield_default: Math.round(baseYield * factor * 10) / 10,
      yield_max: Math.round(baseYield * 1.15 * factor * 10) / 10,
      npp_mean: field?.metrics.npp || 620,
      water_consumption: field?.metrics.aeti || 7300,
      bwp_mean: field?.metrics.bwp || 1.2,
      field_name: field?.name || 'Demo Field',
    },
  }

  demoYieldTasks.set(taskId, completed)
  return { trigger: { task_id: taskId }, completed }
}

export function getDemoTaskStatus(taskId: string): HarvestTaskStatus | null {
  return demoYieldTasks.get(taskId) || null
}
