import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetTaskStatus } from '@/lib/harvest/client'

interface RouteContext {
  params: Promise<{ taskId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  const { taskId } = await context.params
  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
  }

  try {
    const payload = await harvestGetTaskStatus(taskId)
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
