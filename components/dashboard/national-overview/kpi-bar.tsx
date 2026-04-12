'use client'

import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface KPICardProps {
  label: string
  value: string | number
  delta?: number
  severity?: 'normal' | 'warning' | 'critical'
  icon?: React.ReactNode
  onClick?: () => void
}

export function KPICard({
  label,
  value,
  delta,
  severity = 'normal',
  icon,
  onClick,
}: KPICardProps) {
  const severityColor = {
    normal: 'bg-[#07f880]/10 border-[#07f880]/20 text-[#07f880]',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
    critical: 'bg-red-500/10 border-red-500/20 text-red-500',
  }

  const deltaColor = delta && delta > 0 ? 'text-[#07f880]' : 'text-red-500'

  return (
    <Card
      onClick={onClick}
      className={`p-4 cursor-pointer hover:border-[#07f880]/50 transition-all ${severityColor[severity]} border`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-white/60 uppercase">{label}</span>
        {severity !== 'normal' && (
          <AlertCircle className="h-4 w-4" />
        )}
      </div>
      
      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-bold text-white">{value}</div>
        {delta !== undefined && (
          <div className="flex items-center gap-1 text-xs font-semibold">
            {delta > 0 ? (
              <>
                <TrendingUp className="h-3 w-3" />
                <span className={deltaColor}>+{delta}%</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-3 w-3" />
                <span className={deltaColor}>{delta}%</span>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

export function KPIBar() {
  const kpis = [
    { label: 'Total Farms Tracked', value: '2,847', delta: 12, severity: 'normal' as const },
    { label: 'Active Production Sites', value: '1,923', delta: 8, severity: 'normal' as const },
    { label: 'Farms with Open Alerts', value: '284', delta: -15, severity: 'warning' as const },
    { label: 'Open Inspections', value: '67', delta: 5, severity: 'warning' as const },
    { label: 'Open Non-Conformities', value: '43', delta: -8, severity: 'critical' as const },
    { label: 'Harvest Next 30 Days', value: '4.2M kg', delta: 3, severity: 'normal' as const },
    { label: 'Water-Risk Entities', value: '156', delta: 2, severity: 'warning' as const },
    { label: 'Program Participation', value: '1,247', delta: 18, severity: 'normal' as const },
  ]

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {kpis.map((kpi, idx) => (
        <KPICard key={idx} {...kpi} />
      ))}
    </div>
  )
}
