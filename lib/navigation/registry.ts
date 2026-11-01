/**
 * Navigation registry — the single source of truth for the product menu.
 *
 * It replaces four overlapping definitions: `product-navigation.ts` (what the
 * rail showed), `platform-navigation.ts` (a second role→menu map, unused),
 * `module-registry.ts` (permission-filtered menus that no screen displayed)
 * and the hard-coded lists and `ensure*` patches inside `useRoleNavigation`.
 *
 * Everything here is pure: role in, menu out. The hook only resolves the
 * user's role; `buildNavigation()` does the rest and is covered by tests.
 */

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

export interface ProductNavItem {
  key: string
  label: string
  /** Arabic menu label. */
  labelAr?: string
  path: string
  /** Icon name, resolved by `components/platform/nav-icons.ts`. */
  icon: string
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
  { id: 'food_security', label: 'Food security', labelAr: 'الأمن الغذائي' },
  { id: 'risk_response', label: 'Risk and response', labelAr: 'المخاطر والاستجابة' },
  { id: 'governance', label: 'Governance', labelAr: 'الحوكمة' },
  { id: 'ai_operations', label: 'AI operations', labelAr: 'عمليات الذكاء الاصطناعي' },
  { id: 'platform', label: 'Platform', labelAr: 'المنصة' },
]

