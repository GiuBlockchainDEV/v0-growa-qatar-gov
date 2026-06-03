import { NextResponse } from 'next/server'
import {
  fetchWeatherByCoordinates,
  getWeatherApiKey,
  missingWeatherApiKeyPayload,
  parseCoordinate,
  parseRequestedAt,
} from '../../_shared'

function parseInteger(input: string | null, fallback: number, min: number, max: number) {
  const value = input ? Number(input) : fallback
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function buildTimeline(endIso: string | null, count: number, intervalHours: number) {
  const endDate = endIso ? new Date(endIso) : new Date()
  const endMs = Number.isNaN(endDate.getTime()) ? Date.now() : endDate.getTime()
  const intervalMs = intervalHours * 60 * 60 * 1000

  return Array.from({ length: count }, (_, index) => {
    const offset = count - index - 1
    return new Date(endMs - offset * intervalMs).toISOString()
  })
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

  const timeline = buildTimeline(requestedAt, count, intervalHours)

  try {
    const points = await Promise.all(
      timeline.map(async (timestamp) => {
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
    )

    return NextResponse.json(
      {
        latitude,
        longitude,
        intervalHours,
        count,
        points,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
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
