import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetAnalyticsTimeseries } from '@/lib/harvest/client'

export async function GET(request: Request) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const metric = searchParams.get('metric')
  const granularity = searchParams.get('granularity') || 'dekad'

  if (!metric) {
    return NextResponse.json({ error: 'metric is required' }, { status: 400 })
  }

  try {
    const payload = await harvestGetAnalyticsTimeseries({
      metric,
      granularity,
      mode: searchParams.get('mode') || 'current',
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
