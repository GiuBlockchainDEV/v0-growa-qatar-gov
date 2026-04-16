'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useOrganization } from '@/hooks/use-organization'
import { usePermissions } from '@/hooks/use-permissions'
import { useGovernance } from '@/hooks/use-governance'
import { resolveOrganizationType } from '@/lib/supabase/schema-compat'
import {
  Globe, Map, Layers, Sprout, Activity, AlertTriangle, CheckCircle,
  Users, Target, BarChart3, HelpCircle, Settings, LayoutDashboard,
  Navigation, FileText, AlertCircle, CheckSquare, Paperclip,
  TrendingUp, Leaf, Link, ShoppingCart, PieChart, Briefcase,
  DollarSign, Droplets, Wifi, Home, ToggleRight, Clock,
  Terminal, Cpu, Zap, Wrench, BookOpen, Lightbulb, type LucideIcon
} from 'lucide-react'
import {
  buildRoleNavigation,
  type MinistryRoleProfile,
  type PermissionFlag,
  type ResolvedModuleDefinition,
  type SharedLayer,
  type VisibilityLevel,
} from '@/lib/navigation/module-registry'

// Custom Harvest icon since it doesn't exist in lucide
const Harvest = Sprout

export interface MenuItem {
  key: string
  label: string
  path: string
  icon: string
  backendRoute?: string
  section?: 'primary' | 'secondary'
  purpose?: string
  defaultContent?: string
  allowedActions?: string[]
  visibilityScope?: {
    allowedOrgTypes: string[] | '*'
    requiredPermissions: string[]
    requiredLayerVisibility?: Partial<Record<SharedLayer, VisibilityLevel[]>>
  }
  submenu?: Array<{ key: string; label: string }>
}

export interface RoleNavigation {
  id: string
  role_name: string
  display_name: string
  landing_page: string
  menu_items: MenuItem[]
  description: string
  primary_items?: MenuItem[]
  secondary_items?: MenuItem[]
  role_profile?: MinistryRoleProfile | null
  source?: 'registry' | 'database' | 'fallback'
}

type RawMenuItem = Record<string, unknown>

// Map icon names to actual Lucide components
const iconMap: Record<string, LucideIcon> = {
  Globe,
  Map,
  Layers,
  Sprout,
  Activity,
  AlertTriangle,
  CheckCircle,
  Users,
  Target,
  BarChart3,
  HelpCircle,
  Settings,
  LayoutDashboard,
  Navigation,
  FileText,
  AlertCircle,
  CheckSquare,
  Paperclip,
  TrendingUp,
  Leaf,
  Link,
  ShoppingCart,
  PieChart,
  Briefcase,
  DollarSign,
  Droplets,
  Wifi,
  Home,
  ToggleRight,
  Clock,
  Terminal,
  Cpu,
  Zap,
  Wrench,
  BookOpen,
  Lightbulb,
  Harvest,
}

export function getIconComponent(iconName: string): LucideIcon {
  return iconMap[iconName] || HelpCircle
}

// Default navigation for fallback (legacy roles)
const defaultNavigation: MenuItem[] = [
  { key: 'overview', label: 'Overview', path: '/dashboard', icon: 'LayoutDashboard' },
  { key: 'map', label: 'Live Map', path: '/dashboard/map', icon: 'Map' },
  { key: 'monitoring', label: 'Monitoring', path: '/dashboard/monitoring', icon: 'Activity' },
  { key: 'alerts', label: 'Alerts', path: '/dashboard/alerts', icon: 'AlertTriangle' },
  { key: 'reports', label: 'Reports', path: '/dashboard/reports', icon: 'BarChart3' },
  { key: 'support', label: 'Support', path: '/dashboard/support', icon: 'HelpCircle' },
  { key: 'settings', label: 'Settings', path: '/dashboard/settings', icon: 'Settings' },
]

// Minimal navigation for users without organization/role assignment.
const unassignedNavigation: MenuItem[] = [
  { key: 'live-map', label: 'Live Map', path: '/dashboard?module=live-map', icon: 'Map' },
  { key: 'support', label: 'Support', path: '/dashboard/support', icon: 'HelpCircle' },
  { key: 'settings', label: 'Settings', path: '/dashboard/settings', icon: 'Settings' },
]

