'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'

// Layer types based on the Growa architecture
export type LayerCategory = 'regulatory' | 'commercial' | 'finance' | 'technical'

export interface MapLayer {
  id: string
  name: string
  category: LayerCategory
  description: string
  visible: boolean
  color: string
  icon: string
  // Which roles can see this layer
  allowedRoles: string[]
  // Data type for filtering
  dataType: 'farms' | 'zones' | 'sensors' | 'alerts' | 'inspections' | 'boundaries'
}

// Default layers configuration
const defaultLayers: MapLayer[] = [
  // Regulatory layers (Ministry focused)
  {
    id: 'farms',
    name: 'Registered Farms',
    category: 'regulatory',
    description: 'All registered agricultural farms',
    visible: true,
    color: '#07f880',
    icon: 'Sprout',
    allowedRoles: ['ministry_admin', 'ministry_inspector', 'sourcing_manager', 'finance_officer', 'farm_manager', 'agronomist'],
    dataType: 'farms',
  },
  {
    id: 'compliance-zones',
    name: 'Compliance Zones',
    category: 'regulatory',
    description: 'Areas under compliance monitoring',
    visible: false,
    color: '#f59e0b',
    icon: 'Shield',
    allowedRoles: ['ministry_admin', 'ministry_inspector'],
    dataType: 'zones',
  },
  {
    id: 'inspection-routes',
    name: 'Inspection Routes',
    category: 'regulatory',
    description: 'Planned inspection routes',
    visible: false,
    color: '#8b5cf6',
    icon: 'Route',
    allowedRoles: ['ministry_admin', 'ministry_inspector'],
    dataType: 'zones',
  },
  {
    id: 'non-conformities',
    name: 'Non-Conformities',
    category: 'regulatory',
    description: 'Farms with open non-conformities',
    visible: false,
    color: '#ef4444',
    icon: 'AlertTriangle',
    allowedRoles: ['ministry_admin', 'ministry_inspector'],
    dataType: 'inspections',
  },

  // Commercial layers (Hassad focused)
  {
    id: 'suppliers',
    name: 'Active Suppliers',
    category: 'commercial',
    description: 'Farms supplying to Hassad Food',
    visible: false,
    color: '#3b82f6',
    icon: 'Truck',
    allowedRoles: ['ministry_admin', 'sourcing_manager'],
    dataType: 'farms',
  },
  {
    id: 'harvest-ready',
    name: 'Harvest Ready',
    category: 'commercial',
    description: 'Farms with crops ready for harvest',
    visible: false,
    color: '#22c55e',
    icon: 'Wheat',
    allowedRoles: ['ministry_admin', 'sourcing_manager', 'farm_manager'],
    dataType: 'farms',
  },
  {
    id: 'supply-alerts',
    name: 'Supply Alerts',
    category: 'commercial',
    description: 'Supply chain issues',
    visible: false,
    color: '#f97316',
    icon: 'AlertCircle',
    allowedRoles: ['ministry_admin', 'sourcing_manager'],
    dataType: 'alerts',
  },

  // Finance layers (QDB focused)
  {
    id: 'funded-farms',
    name: 'QDB Funded',
    category: 'finance',
    description: 'Farms with active QDB financing',
    visible: false,
    color: '#0ea5e9',
    icon: 'DollarSign',
    allowedRoles: ['ministry_admin', 'finance_officer'],
    dataType: 'farms',
  },
  {
    id: 'program-participants',
    name: 'Program Participants',
    category: 'finance',
    description: 'Farms in government programs',
    visible: false,
    color: '#14b8a6',
    icon: 'Users',
    allowedRoles: ['ministry_admin', 'finance_officer'],
    dataType: 'farms',
  },
  {
    id: 'risk-indicators',
    name: 'Risk Indicators',
    category: 'finance',
    description: 'Farms flagged for financial risk',
    visible: false,
    color: '#f43f5e',
    icon: 'TrendingDown',
    allowedRoles: ['ministry_admin', 'finance_officer'],
    dataType: 'farms',
  },

  // Technical layers (Farm operations focused)
  {
    id: 'sensors',
    name: 'IoT Sensors',
    category: 'technical',
    description: 'Connected sensor devices',
    visible: false,
    color: '#a855f7',
    icon: 'Activity',
    allowedRoles: ['ministry_admin', 'farm_manager', 'agronomist', 'operator', 'technical_support'],
    dataType: 'sensors',
  },
  {
    id: 'irrigation-zones',
    name: 'Irrigation Zones',
    category: 'technical',
    description: 'Irrigation system coverage',
    visible: false,
    color: '#06b6d4',
    icon: 'Droplets',
    allowedRoles: ['ministry_admin', 'farm_manager', 'agronomist', 'operator'],
    dataType: 'zones',
  },
  {
    id: 'water-stress',
    name: 'Water Stress',
    category: 'technical',
    description: 'Areas showing water stress',
    visible: false,
    color: '#dc2626',
    icon: 'Thermometer',
    allowedRoles: ['ministry_admin', 'farm_manager', 'agronomist', 'operator'],
    dataType: 'alerts',
  },
  {
    id: 'device-health',
    name: 'Device Health',
    category: 'technical',
    description: 'Device connectivity status',
    visible: false,
    color: '#84cc16',
    icon: 'Wifi',
    allowedRoles: ['ministry_admin', 'technical_support', 'operator'],
    dataType: 'sensors',
  },
]

