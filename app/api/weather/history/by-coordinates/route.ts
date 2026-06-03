import { NextResponse } from 'next/server'
import {
  fetchWeatherByCoordinates,
  getWeatherApiKey,
  missingWeatherApiKeyPayload,
  parseCoordinate,
  parseRequestedAt,
} from '../../_shared'

const HISTORY_CACHE_TTL_MS = 5 * 60 * 1000
const historyCache = new Map<string, { expiresAt: number; payload: unknown }>()

function parseInteger(input: string | null, fallback: number, min: number, max: number) {
  const value = input ? Number(input) : fallback
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function buildCacheKey(latitude: number, longitude: number, requestedAt: string | null, count: number, intervalHours: number) {
  return [latitude.toFixed(5), longitude.toFixed(5), requestedAt || 'latest', count, intervalHours].join(':')
}

function buildTimeline(endIso: string | null, count: number, intervalHours: number) {
  const endDate = endIso ? new Date(endIso) : new Date()
  const endMs = Number.isNaN(endDate.getTime()) ? Date.now() : endDate.getTime()
  const intervalMs = intervalHours * 60 * 60 * 1000
  const attempts = Math.min(count + 30, 140)

  return Array.from({ length: attempts }, (_, index) => new Date(endMs - index * intervalMs).toISOString())
}

function readingKey(reading: unknown, fallback: string) {
  if (!reading || typeof reading !== 'object') return fallback
  const record = reading as Record<string, unknown>
  const candidates = [
    record.matched_timestamp,
    record.stored_at,
    record.requested_at,
    (record.weather && typeof record.weather === 'object' ? (record.weather as Record<string, unknown>).weather_timestamp_unix : null),
  ]
  const match = candidates.find((candidate) => typeof candidate === 'string' || typeof candidate === 'number')
  return match === undefined || match === null ? fallback : String(match)
}

async function runBatch<T, R>(items: T[], worker: (item: T) => Promise<R>) {
  return Promise.all(items.map((item) => worker(item)))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const latitude = parseCoordinate(searchParams.get('latitude'), -90, 90)
  const longitude = parseCoordinate(searchParams.get('longitude'), -180, 180)
  const requestedAt = parseRequestedAt(searchParams.get('requested_at') || searchParams.get('requestedAt'))
  const count = parseInteger(searchParams.get('count'), 90, 2, 90)
  const intervalHours = parseInteger(searchParams.get('interval_hours') || searchParams.get('intervalHours'), 3, 1, 24)

  if (latitude === null || longitude === null) {
    return NextResponse.json({ error: 'latitude and longitude are required valid coordinates' }, { status: 400 })
  }

  if (requestedAt === 'invalid') {
    return NextResponse.json({ error: 'requested_at must be a valid ISO-8601 timestamp' }, { status: 400 })
  }

  if (!getWeatherApiKey()) {
    return NextResponse.json(missingWeatherApiKeyPayload(), { status: 500 })
  }

  const cacheKey = buildCacheKey(latitude, longitude, requestedAt, count, intervalHours)
  const cached = historyCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: {
        'Cache-Control': 'private, max-age=300',
        'X-Weather-History-Cache': 'HIT',
      },
    })
  }

  const timeline = buildTimeline(requestedAt, count, intervalHours)

  try {
    const points: Array<{ requestedAt: string; reading: unknown; error: string | null }> = []
    const seen = new Set<string>()
    const batchSize = 20

    for (let index = 0; index < timeline.length && points.length < count; index += batchSize) {
      const batch = timeline.slice(index, index + batchSize)
      const results = await runBatch(batch, async (timestamp) => {
        try {
          const reading = await fetchWeatherByCoordinates({
            latitude,
            longitude,
            requestedAt: timestamp,
          })
          return {
            requestedAt: timestamp,
            reading,
            error: null,
          }
        } catch (error) {
          return {
            requestedAt: timestamp,
            reading: null,
            error: error instanceof Error ? error.message : 'Weather history request failed',
          }
        }
      })

      for (const result of results) {
        if (!result.reading) continue
        const key = readingKey(result.reading, result.requestedAt)
        if (seen.has(key)) continue
        seen.add(key)
        points.push(result)
        if (points.length >= count) break
      }
    }

    const chronologicalPoints = [...points].reverse()

    const payload = {
      latitude,
      longitude,
      intervalHours,
      count,
      returnedCount: chronologicalPoints.length,
      points: chronologicalPoints,
    }

    historyCache.set(cacheKey, {
      expiresAt: Date.now() + HISTORY_CACHE_TTL_MS,
      payload,
    })

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, max-age=300',
        'X-Weather-History-Cache': 'MISS',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Unable to load Weather history',
        details: error instanceof Error ? error.message : 'Unknown history error',
      },
      { status: 502 }
    )
  }
}