// Role mapping for legacy roles to new roles
const roleMapping: Record<string, string> = {
  'super_admin': 'ministry_admin',
  'admin': 'ministry_admin',
  'ministry_super_admin': 'ministry_admin',
  'ministry_officer': 'ministry_officer',
  'supply_chain_officer': 'sourcing_manager',
  'hassad_admin': 'sourcing_manager',
  'credit_analyst': 'finance_officer',
  'qdb_admin': 'finance_officer',
  'farm_company_admin': 'farm_manager',
  'editor': 'operator',
  'viewer': 'operator',
  'member': 'operator',
}

const ministryProfileByRole: Record<string, MinistryRoleProfile> = {
  ministry_admin: 'ministry_admin',
  ministry_super_admin: 'ministry_admin',
  ministry_officer: 'ministry_inspector',
}

const SHARED_LAYERS: SharedLayer[] = ['regulatory', 'commercial', 'finance', 'technical_support']
const HASSAD_SUPPLY_ROLE = 'sourcing_manager'

const HASSAD_SUPPLY_OVERVIEW_ITEM: MenuItem = {
  key: 'supply-overview',
  label: 'Supply Overview',
  path: '/dashboard/supply-overview',
  icon: 'ShoppingCart',
}

function ensureHassadSupplyOverview(items: MenuItem[]): MenuItem[] {
  const normalized = items.map((item) => {
    const normalizedLabel = item.label?.trim().toLowerCase()
    const normalizedKey = item.key?.trim().toLowerCase()
    const normalizedPath = item.path?.trim().toLowerCase()
    const pointsToSupplyOverview =
      item.key === 'supply-overview' ||
      normalizedKey === 'supply_overview' ||
      normalizedLabel === 'supply overview' ||
      item.path === '/dashboard/supply-overview' ||
      item.path === '/dashboard?module=supply-overview' ||
      normalizedPath === '/dashboard?module=supply_overview'

    if (!pointsToSupplyOverview) return item

    return {
      ...item,
      key: 'supply-overview',
      label: item.label || HASSAD_SUPPLY_OVERVIEW_ITEM.label,
      path: '/dashboard/supply-overview',
      icon: item.icon || HASSAD_SUPPLY_OVERVIEW_ITEM.icon,
    }
  })

  const deduped: MenuItem[] = []
  let hasSupplyOverview = false
  for (const item of normalized) {
    const isSupplyOverview =
      item.key === 'supply-overview' ||
      item.path === '/dashboard/supply-overview' ||
      item.path === '/dashboard?module=supply-overview'

    if (isSupplyOverview) {
      if (hasSupplyOverview) continue
      hasSupplyOverview = true
      deduped.push({
        ...HASSAD_SUPPLY_OVERVIEW_ITEM,
        ...item,
        key: 'supply-overview',
        path: '/dashboard/supply-overview',
      })
      continue
    }

    deduped.push(item)
  }

  if (!hasSupplyOverview) {
    deduped.unshift(HASSAD_SUPPLY_OVERVIEW_ITEM)
  }

  return deduped
}

function toMenuItem(
  moduleDefinition: ResolvedModuleDefinition,
  section: 'primary' | 'secondary'
): MenuItem {
  return {
    key: moduleDefinition.id,
    label: moduleDefinition.label,
    path: moduleDefinition.href,
    icon: moduleDefinition.icon,
    backendRoute: moduleDefinition.backendRoute,
    section,
    purpose: moduleDefinition.purpose,
    defaultContent: moduleDefinition.defaultContent,
    allowedActions: moduleDefinition.allowedActions,
    visibilityScope: moduleDefinition.visibilityScope,
    submenu: moduleDefinition.submenu,
  }
}

function toLayerVisibilityFallback(
  permissions: Partial<Record<PermissionFlag, boolean>>
): Partial<Record<SharedLayer, VisibilityLevel>> {
  return {
    regulatory: permissions.canViewRegulatory ? 'FULL' : 'NO',
    commercial: permissions.canViewCommercial ? 'FULL' : 'NO',
    finance: permissions.canViewFinance ? 'FULL' : 'NO',
    technical_support: permissions.canViewTechnical ? 'FULL' : 'NO',
  }
}

