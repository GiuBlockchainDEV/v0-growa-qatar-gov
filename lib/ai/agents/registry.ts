import type { AgentType } from '@/lib/ai/agents/types'

export interface AgentDefinition {
  type: AgentType
  label: string
  mission: string
  domains: string[]
}

export const AGENT_REGISTRY: Record<AgentType, AgentDefinition> = {
  orchestrator: {
    type: 'orchestrator',
    label: 'AI Orchestrator',
    mission: 'Plan and coordinate specialist agent work.',
    domains: ['all'],
  },
  watchtower_analyst: {
    type: 'watchtower_analyst',
    label: 'Watchtower Analyst',
    mission: 'Interpret national signals and priority changes.',
    domains: ['watchtower', 'signals'],
  },
  agronomy_analyst: {
    type: 'agronomy_analyst',
    label: 'Agronomy Analyst',
    mission: 'Interpret crop health, satellite and growing conditions.',
    domains: ['crop_health', 'satellite', 'production'],
  },
  water_analyst: {
    type: 'water_analyst',
    label: 'Water Intelligence Analyst',
    mission: 'Analyse irrigation demand, intensity and water stress.',
    domains: ['water'],
  },
  energy_analyst: {
    type: 'energy_analyst',
    label: 'Energy Analyst',
    mission: 'Analyse energy consumption and intensity anomalies.',
    domains: ['energy'],
  },
  weather_analyst: {
    type: 'weather_analyst',
    label: 'Weather Analyst',
    mission: 'Interpret climate conditions and short-term risk.',
    domains: ['weather', 'climate'],
  },
  food_security_analyst: {
    type: 'food_security_analyst',
    label: 'Food Security Analyst',
    mission: 'Assess production, supply and coverage implications.',
    domains: ['supply', 'production'],
  },
  supply_analyst: {
    type: 'supply_analyst',
    label: 'Supply Analyst',
    mission: 'Analyse contracts, flows, ETA and availability.',
    domains: ['supply'],
  },
  compliance_analyst: {
    type: 'compliance_analyst',
    label: 'Compliance Analyst',
    mission: 'Review inspections, findings and corrective actions.',
    domains: ['compliance'],
  },
  policy_analyst: {
    type: 'policy_analyst',
    label: 'Policy Analyst',
    mission: 'Compare program objectives with observed outcomes.',
    domains: ['programs'],
  },
  reporting_agent: {
    type: 'reporting_agent',
    label: 'Reporting Agent',
    mission: 'Produce structured institutional reports and briefs.',
    domains: ['reports'],
  },
  data_quality_agent: {
    type: 'data_quality_agent',
    label: 'Data Quality Agent',
    mission: 'Identify missing, stale or contradictory data.',
    domains: ['data_quality'],
  },
}

export function selectAgentsForObjective(objective: string): AgentType[] {
  const text = objective.toLowerCase()
  const agents = new Set<AgentType>(['watchtower_analyst'])

  if (/water|irrigation|et0/i.test(text)) agents.add('water_analyst')
  if (/weather|climate|heat|temperature/i.test(text)) agents.add('weather_analyst')
  if (/crop|ndvi|satellite|harvest|agronom/i.test(text)) agents.add('agronomy_analyst')
  if (/energy|kwh/i.test(text)) agents.add('energy_analyst')
  if (/supply|food|commodity|coverage|security/i.test(text)) agents.add('food_security_analyst')
  if (/shipment|contract|eta|logistics/i.test(text)) agents.add('supply_analyst')
  if (/compliance|inspection|finding/i.test(text)) agents.add('compliance_analyst')
  if (/policy|program/i.test(text)) agents.add('policy_analyst')
  if (/report|brief/i.test(text)) agents.add('reporting_agent')
  if (/data quality|missing data|stale/i.test(text)) agents.add('data_quality_agent')

  agents.add('reporting_agent')
  return Array.from(agents)
}
