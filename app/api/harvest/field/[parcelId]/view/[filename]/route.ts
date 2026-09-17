import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetFieldViewFile } from '@/lib/harvest/client'
import type { HarvestMode } from '@/lib/harvest/types'

interface RouteContext {
  params: Promise<{ parcelId: string; filename: string }>
}

function resolveContentType(filename: string) {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.jpeg') || lower.endsWith('.jpg')) return 'image/jpeg'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.csv')) return 'text/csv; charset=utf-8'
  return 'application/octet-stream'
}

export async function GET(request: Request, context: RouteContext) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  const { parcelId, filename } = await context.params
  if (!parcelId || !filename) {
    return NextResponse.json({ error: 'parcelId and filename are required' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const mode = (searchParams.get('mode') || 'current') as HarvestMode
  const seasonId = searchParams.get('season_id')

  if (!seasonId) {
    return NextResponse.json({ error: 'season_id is required' }, { status: 400 })
  }

  if (access.demoMode) {
    return NextResponse.json({ error: 'View files are unavailable in demo mode' }, { status: 404 })
  }

  try {
    const buffer = await harvestGetFieldViewFile(mode, parcelId, seasonId, filename)
    if (!buffer.byteLength) {
      return NextResponse.json({ error: 'Empty file response from Harvest API' }, { status: 404 })
    }

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': resolveContentType(filename),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
