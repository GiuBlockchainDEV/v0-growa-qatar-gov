'use client'

import { TrendingUp, TrendingDown, AlertCircle, Sprout, Droplets, Activity, AlertTriangle, CheckCircle, FileText, Target } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useNationalStats } from '@/hooks/use-national-stats'
import { useDrawer } from '@/contexts/drawer-context'
import { Skeleton } from '@/components/ui/skeleton'

interface KPICardProps {
  label: string
  value: string | number
  delta?: number
  severity?: 'normal' | 'warning' | 'critical'
  icon?: React.ReactNode
  onClick?: () => void
  isLoading?: boolean
}

export function KPICard({
  label,
  value,
  delta,
  severity = 'normal',
  icon,
  onClick,
  isLoading = false,
}: KPICardProps) {
  const severityStyles = {
    normal: 'border-white/10 hover:border-[#07f880]/50',
    warning: 'border-amber-500/30 hover:border-amber-500/50',
    critical: 'border-red-500/30 hover:border-red-500/50',
  }

  const deltaColor = delta !== undefined && delta > 0 ? 'text-[#07f880]' : delta !== undefined && delta < 0 ? 'text-red-400' : 'text-white/50'

  if (isLoading) {
    return (
      <Card className="p-3 bg-white/5 border-white/10">
        <Skeleton className="h-3 w-20 mb-2 bg-white/10" />
        <Skeleton className="h-6 w-16 bg-white/10" />
      </Card>
    )
  }

  return (
    <Card
      onClick={onClick}
      className={`p-3 cursor-pointer bg-white/5 transition-all group ${severityStyles[severity]} border`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{label}</span>
        {severity === 'critical' && <AlertCircle className="h-3 w-3 text-red-400" />}
        {severity === 'warning' && <AlertTriangle className="h-3 w-3 text-amber-400" />}
      </div>
      
      <div className="flex items-baseline justify-between">
        <div className="text-xl font-bold text-white group-hover:text-[#07f880] transition-colors">{value}</div>
        {delta !== undefined && delta !== 0 && (
          <div className={`flex items-center gap-0.5 text-[10px] font-medium ${deltaColor}`}>
            {delta > 0 ? (
              <>
                <TrendingUp className="h-3 w-3" />
                <span>+{delta}%</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-3 w-3" />
                <span>{delta}%</span>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

export function KPIBar() {
  const { kpis, isLoading } = useNationalStats()
  const { openDrawer } = useDrawer()

  const kpiData = [
    { 
      label: 'Total Farms', 
      value: kpis.totalFarms.toLocaleString(), 
      delta: kpis.totalFarmsChange, 
      severity: 'normal' as const,
      icon: <Sprout className="h-4 w-4" />,
      drilldown: { type: 'farm' as const, name: 'All Farms' }
    },
    { 
      label: 'Active Crops', 
      value: kpis.activeCrops.toLocaleString(), 
      delta: kpis.activeCropsChange, 
      severity: 'normal' as const,
      icon: <Activity className="h-4 w-4" />,
      drilldown: { type: 'crop' as const, name: 'Active Crops' }
    },
    { 
      label: 'Total Area (ha)', 
      value: kpis.totalArea.toLocaleString(), 
      delta: kpis.totalAreaChange, 
      severity: 'normal' as const,
      icon: <Target className="h-4 w-4" />,
      drilldown: null
    },
    { 
      label: 'Water Utilization', 
      value: `${kpis.waterUtilization}%`, 
      delta: kpis.waterUtilizationChange, 
      severity: kpis.waterUtilization > 85 ? 'warning' as const : 'normal' as const,
      icon: <Droplets className="h-4 w-4" />,
      drilldown: { type: 'zone' as const, name: 'Water Resources' }
    },
    { 
      label: 'Production YTD (t)', 
      value: (kpis.productionYTD / 1000).toFixed(1) + 'k', 
      delta: kpis.productionYTDChange, 
      severity: 'normal' as const,
      icon: <TrendingUp className="h-4 w-4" />,
      drilldown: { type: 'program' as const, name: 'Production Stats' }
    },
    { 
      label: 'Active Alerts', 
      value: kpis.activeAlerts.toString(), 
      delta: kpis.activeAlertsChange, 
      severity: kpis.activeAlerts > 20 ? 'warning' as const : kpis.activeAlerts > 50 ? 'critical' as const : 'normal' as const,
      icon: <AlertTriangle className="h-4 w-4" />,
      drilldown: { type: 'alert' as const, name: 'Active Alerts' }
    },
    { 
      label: 'Compliance Rate', 
      value: `${kpis.complianceRate}%`, 
      delta: kpis.complianceRateChange, 
      severity: kpis.complianceRate < 90 ? 'warning' as const : 'normal' as const,
      icon: <CheckCircle className="h-4 w-4" />,
      drilldown: { type: 'inspection' as const, name: 'Compliance Overview' }
    },
    { 
      label: 'Active Programs', 
      value: kpis.activePrograms.toString(), 
      delta: kpis.activeProgramsChange, 
      severity: 'normal' as const,
      icon: <FileText className="h-4 w-4" />,
      drilldown: { type: 'program' as const, name: 'Active Programs' }
    },
  ]

  return (
    <div className="grid grid-cols-8 gap-2">
      {kpiData.map((kpi, idx) => (
        <KPICard 
          key={idx} 
          label={kpi.label}
          value={kpi.value}
          delta={kpi.delta}
          severity={kpi.severity}
          icon={kpi.icon}
          isLoading={isLoading}
          onClick={() => {
            if (kpi.drilldown) {
              openDrawer({
                id: `kpi-${idx}`,
                type: kpi.drilldown.type,
                name: kpi.drilldown.name,
              })
            }
          }}
        />
      ))}
    </div>
  )
}
