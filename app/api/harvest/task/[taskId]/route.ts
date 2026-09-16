import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { withDemoHeaders } from '@/lib/harvest/resolve'
import { harvestGetTaskStatus } from '@/lib/harvest/client'
import { getDemoTaskStatus } from '@/lib/harvest/demo-data'

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

  if (access.demoMode && taskId.startsWith('demo-yield-')) {
    const completed = getDemoTaskStatus(taskId)
    if (!completed) {
      return NextResponse.json({ error: 'Demo task not found' }, { status: 404 })
    }
    return withDemoHeaders(
      NextResponse.json(completed, {
        headers: { 'Cache-Control': 'no-store' },
      }),
      true
    )
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
