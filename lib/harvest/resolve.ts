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
}: {
  demoMode: boolean
  fetchLive: () => Promise<T>
  fetchDemo: () => T
  validateLive?: (payload: T) => boolean
}): Promise<{ payload: T; usedDemo: boolean }> {
  if (demoMode) {
    return { payload: fetchDemo(), usedDemo: true }
  }

  const payload = await fetchLive()
  return { payload, usedDemo: false }
}

export function harvestJsonResponse<T>(payload: T, usedDemo: boolean) {
  return withDemoHeaders(
    NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    }),
    usedDemo
  )
}
