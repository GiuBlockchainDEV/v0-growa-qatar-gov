'use client'

import { CheckCircle, AlertCircle, Wrench, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function ComplianceSummary() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Compliance & Inspections</h3>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-white/60 hover:text-[#07f880]">
          View All
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 bg-white/5 border-white/10">
          <div className="flex items-start gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-[#07f880] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-white/60">Inspections</p>
              <p className="text-lg font-bold text-white">67</p>
            </div>
          </div>
          <div className="text-xs space-y-1">
            <div className="flex justify-between text-white/50">
              <span>Scheduled</span>
              <span>23</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Ongoing</span>
              <span>18</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Closed</span>
              <span>26</span>
            </div>
          </div>
        </Card>

        <Card className="p-3 bg-white/5 border-white/10">
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-white/60">Non-Conformities</p>
              <p className="text-lg font-bold text-white">43</p>
            </div>
          </div>
          <div className="text-xs space-y-1">
            <div className="flex justify-between text-white/50">
              <span>Open</span>
              <span>28</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>In Progress</span>
              <span>12</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Resolved</span>
              <span>3</span>
            </div>
          </div>
        </Card>

        <Card className="p-3 bg-white/5 border-white/10">
          <div className="flex items-start gap-2 mb-2">
            <Wrench className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-white/60">Corrective Actions</p>
              <p className="text-lg font-bold text-white">31</p>
            </div>
          </div>
          <div className="text-xs space-y-1">
            <div className="flex justify-between text-white/50">
              <span>Overdue</span>
              <span className="text-red-500 font-semibold">8</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>In Progress</span>
              <span>15</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Completed</span>
              <span>8</span>
            </div>
          </div>
        </Card>

        <Card className="p-3 bg-white/5 border-white/10">
          <div className="flex items-start gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-[#07f880] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-white/60">Compliance Index</p>
              <p className="text-lg font-bold text-white">87%</p>
            </div>
          </div>
          <div className="text-xs space-y-1">
            <div className="flex justify-between text-white/50">
              <span>vs Last Month</span>
              <span className="text-[#07f880]">+2%</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Target</span>
              <span>95%</span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-3 bg-white/5 border-white/10">
        <p className="text-xs font-semibold text-white mb-2">High-Risk Zones</p>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2 bg-white/5 rounded">
            <div>
              <p className="text-white/80">Al Wakrah</p>
              <p className="text-white/40">12 non-conformities</p>
            </div>
            <Badge className="bg-red-500/20 text-red-500">Critical</Badge>
          </div>
          <div className="flex items-center justify-between p-2 bg-white/5 rounded">
            <div>
              <p className="text-white/80">Lusail</p>
              <p className="text-white/40">8 non-conformities</p>
            </div>
            <Badge className="bg-amber-500/20 text-amber-500">High</Badge>
          </div>
        </div>
      </Card>
    </div>
  )
}
