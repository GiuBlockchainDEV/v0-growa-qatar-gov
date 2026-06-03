const DEFAULT_WEATHER_API_BASE_URL = 'https://weather-api-delta-tawny.vercel.app'

export const WEATHER_API_ENV_NAMES = [
  'WEATHER_API_KEY',
  'QATAR_WEATHER_API_KEY',
  'WEATHER_SERVICE_API_KEY',
  'WEATHER_API_DELTA_TAWNY_KEY',
  'WEATHER_API_DELTA_TAWNY_API_KEY',
  'NEXT_PUBLIC_WEATHER_API_KEY',
  'NEXT_PUBLIC_QATAR_WEATHER_API_KEY',
  'X_API_KEY',
]

export function parseCoordinate(input: string | null, min: number, max: number) {
  if (!input) return null
  const value = Number(input)
  if (!Number.isFinite(value) || value < min || value > max) return null
  return value
}

export function parseRequestedAt(input: string | null) {
  const normalized = input?.trim()
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return 'invalid'

  return normalized
}

export function getWeatherApiKey() {
  for (const name of WEATHER_API_ENV_NAMES) {
    const value = process.env[name]?.trim()
    if (value) return value
  }

  return ''
}

export function getWeatherApiBaseUrl() {
  return (process.env.WEATHER_API_BASE_URL || DEFAULT_WEATHER_API_BASE_URL).replace(/\/+$/, '')
}

export function missingWeatherApiKeyPayload() {
  return {
    error: 'Weather API key is not configured',
    hint:
      `Set one of ${WEATHER_API_ENV_NAMES.join(', ')} in the Vercel environment for the active deployment target ` +
      '(Preview/Production) and redeploy.',
  }
}

export async function fetchWeatherByCoordinates({
  latitude,
  longitude,
  requestedAt,
}: {
  latitude: number
  longitude: number
  requestedAt?: string | null
}) {
  const apiKey = getWeatherApiKey()
  if (!apiKey) {
    throw new Error('WEATHER_API_KEY_MISSING')
  }

  const upstreamUrl = new URL(`${getWeatherApiBaseUrl()}/weather/by-coordinates`)
  upstreamUrl.searchParams.set('latitude', String(latitude))
  upstreamUrl.searchParams.set('longitude', String(longitude))
  if (requestedAt) {
    upstreamUrl.searchParams.set('requested_at', requestedAt)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  const upstreamResponse = await fetch(upstreamUrl, {
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
    cache: 'no-store',
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout))
  const payload = await upstreamResponse.json().catch(() => null)

  if (!upstreamResponse.ok) {
    const error = new Error('WEATHER_API_REQUEST_FAILED')
    Object.assign(error, { status: upstreamResponse.status, payload })
    throw error
  }

  return payload
}
