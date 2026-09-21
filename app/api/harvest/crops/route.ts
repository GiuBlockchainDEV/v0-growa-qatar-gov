import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetCrops } from '@/lib/harvest/client'
import { getDemoHarvestCrops } from '@/lib/harvest/demo-data'
import { groupOpenFieldCrops } from '@/lib/harvest/crops'
import { harvestJsonResponse, resolveHarvestPayload } from '@/lib/harvest/resolve'

export async function GET() {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  try {
    const { payload, usedDemo } = await resolveHarvestPayload({
      demoMode: access.demoMode,
      fetchLive: () => harvestGetCrops(),
      fetchDemo: () => getDemoHarvestCrops(),
    })

    const crops = Array.isArray(payload) ? payload : []
    return harvestJsonResponse(
      {
        crops,
        groups: groupOpenFieldCrops(crops),
      },
      usedDemo
    )
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