function splitNavigationSections(items: MenuItem[] = []) {
  const normalizeItemPath = (item: MenuItem): string => {
    if (item.key === 'support') return '/dashboard/support'
    if (item.key === 'settings') return '/dashboard/settings'
    if (item.key === 'supply-overview') return '/dashboard/supply-overview'
    if (item.path === '/dashboard?module=supply-overview') return '/dashboard/supply-overview'
    if (item.path.startsWith('/dashboard?module=')) return item.path
    if (item.path === '/dashboard') return item.path
    if (item.path.startsWith('/dashboard/settings')) return item.path
    if (item.path.startsWith('/dashboard/support')) return item.path
    if (item.path.startsWith('/dashboard/supply-overview')) return item.path
    if (item.path.startsWith('/dashboard')) return `/dashboard?module=${item.key}`
    return item.path
  }

  const settingsAndSupport = items.filter((item) => ['settings', 'support'].includes(item.key))
  const main = items
    .filter((item) => !['settings', 'support'].includes(item.key))
    .map((item) => ({
      ...item,
      // Keep legacy/fallback items on an existing route to avoid 404s
      // when route pages are not implemented yet.
      path: normalizeItemPath(item),
    }))
  const normalizedSettingsAndSupport = settingsAndSupport.map((item) => ({
    ...item,
    path: normalizeItemPath(item),
  }))
  const primary = main.slice(0, 8).map((item) => ({ ...item, section: 'primary' as const }))
  const secondary = [...main.slice(8), ...normalizedSettingsAndSupport].map((item) => ({
    ...item,
    section: 'secondary' as const,
  }))
  return { primary, secondary }
}

function normalizeRawMenuItems(rawItems: unknown): MenuItem[] {
  if (!Array.isArray(rawItems)) return []

  return rawItems
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null
      const raw = entry as RawMenuItem

      const keyFromRow =
        typeof raw.key === 'string'
          ? raw.key
          : typeof raw.id === 'string'
            ? raw.id
            : null

      const labelFromRow =
        typeof raw.label === 'string'
          ? raw.label
          : typeof raw.title === 'string'
            ? raw.title
            : keyFromRow
              ? keyFromRow.replace(/[-_]/g, ' ')
              : `module-${index + 1}`

      const normalizedKey =
        (keyFromRow || labelFromRow || `module-${index + 1}`)
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-')

      const pathFromRow = typeof raw.path === 'string' ? raw.path : undefined
      const hrefFromRow = typeof raw.href === 'string' ? raw.href : undefined
      const normalizedPath = pathFromRow || hrefFromRow || `/dashboard?module=${normalizedKey}`

      const icon =
        typeof raw.icon === 'string' && raw.icon.trim().length > 0
          ? raw.icon
          : 'HelpCircle'

      const submenu = Array.isArray(raw.submenu)
        ? raw.submenu
            .map((item, submenuIndex) => {
              if (!item || typeof item !== 'object') return null
              const rawSub = item as Record<string, unknown>
              const subLabel =
                typeof rawSub.label === 'string'
                  ? rawSub.label
                  : typeof rawSub.title === 'string'
                    ? rawSub.title
                    : `Section ${submenuIndex + 1}`
              const subKey =
                typeof rawSub.key === 'string'
                  ? rawSub.key
                  : typeof rawSub.id === 'string'
                    ? rawSub.id
                    : `${normalizedKey}-section-${submenuIndex + 1}`
              return { key: subKey, label: subLabel }
            })
            .filter((item): item is { key: string; label: string } => Boolean(item))
        : undefined

      return {
        key: normalizedKey,
        label: labelFromRow,
        path: normalizedPath,
        icon,
        backendRoute: typeof raw.backendRoute === 'string' ? raw.backendRoute : undefined,
        purpose: typeof raw.purpose === 'string' ? raw.purpose : undefined,
        defaultContent: typeof raw.defaultContent === 'string' ? raw.defaultContent : undefined,
        allowedActions: Array.isArray(raw.allowedActions)
          ? raw.allowedActions.filter((action): action is string => typeof action === 'string')
          : undefined,
        submenu,
      } as MenuItem
    })
    .filter((item): item is MenuItem => Boolean(item))
}

