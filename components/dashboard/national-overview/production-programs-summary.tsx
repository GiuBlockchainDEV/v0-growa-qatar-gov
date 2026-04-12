'use client'

import { Harvest, Target, TrendingUp, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function ProductionProgramsSummary() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Production & Programs</h3>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-white/60 hover:text-[#07f880]">
          View All
        </Button>
      </div>

      <Card className="p-4 bg-white/5 border-white/10">
        <div className="flex items-start gap-3 mb-3">
          <Harvest className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-white">Production Outlook</p>
            <p className="text-xs text-white/50 mt-0.5">Estimated yield for next 30 days</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-white/5 rounded p-3">
            <p className="text-white/60">Next 7 Days</p>
            <p className="text-lg font-bold text-white mt-1">487K kg</p>
            <p className="text-[#07f880] text-xs mt-1">+8%</p>
          </div>
          <div className="bg-white/5 rounded p-3">
            <p className="text-white/60">Next 30 Days</p>
            <p className="text-lg font-bold text-white mt-1">4.2M kg</p>
            <p className="text-[#07f880] text-xs mt-1">+3%</p>
          </div>
          <div className="bg-white/5 rounded p-3">
            <p className="text-white/60">Top Crop</p>
            <p className="text-lg font-bold text-white mt-1">Tomatoes</p>
            <p className="text-white/60 text-xs mt-1">1.8M kg</p>
          </div>
        </div>

        <div className="mt-3 p-3 bg-white/5 rounded text-xs">
          <p className="text-white/60 mb-1">Readiness by Region</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-white/80">Doha</span>
              <div className="flex items-center gap-2">
                <div className="h-1 bg-[#07f880]/30 rounded-full w-20"></div>
                <span className="text-white/60">92%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/80">Al Wakrah</span>
              <div className="flex items-center gap-2">
                <div className="h-1 bg-amber-500/30 rounded-full w-16"></div>
                <span className="text-white/60">78%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/80">Lusail</span>
              <div className="flex items-center gap-2">
                <div className="h-1 bg-[#07f880]/30 rounded-full w-24"></div>
                <span className="text-white/60">87%</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-white/5 border-white/10">
        <div className="flex items-start gap-3 mb-3">
          <Target className="h-5 w-5 text-[#07f880] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-white">Public Programs</p>
            <p className="text-xs text-white/50 mt-0.5">Enrollment and performance</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-white/5 rounded p-3">
            <p className="text-white/60">Enrolled Farms</p>
            <p className="text-lg font-bold text-white mt-1">1,247</p>
          </div>
          <div className="bg-white/5 rounded p-3">
            <p className="text-white/60">Active Schemes</p>
            <p className="text-lg font-bold text-white mt-1">8</p>
          </div>
        </div>

        <div className="mt-3 p-3 bg-white/5 rounded text-xs">
          <p className="text-white/60 mb-2">Scheme Performance</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white/80">Water Security</span>
              <Badge className="bg-[#07f880]/20 text-[#07f880] text-xs">847 farms</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/80">Sustainable Ag</span>
              <Badge className="bg-[#07f880]/20 text-[#07f880] text-xs">234 farms</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/80">Flagged for Review</span>
              <Badge className="bg-amber-500/20 text-amber-500 text-xs">45 farms</Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
