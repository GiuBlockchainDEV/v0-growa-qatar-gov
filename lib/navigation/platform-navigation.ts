import { HARVEST_MENU_ITEM, type NavigationMenuItem } from '@/lib/navigation/shared-menu-items'

type MenuItem = NavigationMenuItem

export type PlatformRoleProfile =
  | 'ministry_admin'
  | 'ministry_inspector'
  | 'hassad_supply'
  | 'farm_operations'
  | 'finance'
  | 'default'

const WATCHTOWER_ITEM: MenuItem = {
  key: 'watchtower',
  label: 'National Watchtower',
  path: '/dashboard?module=watchtower',
  icon: 'Radio',
}

const LIVE_MAP: MenuItem = {
  key: 'live-map',
  label: 'Live Map',
  path: '/dashboard?module=live-map',
  icon: 'Map',
}

const FARMS_SITES: MenuItem = {
  key: 'farms-sites',
  label: 'Farms & Sites',
  path: '/dashboard/farms',
  icon: 'Home',
}

const SUPPLY: MenuItem = {
  key: 'supply-overview',
  label: 'Supply Overview',
  path: '/dashboard/supply-overview',
  icon: 'ShoppingCart',
}

const INTELLIGENCE_ITEMS: MenuItem[] = [
  HARVEST_MENU_ITEM,
  { key: 'weather', label: 'Weather', path: '/dashboard?module=weather', icon: 'CloudSun' },
  { key: 'water-intelligence', label: 'Water Intelligence', path: '/dashboard?module=water-intelligence', icon: 'Droplets' },
  { key: 'energy-intelligence', label: 'Energy Intelligence', path: '/dashboard?module=energy-intelligence', icon: 'Zap' },
  { key: 'data-analytics', label: 'Data Analytics', path: '/dashboard?module=data-analytics', icon: 'BarChart3' },
]

const RISK_ITEMS: MenuItem[] = [
  { key: 'alerts-center', label: 'Alerts Center', path: '/dashboard?module=alerts-center', icon: 'AlertTriangle' },
  { key: 'inspection-dashboard', label: 'Inspections', path: '/dashboard?module=inspection-dashboard', icon: 'CheckCircle' },
  { key: 'compliance-inspections', label: 'Compliance', path: '/dashboard?module=compliance-inspections', icon: 'CheckCircle' },
  { key: 'corrective-actions', label: 'Corrective Actions', path: '/dashboard?module=corrective-actions', icon: 'CheckSquare' },
]

const PLATFORM_ITEMS: MenuItem[] = [
  { key: 'settings', label: 'Settings', path: '/dashboard/settings', icon: 'Settings' },
  { key: 'support', label: 'Support', path: '/dashboard/support', icon: 'HelpCircle' },
]

const FEEDS_ITEM: MenuItem = {
  key: 'rss-feed',
  label: 'News / RSS',
  path: '/dashboard?module=rss-feed',
  icon: 'Globe',
}

const PLATFORM_MENUS: Record<PlatformRoleProfile, { landing: string; items: MenuItem[] }> = {
  ministry_admin: {
    landing: '/dashboard?module=watchtower',
    items: [
      WATCHTOWER_ITEM,
      LIVE_MAP,
      FARMS_SITES,
      { key: 'monitoring', label: 'Monitoring', path: '/dashboard?module=monitoring', icon: 'Activity' },
      ...INTELLIGENCE_ITEMS,
      SUPPLY,
      ...RISK_ITEMS,
      { key: 'reports-center', label: 'Reports', path: '/dashboard?module=reports-center', icon: 'BarChart3' },
      FEEDS_ITEM,
      ...PLATFORM_ITEMS,
    ],
  },
  ministry_inspector: {
    landing: '/dashboard?module=watchtower',
    items: [
      { key: 'inspection-dashboard', label: 'Inspection Dashboard', path: '/dashboard?module=inspection-dashboard', icon: 'CheckCircle' },
      WATCHTOWER_ITEM,
      LIVE_MAP,
      FARMS_SITES,
      ...RISK_ITEMS,
      { key: 'evidence-attachments', label: 'Evidence', path: '/dashboard?module=evidence-attachments', icon: 'Paperclip' },
      FEEDS_ITEM,
      ...PLATFORM_ITEMS,
    ],
  },
  hassad_supply: {
    landing: '/dashboard?module=watchtower',
    items: [
      SUPPLY,
      WATCHTOWER_ITEM,
      HARVEST_MENU_ITEM,
      { key: 'data-analytics', label: 'Production Analytics', path: '/dashboard?module=data-analytics', icon: 'BarChart3' },
      LIVE_MAP,
      FEEDS_ITEM,
      ...PLATFORM_ITEMS,
    ],
  },
  farm_operations: {
    landing: '/dashboard?module=watchtower',
    items: [
      FARMS_SITES,
      LIVE_MAP,
      HARVEST_MENU_ITEM,
      { key: 'weather', label: 'Weather', path: '/dashboard?module=weather', icon: 'CloudSun' },
      { key: 'data-analytics', label: 'Analytics', path: '/dashboard?module=data-analytics', icon: 'BarChart3' },
      ...PLATFORM_ITEMS,
    ],
  },
  finance: {
    landing: '/dashboard?module=watchtower',
    items: [
      { key: 'data-analytics', label: 'Data Analytics', path: '/dashboard?module=data-analytics', icon: 'BarChart3' },
      SUPPLY,
      LIVE_MAP,
      ...PLATFORM_ITEMS,
    ],
  },
  default: {
    landing: '/dashboard?module=watchtower',
    items: [LIVE_MAP, HARVEST_MENU_ITEM, ...INTELLIGENCE_ITEMS, FEEDS_ITEM, ...PLATFORM_ITEMS],
  },
}

export function resolvePlatformRoleProfile(
  effectiveRole: string | null,
  roleProfile: string | null
): PlatformRoleProfile {
  if (roleProfile === 'ministry_admin') return 'ministry_admin'
  if (roleProfile === 'ministry_inspector') return 'ministry_inspector'
  if (!effectiveRole) return 'default'

  const role = effectiveRole.toLowerCase()
  if (['sourcing_manager', 'hassad_admin', 'supply_chain_officer'].includes(role)) return 'hassad_supply'
  if (['farm_manager', 'farm_company_admin', 'operator', 'editor'].includes(role)) return 'farm_operations'
  if (['finance_officer', 'credit_analyst', 'qdb_admin'].includes(role)) return 'finance'
  if (['ministry_admin', 'ministry_super_admin', 'admin', 'super_admin'].includes(role)) return 'ministry_admin'
  if (['ministry_officer', 'ministry_inspector'].includes(role)) return 'ministry_inspector'

  return 'default'
}

export function buildPlatformNavigation(
  effectiveRole: string | null,
  roleProfile: string | null
): { landing: string; items: MenuItem[] } {
  const profile = resolvePlatformRoleProfile(effectiveRole, roleProfile)
  const blueprint = PLATFORM_MENUS[profile]

  const seen = new Set<string>()
  const deduped: MenuItem[] = []
  for (const item of blueprint.items) {
    if (seen.has(item.key)) continue
    seen.add(item.key)
    deduped.push(item)
  }

  return { landing: blueprint.landing, items: deduped }
}

export function mergeWithRoleNavigation(
  platformItems: MenuItem[],
  roleItems: MenuItem[]
): MenuItem[] {
  const keys = new Set(platformItems.map((i) => i.key))
  const extras = roleItems.filter((item) => !keys.has(item.key))
  return [...platformItems, ...extras]
}
