export interface InsightRow {
  id: string
  pointId: string
  cropName: string
  estimatedProductionTons: number
  energyConsumptionKwh: number
  waterConsumptionM3: number
}

export interface PolygonRow {
  id: string
  pointId: string
  score: number
  crop: {
    cropName: string
  }
}

function toPositiveNumber(input: unknown) {
  const value = typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : Number.NaN
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value * 100) / 100
}

export function normalizeInsightRows(input: unknown): InsightRow[] {
  if (!Array.isArray(input)) return []
  return input
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as Record<string, unknown>
      const id = typeof row.id === 'string' ? row.id.trim() : ''
      const pointId =
        (typeof row.pointId === 'string' && row.pointId.trim()) ||
        (typeof row.custom_point_id === 'string' && row.custom_point_id.trim()) ||
        ''
      const cropName =
        (typeof row.cropName === 'string' && row.cropName.trim()) ||
        (typeof row.crop_name === 'string' && row.crop_name.trim()) ||
        ''
      if (!id || !pointId || !cropName) return null
      return {
        id,
        pointId,
        cropName,
        estimatedProductionTons: toPositiveNumber(
          row.estimatedProductionTons ?? row.estimated_production_tons ?? row.estimated_production
        ),
        energyConsumptionKwh: toPositiveNumber(
          row.energyConsumptionKwh ?? row.energy_consumption_kwh ?? row.energy_consumption
        ),
        waterConsumptionM3: toPositiveNumber(
          row.waterConsumptionM3 ?? row.water_consumption_m3 ?? row.water_consumption
        ),
      } satisfies InsightRow
    })
    .filter((row): row is InsightRow => Boolean(row))
}

export function normalizePolygonRows(input: unknown): PolygonRow[] {
  if (!Array.isArray(input)) return []
  return input
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as Record<string, unknown>
      const id = typeof row.id === 'string' ? row.id.trim() : ''
      const pointId =
        (typeof row.pointId === 'string' && row.pointId.trim()) ||
        (typeof row.custom_point_id === 'string' && row.custom_point_id.trim()) ||
        (typeof row.customPointId === 'string' && row.customPointId.trim()) ||
        ''
      const cropSource = row.crop && typeof row.crop === 'object' ? (row.crop as Record<string, unknown>) : null
      const cropName =
        (typeof cropSource?.cropName === 'string' && cropSource.cropName.trim()) ||
        (typeof cropSource?.crop_name === 'string' && cropSource.crop_name.trim()) ||
        (typeof row.cropName === 'string' && row.cropName.trim()) ||
        (typeof row.crop_name === 'string' && row.crop_name.trim()) ||
        ''
      const score = toPositiveNumber(row.score)
      if (!id || !pointId) return null
      return {
        id,
        pointId,
        score: Math.max(0, Math.min(100, score)),
        crop: { cropName },
      } satisfies PolygonRow
    })
    .filter((row): row is PolygonRow => Boolean(row))
}
