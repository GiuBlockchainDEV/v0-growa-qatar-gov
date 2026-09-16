import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetAnalyticsFields, harvestGetAllFields } from '@/lib/harvest/client'

export async function GET(request: Request) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source') || 'analytics'

  try {
    const payload =
      source === 'all'
        ? await harvestGetAllFields({
            name: searchParams.get('name') || undefined,
            crop_id: searchParams.get('crop_id') || undefined,
            start_date: searchParams.get('start_date') || undefined,
            harvest_date: searchParams.get('harvest_date') || undefined,
            sort_by: searchParams.get('sort_by') || undefined,
            sort_dir: searchParams.get('sort_dir') || undefined,
          })
        : await harvestGetAnalyticsFields({
            mode: searchParams.get('mode') || 'current',
            crop_id: searchParams.get('crop_id') || undefined,
            start_date: searchParams.get('start_date') || undefined,
            end_date: searchParams.get('end_date') || undefined,
            page: searchParams.get('page') || '1',
            perpage: searchParams.get('perpage') || '20',
            sort: searchParams.get('sort') || 'name',
            order: searchParams.get('order') || 'asc',
          })

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
