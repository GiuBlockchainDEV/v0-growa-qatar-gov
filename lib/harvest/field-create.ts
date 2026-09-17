import type { LatLngVertex } from '@/lib/harvest/geojson'
import { calculatePolygonAreaHectares, verticesToCreateGeoJson } from '@/lib/harvest/geojson'

export const MIN_FIELD_AREA_HECTARES = 1
export const MAX_FIELD_AREA_HECTARES = 5000
export const MIN_START_DATE = '2018-01-01'
export const START_DATE_LOOKBACK_DAYS = 15

export function formatIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getLatestAllowedStartDate(reference = new Date()) {
  const latest = new Date(reference)
  latest.setDate(latest.getDate() - START_DATE_LOOKBACK_DAYS)
  return formatIsoDate(latest)
}

export function getDefaultHarvestStartDate(reference = new Date()) {
  return getLatestAllowedStartDate(reference)
}

export function getDefaultHarvestEndDate(reference = new Date()) {
  const end = new Date(reference)
  end.setMonth(end.getMonth() + 4)
  return formatIsoDate(end)
}

export interface HarvestFieldCreateInput {
  name: string
  crop_id: number | null
  start_date: string
  harvest_date: string
  vertices: LatLngVertex[]
}

export function validateHarvestFieldCreateInput(input: HarvestFieldCreateInput) {
  const name = input.name.trim()
  if (name.length < 3) return 'Field name must be at least 3 characters.'
  if (name.length > 1024) return 'Field name must be at most 1024 characters.'

  if (!input.crop_id || !Number.isFinite(input.crop_id)) return 'Crop is required.'

  if (!input.start_date) return 'Start date is required.'
  if (input.start_date < MIN_START_DATE) return 'Start date cannot be before 2018-01-01.'

  const latestStartDate = getLatestAllowedStartDate()
  if (input.start_date > latestStartDate) {
    return `Start date must be at least ${START_DATE_LOOKBACK_DAYS} days before today.`
  }

  if (!input.harvest_date) return 'Harvest date is required.'
  if (input.harvest_date < MIN_START_DATE) return 'Harvest date cannot be before 2018-01-01.'
  if (input.harvest_date <= input.start_date) return 'Harvest date must be after start date.'

  if (input.vertices.length < 3) return 'Draw a field boundary with at least 3 points.'

  const areaHa = calculatePolygonAreaHectares(input.vertices)
  if (areaHa < MIN_FIELD_AREA_HECTARES) {
    return `Field area must be at least ${MIN_FIELD_AREA_HECTARES} hectare.`
  }
  if (areaHa > MAX_FIELD_AREA_HECTARES) {
    return `Field area must be at most ${MAX_FIELD_AREA_HECTARES} hectares.`
  }

  return null
}

export function buildHarvestCreateFieldPayload(input: HarvestFieldCreateInput) {
  const error = validateHarvestFieldCreateInput(input)
  if (error) throw new Error(error)

  return {
    name: input.name.trim(),
    crop_id: input.crop_id as number,
    start_date: input.start_date,
    harvest_date: input.harvest_date,
    geojson: verticesToCreateGeoJson(input.vertices),
  }
}
