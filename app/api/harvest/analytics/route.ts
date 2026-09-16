import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse, withDemoHeaders } from '@/lib/harvest/auth'
import { harvestGetAnalytics } from '@/lib/harvest/client'
import { getDemoAnalytics } from '@/lib/harvest/demo-data'
import type { HarvestMode } from '@/lib/harvest/types'

export async function GET(request: Request) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const mode = (searchParams.get('mode') || 'current') as HarvestMode

  if (access.demoMode) {
    return withDemoHeaders(
      NextResponse.json(getDemoAnalytics(mode), {
        headers: { 'Cache-Control': 'no-store' },
      }),
      true
    )
  }

  try {
    const payload = await harvestGetAnalytics({
      mode,
      crop_id: searchParams.get('crop_id') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
    })

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
