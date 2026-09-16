import { NextResponse } from 'next/server'
import { isHarvestConfigured, shouldUseHarvestDemo } from '@/lib/harvest/config'

export function withDemoHeaders(response: NextResponse, demoMode: boolean) {
  if (demoMode) {
    response.headers.set('X-Harvest-Demo', 'true')
  }
  return response
}

export function resolveHarvestDemoMode(): boolean {
  if (shouldUseHarvestDemo()) return true
  if (!isHarvestConfigured()) return true
  return false
}

export async function resolveHarvestPayload<T>({
  demoMode,
  fetchLive,
  fetchDemo,
  validateLive,
}: {
  demoMode: boolean
  fetchLive: () => Promise<T>
  fetchDemo: () => T
  validateLive?: (payload: T) => boolean
}): Promise<{ payload: T; usedDemo: boolean }> {
  if (demoMode) {
    return { payload: fetchDemo(), usedDemo: true }
  }

  try {
    const payload = await fetchLive()
    if (validateLive && !validateLive(payload)) {
      return { payload: fetchDemo(), usedDemo: true }
    }
    return { payload, usedDemo: false }
  } catch {
    return { payload: fetchDemo(), usedDemo: true }
  }
}

export function harvestJsonResponse<T>(payload: T, usedDemo: boolean) {
  return withDemoHeaders(
    NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    }),
    usedDemo
  )
}
