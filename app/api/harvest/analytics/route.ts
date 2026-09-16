import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetAnalytics } from '@/lib/harvest/client'

export async function GET(request: Request) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)

  try {
    const payload = await harvestGetAnalytics({
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
