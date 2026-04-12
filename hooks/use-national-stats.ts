'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Types for national statistics
export interface NationalKPIs {
  totalFarms: number
  totalFarmsChange: number
  activeCrops: number
  activeCropsChange: number
  totalArea: number // hectares
  totalAreaChange: number
  waterUtilization: number // percentage
  waterUtilizationChange: number
  productionYTD: number // tons
  productionYTDChange: number
  activeAlerts: number
  activeAlertsChange: number
  complianceRate: number
  complianceRateChange: number
  activePrograms: number
  activeProgramsChange: number
}

export interface AlertPriority {
  id: string
  type: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  location: string
  farm_id?: string
  farm_name?: string
  created_at: string
  affected_area?: string
}

export interface MonitoringStatus {
  environmental: {
    status: 'normal' | 'warning' | 'critical'
    avgTemperature: number
    avgHumidity: number
    avgSoilMoisture: number
  }
  water: {
    status: 'normal' | 'warning' | 'critical'
    totalConsumption: number
    utilizationRate: number
    reservoirLevel: number
  }
  crops: {
    status: 'normal' | 'warning' | 'critical'
    healthyPercentage: number
    stressedCount: number
    harvestReady: number
  }
}

export interface ComplianceStatus {
  inspectionsThisWeek: number
  passRate: number
  openNonConformities: number
  pendingActions: number
  recentInspections: {
    id: string
    farm_name: string
    date: string
    result: 'pass' | 'fail' | 'pending'
    score?: number
  }[]
}

export interface ProductionStatus {
  harvestToday: number
  harvestThisWeek: number
  projectedMonthly: number
  topCrops: {
    name: string
    quantity: number
    unit: string
    trend: 'up' | 'down' | 'stable'
  }[]
  activePrograms: {
    id: string
    name: string
    participants: number
    progress: number
  }[]
}

// Default/fallback data
const defaultKPIs: NationalKPIs = {
  totalFarms: 847,
  totalFarmsChange: 12,
  activeCrops: 2341,
  activeCropsChange: 156,
  totalArea: 12450,
  totalAreaChange: 3.2,
  waterUtilization: 78,
  waterUtilizationChange: -2.5,
  productionYTD: 45600,
  productionYTDChange: 8.4,
  activeAlerts: 23,
  activeAlertsChange: -5,
  complianceRate: 94,
  complianceRateChange: 1.2,
  activePrograms: 12,
  activeProgramsChange: 2,
}

const defaultAlerts: AlertPriority[] = [
  {
    id: '1',
    type: 'critical',
    title: 'Water System Failure',
    description: 'Main irrigation pump offline at Al Khor Farm',
    location: 'Al Khor',
    farm_name: 'Al Khor Agricultural',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    affected_area: '45 hectares',
  },
  {
    id: '2',
    type: 'high',
    title: 'Temperature Threshold Exceeded',
    description: 'Greenhouse 3 temperature above 42°C',
    location: 'Al Shamal',
    farm_name: 'Shamal Greenhouses',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    affected_area: '2.5 hectares',
  },
  {
    id: '3',
    type: 'medium',
    title: 'Pest Detection',
    description: 'Aphid infestation detected in tomato section',
    location: 'Umm Salal',
    farm_name: 'Qatar Fresh Produce',
    created_at: new Date(Date.now() - 14400000).toISOString(),
    affected_area: '0.8 hectares',
  },
]

const defaultMonitoring: MonitoringStatus = {
  environmental: {
    status: 'normal',
    avgTemperature: 34.2,
    avgHumidity: 45,
    avgSoilMoisture: 68,
  },
  water: {
    status: 'warning',
    totalConsumption: 2450000,
    utilizationRate: 78,
    reservoirLevel: 65,
  },
  crops: {
    status: 'normal',
    healthyPercentage: 94,
    stressedCount: 45,
    harvestReady: 234,
  },
}

const defaultCompliance: ComplianceStatus = {
  inspectionsThisWeek: 47,
  passRate: 92,
  openNonConformities: 18,
  pendingActions: 12,
  recentInspections: [
    { id: '1', farm_name: 'Al Khor Agricultural', date: '2024-01-15', result: 'pass', score: 95 },
    { id: '2', farm_name: 'Shamal Greenhouses', date: '2024-01-15', result: 'pass', score: 88 },
    { id: '3', farm_name: 'Qatar Fresh Produce', date: '2024-01-14', result: 'fail', score: 72 },
    { id: '4', farm_name: 'Desert Bloom Farms', date: '2024-01-14', result: 'pass', score: 91 },
  ],
}

