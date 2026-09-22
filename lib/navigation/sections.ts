export type NavigationSectionId =
  | 'watchtower'
  | 'operations'
  | 'intelligence'
  | 'food_security'
  | 'risk_compliance'
  | 'collaboration'
  | 'feeds'
  | 'platform'

export interface NavigationSection {
  id: NavigationSectionId
  label: string
  labelAr: string
  moduleKeys: string[]
}

export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: 'watchtower',
    label: 'Watchtower',
    labelAr: 'برج المراقبة',
    moduleKeys: ['watchtower', 'national-overview'],
  },
  {
    id: 'operations',
    label: 'Operations',
    labelAr: 'العمليات',
    moduleKeys: ['live-map', 'map', 'farms-sites', 'monitoring', 'cycles', 'inventory'],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    labelAr: 'الذكاء',
    moduleKeys: [
      'harvest',
      'production-harvest',
      'weather',
      'water-intelligence',
      'energy-intelligence',
      'data-analytics',
    ],
  },
  {
    id: 'food_security',
    label: 'Food Security',
    labelAr: 'الأمن الغذائي',
    moduleKeys: ['supply-overview'],
  },
  {
    id: 'risk_compliance',
    label: 'Risk & Compliance',
    labelAr: 'المخاطر والامتثال',
    moduleKeys: [
      'alerts-center',
      'inspection-dashboard',
      'compliance-inspections',
      'compliance-cases',
      'non-conformities',
      'corrective-actions',
    ],
  },
  {
    id: 'collaboration',
    label: 'Collaboration & Reporting',
    labelAr: 'التعاون والتقارير',
    moduleKeys: ['inter-agency-collaboration', 'reports-center', 'evidence-attachments', 'programs-policy'],
  },
  {
    id: 'feeds',
    label: 'Intelligence Feeds',
    labelAr: 'مصادر المعلومات',
    moduleKeys: ['rss-feed'],
  },
  {
    id: 'platform',
    label: 'Platform',
    labelAr: 'المنصة',
    moduleKeys: ['settings', 'support'],
  },
]

export function getSectionForModuleKey(moduleKey: string): NavigationSectionId {
  for (const section of NAVIGATION_SECTIONS) {
    if (section.moduleKeys.includes(moduleKey)) return section.id
  }
  return 'platform'
}

export function groupMenuItemsBySection<T extends { key: string }>(
  items: T[]
): Array<{ section: NavigationSection; items: T[] }> {
  const grouped = new Map<NavigationSectionId, T[]>()

  for (const item of items) {
    const sectionId = getSectionForModuleKey(item.key)
    if (!grouped.has(sectionId)) grouped.set(sectionId, [])
    grouped.get(sectionId)!.push(item)
  }

  return NAVIGATION_SECTIONS
    .filter((section) => grouped.has(section.id) && grouped.get(section.id)!.length > 0)
    .map((section) => ({
      section,
      items: grouped.get(section.id)!,
    }))
}
