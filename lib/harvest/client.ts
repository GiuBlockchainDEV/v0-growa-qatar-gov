import {
  getHarvestApiBaseUrl,
  getHarvestCredentials,
  isHarvestConfigured,
} from '@/lib/harvest/config'

type HarvestQuery = Record<string, string | number | undefined | null>

interface HarvestSession {
  cookieHeader: string
  expiresAt: number
}

const SESSION_TTL_MS = 4 * 60 * 1000

let cachedSession: HarvestSession | null = null
let authPromise: Promise<string> | null = null

function parseSetCookieHeader(setCookie: string | null): string {
  if (!setCookie) return ''

  const cookies = setCookie
    .split(/,(?=\s*[^;]+=[^;]+)/)
    .map((entry) => entry.trim().split(';')[0]?.trim())
    .filter(Boolean)

  return cookies.join('; ')
}

function mergeCookieHeaders(existing: string, incoming: string): string {
  const jar = new Map<string, string>()

  for (const source of [existing, incoming]) {
    if (!source) continue
    for (const part of source.split(';')) {
      const trimmed = part.trim()
      if (!trimmed) continue
      const [name, ...valueParts] = trimmed.split('=')
      if (!name) continue
      jar.set(name.trim(), valueParts.join('='))
    }
  }

  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

async function loginToHarvest(): Promise<string> {
  const { username, password } = getHarvestCredentials()
  const response = await fetch(`${getHarvestApiBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ username, password }),
    redirect: 'manual',
  })

  if (!response.ok) {
    throw new Error(`HARVEST_LOGIN_FAILED:${response.status}`)
  }

  const cookieHeader = parseSetCookieHeader(response.headers.get('set-cookie'))
  if (!cookieHeader) {
    throw new Error('HARVEST_LOGIN_MISSING_COOKIES')
  }

  cachedSession = {
    cookieHeader,
    expiresAt: Date.now() + SESSION_TTL_MS,
  }

  return cookieHeader
}

async function refreshHarvestSession(cookieHeader: string): Promise<string> {
  const response = await fetch(`${getHarvestApiBaseUrl()}/auth/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Cookie: cookieHeader,
    },
    redirect: 'manual',
  })

  if (!response.ok) {
    return loginToHarvest()
  }

  const refreshedCookies = parseSetCookieHeader(response.headers.get('set-cookie'))
  const nextCookieHeader = mergeCookieHeaders(cookieHeader, refreshedCookies)

  cachedSession = {
    cookieHeader: nextCookieHeader,
    expiresAt: Date.now() + SESSION_TTL_MS,
  }

  return nextCookieHeader
}

async function getHarvestCookieHeader(forceRefresh = false): Promise<string> {
  if (!isHarvestConfigured()) {
    throw new Error('HARVEST_NOT_CONFIGURED')
  }

  if (
    !forceRefresh &&
    cachedSession &&
    cachedSession.cookieHeader &&
    cachedSession.expiresAt > Date.now()
  ) {
    return cachedSession.cookieHeader
  }

  if (authPromise) {
    return authPromise
  }

  authPromise = (async () => {
    try {
      if (cachedSession?.cookieHeader && !forceRefresh) {
        return await refreshHarvestSession(cachedSession.cookieHeader)
      }
      return await loginToHarvest()
    } finally {
      authPromise = null
    }
  })()

  return authPromise
}

function buildUrl(path: string, query?: HarvestQuery): string {
  const normalizedPath = path.replace(/^\/+/, '')
  const url = new URL(`${getHarvestApiBaseUrl()}/${normalizedPath}`)

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue
      url.searchParams.set(key, String(value))
    }
  }

  return url.toString()
}

async function harvestFetch<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    query?: HarvestQuery
    body?: unknown
    retryOnAuth?: boolean
  } = {}
): Promise<T> {
  const method = options.method || 'GET'
  const retryOnAuth = options.retryOnAuth ?? true
  const cookieHeader = await getHarvestCookieHeader()

  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers: {
      Accept: 'application/json',
      Cookie: cookieHeader,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  })

  if (response.status === 401 && retryOnAuth) {
    const refreshedCookieHeader = await getHarvestCookieHeader(true)
    const retryResponse = await fetch(buildUrl(path, options.query), {
      method,
      headers: {
        Accept: 'application/json',
        Cookie: refreshedCookieHeader,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    })

    if (!retryResponse.ok) {
      const details = await retryResponse.text()
      throw new Error(`HARVEST_REQUEST_FAILED:${retryResponse.status}:${details}`)
    }

    if (retryResponse.status === 204) {
      return undefined as T
    }

    return (await retryResponse.json()) as T
  }

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`HARVEST_REQUEST_FAILED:${response.status}:${details}`)
  }

  if (response.status === 204 || method === 'DELETE') {
    return undefined as T
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return (await response.json()) as T
  }

  return (await response.text()) as T
}

async function harvestFetchBinary(path: string, query?: HarvestQuery): Promise<ArrayBuffer> {
  const cookieHeader = await getHarvestCookieHeader()
  const response = await fetch(buildUrl(path, query), {
    method: 'GET',
    headers: {
      Accept: '*/*',
      Cookie: cookieHeader,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`HARVEST_REQUEST_FAILED:${response.status}:${details}`)
  }

  return response.arrayBuffer()
}

export async function harvestGetAnalytics(query: HarvestQuery) {
  return harvestFetch('entities/analytics', { query })
}

export async function harvestGetAnalyticsFields(query: HarvestQuery) {
  return harvestFetch('entities/analytics/fields', { query })
}

export async function harvestGetAnalyticsTimeseries(query: HarvestQuery) {
  return harvestFetch('entities/analytics/timeseries', { query })
}

export async function harvestGetAllFields(query: HarvestQuery = {}) {
  return harvestFetch('entities/all', { query })
}

export async function harvestGetEntity(parcelId: string) {
  return harvestFetch(`entity/${parcelId}`)
}

export async function harvestGetParcel(parcelId: string) {
  return harvestFetch<{ geojson?: unknown }>(`parcel/${parcelId}`)
}

export async function harvestGetTaskStatus(taskId: string) {
  return harvestFetch(`task_status/${taskId}`)
}

export async function harvestTriggerYield(mode: string, parcelId: string, seasonId: string) {
  return harvestFetch(`yield/${mode}/${parcelId}/${seasonId}`)
}

export async function harvestGetMapTileUrl() {
  return harvestFetch<{ url: string }>('map/tile-url')
}

export async function harvestGetFieldStatsCsv(
  mode: string,
  parcelId: string,
  seasonId: string | number
) {
  return harvestFetch<string>(`entity/view/${mode}/${parcelId}/${seasonId}/stats_agg.csv`)
}

export async function harvestGetFieldRaster(
  mode: string,
  parcelId: string,
  seasonId: string | number,
  query: HarvestQuery
) {
  return harvestFetchBinary(`entity/raster/${mode}/${parcelId}/${seasonId}`, query)
}

export async function harvestGetFieldRasterMeta(
  mode: string,
  parcelId: string,
  seasonId: string | number,
  query: HarvestQuery
) {
  return harvestFetch<{
    bounds?: [[number, number], [number, number]]
    legend?: Array<{ color: string; label: string }>
    vmin?: number
    vmax?: number
    unit?: string
  }>(`entity/raster_meta/${mode}/${parcelId}/${seasonId}`, query)
}

export async function harvestDeleteEntity(parcelId: string) {
  return harvestFetch(`entity/${parcelId}`, { method: 'DELETE' })
}
