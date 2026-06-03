import { NextResponse } from 'next/server'

const DEFAULT_WEATHER_API_BASE_URL = 'https://weather-api-delta-tawny.vercel.app'

function parseCoordinate(input: string | null, min: number, max: number) {
  if (!input) return null
  const value = Number(input)
  if (!Number.isFinite(value) || value < min || value > max) return null
  return value
}

function parseRequestedAt(input: string | null) {
  const normalized = input?.trim()
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return 'invalid'

  return normalized
}

function getWeatherApiKey() {
  return process.env.WEATHER_API_KEY || process.env.QATAR_WEATHER_API_KEY || ''
}

function getWeatherApiBaseUrl() {
  return (process.env.WEATHER_API_BASE_URL || DEFAULT_WEATHER_API_BASE_URL).replace(/\/+$/, '')
}

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

  const apiKey = getWeatherApiKey()
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'Weather API key is not configured',
        hint: 'Set WEATHER_API_KEY or QATAR_WEATHER_API_KEY in the server environment.',
      },
      { status: 500 }
    )
  }

  const upstreamUrl = new URL(`${getWeatherApiBaseUrl()}/weather/by-coordinates`)
  upstreamUrl.searchParams.set('latitude', String(latitude))
  upstreamUrl.searchParams.set('longitude', String(longitude))
  if (requestedAt) {
    upstreamUrl.searchParams.set('requested_at', requestedAt)
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        Accept: 'application/json',
        'x-api-key': apiKey,
      },
      cache: 'no-store',
    })
    const payload = await upstreamResponse.json().catch(() => null)

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        {
          error: 'Weather API request failed',
          status: upstreamResponse.status,
          details: payload,
        },
        { status: upstreamResponse.status }
      )
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Unable to reach Weather API',
        details: error instanceof Error ? error.message : 'Unknown upstream error',
      },
      { status: 502 }
    )
  }
}
