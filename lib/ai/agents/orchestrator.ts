import type {
  AgentMission,
  AgentMissionEvent,
  AgentArtifact,
  ProposedAction,
  CreateMissionRequest,
} from '@/lib/ai/agents/types'
import { AGENT_REGISTRY, selectAgentsForObjective } from '@/lib/ai/agents/registry'
import type { PlatformContext } from '@/lib/domain/platform-context'

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function now() {
  return new Date().toISOString()
}

/**
 * Simulates agentic institutional work using deterministic planning + structured artifacts.
 * LLM synthesis happens in the API route; this layer handles mission structure.
 */
export function planMission(
  request: CreateMissionRequest,
  userId: string,
  organizationId: string
): AgentMission {
  const agents = selectAgentsForObjective(request.objective)
  const missionId = uid('mission')
  const t = now()

  const events: AgentMissionEvent[] = [
    {
      id: uid('evt'),
      timestamp: t,
      agent: 'orchestrator',
      title: 'Mission queued',
      detail: `Objective: ${request.objective}`,
    },
    {
      id: uid('evt'),
      timestamp: t,
      agent: 'orchestrator',
      title: 'Task plan created',
      detail: `Specialists: ${agents.map((a) => AGENT_REGISTRY[a].label).join(', ')}`,
    },
  ]

  return {
    id: missionId,
    taskType: request.taskType || 'investigation',
    objective: request.objective,
    requestedBy: userId,
    organizationId,
    context: (request.context || {}) as PlatformContext,
    status: 'queued',
    assignedAgent: agents[0] || 'watchtower_analyst',
    agentsInvolved: agents,
    inputs: [],
    outputs: [],
    proposedActions: [],
    events,
    createdAt: t,
    updatedAt: t,
  }
}

export function advanceMission(mission: AgentMission, watchtowerDigest?: string): AgentMission {
  const events = [...mission.events]
  const outputs: AgentArtifact[] = [...mission.outputs]
  const proposedActions: ProposedAction[] = [...mission.proposedActions]
  let status = mission.status

  for (const agent of mission.agentsInvolved) {
    if (agent === 'orchestrator') continue
    events.push({
      id: uid('evt'),
      timestamp: now(),
      agent,
      title: `${AGENT_REGISTRY[agent].label} analysis`,
      detail: AGENT_REGISTRY[agent].mission,
      toolName: agent.includes('water') ? 'get_water_metrics' : 'get_watchtower_summary',
    })

    outputs.push({
      id: uid('art'),
      type: `${agent}_assessment`,
      title: `${AGENT_REGISTRY[agent].label} assessment`,
      content: `Analysis prepared by ${AGENT_REGISTRY[agent].label} for: ${mission.objective}. ${
        watchtowerDigest ? 'Grounded in current Watchtower data.' : 'Limited platform data available.'
      }`,
      kind: watchtowerDigest ? 'derived' : 'limitation',
      createdAt: now(),
    })
  }

  events.push({
    id: uid('evt'),
    timestamp: now(),
    agent: 'reporting_agent',
    title: 'Integrated brief created',
    detail: 'Synthesis across specialist agents complete.',
  })

  outputs.push({
    id: uid('art'),
    type: 'investigation_brief',
    title: 'Integrated investigation brief',
    content: watchtowerDigest || `Investigation brief for: ${mission.objective}. Review specialist assessments and proposed actions.`,
    kind: 'interpretation',
    createdAt: now(),
  })

  proposedActions.push({
    id: uid('act'),
    type: 'open_investigation',
    reason: `AI analysis suggests formal investigation for: ${mission.objective}`,
    targetIds: mission.context.farmId ? [mission.context.farmId] : [],
    confidenceLabel: watchtowerDigest ? 'moderate' : 'limited',
    requiresApproval: true,
  })

  status = 'waiting_for_human'

  return {
    ...mission,
    status,
    outputs,
    proposedActions,
    events,
    updatedAt: now(),
  }
}