const NAV: ProductNavItem[] = [
  // WATCHTOWER
  {
    key: 'watchtower',
    label: 'National watchtower',
    labelAr: 'برج المراقبة الوطني',
    path: '/dashboard?module=watchtower',
    icon: 'Radio',
    availability: 'live',
    area: 'watchtower',
  },

  // OPERATIONS
  {
    key: 'live-map',
    label: 'National map',
    labelAr: 'الخريطة الوطنية',
    path: '/dashboard?module=live-map',
    icon: 'Map',
    availability: 'live',
    area: 'operations',
  },
  {
    key: 'farms-sites',
    label: 'Farms & sites',
    labelAr: 'المزارع والمواقع',
    path: '/dashboard/farms',
    icon: 'Home',
    availability: 'partial',
    area: 'operations',
  },
  {
    key: 'harvest',
    label: 'Production',
    labelAr: 'الإنتاج',
    path: '/dashboard?module=harvest',
    icon: 'Harvest',
    availability: 'live',
    area: 'operations',
  },
  {
    key: 'monitoring',
    label: 'Monitoring',
    labelAr: 'الرصد',
    path: '/dashboard?module=monitoring',
    icon: 'Activity',
    availability: 'upcoming',
    area: 'operations',
  },

  // INTELLIGENCE
  {
    key: 'data-analytics',
    label: 'Crop & production',
    labelAr: 'المحاصيل والإنتاج',
    path: '/dashboard?module=data-analytics',
    icon: 'Leaf',
    availability: 'live',
    area: 'intelligence',
  },
  {
    key: 'production-harvest',
    label: 'Satellite & harvest',
    labelAr: 'الأقمار الصناعية والحصاد',
    path: '/dashboard?module=harvest',
    icon: 'Sprout',
    availability: 'live',
    area: 'intelligence',
  },
  {
    key: 'weather',
    label: 'Weather',
    labelAr: 'الطقس',
    path: '/dashboard?module=weather',
    icon: 'CloudSun',
    availability: 'live',
    area: 'intelligence',
  },
  {
    key: 'water-intelligence',
    label: 'Water',
    labelAr: 'المياه',
    path: '/dashboard?module=water-intelligence',
    icon: 'Droplets',
    availability: 'live',
    area: 'intelligence',
  },
  {
    key: 'energy-intelligence',
    label: 'Energy',
    labelAr: 'الطاقة',
    path: '/dashboard?module=energy-intelligence',
    icon: 'Zap',
    availability: 'live',
    area: 'intelligence',
  },
  {
    key: 'cross-analytics',
    label: 'Cross-domain analytics',
    labelAr: 'التحليلات المتقاطعة',
    path: '/dashboard?module=data-analytics',
    icon: 'BarChart3',
    availability: 'live',
    area: 'intelligence',
  },

  // FOOD SECURITY
  {
    key: 'procurement',
    label: 'Procurement',
    labelAr: 'المشتريات',
    path: '/dashboard/procurement',
    icon: 'ShoppingBag',
    availability: 'partial',
    area: 'food_security',
  },
  {
    key: 'logistics',
    label: 'Logistics',
    labelAr: 'الخدمات اللوجستية',
    path: '/dashboard/logistics',
    icon: 'Ship',
    availability: 'partial',
    area: 'food_security',
  },
  {
    key: 'strategic-reserves',
    label: 'Strategic reserves',
    labelAr: 'الاحتياطيات الاستراتيجية',
    path: '/dashboard/reserves',
    icon: 'Warehouse',
    availability: 'partial',
    area: 'food_security',
  },
  {
    key: 'commodities',
    label: 'Commodities',
    labelAr: 'السلع',
    path: '/dashboard?module=commodities',
    icon: 'PieChart',
    availability: 'partial',
    area: 'food_security',
  },
  {
    key: 'forecast-resilience',
    label: 'Forecast & resilience',
    labelAr: 'التنبؤ والمرونة',
    path: '/dashboard?module=forecast-resilience',
    icon: 'TrendingUp',
    availability: 'upcoming',
    area: 'food_security',
  },

  // RISK & RESPONSE
  {
    key: 'alerts-center',
    label: 'Signals & alerts',
    labelAr: 'الإشارات والتنبيهات',
    path: '/dashboard?module=alerts-center',
    icon: 'AlertTriangle',
    availability: 'partial',
    area: 'risk_response',
  },
  {
    key: 'investigations',
    label: 'Investigations',
    labelAr: 'التحقيقات',
    path: '/dashboard?module=investigations',
    icon: 'Search',
    availability: 'partial',
    area: 'risk_response',
  },
  {
    key: 'inspection-dashboard',
    label: 'Inspections',
    labelAr: 'عمليات التفتيش',
    path: '/dashboard?module=inspection-dashboard',
    icon: 'CheckCircle',
    availability: 'partial',
    area: 'risk_response',
  },
  {
    key: 'compliance-inspections',
    label: 'Compliance',
    labelAr: 'الامتثال',
    path: '/dashboard?module=compliance-inspections',
    icon: 'Shield',
    availability: 'partial',
    area: 'risk_response',
  },
  {
    key: 'corrective-actions',
    label: 'Corrective actions',
    labelAr: 'الإجراءات التصحيحية',
    path: '/dashboard?module=corrective-actions',
    icon: 'CheckSquare',
    availability: 'upcoming',
    area: 'risk_response',
  },

  // GOVERNANCE
  {
    key: 'programs-policy',
    label: 'Programs & policy',
    labelAr: 'البرامج والسياسات',
    path: '/dashboard?module=programs-policy',
    icon: 'Target',
    availability: 'upcoming',
    area: 'governance',
  },
  {
    key: 'inter-agency-collaboration',
    label: 'Inter-agency',
    labelAr: 'التعاون بين الجهات',
    path: '/dashboard?module=inter-agency-collaboration',
    icon: 'Users',
    availability: 'upcoming',
    area: 'governance',
  },
  {
    key: 'reports-center',
    label: 'Reports',
    labelAr: 'التقارير',
    path: '/dashboard?module=reports-center',
    icon: 'FileText',
    availability: 'upcoming',
    area: 'governance',
  },
  {
    key: 'evidence-attachments',
    label: 'Evidence',
    labelAr: 'الأدلة',
    path: '/dashboard?module=evidence-attachments',
    icon: 'Paperclip',
    availability: 'upcoming',
    area: 'governance',
  },

  // AI OPERATIONS
  {
    key: 'ai-mission-control',
    label: 'AI mission control',
    labelAr: 'مركز مهام الذكاء الاصطناعي',
    path: '/dashboard?module=ai-mission-control',
    icon: 'Cpu',
    availability: 'partial',
    area: 'ai_operations',
  },
  {
    key: 'ai-briefings',
    label: 'Briefings',
    labelAr: 'الإحاطات',
    path: '/dashboard?module=watchtower',
    icon: 'Bot',
    availability: 'partial',
    area: 'ai_operations',
  },

  // PLATFORM
  {
    key: 'organizations',
    label: 'Organizations',
    labelAr: 'المؤسسات',
    path: '/dashboard/settings/organizations',
    icon: 'Building2',
    availability: 'live',
    area: 'platform',
  },
  {
    key: 'users-roles',
    label: 'Users & roles',
    labelAr: 'المستخدمون والأدوار',
    path: '/dashboard/team',
    icon: 'Users',
    availability: 'live',
    area: 'platform',
  },
  {
    key: 'invitations',
    label: 'Invitations',
    labelAr: 'الدعوات',
    path: '/dashboard/invitations',
    icon: 'Mail',
    availability: 'live',
    area: 'platform',
  },
  {
    key: 'access-permissions',
    label: 'Access & permissions',
    labelAr: 'الوصول والصلاحيات',
    path: '/dashboard/access',
    icon: 'KeyRound',
    availability: 'live',
    area: 'platform',
  },
  {
    key: 'my-profile',
    label: 'My profile',
    labelAr: 'ملفي الشخصي',
    path: '/dashboard/account',
    icon: 'UserCircle',
    availability: 'live',
    area: 'platform',
  },
  {
    key: 'security-audit',
    label: 'Security & audit',
    labelAr: 'الأمن والتدقيق',
    path: '/dashboard/audit',
    icon: 'ShieldCheck',
    availability: 'live',
    area: 'platform',
  },
  {
    key: 'data-sharing',
    label: 'Data sharing',
    labelAr: 'مشاركة البيانات',
    path: '/dashboard/settings/data-sharing',
    icon: 'Share2',
    availability: 'partial',
    area: 'platform',
  },
  {
    key: 'data-health',
    label: 'Data health',
    labelAr: 'سلامة البيانات',
    path: '/dashboard?module=data-health',
    icon: 'Activity',
    availability: 'partial',
    area: 'platform',
  },
  {
    key: 'settings',
    label: 'Settings',
    labelAr: 'الإعدادات',
    path: '/dashboard/settings',
    icon: 'Settings',
    availability: 'live',
    area: 'platform',
  },
]

