/**
 * Growa Qatar v2 product navigation — seven areas + platform.
 * Single source of truth for information architecture.
 */

import type { NavigationMenuItem } from '@/lib/navigation/shared-menu-items'
import type { PlatformRoleProfile } from '@/lib/navigation/platform-navigation'
import { resolvePlatformRoleProfile } from '@/lib/navigation/platform-navigation'

export type ProductAreaId =
  | 'watchtower'
  | 'operations'
  | 'intelligence'
  | 'food_security'
  | 'risk_response'
  | 'governance'
  | 'ai_operations'
  | 'platform'

export type ModuleAvailability = 'live' | 'partial' | 'upcoming'

export interface ProductNavItem extends NavigationMenuItem {
  availability: ModuleAvailability
  area: ProductAreaId
}

export interface ProductArea {
  id: ProductAreaId
  label: string
  labelAr: string
}

export const PRODUCT_AREAS: ProductArea[] = [
  { id: 'watchtower', label: 'Watchtower', labelAr: 'برج المراقبة' },
  { id: 'operations', label: 'Operations', labelAr: 'العمليات' },
  { id: 'intelligence', label: 'Intelligence', labelAr: 'الذكاء' },
  { id: 'food_security', label: 'Food Security', labelAr: 'الأمن الغذائي' },
  { id: 'risk_response', label: 'Risk & Response', labelAr: 'المخاطر والاستجابة' },
  { id: 'governance', label: 'Governance', labelAr: 'الحوكمة' },
  { id: 'ai_operations', label: 'AI Operations', labelAr: 'عمليات الذكاء الاصطناعي' },
  { id: 'platform', label: 'Platform', labelAr: 'المنصة' },
]

const NAV: ProductNavItem[] = [
  // WATCHTOWER
  {
    key: 'watchtower',
    label: 'National Watchtower',
    path: '/dashboard?module=watchtower',
    icon: 'Radio',
    availability: 'live',
    area: 'watchtower',
  },

  // OPERATIONS
  {
    key: 'live-map',
    label: 'National Map',
    path: '/dashboard?module=live-map',
    icon: 'Map',
    availability: 'live',
    area: 'operations',
  },
  {
    key: 'farms-sites',
    label: 'Farms & Sites',
    path: '/dashboard/farms',
    icon: 'Home',
    availability: 'partial',
    area: 'operations',
  },
  {
    key: 'harvest',
    label: 'Production',
    path: '/dashboard?module=harvest',
    icon: 'Harvest',
    availability: 'live',
    area: 'operations',
  },
  {
    key: 'monitoring',
    label: 'Monitoring',
    path: '/dashboard?module=monitoring',
    icon: 'Activity',
    availability: 'upcoming',
    area: 'operations',
  },

  // INTELLIGENCE
  {
    key: 'data-analytics',
    label: 'Crop & Production',
    path: '/dashboard?module=data-analytics',
    icon: 'Leaf',
    availability: 'live',
    area: 'intelligence',
  },
  {
    key: 'production-harvest',
    label: 'Satellite & Harvest',
    path: '/dashboard?module=harvest',
    icon: 'Sprout',
    availability: 'live',
    area: 'intelligence',
  },
  {
    key: 'weather',
    label: 'Weather',
    path: '/dashboard?module=weather',
    icon: 'CloudSun',
    availability: 'live',
    area: 'intelligence',
  },
  {
    key: 'water-intelligence',
    label: 'Water',
    path: '/dashboard?module=water-intelligence',
    icon: 'Droplets',
    availability: 'live',
    area: 'intelligence',
  },
  {
    key: 'energy-intelligence',
    label: 'Energy',
    path: '/dashboard?module=energy-intelligence',
    icon: 'Zap',
    availability: 'live',
    area: 'intelligence',
  },
  {
    key: 'cross-analytics',
    label: 'Cross-Domain Analytics',
    path: '/dashboard?module=data-analytics',
    icon: 'BarChart3',
    availability: 'live',
    area: 'intelligence',
  },

  // FOOD SECURITY
  {
    key: 'supply-overview',
    label: 'Supply Position',
    path: '/dashboard/supply-overview',
    icon: 'ShoppingCart',
    availability: 'partial',
    area: 'food_security',
  },
  {
    key: 'commodities',
    label: 'Commodities',
    path: '/dashboard?module=commodities',
    icon: 'PieChart',
    availability: 'partial',
    area: 'food_security',
  },
  {
    key: 'forecast-resilience',
    label: 'Forecast & Resilience',
    path: '/dashboard?module=forecast-resilience',
    icon: 'TrendingUp',
    availability: 'upcoming',
    area: 'food_security',
  },

  // RISK & RESPONSE
  {
    key: 'alerts-center',
    label: 'Signals & Alerts',
    path: '/dashboard?module=alerts-center',
    icon: 'AlertTriangle',
    availability: 'partial',
    area: 'risk_response',
  },
  {
    key: 'investigations',
    label: 'Investigations',
    path: '/dashboard?module=investigations',
    icon: 'Search',
    availability: 'partial',
    area: 'risk_response',
  },
  {
    key: 'inspection-dashboard',
    label: 'Inspections',
    path: '/dashboard?module=inspection-dashboard',
    icon: 'CheckCircle',
    availability: 'partial',
    area: 'risk_response',
  },
  {
    key: 'compliance-inspections',
    label: 'Compliance',
    path: '/dashboard?module=compliance-inspections',
    icon: 'Shield',
    availability: 'partial',
    area: 'risk_response',
  },
  {
    key: 'corrective-actions',
    label: 'Corrective Actions',
    path: '/dashboard?module=corrective-actions',
    icon: 'CheckSquare',
    availability: 'upcoming',
    area: 'risk_response',
  },

  // GOVERNANCE
  {
    key: 'programs-policy',
    label: 'Programs & Policy',
    path: '/dashboard?module=programs-policy',
    icon: 'Target',
    availability: 'upcoming',
    area: 'governance',
  },
  {
    key: 'inter-agency-collaboration',
    label: 'Inter-Agency',
    path: '/dashboard?module=inter-agency-collaboration',
    icon: 'Users',
    availability: 'upcoming',
    area: 'governance',
  },
  {
    key: 'reports-center',
    label: 'Reports',
    path: '/dashboard?module=reports-center',
    icon: 'FileText',
    availability: 'upcoming',
    area: 'governance',
  },
  {
    key: 'evidence-attachments',
    label: 'Evidence',
    path: '/dashboard?module=evidence-attachments',
    icon: 'Paperclip',
    availability: 'upcoming',
    area: 'governance',
  },

  // AI OPERATIONS
  {
    key: 'ai-mission-control',
    label: 'AI Mission Control',
    path: '/dashboard?module=ai-mission-control',
    icon: 'Cpu',
    availability: 'partial',
    area: 'ai_operations',
  },
  {
    key: 'ai-briefings',
    label: 'Briefings',
    path: '/dashboard?module=watchtower',
    icon: 'Bot',
    availability: 'partial',
    area: 'ai_operations',
  },

  // PLATFORM
  {
    key: 'organizations',
    label: 'Organizations',
    path: '/dashboard/settings/organizations',
    icon: 'Building2',
    availability: 'live',
    area: 'platform',
  },
  {
    key: 'users-roles',
    label: 'Users & Roles',
    path: '/dashboard/team',
    icon: 'Users',
    availability: 'live',
    area: 'platform',
  },
  {
    key: 'data-sharing',
    label: 'Data Sharing',
    path: '/dashboard/settings/data-sharing',
    icon: 'Share2',
    availability: 'partial',
    area: 'platform',
  },
  {
    key: 'data-health',
    label: 'Data Health',
    path: '/dashboard?module=data-health',
    icon: 'Activity',
    availability: 'partial',
    area: 'platform',
  },
  {
    key: 'settings',
    label: 'Settings',
    path: '/dashboard/settings',
    icon: 'Settings',
    availability: 'live',
    area: 'platform',
  },
]

