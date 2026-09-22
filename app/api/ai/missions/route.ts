import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { planMission, advanceMission } from '@/lib/ai/agents/orchestrator'
import type { AgentMission, CreateMissionRequest } from '@/lib/ai/agents/types'
import { buildWatchtowerGrowaDigest } from '@/lib/ai/build-watchtower-growa-context'

export const dynamic = 'force-dynamic'

function rowToMission(row: Record<string, unknown>): AgentMission {
  return {
    id: String(row.id),
    taskType: String(row.task_type || 'investigation'),
    objective: String(row.objective),
    requestedBy: String(row.requested_by),
    organizationId: String(row.organization_id),
    context: (row.context as AgentMission['context']) || {},
    status: row.status as AgentMission['status'],
    assignedAgent: row.assigned_agent as AgentMission['assignedAgent'],
    agentsInvolved: (row.agents_involved as AgentMission['agentsInvolved']) || [],
    inputs: (row.inputs as AgentMission['inputs']) || [],
    outputs: (row.outputs as AgentMission['outputs']) || [],
    proposedActions: (row.proposed_actions as AgentMission['proposedActions']) || [],
    events: (row.events as AgentMission['events']) || [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('agent_missions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    if (error.message.includes('does not exist')) {
      return NextResponse.json({ missions: [], unavailable: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ missions: (data || []).map(rowToMission) })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateMissionRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const objective = typeof body.objective === 'string' ? body.objective.trim() : ''
  if (!objective) {
    return NextResponse.json({ error: 'objective is required' }, { status: 400 })
  }

  const { data: membership } = await supabase
    .from('user_organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const organizationId = membership?.organization_id
  if (!organizationId) {
    return NextResponse.json({ error: 'No organization membership' }, { status: 403 })
  }

  let planned = planMission(body, user.id, organizationId)
  planned = { ...planned, status: 'running' }

  let watchtowerDigest: string | undefined
  try {
    const wtRes = await fetch(new URL('/api/watchtower/summary?timeframe=7d', request.url), {
      headers: { cookie: request.headers.get('cookie') || '' },
    })
    if (wtRes.ok) {
      const summary = await wtRes.json()
      watchtowerDigest = buildWatchtowerGrowaDigest(summary).slice(0, 2000)
    }
  } catch {
    watchtowerDigest = undefined
  }

  const completed = advanceMission(planned, watchtowerDigest)

  const payload = {
    organization_id: organizationId,
    requested_by: user.id,
    task_type: completed.taskType,
    objective: completed.objective,
    status: completed.status,
    assigned_agent: completed.assignedAgent,
    agents_involved: completed.agentsInvolved,
    context: completed.context,
    inputs: completed.inputs,
    outputs: completed.outputs,
    proposed_actions: completed.proposedActions,
    events: completed.events,
  }

  const { data, error } = await supabase
    .from('agent_missions')
    .insert(payload)
    .select()
    .single()

  if (error) {
    if (error.message.includes('does not exist')) {
      return NextResponse.json({
        mission: { ...completed, id: `local_${Date.now()}` },
        unavailable: true,
        warning: 'agent_missions table not migrated — mission not persisted',
      }, { status: 201 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ mission: rowToMission(data as Record<string, unknown>) }, { status: 201 })
}
