/**
 * Permissioned agent tools — server-side only.
 * Each tool must enforce the same RLS boundaries as the user session.
 */

export const AGENT_TOOL_NAMES = [
  'get_farms',
  'get_farm',
  'get_weather',
  'get_water_metrics',
  'get_energy_metrics',
  'get_active_signals',
  'get_alerts',
  'get_watchtower_summary',
  'get_data_quality',
  'get_supply_position',
] as const

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number]

export interface AgentToolDefinition {
  name: AgentToolName
  description: string
  requiredPermission?: string
}

export const AGENT_TOOLS: Record<AgentToolName, AgentToolDefinition> = {
  get_farms: { name: 'get_farms', description: 'List farms visible to the user.' },
  get_farm: { name: 'get_farm', description: 'Get farm intelligence for one farm.' },
  get_weather: { name: 'get_weather', description: 'Get weather for coordinates.' },
  get_water_metrics: { name: 'get_water_metrics', description: 'Get water intelligence aggregates.' },
  get_energy_metrics: { name: 'get_energy_metrics', description: 'Get energy intelligence aggregates.' },
  get_active_signals: { name: 'get_active_signals', description: 'Get Watchtower priority signals.' },
  get_alerts: { name: 'get_alerts', description: 'Get operational alerts for the organization.' },
  get_watchtower_summary: { name: 'get_watchtower_summary', description: 'Get national Watchtower summary.' },
  get_data_quality: { name: 'get_data_quality', description: 'Get data quality and source health.' },
  get_supply_position: { name: 'get_supply_position', description: 'Get supply overview snapshots.' },
}