const defaultProduction: ProductionStatus = {
  harvestToday: 245,
  harvestThisWeek: 1420,
  projectedMonthly: 6200,
  topCrops: [
    { name: 'Tomatoes', quantity: 450, unit: 'tons', trend: 'up' },
    { name: 'Cucumbers', quantity: 320, unit: 'tons', trend: 'stable' },
    { name: 'Lettuce', quantity: 180, unit: 'tons', trend: 'up' },
    { name: 'Peppers', quantity: 150, unit: 'tons', trend: 'down' },
  ],
  activePrograms: [
    { id: '1', name: 'Food Security Initiative', participants: 145, progress: 68 },
    { id: '2', name: 'Organic Certification', participants: 45, progress: 42 },
    { id: '3', name: 'Water Conservation', participants: 230, progress: 85 },
  ],
}

export function useNationalStats() {
  const [kpis, setKpis] = useState<NationalKPIs>(defaultKPIs)
  const [alerts, setAlerts] = useState<AlertPriority[]>(defaultAlerts)
  const [monitoring, setMonitoring] = useState<MonitoringStatus>(defaultMonitoring)
  const [compliance, setCompliance] = useState<ComplianceStatus>(defaultCompliance)
  const [production, setProduction] = useState<ProductionStatus>(defaultProduction)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchNationalStats() {
      try {
        setIsLoading(true)
        const supabase = createClient()

        // Fetch KPIs from farms table
        const { data: farmsData, error: farmsError } = await supabase
          .from('farms')
          .select('id, name_en, name_ar, location, size_hectares, status, created_at')

        if (farmsError) throw farmsError

        // Calculate real KPIs from farm data
        if (farmsData && farmsData.length > 0) {
          const totalFarms = farmsData.length
          const totalArea = farmsData.reduce((sum, f) => sum + (f.size_hectares || 0), 0)
          
          setKpis(prev => ({
            ...prev,
            totalFarms,
            totalArea: Math.round(totalArea),
          }))
        }

        // Fetch active alerts
        const { data: alertsData, error: alertsError } = await supabase
          .from('alerts')
          .select('*, farms(name_en, name_ar, location)')
          .eq('status', 'active')
          .order('severity', { ascending: false })
          .limit(10)

        if (!alertsError && alertsData) {
          const mappedAlerts: AlertPriority[] = alertsData.map(a => ({
            id: a.id,
            type: a.severity as AlertPriority['type'],
            title: a.title,
            description: a.description,
            location: a.farms?.location || 'Unknown',
            farm_name: a.farms?.name_en || a.farms?.name_ar,
            created_at: a.created_at,
            affected_area: a.affected_area,
          }))
          if (mappedAlerts.length > 0) {
            setAlerts(mappedAlerts)
          }
        }

        // Fetch compliance data - inspections
        const { data: inspectionsData } = await supabase
          .from('inspections')
          .select('id, result, score, created_at, farms(name_en, name_ar)')
          .order('created_at', { ascending: false })
          .limit(20)

        if (inspectionsData && inspectionsData.length > 0) {
          const thisWeek = inspectionsData.filter(i => {
            const date = new Date(i.created_at)
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            return date > weekAgo
          })
          
          const passCount = thisWeek.filter(i => i.result === 'pass').length
          const passRate = thisWeek.length > 0 ? Math.round((passCount / thisWeek.length) * 100) : 92

          setCompliance(prev => ({
            ...prev,
            inspectionsThisWeek: thisWeek.length,
            passRate,
            recentInspections: inspectionsData.slice(0, 4).map(i => ({
              id: i.id,
              farm_name: i.farms?.name_en || i.farms?.name_ar || 'Unknown',
              date: i.created_at.split('T')[0],
              result: i.result as 'pass' | 'fail' | 'pending',
              score: i.score,
            })),
          }))
        }

      } catch (err) {
        console.error('Error fetching national stats:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch stats')
        // Keep default data on error
      } finally {
        setIsLoading(false)
      }
    }

    fetchNationalStats()

    // Set up real-time subscriptions for alerts with unique channel name
    const supabase = createClient()
    const channelName = `alerts-changes-${Date.now()}`
    const alertsChannel = supabase.channel(channelName)
    
    alertsChannel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        // Refetch alerts on change
        fetchNationalStats()
      })
      .subscribe()

    return () => {
      alertsChannel.unsubscribe()
    }
  }, [])

  return {
    kpis,
    alerts,
    monitoring,
    compliance,
    production,
    isLoading,
    error,
  }
}
