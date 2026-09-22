export type ModuleImplementationStatus = 'live' | 'partial' | 'upcoming'

export interface ModuleStatusDefinition {
  status: ModuleImplementationStatus
  relatedModules: string[]
  description: string
}

const MODULE_STATUS: Record<string, ModuleStatusDefinition> = {
  watchtower: {
    status: 'live',
    relatedModules: ['live-map', 'water-intelligence', 'harvest'],
    description: 'National situational awareness with signals, map, KPIs and AI briefing.',
  },
  'live-map': {
    status: 'live',
    relatedModules: ['watchtower', 'farms-sites'],
    description: 'Spatial operational backbone with farm and field context.',
  },
  'farms-sites': {
    status: 'live',
    relatedModules: ['live-map', 'harvest'],
    description: 'Farm registry with production and location context.',
  },
  harvest: {
    status: 'live',
    relatedModules: ['watchtower', 'data-analytics'],
    description: 'Harvest prediction and parcel intelligence.',
  },
  'production-harvest': {
    status: 'live',
    relatedModules: ['harvest', 'watchtower'],
    description: 'Production and harvest forecasting workspace.',
  },
  weather: {
    status: 'live',
    relatedModules: ['watchtower', 'live-map'],
    description: 'Weather intelligence with grid and point analysis.',
  },
  'water-intelligence': {
    status: 'live',
    relatedModules: ['watchtower', 'energy-intelligence'],
    description: 'Water demand, intensity and irrigation pressure analytics.',
  },
  'energy-intelligence': {
    status: 'live',
    relatedModules: ['water-intelligence', 'data-analytics'],
    description: 'Energy consumption and intensity analytics.',
  },
  'data-analytics': {
    status: 'live',
    relatedModules: ['harvest', 'water-intelligence'],
    description: 'Cross-domain production and resource analytics.',
  },
  'rss-feed': {
    status: 'live',
    relatedModules: ['watchtower'],
    description: 'External agriculture intelligence feeds.',
  },
  'supply-overview': {
    status: 'partial',
    relatedModules: ['watchtower', 'harvest', 'commodities'],
    description: 'Supply chain overview with partial production linkage.',
  },
  commodities: {
    status: 'partial',
    relatedModules: ['supply-overview', 'watchtower', 'data-analytics'],
    description: 'Commodity-centric investigation bridging farms and food security.',
  },
  investigations: {
    status: 'partial',
    relatedModules: ['watchtower', 'alerts-center', 'ai-mission-control'],
    description: 'Operational investigations from signals and cross-domain analysis.',
  },
  'ai-mission-control': {
    status: 'partial',
    relatedModules: ['watchtower', 'investigations'],
    description: 'Agentic AI missions with specialist handoffs and human approval.',
  },
  'data-health': {
    status: 'live',
    relatedModules: ['watchtower'],
    description: 'Platform data coverage and source health monitoring.',
  },
  'alerts-center': {
    status: 'partial',
    relatedModules: ['watchtower', 'inspection-dashboard'],
    description: 'Operational alert lifecycle from Watchtower signals.',
  },
  monitoring: {
    status: 'upcoming',
    relatedModules: ['watchtower', 'live-map'],
    description: 'Sensor and monitoring signal aggregation.',
  },
  'inspection-dashboard': {
    status: 'upcoming',
    relatedModules: ['alerts-center', 'compliance-inspections'],
    description: 'Inspection scheduling and field operations.',
  },
  'compliance-inspections': {
    status: 'upcoming',
    relatedModules: ['inspection-dashboard', 'corrective-actions'],
    description: 'Compliance inspection workflows.',
  },
  'compliance-cases': {
    status: 'upcoming',
    relatedModules: ['compliance-inspections', 'non-conformities'],
    description: 'Compliance case management.',
  },
  'non-conformities': {
    status: 'upcoming',
    relatedModules: ['corrective-actions', 'compliance-cases'],
    description: 'Non-conformity tracking and resolution.',
  },
  'corrective-actions': {
    status: 'upcoming',
    relatedModules: ['alerts-center', 'compliance-inspections'],
    description: 'Corrective action assignment and monitoring.',
  },
  'evidence-attachments': {
    status: 'upcoming',
    relatedModules: ['inspection-dashboard'],
    description: 'Evidence and attachment repository.',
  },
  'inter-agency-collaboration': {
    status: 'upcoming',
    relatedModules: ['reports-center'],
    description: 'Inter-agency collaboration workspace.',
  },
  'reports-center': {
    status: 'upcoming',
    relatedModules: ['watchtower'],
    description: 'Executive reporting from normalized platform data.',
  },
  'programs-policy': {
    status: 'upcoming',
    relatedModules: ['reports-center'],
    description: 'Programs and policy management.',
  },
}

export function getModuleStatus(moduleKey: string): ModuleStatusDefinition {
  const normalized = moduleKey.trim().toLowerCase().replace(/_/g, '-')
  return (
    MODULE_STATUS[normalized] || {
      status: 'upcoming',
      relatedModules: ['watchtower', 'live-map'],
      description: 'This module is registered in navigation but not yet fully integrated.',
    }
  )
}

export function isLiveModule(moduleKey: string): boolean {
  return getModuleStatus(moduleKey).status === 'live'
}
