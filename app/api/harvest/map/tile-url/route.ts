import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetMapTileUrl } from '@/lib/harvest/client'
import { harvestJsonResponse, resolveHarvestPayload } from '@/lib/harvest/resolve'

const FALLBACK_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

export async function GET() {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  try {
    const { payload, usedDemo } = await resolveHarvestPayload({
      demoMode: access.demoMode,
      fetchLive: () => harvestGetMapTileUrl(),
      fetchDemo: () => ({ url: FALLBACK_TILE_URL }),
      validateLive: (data) => Boolean(data?.url),
    })

    return harvestJsonResponse(
      { url: payload?.url || FALLBACK_TILE_URL },
      usedDemo
    )
  } catch (error) {
    return harvestJsonResponse({ url: FALLBACK_TILE_URL }, true)
  }
}
