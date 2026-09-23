import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LatLngVertex } from '@/lib/harvest/geojson'
import { isInQatar } from '@/lib/harvest/geojson'

export interface CropCalendarEntry {
  region: string
  crop_key: string
  crop_aliases: string
  production_system: string
  calendar_type: string
  season_name: string
  start_month: number
  start_day: number
  harvest_month: number
  harvest_day: number
  harvest_year_offset: number
  min_lat: number | null
  max_lat: number | null
  min_lng: number | null
  max_lng: number | null
  start_shift_north_lat: number | null
  start_shift_north_days: number
  start_shift_south_lat: number | null
  start_shift_south_days: number
  priority: number
  notes: string
  confidence: string
  source_url: string
}

export interface CropCalendarResolveOptions {
  productionSystem?: string
  calendarType?: string
}

const CALENDAR_PATH = join(process.cwd(), 'lib/harvest/data/qatar-gcc-crop-calendar.csv')

let cachedEntries: CropCalendarEntry[] | null = null

function parseNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const numeric = Number(trimmed)
  return Number.isFinite(numeric) ? numeric : null
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }
    current += char
  }

  values.push(current)
  return values
}

export function parseCropCalendarCsv(csv: string): CropCalendarEntry[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0])
  const entries: CropCalendarEntry[] = []

  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line)
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))

    entries.push({
      region: record.region?.trim() || 'gcc',
      crop_key: record.crop_key?.trim() || 'default',
      crop_aliases: record.crop_aliases?.trim() || '*',
      production_system: record.production_system?.trim() || 'open_field_or_passive_protected',
      calendar_type: record.calendar_type?.trim() || 'active_or_commercial_window',
      season_name: record.season_name?.trim() || 'cool_season',
      start_month: parseNumber(record.start_month) ?? 10,
      start_day: parseNumber(record.start_day) ?? 1,
      harvest_month: parseNumber(record.harvest_month) ?? 1,
      harvest_day: parseNumber(record.harvest_day) ?? 31,
      harvest_year_offset: parseNumber(record.harvest_year_offset) ?? 1,
      min_lat: parseNumber(record.min_lat),
      max_lat: parseNumber(record.max_lat),
      min_lng: parseNumber(record.min_lng),
      max_lng: parseNumber(record.max_lng),
      start_shift_north_lat: parseNumber(record.start_shift_north_lat),
      start_shift_north_days: parseNumber(record.start_shift_north_days) ?? 0,
      start_shift_south_lat: parseNumber(record.start_shift_south_lat),
      start_shift_south_days: parseNumber(record.start_shift_south_days) ?? 0,
      priority: parseNumber(record.priority) ?? 0,
      notes: record.notes?.trim() || '',
      confidence: record.confidence?.trim() || '',
      source_url: record.source_url?.trim() || '',
    })
  }

  return entries
}

export function loadCropCalendar(): CropCalendarEntry[] {
  if (cachedEntries) return cachedEntries
  const csv = readFileSync(CALENDAR_PATH, 'utf8')
  cachedEntries = parseCropCalendarCsv(csv)
  return cachedEntries
}

export function resetCropCalendarCache() {
  cachedEntries = null
}

function locationMatchesBounds(location: LatLngVertex, entry: CropCalendarEntry) {
  if (entry.min_lat !== null && location.lat < entry.min_lat) return false
  if (entry.max_lat !== null && location.lat > entry.max_lat) return false
  if (entry.min_lng !== null && location.lng < entry.min_lng) return false
  if (entry.max_lng !== null && location.lng > entry.max_lng) return false
  return true
}

function cropMatchesAliases(cropName: string, aliases: string) {
  const normalized = cropName.trim().toLowerCase()
  if (!normalized) return aliases.trim() === '*'
  if (aliases.trim() === '*') return true

  return aliases
    .split('|')
    .map((alias) => alias.trim().toLowerCase())
    .filter(Boolean)
    .some((alias) => normalized.includes(alias) || alias.includes(normalized))
}

function productionSystemScore(entry: CropCalendarEntry, preferred?: string) {
  if (!preferred) {
    if (entry.production_system === 'open_field_or_passive_protected') return 2
    if (entry.production_system === 'irrigated_field') return 1
    return 0
  }
  return entry.production_system === preferred ? 2 : 0
}

function calendarTypeScore(entry: CropCalendarEntry, preferred?: string) {
  if (!preferred) {
    if (entry.calendar_type === 'active_or_commercial_window') return 2
    if (entry.calendar_type === 'production_possible') return 0
    return 1
  }
  return entry.calendar_type === preferred ? 2 : 0
}

export function resolveCropCalendarEntry(
  cropName: string,
  location?: LatLngVertex,
  entries = loadCropCalendar(),
  options?: CropCalendarResolveOptions
): CropCalendarEntry {
  const point = location ?? { lat: 25.3548, lng: 51.1839 }
  const preferredRegion = isInQatar(point.lat, point.lng) ? 'qatar' : 'gcc'

  const matches = entries
    .filter((entry) => cropMatchesAliases(cropName, entry.crop_aliases))
    .filter((entry) => locationMatchesBounds(point, entry))
    .sort((left, right) => {
      const leftRegionBoost = left.region === preferredRegion ? 1 : 0
      const rightRegionBoost = right.region === preferredRegion ? 1 : 0
      if (leftRegionBoost !== rightRegionBoost) return rightRegionBoost - leftRegionBoost

      const leftProduction = productionSystemScore(left, options?.productionSystem)
      const rightProduction = productionSystemScore(right, options?.productionSystem)
      if (leftProduction !== rightProduction) return rightProduction - leftProduction

      const leftCalendar = calendarTypeScore(left, options?.calendarType)
      const rightCalendar = calendarTypeScore(right, options?.calendarType)
      if (leftCalendar !== rightCalendar) return rightCalendar - leftCalendar

      return right.priority - left.priority
    })

  return matches[0] ?? entries.find((entry) => entry.crop_key === 'default') ?? entries[entries.length - 1]
}

export function geographicStartShiftDays(location?: LatLngVertex, entry?: CropCalendarEntry) {
  if (!location || !entry) return 0
  if (entry.start_shift_north_lat !== null && location.lat >= entry.start_shift_north_lat) {
    return entry.start_shift_north_days
  }
  if (entry.start_shift_south_lat !== null && location.lat <= entry.start_shift_south_lat) {
    return entry.start_shift_south_days
  }
  return 0
}
