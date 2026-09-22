import type { PlatformContext } from '@/lib/domain/platform-context'

export type AgentType =
  | 'orchestrator'
  | 'watchtower_analyst'
  | 'agronomy_analyst'
  | 'water_analyst'
  | 'energy_analyst'
  | 'weather_analyst'
  | 'food_security_analyst'
  | 'supply_analyst'
  | 'compliance_analyst'
  | 'policy_analyst'
  | 'reporting_agent'
  | 'data_quality_agent'

export type AgentTaskStatus =
  | 'queued'
  | 'running'
  | 'waiting_for_agent'
  | 'waiting_for_human'
  | 'completed'
  | 'failed'

export type EvidenceKind =
  | 'observed'
  | 'derived'
  | 'interpretation'
  | 'forecast'
  | 'recommendation'
  | 'limitation'

export interface AgentArtifact {
  id: string
  type: string
  title: string
  content: string
  kind: EvidenceKind
  sourceIds?: string[]
  createdAt: string
}

export interface ProposedAction {
  id: string
  type:
    | 'open_investigation'
    | 'create_alert'
    | 'schedule_inspection'
    | 'request_data'
    | 'create_report'
    | 'request_collaboration'
  reason: string
  targetIds: string[]
  confidenceLabel?: 'strong' | 'moderate' | 'limited' | 'insufficient'
  requiresApproval: true
}

export interface AgentMissionEvent {
  id: string
  timestamp: string
  agent: AgentType
  title: string
  detail?: string
  toolName?: string
}

export interface AgentMission {
  id: string
  taskType: string
  objective: string
  requestedBy: string
  organizationId: string
  context: PlatformContext
  status: AgentTaskStatus
  assignedAgent: AgentType
  agentsInvolved: AgentType[]
  inputs: AgentArtifact[]
  outputs: AgentArtifact[]
  proposedActions: ProposedAction[]
  events: AgentMissionEvent[]
  createdAt: string
  updatedAt: string
}

export interface CreateMissionRequest {
  objective: string
  taskType?: string
  context?: Partial<PlatformContext>
}