interface MapLayerContextType {
  layers: MapLayer[]
  visibleLayers: MapLayer[]
  toggleLayer: (layerId: string) => void
  setLayerVisibility: (layerId: string, visible: boolean) => void
  getLayersByCategory: (category: LayerCategory) => MapLayer[]
  resetLayers: () => void
  currentUserRole: string | null
}

const MapLayerContext = createContext<MapLayerContextType | undefined>(undefined)

export function MapLayerProvider({ children }: { children: ReactNode }) {
  const { userRole } = useAuth()
  const [layers, setLayers] = useState<MapLayer[]>(defaultLayers)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)

  // Filter layers based on user role
  useEffect(() => {
    async function getEffectiveRole() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user?.email?.endsWith('@growa.ai')) {
        // Check for impersonation
        const { data: effectiveRoleData } = await supabase.rpc('get_effective_role')
        if (effectiveRoleData?.[0]?.role_name) {
          setCurrentUserRole(effectiveRoleData[0].role_name)
          return
        }
      }
      
      setCurrentUserRole(userRole || 'ministry_admin')
    }
    
    getEffectiveRole()
  }, [userRole])

  // Get layers accessible to current user
  const accessibleLayers = layers.filter(layer => 
    currentUserRole && layer.allowedRoles.includes(currentUserRole)
  )

  const visibleLayers = accessibleLayers.filter(layer => layer.visible)

  const toggleLayer = useCallback((layerId: string) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
    ))
  }, [])

  const setLayerVisibility = useCallback((layerId: string, visible: boolean) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId ? { ...layer, visible } : layer
    ))
  }, [])

  const getLayersByCategory = useCallback((category: LayerCategory) => {
    return accessibleLayers.filter(layer => layer.category === category)
  }, [accessibleLayers])

  const resetLayers = useCallback(() => {
    setLayers(defaultLayers.map(layer => ({ ...layer, visible: layer.id === 'farms' })))
  }, [])

  return (
    <MapLayerContext.Provider value={{
      layers: accessibleLayers,
      visibleLayers,
      toggleLayer,
      setLayerVisibility,
      getLayersByCategory,
      resetLayers,
      currentUserRole,
    }}>
      {children}
    </MapLayerContext.Provider>
  )
}

export function useMapLayers() {
  const context = useContext(MapLayerContext)
  if (!context) {
    throw new Error('useMapLayers must be used within a MapLayerProvider')
  }
  return context
}
