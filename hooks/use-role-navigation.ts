'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  Globe, Map, Layers, Sprout, Activity, AlertTriangle, CheckCircle,
  Users, Target, BarChart3, HelpCircle, Settings, LayoutDashboard,
  Navigation, FileText, AlertCircle, CheckSquare, Paperclip,
  TrendingUp, Leaf, Link, ShoppingCart, PieChart, Briefcase,
  DollarSign, Droplets, Wifi, Home, ToggleRight, Clock,
  Terminal, Cpu, Zap, Wrench, BookOpen, Lightbulb, type LucideIcon
} from 'lucide-react'

// Custom Harvest icon since it doesn't exist in lucide
const Harvest = Sprout

export interface MenuItem {
  key: string
  label: string
  path: string
  icon: string
}

export interface RoleNavigation {
  id: string
  role_name: string
  display_name: string
  landing_page: string
  menu_items: MenuItem[]
  description: string
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

// Role mapping for legacy roles to new roles
const roleMapping: Record<string, string> = {
  'super_admin': 'ministry_admin',
  'admin': 'ministry_admin',
  'ministry_super_admin': 'ministry_admin',
  'ministry_officer': 'ministry_inspector',
  'supply_chain_officer': 'sourcing_manager',
  'hassad_admin': 'sourcing_manager',
  'credit_analyst': 'finance_officer',
  'qdb_admin': 'finance_officer',
  'farm_company_admin': 'farm_manager',
  'editor': 'operator',
  'viewer': 'operator',
  'member': 'operator',
}

export function useRoleNavigation() {
  const { user, userRole } = useAuth()
  const [navigation, setNavigation] = useState<RoleNavigation | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>(defaultNavigation)
  const [landingPage, setLandingPage] = useState('/dashboard')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [effectiveRole, setEffectiveRole] = useState<string | null>(null)

  useEffect(() => {
    async function fetchNavigation() {
      if (!user) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const supabase = createClient()

        // First, get effective role (may be impersonated for @growa.ai users)
        let currentRole = userRole

        // Check if user is growa.ai admin and has impersonation
        const isGrowaAdmin = user.email?.endsWith('@growa.ai')
        if (isGrowaAdmin) {
          const { data: effectiveRoleData } = await supabase.rpc('get_effective_role')
          if (effectiveRoleData?.[0]?.role_name) {
            currentRole = effectiveRoleData[0].role_name
          }
        }

        if (!currentRole) {
          setIsLoading(false)
          return
        }

        setEffectiveRole(currentRole)

        // Map legacy role to new role if needed
        const mappedRole = roleMapping[currentRole] || currentRole

        // Fetch navigation for user's role
        const { data, error: fetchError } = await supabase
          .from('role_navigation')
          .select('*')
          .eq('role_name', mappedRole)
          .single()

        if (fetchError) {
          // If no specific navigation found, use default
          if (fetchError.code === 'PGRST116') {
            setMenuItems(defaultNavigation)
            setLandingPage('/dashboard')
          } else {
            throw fetchError
          }
        } else if (data) {
          setNavigation(data)
          // Parse menu_items if it's a string
          const items = typeof data.menu_items === 'string' 
            ? JSON.parse(data.menu_items) 
            : data.menu_items
          setMenuItems(items)
          setLandingPage(data.landing_page)
        }
      } catch (err) {
        console.error('Error fetching role navigation:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch navigation')
        // Fallback to default navigation
        setMenuItems(defaultNavigation)
      } finally {
        setIsLoading(false)
      }
    }

    fetchNavigation()
  }, [user, userRole])

  return {
    navigation,
    menuItems,
    landingPage,
    isLoading,
    error,
    effectiveRole,
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