/* ------------------------------------------------------------------ *
 * Roles
 * ------------------------------------------------------------------ */

export type PlatformRoleProfile =
  | 'ministry_admin'
  | 'ministry_inspector'
  | 'hassad_supply'
  | 'farm_operations'
  | 'finance'
  | 'default'

/** Ministry workspaces: the only roles with a named profile of their own. */
export type MinistryRoleProfile = 'ministry_admin' | 'ministry_inspector'

/** Legacy role names folded onto the current ones. */
const ROLE_ALIASES: Record<string, string> = {
  super_admin: 'ministry_admin',
  admin: 'ministry_admin',
  ministry_super_admin: 'ministry_admin',
  supply_chain_officer: 'sourcing_manager',
  hassad_admin: 'sourcing_manager',
  credit_analyst: 'finance_officer',
  qdb_admin: 'finance_officer',
  farm_company_admin: 'farm_manager',
  editor: 'operator',
  viewer: 'operator',
  member: 'operator',
}

const MINISTRY_PROFILE_BY_ROLE: Record<string, MinistryRoleProfile> = {
  ministry_admin: 'ministry_admin',
  ministry_officer: 'ministry_inspector',
}

/** The ministry profile of a raw role (after aliases), if it has one. */
export function ministryProfileForRole(role: string | null | undefined): MinistryRoleProfile | null {
  if (!role) return null
  const mapped = ROLE_ALIASES[role] || role
  return MINISTRY_PROFILE_BY_ROLE[mapped] ?? null
}

