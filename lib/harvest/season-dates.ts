import type { LatLngVertex } from '@/lib/harvest/geojson'
import { computeCentroid } from '@/lib/harvest/geojson'
import {
  geographicStartShiftDays,
  loadCropCalendar,
  resolveCropCalendarEntry,
  type CropCalendarEntry,
} from '@/lib/harvest/crop-calendar'
import { formatIsoDate } from '@/lib/harvest/field-create'

export const SEASON_START_LOOKBACK_DAYS = 30

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

function buildSeasonDatesForYear(
  entry: CropCalendarEntry,
  year: number,
  location?: LatLngVertex
): { start: Date; harvest: Date } {
  const start = new Date(year, entry.start_month - 1, entry.start_day)
  start.setDate(start.getDate() + geographicStartShiftDays(location, entry))

  const harvestYear = year + entry.harvest_year_offset
  const harvest = new Date(harvestYear, entry.harvest_month - 1, entry.harvest_day)

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
  calendar = loadCropCalendar(),
}: {
  cropName: string
  location?: LatLngVertex
  reference?: Date
  calendar?: ReturnType<typeof loadCropCalendar>
}): { start_date: string; harvest_date: string; crop_key: string; region: string; season_name: string } {
  const entry = resolveCropCalendarEntry(cropName, location, calendar)
  const today = startOfDay(reference)
  const latestAllowedStart = addDays(today, -SEASON_START_LOOKBACK_DAYS)

  let year = today.getFullYear()

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { start, harvest } = buildSeasonDatesForYear(entry, year, location)
    const startInFuture = start > today
    const startTooRecent = start > latestAllowedStart

    if (!startInFuture && !startTooRecent && harvest > start) {
      return {
        start_date: formatIsoDate(start),
        harvest_date: formatIsoDate(harvest),
        crop_key: entry.crop_key,
        region: entry.region,
        season_name: entry.season_name,
      }
    }

    year -= 1
  }

  const fallback = buildSeasonDatesForYear(entry, today.getFullYear() - 1, location)
  return {
    start_date: formatIsoDate(fallback.start),
    harvest_date: formatIsoDate(fallback.harvest),
    crop_key: entry.crop_key,
    region: entry.region,
    season_name: entry.season_name,
  }
}
