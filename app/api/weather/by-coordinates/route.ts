import { NextResponse } from 'next/server'
import {
  fetchWeatherByCoordinates,
  getWeatherApiKey,
  missingWeatherApiKeyPayload,
  parseCoordinate,
  parseRequestedAt,
} from '../_shared'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const latitude = parseCoordinate(searchParams.get('latitude'), -90, 90)
  const longitude = parseCoordinate(searchParams.get('longitude'), -180, 180)
  const requestedAt = parseRequestedAt(searchParams.get('requested_at') || searchParams.get('requestedAt'))

  if (latitude === null || longitude === null) {
    return NextResponse.json({ error: 'latitude and longitude are required valid coordinates' }, { status: 400 })
  }

  if (requestedAt === 'invalid') {
    return NextResponse.json({ error: 'requested_at must be a valid ISO-8601 timestamp' }, { status: 400 })
  }

  if (!getWeatherApiKey()) {
    return NextResponse.json(missingWeatherApiKeyPayload(), { status: 500 })
  }

  try {
    const payload = await fetchWeatherByCoordinates({
      latitude,
      longitude,
      requestedAt,
    })

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'WEATHER_API_REQUEST_FAILED') {
      return NextResponse.json(
        {
          error: 'Weather API request failed',
          status: (error as { status?: number }).status,
          details: (error as { payload?: unknown }).payload,
        },
        { status: (error as { status?: number }).status || 502 }
      )
    }

    return NextResponse.json(
      {
        error: 'Unable to reach Weather API',
        details: error instanceof Error ? error.message : 'Unknown upstream error',
      },
      { status: 502 }
    )
  }
}