/** Which menu a role gets. */
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

export const ROLE_NAV_KEYS: Record<PlatformRoleProfile, string[]> = {
  ministry_admin: [
    'watchtower', 'live-map', 'farms-sites', 'harvest', 'monitoring',
    'data-analytics', 'production-harvest', 'weather', 'water-intelligence', 'energy-intelligence', 'cross-analytics',
    'procurement', 'logistics', 'strategic-reserves', 'commodities', 'forecast-resilience',
    'alerts-center', 'investigations', 'inspection-dashboard', 'compliance-inspections', 'corrective-actions',
    'programs-policy', 'inter-agency-collaboration', 'reports-center', 'evidence-attachments',
    'ai-mission-control', 'ai-briefings',
    'organizations', 'users-roles', 'invitations', 'access-permissions', 'my-profile', 'security-audit',
    'data-sharing', 'data-health', 'settings',
  ],
  ministry_inspector: [
    'inspection-dashboard', 'watchtower', 'live-map', 'farms-sites',
    'alerts-center', 'investigations', 'compliance-inspections', 'corrective-actions', 'evidence-attachments',
    'ai-mission-control',
    'settings',
  ],
  hassad_supply: [
    'procurement', 'logistics', 'strategic-reserves', 'commodities', 'forecast-resilience',
    'watchtower', 'harvest', 'data-analytics',
    'live-map', 'ai-mission-control',
    'users-roles', 'invitations', 'access-permissions', 'my-profile', 'settings',
  ],
  farm_operations: [
    'farms-sites', 'live-map', 'harvest', 'monitoring',
    'weather', 'data-analytics', 'water-intelligence',
    'alerts-center', 'users-roles', 'invitations', 'my-profile', 'settings',
  ],
  finance: [
    'data-analytics', 'cross-analytics', 'procurement', 'logistics', 'strategic-reserves', 'reports-center', 'settings',
  ],
  default: [
    'live-map', 'watchtower', 'harvest', 'weather', 'water-intelligence', 'energy-intelligence',
    'data-analytics', 'settings',
  ],
}

const ROLE_LANDINGS: Record<PlatformRoleProfile, string> = {
  ministry_admin: '/dashboard?module=watchtower',
  ministry_inspector: '/dashboard?module=watchtower',
  hassad_supply: '/dashboard?module=watchtower',
  farm_operations: '/dashboard?module=watchtower',
  finance: '/dashboard?module=watchtower',
  default: '/dashboard?module=watchtower',
}

export type ProductNavigation = ReturnType<typeof buildNavigation>

export function buildNavigation(
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

/* ------------------------------------------------------------------ *
 * Lookups
 * ------------------------------------------------------------------ */

export function getNavItem(key: string): ProductNavItem | undefined {
  return NAV.find((item) => item.key === key)
}


/** Menu label in the interface language (falls back to English). */
export function navItemLabel(item: { label: string; labelAr?: string }, locale: string) {
  return locale === 'ar' && item.labelAr ? item.labelAr : item.label
}

/** Every menu item (for tests and tooling). */
export function allNavItems(): readonly ProductNavItem[] {
  return NAV
}

const HARVEST_MODULE_ALIASES = [
  'production-harvest',
  'production_harvest',
  'production & harvest',
  'harvest prediction',
  'harvest-forecast',
  '/dashboard?module=production-harvest',
]

/** The harvest workspace answers to several historical keys. */
export function isHarvestModuleKey(moduleKey: string | null | undefined): boolean {
  if (!moduleKey) return false
  const normalized = moduleKey.trim().toLowerCase()
  return normalized === 'harvest' || HARVEST_MODULE_ALIASES.includes(normalized)
}
