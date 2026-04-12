'use client'

import { Droplets, AlertTriangle, Cloud, Wifi } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function MonitoringSummary() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white">Monitoring Summary</h3>

      <Card className="p-4 bg-white/5 border-white/10">
        <div className="flex items-start gap-3 mb-3">
          <Droplets className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Water Status</p>
            <p className="text-xs text-white/50 mt-0.5">342 anomalies detected</p>
          </div>
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Warning</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-white/5 rounded p-2">
            <p className="text-white/60">High EC</p>
            <p className="text-white font-semibold">156</p>
          </div>
          <div className="bg-white/5 rounded p-2">
            <p className="text-white/60">Low pH</p>
            <p className="text-white font-semibold">89</p>
          </div>
          <div className="bg-white/5 rounded p-2">
            <p className="text-white/60">Moisture</p>
            <p className="text-white font-semibold">97</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-white/5 border-white/10">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Environmental Status</p>
            <p className="text-xs text-white/50 mt-0.5">218 anomalies detected</p>
          </div>
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Active</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-white/5 rounded p-2">
            <p className="text-white/60">Stress</p>
            <p className="text-white font-semibold">143</p>
          </div>
          <div className="bg-white/5 rounded p-2">
            <p className="text-white/60">Temp</p>
            <p className="text-white font-semibold">52</p>
          </div>
          <div className="bg-white/5 rounded p-2">
            <p className="text-white/60">Humidity</p>
            <p className="text-white font-semibold">23</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-white/5 border-white/10">
        <div className="flex items-start gap-3 mb-3">
          <Cloud className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Weather Risk</p>
            <p className="text-xs text-white/50 mt-0.5">5 regions affected</p>
          </div>
          <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Monitor</Badge>
        </div>
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-white/60">Drought Risk</span>
            <span className="text-white font-semibold">34%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Frost Risk</span>
            <span className="text-white font-semibold">12%</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
