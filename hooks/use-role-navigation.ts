'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useOrganization } from '@/hooks/use-organization'
import { usePermissions } from '@/hooks/use-permissions'
import { useGovernance } from '@/hooks/use-governance'
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

// Minimal menu for @growa.ai "Normal User" mode.
const normalUserNavigation: MenuItem[] = [
  { key: 'live-map', label: 'Live Map', path: '/dashboard?module=live-map', icon: 'Map' },
  { key: 'rss-feed', label: 'RSS Feed', path: '/dashboard?module=rss-feed', icon: 'Globe' },
  { key: 'data-analytics', label: 'Data Analytics', path: '/dashboard?module=data-analytics', icon: 'BarChart3' },
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

const DATA_ANALYTICS_ITEM: MenuItem = {
  key: 'data-analytics',
  label: 'Data Analytics',
  path: '/dashboard?module=data-analytics',
  icon: 'BarChart3',
}

const WATER_INTELLIGENCE_ITEM: MenuItem = {
  key: 'water-intelligence',
  label: 'Water Intelligence',
  path: '/dashboard?module=water-intelligence',
  icon: 'Droplets',
}

const ENERGY_INTELLIGENCE_ITEM: MenuItem = {
  key: 'energy-intelligence',
  label: 'Energy Intelligence',
  path: '/dashboard?module=energy-intelligence',
  icon: 'Zap',
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

function ensureMenuModule(items: MenuItem[], moduleItem: MenuItem, aliases: string[]): MenuItem[] {
  const normalizedAliases = aliases.map((alias) => alias.trim().toLowerCase())
  const normalizedModuleKey = moduleItem.key.trim().toLowerCase()
  const normalizedModulePath = moduleItem.path.trim().toLowerCase()
  const normalized = items.map((item) => {
    const normalizedKey = item.key?.trim().toLowerCase()
    const normalizedLabel = item.label?.trim().toLowerCase()
    const normalizedPath = item.path?.trim().toLowerCase()
    const isModule =
      normalizedKey === normalizedModuleKey ||
      normalizedPath === normalizedModulePath ||
      normalizedAliases.includes(normalizedKey) ||
      normalizedAliases.includes(normalizedLabel) ||
      normalizedAliases.includes(normalizedPath)

    if (!isModule) return item
    return {
      ...item,
      key: moduleItem.key,
      label: item.label || moduleItem.label,
      path: moduleItem.path,
      icon: item.icon || moduleItem.icon,
    }
  })

  const deduped: MenuItem[] = []
  let hasModule = false
  for (const item of normalized) {
    const isModule = item.key === moduleItem.key || item.path === moduleItem.path
    if (isModule) {
      if (hasModule) continue
      hasModule = true
      deduped.push({
        ...moduleItem,
        ...item,
        key: moduleItem.key,
        path: moduleItem.path,
      })
      continue
    }
    deduped.push(item)
  }

  if (!hasModule) {
    deduped.push(moduleItem)
  }

  return deduped
}

function ensureIntelligenceModules(items: MenuItem[]): MenuItem[] {
  const withDataAnalytics = ensureMenuModule(items, DATA_ANALYTICS_ITEM, [
    'data_analytics',
    'analytics',
    'crop-analytics',
    '/dashboard?module=data_analytics',
    '/dashboard/data-analytics',
  ])
  const withWaterIntelligence = ensureMenuModule(withDataAnalytics, WATER_INTELLIGENCE_ITEM, [
    'water_intelligence',
    'water analytics',
    '/dashboard?module=water_intelligence',
    '/dashboard/water-intelligence',
  ])
  return ensureMenuModule(withWaterIntelligence, ENERGY_INTELLIGENCE_ITEM, [
    'energy_intelligence',
    'energy analytics',
    '/dashboard?module=energy_intelligence',
    '/dashboard/energy-intelligence',
  ])
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

function splitNavigationSections(items: MenuItem[]) {
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

      try {
        setIsLoading(true)
        const supabase = createClient()

        // Resolve role without over-assigning menus:
        // - org role is the baseline
        // - growa.ai can use RPC role only while impersonating
        // - metadata fallback is accepted only when org exists
        const isGrowaAdmin = user.email?.endsWith('@growa.ai') || false
        let currentRole: string | null = organization?.id ? await getUserRole(organization.id) : null
        let isGrowaImpersonating = false

        if (isGrowaAdmin) {
          let roleData: any = null
          // Disambiguate overloaded RPC signatures in mixed DB states.
          const { data: effectiveRoleData, error: effectiveRoleError } = await supabase.rpc(
            'get_effective_role',
            { user_id: user.id }
          )
          const fallbackEffectiveRoleData =
            effectiveRoleError?.code === 'PGRST202' || effectiveRoleError?.code === 'PGRST203'
              ? (await supabase.rpc('get_effective_role')).data
              : null
          roleData = effectiveRoleData?.[0] || fallbackEffectiveRoleData?.[0] || null

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
          isGrowaImpersonating = Boolean(roleData?.is_impersonating)
        }

        // In "Normal User" mode for growa admins, always force a minimal
        // observer menu, regardless of backend membership role.
        if (isGrowaAdmin && !isGrowaImpersonating) {
          const roleAwareItems = ensureIntelligenceModules(normalUserNavigation)
          const { primary, secondary } = splitNavigationSections(roleAwareItems)
          const merged = [...primary, ...secondary]
          setNavigation({
            id: 'normal-user',
            role_name: 'normal_user',
            display_name: 'Normal User',
            landing_page: '/dashboard?module=live-map',
            menu_items: merged,
            primary_items: primary,
            secondary_items: secondary,
            role_profile: null,
            source: 'fallback',
            description: 'Minimal navigation for normal user mode.',
          })
          setPrimaryItems(primary)
          setSecondaryItems(secondary)
          setMenuItems(merged)
          setLandingPage('/dashboard?module=live-map')
          setEffectiveRole('normal_user')
          setRoleProfile(null)
          setSource('fallback')
          return
        }

        if (!currentRole && organization?.id) {
          const metadataRole = user.user_metadata?.role || user.app_metadata?.role
          currentRole = typeof metadataRole === 'string' ? metadataRole : null
        }

        if (!currentRole) {
          const roleAwareItems = ensureIntelligenceModules(unassignedNavigation)
          const { primary, secondary } = splitNavigationSections(roleAwareItems)
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
        const mappedProfile = ministryProfileByRole[mappedRole] || null

        if (mappedProfile) {
          const orgType = organization?.id
            ? await getUserOrgType(organization.id)
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
          const roleAwareItems = ensureIntelligenceModules([...resolvedPrimary, ...resolvedSecondary])
          const { primary, secondary } = splitNavigationSections(roleAwareItems)
          const resolvedMenuItems = [...primary, ...secondary]

          setNavigation({
            id: mappedProfile,
            role_name: mappedRole,
            display_name:
              mappedProfile === 'ministry_admin' ? 'Ministry Admin Workspace' : 'Ministry Inspector Workspace',
            landing_page: resolvedNavigation.landingPage,
            menu_items: resolvedMenuItems,
            primary_items: primary,
            secondary_items: secondary,
            role_profile: mappedProfile,
            source: 'registry',
            description: 'Route-first map-centric sovereign workspace',
          })
          setPrimaryItems(primary)
          setSecondaryItems(secondary)
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
            const roleAwareFallbackItems = ensureIntelligenceModules(fallbackItems)
            const { primary, secondary } = splitNavigationSections(roleAwareFallbackItems)
            setPrimaryItems(primary)
            setSecondaryItems(secondary)
            setMenuItems([...primary, ...secondary])
            setLandingPage(mappedRole === HASSAD_SUPPLY_ROLE ? '/dashboard/supply-overview' : '/dashboard')
            setRoleProfile(null)
            setSource('fallback')
          } else {
            throw fetchError
          }
        } else if (data) {
          // Parse menu_items if it's a string
          const items = typeof data.menu_items === 'string'
            ? JSON.parse(data.menu_items)
            : data.menu_items
          const roleAwareItems = ensureIntelligenceModules(
            mappedRole === HASSAD_SUPPLY_ROLE ? ensureHassadSupplyOverview(items) : items
          )
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
        const roleAwareFallbackItems = ensureIntelligenceModules(defaultNavigation)
        const { primary, secondary } = splitNavigationSections(roleAwareFallbackItems)
        setPrimaryItems(primary)
        setSecondaryItems(secondary)
        setMenuItems([...primary, ...secondary])
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
        const parsed = data?.map(nav => ({
          ...nav,
          menu_items: typeof nav.menu_items === 'string' 
            ? JSON.parse(nav.menu_items) 
            : nav.menu_items
        })) || []

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
