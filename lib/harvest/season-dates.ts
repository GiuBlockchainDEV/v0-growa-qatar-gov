import type { LatLngVertex } from '@/lib/harvest/geojson'
import { computeCentroid } from '@/lib/harvest/geojson'
import { formatIsoDate } from '@/lib/harvest/field-create'

export const SEASON_START_LOOKBACK_DAYS = 30

interface CropSeasonTemplate {
  startMonth: number
  startDay: number
  harvestMonth: number
  harvestDay: number
  harvestYearOffset: number
}

const CROP_SEASON_TEMPLATES: Array<{ pattern: RegExp; template: CropSeasonTemplate }> = [
  {
    pattern: /tomato/i,
    template: { startMonth: 10, startDay: 15, harvestMonth: 3, harvestDay: 20, harvestYearOffset: 1 },
  },
  {
    pattern: /cucumber/i,
    template: { startMonth: 11, startDay: 1, harvestMonth: 2, harvestDay: 28, harvestYearOffset: 1 },
  },
  {
    pattern: /pepper|capsicum/i,
    template: { startMonth: 9, startDay: 20, harvestMonth: 1, harvestDay: 15, harvestYearOffset: 1 },
  },
  {
    pattern: /lettuce|leafy|spinach|rocket|kale/i,
    template: { startMonth: 9, startDay: 1, harvestMonth: 11, harvestDay: 30, harvestYearOffset: 0 },
  },
  {
    pattern: /melon|watermelon/i,
    template: { startMonth: 2, startDay: 15, harvestMonth: 6, harvestDay: 15, harvestYearOffset: 0 },
  },
  {
    pattern: /zucchini|squash|courgette/i,
    template: { startMonth: 10, startDay: 1, harvestMonth: 2, harvestDay: 10, harvestYearOffset: 1 },
  },
]

const DEFAULT_TEMPLATE: CropSeasonTemplate = {
  startMonth: 10,
  startDay: 1,
  harvestMonth: 1,
  harvestDay: 31,
  harvestYearOffset: 1,
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return startOfDay(next)
}

function resolveCropTemplate(cropName: string): CropSeasonTemplate {
  const normalized = cropName.trim()
  if (!normalized) return DEFAULT_TEMPLATE
  const match = CROP_SEASON_TEMPLATES.find((entry) => entry.pattern.test(normalized))
  return match?.template ?? DEFAULT_TEMPLATE
}

function geographicStartShiftDays(location?: LatLngVertex) {
  if (!location) return 0
  if (location.lat >= 25.8) return -5
  if (location.lat <= 25.2) return 5
  return 0
}

function buildSeasonDatesForYear(
  template: CropSeasonTemplate,
  year: number,
  location?: LatLngVertex
): { start: Date; harvest: Date } {
  const start = new Date(year, template.startMonth - 1, template.startDay)
  start.setDate(start.getDate() + geographicStartShiftDays(location))

  const harvestYear = year + template.harvestYearOffset
  const harvest = new Date(harvestYear, template.harvestMonth - 1, template.harvestDay)

  return {
    start: startOfDay(start),
    harvest: startOfDay(harvest),
  }
}

export function computeRingsCentroid(rings: LatLngVertex[][]): LatLngVertex {
  const vertices = rings.flat().filter((vertex) => Number.isFinite(vertex.lat) && Number.isFinite(vertex.lng))
  if (vertices.length === 0) {
    return { lat: 25.3548, lng: 51.1839 }
  }
  return computeCentroid(vertices)
}

export function suggestHarvestSeasonDates({
  cropName,
  location,
  reference = new Date(),
}: {
  cropName: string
  location?: LatLngVertex
  reference?: Date
}): { start_date: string; harvest_date: string } {
  const template = resolveCropTemplate(cropName)
  const today = startOfDay(reference)
  const latestAllowedStart = addDays(today, -SEASON_START_LOOKBACK_DAYS)

  let year = today.getFullYear()

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { start, harvest } = buildSeasonDatesForYear(template, year, location)
    const startInFuture = start > today
    const startTooRecent = start > latestAllowedStart

    if (!startInFuture && !startTooRecent && harvest > start) {
      return {
        start_date: formatIsoDate(start),
        harvest_date: formatIsoDate(harvest),
      }
    }

    year -= 1
  }

  const fallback = buildSeasonDatesForYear(template, today.getFullYear() - 1, location)
  return {
    start_date: formatIsoDate(fallback.start),
    harvest_date: formatIsoDate(fallback.harvest),
  }
}