export function useRoleNavigation() {
  const { user } = useAuth()
  const { organization } = useOrganization()
  const { getUserRole, getUserOrgType, getPermissions } = usePermissions()
  const { getUserVisibility } = useGovernance()
  const [navigation, setNavigation] = useState<RoleNavigation | null>(null)
  const [primaryItems, setPrimaryItems] = useState<MenuItem[]>(defaultNavigation.slice(0, 6))
  const [secondaryItems, setSecondaryItems] = useState<MenuItem[]>(defaultNavigation.slice(6))
  const [menuItems, setMenuItems] = useState<MenuItem[]>(defaultNavigation)
  const [landingPage, setLandingPage] = useState('/dashboard')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [effectiveRole, setEffectiveRole] = useState<string | null>(null)
  const [roleProfile, setRoleProfile] = useState<MinistryRoleProfile | null>(null)
  const [source, setSource] = useState<'registry' | 'database' | 'fallback'>('fallback')

  useEffect(() => {
    async function fetchNavigation() {
      if (!user) {
        setIsLoading(false)
        return
      }

      let mappedRoleForFallback: string | null = null
      try {
        setIsLoading(true)
        setError(null)
        const supabase = createClient()

        // Resolve role without over-assigning menus:
        // - org role is the baseline
        // - growa.ai can use RPC role only while impersonating
        // - metadata fallback is accepted only when org exists
        const isGrowaAdmin = user.email?.endsWith('@growa.ai') || false
        let currentRole: string | null = organization?.id ? await getUserRole(organization.id) : null

        if (isGrowaAdmin) {
          let roleData: any = null
          const { data: effectiveRoleData } = await supabase.rpc('get_effective_role')
          roleData = effectiveRoleData?.[0] || null

          // Fallback to persisted impersonation state if RPC output is empty.
          if (!roleData?.is_impersonating) {
            const { data: impersonationState } = await supabase
              .from('user_impersonation_state')
              .select('role_name, org_id, is_impersonating')
              .eq('user_id', user.id)
              .maybeSingle()
            if (impersonationState?.is_impersonating) {
              roleData = {
                role_name: impersonationState.role_name,
                org_id: impersonationState.org_id,
                is_impersonating: true,
              }
            }
          }

          if (roleData?.is_impersonating && roleData?.role_name) {
            currentRole = roleData.role_name
          }
        }

        if (!currentRole && organization?.id) {
          const metadataRole = user.user_metadata?.role || user.app_metadata?.role
          currentRole = typeof metadataRole === 'string' ? metadataRole : null
        }

        if (!currentRole) {
          const { primary, secondary } = splitNavigationSections(unassignedNavigation)
          setNavigation({
            id: 'unassigned',
            role_name: 'unassigned',
            display_name: 'Unassigned User',
            landing_page: '/dashboard?module=live-map',
            menu_items: [...primary, ...secondary],
            primary_items: primary,
            secondary_items: secondary,
            role_profile: null,
            source: 'fallback',
            description: 'Minimal navigation until role assignment',
          })
          setPrimaryItems(primary)
          setSecondaryItems(secondary)
          setMenuItems([...primary, ...secondary])
          setLandingPage('/dashboard?module=live-map')
          setEffectiveRole(null)
          setRoleProfile(null)
          setSource('fallback')
          return
        }

        setEffectiveRole(currentRole)

        // Map legacy role to role registry namespace if needed
        const mappedRole = roleMapping[currentRole] || currentRole
        mappedRoleForFallback = mappedRole
        const mappedProfile = ministryProfileByRole[mappedRole] || null

        if (mappedProfile) {
          const orgType = organization?.id
            ? await resolveOrganizationType(supabase as any, organization.id)
            : 'government'
          const permissions: Partial<Record<PermissionFlag, boolean>> = organization?.id
            ? ((await getPermissions(organization.id)) as Partial<Record<PermissionFlag, boolean>>)
            : mappedProfile === 'ministry_admin'
              ? {
                  canView: true,
                  canEdit: true,
                  canManageUsers: true,
                  canDeleteOrganization: false,
                  canShareData: true,
                  canViewRegulatory: true,
                  canViewCommercial: true,
                  canViewFinance: true,
                  canViewTechnical: true,
                }
              : {
                  canView: true,
                  canEdit: false,
                  canManageUsers: false,
                  canDeleteOrganization: false,
                  canShareData: false,
                  canViewRegulatory: true,
                  canViewCommercial: true,
                  canViewFinance: false,
                  canViewTechnical: false,
                }
          const fallbackLayerVisibility = toLayerVisibilityFallback(permissions)

          const resolvedLayerVisibility = await Promise.all(
            SHARED_LAYERS.map(async (layer) => {
              try {
                const value = await getUserVisibility(user.id, layer)
                return [layer, value as VisibilityLevel] as const
              } catch {
                return [layer, fallbackLayerVisibility[layer] || 'NO'] as const
              }
            })
          )

          const visibilityByLayer: Partial<Record<SharedLayer, VisibilityLevel>> = {
            ...fallbackLayerVisibility,
            ...Object.fromEntries(resolvedLayerVisibility),
          }

          const resolvedNavigation = buildRoleNavigation(mappedProfile, {
            orgType: orgType as Parameters<typeof buildRoleNavigation>[1]['orgType'],
            permissions,
            visibilityByLayer,
          })

          const resolvedPrimary = resolvedNavigation.primary.map((item) => toMenuItem(item, 'primary'))
          const resolvedSecondary = resolvedNavigation.secondary.map((item) =>
            toMenuItem(item, 'secondary')
          )
          const resolvedMenuItems = [...resolvedPrimary, ...resolvedSecondary]

          setNavigation({
            id: mappedProfile,
            role_name: mappedRole,
            display_name:
              mappedProfile === 'ministry_admin' ? 'Ministry Admin Workspace' : 'Ministry Inspector Workspace',
            landing_page: resolvedNavigation.landingPage,
            menu_items: resolvedMenuItems,
            primary_items: resolvedPrimary,
            secondary_items: resolvedSecondary,
            role_profile: mappedProfile,
            source: 'registry',
            description: 'Route-first map-centric sovereign workspace',
          })
          setPrimaryItems(resolvedPrimary)
          setSecondaryItems(resolvedSecondary)
          setMenuItems(resolvedMenuItems)
          setLandingPage(resolvedNavigation.landingPage)
          setRoleProfile(mappedProfile)
          setSource('registry')
          return
        }

        // Fetch navigation for user's role
        const { data, error: fetchError } = await supabase
          .from('role_navigation')
          .select('*')
          .eq('role_name', mappedRole)
          .single()

        if (fetchError) {
          // If no specific navigation found, use default
          if (fetchError.code === 'PGRST116') {
            const fallbackItems =
              mappedRole === HASSAD_SUPPLY_ROLE
                ? ensureHassadSupplyOverview(defaultNavigation)
                : defaultNavigation
            const { primary, secondary } = splitNavigationSections(fallbackItems)
            const resolvedLandingPage =
              mappedRole === HASSAD_SUPPLY_ROLE ? '/dashboard/supply-overview' : '/dashboard'
            const merged = [...primary, ...secondary]
            setNavigation({
              id: `fallback-${mappedRole}`,
              role_name: mappedRole,
              display_name: mappedRole.replace(/_/g, ' '),
              landing_page: resolvedLandingPage,
              menu_items: merged,
              primary_items: primary,
              secondary_items: secondary,
              role_profile: null,
              source: 'fallback',
              description: 'Fallback navigation when role-specific menu is unavailable.',
            })
            setPrimaryItems(primary)
            setSecondaryItems(secondary)
            setMenuItems(merged)
            setLandingPage(resolvedLandingPage)
            setRoleProfile(null)
            setSource('fallback')
          } else {
            throw fetchError
          }
        } else if (data) {
          // Parse menu_items defensively because legacy rows can contain malformed payloads.
          let parsedRawItems: unknown = data.menu_items
          if (typeof data.menu_items === 'string') {
            try {
              parsedRawItems = JSON.parse(data.menu_items)
            } catch {
              parsedRawItems = []
            }
          }

          const normalizedItems = normalizeRawMenuItems(parsedRawItems)
          const safeItems =
            normalizedItems.length > 0
              ? normalizedItems
              : mappedRole === HASSAD_SUPPLY_ROLE
                ? ensureHassadSupplyOverview(defaultNavigation)
                : defaultNavigation
          const roleAwareItems =
            mappedRole === HASSAD_SUPPLY_ROLE ? ensureHassadSupplyOverview(safeItems) : safeItems
          const { primary, secondary } = splitNavigationSections(roleAwareItems)
          const merged = [...primary, ...secondary]

          setNavigation({
            ...data,
            menu_items: merged,
            primary_items: primary,
            secondary_items: secondary,
            role_profile: null,
            source: 'database',
          })
          setPrimaryItems(primary)
          setSecondaryItems(secondary)
          setMenuItems(merged)
          const dbLandingPage = typeof data.landing_page === 'string' ? data.landing_page : '/dashboard'
          const normalizedLandingPage =
            merged.find((item) => item.path === dbLandingPage)?.path ||
            (dbLandingPage === '/dashboard?module=support'
              ? '/dashboard/support'
              : dbLandingPage === '/dashboard?module=settings'
                ? '/dashboard/settings'
                : dbLandingPage === '/dashboard?module=supply-overview'
                  ? '/dashboard/supply-overview'
                : dbLandingPage.startsWith('/dashboard?module=')
              ? dbLandingPage
              : dbLandingPage.startsWith('/dashboard/settings') ||
                dbLandingPage.startsWith('/dashboard/support') ||
                dbLandingPage.startsWith('/dashboard/supply-overview')
                ? dbLandingPage
                : merged[0]?.path || '/dashboard')
          setLandingPage(
            mappedRole === HASSAD_SUPPLY_ROLE && normalizedLandingPage === '/dashboard'
              ? '/dashboard/supply-overview'
              : normalizedLandingPage
          )
          setRoleProfile(null)
          setSource('database')
        }
      } catch (err) {
        console.error('Error fetching role navigation:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch navigation')
        // Fallback to default navigation
        const fallbackRole = mappedRoleForFallback || effectiveRole
        const fallbackItems = fallbackRole === HASSAD_SUPPLY_ROLE
          ? ensureHassadSupplyOverview(defaultNavigation)
          : defaultNavigation
        const { primary, secondary } = splitNavigationSections(fallbackItems)
        const merged = [...primary, ...secondary]
        const resolvedLandingPage =
          fallbackRole === HASSAD_SUPPLY_ROLE ? '/dashboard/supply-overview' : '/dashboard'
        setNavigation({
          id: 'fallback-default',
          role_name: fallbackRole || 'viewer',
          display_name: fallbackRole ? fallbackRole.replace(/_/g, ' ') : 'Viewer',
          landing_page: resolvedLandingPage,
          menu_items: merged,
          primary_items: primary,
          secondary_items: secondary,
          role_profile: null,
          source: 'fallback',
          description: 'Default fallback navigation due to loading error.',
        })
        setPrimaryItems(primary)
        setSecondaryItems(secondary)
        setMenuItems(merged)
        setLandingPage(resolvedLandingPage)
        setRoleProfile(null)
        setSource('fallback')
      } finally {
        setIsLoading(false)
      }
    }

    fetchNavigation()
  }, [
    user,
    organization?.id,
    getPermissions,
    getUserOrgType,
    getUserRole,
    getUserVisibility,
  ])

  return {
    navigation,
    primaryItems,
    secondaryItems,
    menuItems,
    landingPage,
    isLoading,
    error,
    effectiveRole,
    roleProfile,
    source,
    isMinistryWorkspace: roleProfile !== null,
    getIconComponent,
  }
}

// Hook for admin to manage all role navigations
export function useAllRoleNavigations() {
  const [navigations, setNavigations] = useState<RoleNavigation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAllNavigations() {
      try {
        setIsLoading(true)
        const supabase = createClient()

        const { data, error: fetchError } = await supabase
          .from('role_navigation')
          .select('*')
          .order('role_name')

        if (fetchError) throw fetchError

        // Parse menu_items for each navigation
        const parsed =
          data?.map((nav) => {
            let parsedRawItems: unknown = nav.menu_items
            if (typeof nav.menu_items === 'string') {
              try {
                parsedRawItems = JSON.parse(nav.menu_items)
              } catch {
                parsedRawItems = []
              }
            }

            return {
              ...nav,
              menu_items: normalizeRawMenuItems(parsedRawItems),
            }
          }) || []

        setNavigations(parsed)
      } catch (err) {
        console.error('Error fetching all navigations:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch navigations')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAllNavigations()
  }, [])

  return { navigations, isLoading, error }
}
