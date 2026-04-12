'use client'

import { AlertTriangle, Clock, CheckCircle, AlertCircle, MapPin, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useNationalStats, AlertPriority } from '@/hooks/use-national-stats'
import { useDrawer } from '@/contexts/drawer-context'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistanceToNow } from 'date-fns'

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/10 text-red-500 border-red-500/20'
    case 'high':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    case 'medium':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    case 'low':
      return 'bg-white/10 text-white/60 border-white/20'
    default:
      return 'bg-white/10 text-white/60 border-white/20'
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'critical':
      return <AlertTriangle className="h-4 w-4" />
    case 'high':
      return <AlertCircle className="h-4 w-4" />
    case 'medium':
      return <Clock className="h-4 w-4" />
    case 'low':
      return <MapPin className="h-4 w-4" />
    default:
      return <AlertCircle className="h-4 w-4" />
  }
}

function PriorityCard({ alert, onClick }: { alert: AlertPriority; onClick: () => void }) {
  const timeAgo = formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })

  return (
    <Card
      onClick={onClick}
      className="p-3 bg-white/5 border-white/10 hover:border-[#07f880]/30 transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg border flex-shrink-0 ${getSeverityColor(alert.type)}`}>
          {getTypeIcon(alert.type)}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white group-hover:text-[#07f880] transition-colors truncate">
            {alert.title}
          </p>
          <p className="text-xs text-white/50 mt-1 line-clamp-2">{alert.description}</p>

          <div className="flex items-center gap-2 mt-2 text-xs text-white/40">
            {alert.farm_name && (
              <span className="px-2 py-0.5 rounded bg-white/5 truncate max-w-24">{alert.farm_name}</span>
            )}
            <span className="truncate">{alert.location}</span>
            {alert.affected_area && (
              <>
                <span className="text-white/30">•</span>
                <span>{alert.affected_area}</span>
              </>
            )}
          </div>
          <p className="text-[10px] text-white/30 mt-1">{timeAgo}</p>
        </div>

        <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-[#07f880] transition-colors flex-shrink-0" />
      </div>
    </Card>
  )
}

function PriorityCardSkeleton() {
  return (
    <Card className="p-3 bg-white/5 border-white/10">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-lg bg-white/10" />
        <div className="flex-1">
          <Skeleton className="h-4 w-3/4 bg-white/10 mb-2" />
          <Skeleton className="h-3 w-full bg-white/10 mb-2" />
          <Skeleton className="h-3 w-1/2 bg-white/10" />
        </div>
      </div>
    </Card>
  )
}

export function TodaysPriorities() {
  const { alerts, isLoading } = useNationalStats()
  const { openDrawer } = useDrawer()

  // Get only critical and high priority alerts
  const priorityAlerts = alerts.filter(a => a.type === 'critical' || a.type === 'high')

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Today&apos;s Priorities</h3>
          <Skeleton className="h-5 w-16 bg-white/10" />
        </div>
        {[1, 2, 3].map((i) => (
          <PriorityCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Today&apos;s Priorities</h3>
        <Badge variant="outline" className="bg-[#07f880]/10 text-[#07f880] border-[#07f880]/20">
          {priorityAlerts.length} Critical/High
        </Badge>
      </div>

      {priorityAlerts.length === 0 ? (
        <Card className="p-6 bg-white/5 border-white/10 text-center">
          <CheckCircle className="h-8 w-8 text-[#07f880] mx-auto mb-2" />
          <p className="text-sm text-white/70">No critical priorities today</p>
          <p className="text-xs text-white/40 mt-1">All systems operating normally</p>
        </Card>
      ) : (
        priorityAlerts.map((alert) => (
          <PriorityCard
            key={alert.id}
            alert={alert}
            onClick={() => {
              openDrawer({
                id: alert.id,
                type: 'alert',
                name: alert.title,
                data: alert,
              })
            }}
          />
        ))
      )}

      {alerts.length > priorityAlerts.length && (
        <Button
          variant="outline"
          className="w-full border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
        >
          View All {alerts.length} Alerts
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      )}
    </div>
  )
}
