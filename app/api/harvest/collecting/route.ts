import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetCollectingEntities } from '@/lib/harvest/client'
import { harvestJsonResponse } from '@/lib/harvest/resolve'

export async function GET() {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  if (access.demoMode) {
    return harvestJsonResponse([], true)
  }

  try {
    const entries = await harvestGetCollectingEntities()
    const results = Array.isArray(entries) ? entries : []
    return harvestJsonResponse(results, false)
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
