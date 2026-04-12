'use client'

import { AlertTriangle, Clock, CheckCircle, AlertCircle, MapPin } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface PriorityItem {
  id: string
  type: 'incident' | 'inspection' | 'action' | 'region' | 'program' | 'case'
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium'
  region: string
  affectedCount: number
  lastUpdated: string
}

const mockPriorities: PriorityItem[] = [
  {
    id: '1',
    type: 'incident',
    title: 'Critical Incident - Doha Region',
    description: 'Water supply anomaly detected in 23 farms',
    severity: 'critical',
    region: 'Doha',
    affectedCount: 23,
    lastUpdated: '2 hours ago',
  },
  {
    id: '2',
    type: 'inspection',
    title: 'Inspections Due This Week',
    description: '12 compliance inspections scheduled',
    severity: 'high',
    region: 'Multiple',
    affectedCount: 12,
    lastUpdated: '1 day ago',
  },
  {
    id: '3',
    type: 'action',
    title: 'Overdue Corrective Actions',
    description: '8 farms with overdue compliance actions',
    severity: 'high',
    region: 'Al Wakrah',
    affectedCount: 8,
    lastUpdated: '3 days ago',
  },
  {
    id: '4',
    type: 'region',
    title: 'High Water-Risk Cluster',
    description: 'Northern zone showing stress indicators',
    severity: 'high',
    region: 'Al Shahaniya',
    affectedCount: 34,
    lastUpdated: '6 hours ago',
  },
  {
    id: '5',
    type: 'program',
    title: 'Program Exception Detected',
    description: 'Flagged farm in public subsidy scheme',
    severity: 'medium',
    region: 'Lusail',
    affectedCount: 1,
    lastUpdated: '4 hours ago',
  },
]

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/10 text-red-500 border-red-500/20'
    case 'high':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    case 'medium':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    default:
      return 'bg-white/10 text-white/60 border-white/20'
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'incident':
      return <AlertTriangle className="h-4 w-4" />
    case 'inspection':
      return <Clock className="h-4 w-4" />
    case 'action':
      return <CheckCircle className="h-4 w-4" />
    case 'region':
      return <MapPin className="h-4 w-4" />
    case 'program':
      return <AlertCircle className="h-4 w-4" />
    default:
      return <AlertCircle className="h-4 w-4" />
  }
}

export function TodaysPriorities() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Today's Priorities</h3>
        <Badge variant="outline" className="bg-[#07f880]/10 text-[#07f880] border-[#07f880]/20">
          {mockPriorities.length} Active
        </Badge>
      </div>

      {mockPriorities.map((item) => (
        <Card
          key={item.id}
          className="p-3 bg-white/5 border-white/10 hover:border-[#07f880]/30 transition-all cursor-pointer group"
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg border ${getSeverityColor(item.severity)}`}>
              {getTypeIcon(item.type)}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white group-hover:text-[#07f880] transition-colors">
                {item.title}
              </p>
              <p className="text-xs text-white/50 mt-1">{item.description}</p>

              <div className="flex items-center gap-2 mt-2 text-xs text-white/40">
                <span className="px-2 py-0.5 rounded bg-white/5">{item.region}</span>
                <span>{item.affectedCount} affected</span>
                <span className="text-white/30">•</span>
                <span>{item.lastUpdated}</span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-white/60 hover:text-[#07f880] hover:bg-[#07f880]/10"
            >
              View
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
