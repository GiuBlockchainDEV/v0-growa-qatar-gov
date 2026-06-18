import type { GrowaModule } from './growa-types'

export interface GrowaPromptOption {
  id: string
  label: string
  prompt: string
}

const DATA_ANALYTICS_PROMPTS: GrowaPromptOption[] = [
  {
    id: 'executive-briefing',
    label: 'Executive briefing',
    prompt:
      'Prepare an executive government briefing on national crop production efficiency, resource pressure, and producer performance across all monitored farms in Qatar. Highlight strategic risks and opportunities for food security.',
  },
  {
    id: 'intervention-priority',
    label: 'Intervention priorities',
    prompt:
      'Identify which producers and crop families require immediate government intervention based on efficiency gaps, low polygon scores, and disproportionate resource use relative to production output.',
  },
  {
    id: 'food-security-outlook',
    label: 'Food security outlook',
    prompt:
      'Summarize cross-crop performance trends and their implications for Qatar food security policy. Recommend monitoring priorities for the next reporting cycle.',
  },
]

const WATER_INTELLIGENCE_PROMPTS: GrowaPromptOption[] = [
  {
    id: 'water-policy-briefing',
    label: 'Water policy briefing',
    prompt:
      'Draft a government water resource briefing highlighting irrigation pressure, water intensity by crop, and farms with unsustainable consumption patterns across monitored agricultural operations in Qatar.',
  },
  {
    id: 'conservation-priorities',
    label: 'Conservation priorities',
    prompt:
      'Recommend water conservation and irrigation efficiency priorities for government oversight, focusing on high-intensity crops and producers with elevated water use relative to production.',
  },
  {
    id: 'drought-resilience',
    label: 'Drought resilience',
    prompt:
      'Assess drought and heat-season water resilience across monitored farms. Identify where regulatory or support measures should be strengthened to protect crop yields and national supply stability.',
  },
]

const ENERGY_INTELLIGENCE_PROMPTS: GrowaPromptOption[] = [
  {
    id: 'energy-efficiency-assessment',
    label: 'Energy efficiency assessment',
    prompt:
      'Prepare a government energy efficiency assessment for agricultural operations in Qatar, covering total consumption, energy per ton by crop, and farms with disproportionate energy intensity.',
  },
  {
    id: 'grid-pressure',
    label: 'Grid pressure analysis',
    prompt:
      'Analyze which crops and producers are placing the greatest energy burden on the monitored farm network. Recommend intervention priorities to reduce grid pressure while protecting production.',
  },
  {
    id: 'decarbonization-roadmap',
    label: 'Decarbonization roadmap',
    prompt:
      'Outline a practical decarbonization roadmap for Qatar agricultural producers based on current energy intensity data, distinguishing quick wins from structural upgrades requiring policy support.',
  },
]

const PROMPTS_BY_MODULE: Record<GrowaModule, GrowaPromptOption[]> = {
  'data-analytics': DATA_ANALYTICS_PROMPTS,
  'water-intelligence': WATER_INTELLIGENCE_PROMPTS,
  'energy-intelligence': ENERGY_INTELLIGENCE_PROMPTS,
}

export function getGrowaPrompts(module: GrowaModule): GrowaPromptOption[] {
  return PROMPTS_BY_MODULE[module]
}

export function getGrowaModuleTitle(module: GrowaModule): string {
  switch (module) {
    case 'data-analytics':
      return 'Data Analytics Command'
    case 'water-intelligence':
      return 'Water Intelligence'
    case 'energy-intelligence':
      return 'Energy Intelligence Command'
    default:
      return 'Intelligence Workspace'
  }
}
