import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse, withDemoHeaders } from '@/lib/harvest/auth'
import { harvestGetAnalyticsTimeseries } from '@/lib/harvest/client'
import { getDemoTimeseries } from '@/lib/harvest/demo-data'
import type { HarvestMode } from '@/lib/harvest/types'

export async function GET(request: Request) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const metric = searchParams.get('metric')
  const mode = (searchParams.get('mode') || 'current') as HarvestMode

  if (!metric) {
    return NextResponse.json({ error: 'metric is required' }, { status: 400 })
  }

  if (access.demoMode) {
    return withDemoHeaders(
      NextResponse.json(getDemoTimeseries(mode), {
        headers: { 'Cache-Control': 'no-store' },
      }),
      true
    )
  }

  try {
    const payload = await harvestGetAnalyticsTimeseries({
      metric,
      granularity: searchParams.get('granularity') || 'dekad',
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