const ROLE_NAV_KEYS: Record<PlatformRoleProfile, string[]> = {
  ministry_admin: [
    'watchtower', 'live-map', 'farms-sites', 'harvest', 'monitoring',
    'data-analytics', 'production-harvest', 'weather', 'water-intelligence', 'energy-intelligence', 'cross-analytics',
    'supply-overview', 'commodities', 'forecast-resilience',
    'alerts-center', 'investigations', 'inspection-dashboard', 'compliance-inspections', 'corrective-actions',
    'programs-policy', 'inter-agency-collaboration', 'reports-center', 'evidence-attachments',
    'ai-mission-control', 'ai-briefings',
    'organizations', 'users-roles', 'data-sharing', 'data-health', 'settings',
  ],
  ministry_inspector: [
    'inspection-dashboard', 'watchtower', 'live-map', 'farms-sites',
    'alerts-center', 'investigations', 'compliance-inspections', 'corrective-actions', 'evidence-attachments',
    'ai-mission-control',
    'settings',
  ],
  hassad_supply: [
    'supply-overview', 'commodities', 'forecast-resilience',
    'watchtower', 'harvest', 'data-analytics',
    'live-map', 'ai-mission-control', 'settings',
  ],
  farm_operations: [
    'farms-sites', 'live-map', 'harvest', 'monitoring',
    'weather', 'data-analytics', 'water-intelligence',
    'alerts-center', 'settings',
  ],
  finance: [
    'data-analytics', 'cross-analytics', 'supply-overview', 'reports-center', 'settings',
  ],
  default: [
    'live-map', 'watchtower', 'harvest', 'weather', 'water-intelligence', 'energy-intelligence',
    'data-analytics', 'settings',
  ],
}

const ROLE_LANDINGS: Record<PlatformRoleProfile, string> = {
  ministry_admin: '/dashboard?module=watchtower',
  ministry_inspector: '/dashboard?module=inspection-dashboard',
  hassad_supply: '/dashboard/supply-overview',
  farm_operations: '/dashboard/farms',
  finance: '/dashboard?module=data-analytics',
  default: '/dashboard?module=live-map',
}

export function buildProductNavigation(
  effectiveRole: string | null,
  roleProfile: string | null
): {
  landing: string
  areas: ProductArea[]
  items: ProductNavItem[]
  grouped: Array<{ area: ProductArea; items: ProductNavItem[] }>
} {
  const profile = resolvePlatformRoleProfile(effectiveRole, roleProfile)
  const allowedKeys = new Set(ROLE_NAV_KEYS[profile])
  const items = NAV.filter((item) => allowedKeys.has(item.key))

  const grouped = PRODUCT_AREAS
    .map((area) => ({
      area,
      items: items.filter((item) => item.area === area.id),
    }))
    .filter((g) => g.items.length > 0)

  return {
    landing: ROLE_LANDINGS[profile],
    areas: PRODUCT_AREAS,
    items,
    grouped,
  }
}

export function getProductNavItem(key: string): ProductNavItem | undefined {
  return NAV.find((item) => item.key === key)
}
