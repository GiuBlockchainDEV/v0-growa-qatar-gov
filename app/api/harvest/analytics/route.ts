import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetAnalytics } from '@/lib/harvest/client'
import { getDemoAnalytics } from '@/lib/harvest/demo-data'
import { harvestJsonResponse, resolveHarvestPayload } from '@/lib/harvest/resolve'
import type { HarvestMode } from '@/lib/harvest/types'

export async function GET(request: Request) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const mode = (searchParams.get('mode') || 'current') as HarvestMode

  try {
    const { payload, usedDemo } = await resolveHarvestPayload({
      demoMode: access.demoMode,
      fetchLive: () =>
        harvestGetAnalytics({
          mode,
          crop_id: searchParams.get('crop_id') || undefined,
          start_date: searchParams.get('start_date') || undefined,
          end_date: searchParams.get('end_date') || undefined,
        }),
      fetchDemo: () => getDemoAnalytics(mode),
    })

    return harvestJsonResponse(payload, usedDemo)
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
