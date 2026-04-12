'use client'

import { useState } from 'react'
import { ArrowLeft, Search, Filter, CheckCircle, XCircle, Clock, Calendar, FileText, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNationalStats } from '@/hooks/use-national-stats'
import { useDrawer } from '@/contexts/drawer-context'
import { Progress } from '@/components/ui/progress'

export default function CompliancePage() {
  const router = useRouter()
  const { compliance, isLoading } = useNationalStats()
  const { openDrawer } = useDrawer()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('inspections')

  const resultConfig = {
    pass: { color: 'bg-[#07f880]/20 text-[#07f880] border-[#07f880]/30', icon: CheckCircle },
    fail: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
    pending: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
  }

  return (
    <div className="h-screen flex flex-col bg-[#0c0c0e] text-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">Compliance & Inspections</h1>
            <p className="text-sm text-white/50">
              {compliance.inspectionsThisWeek} inspections this week | {compliance.passRate}% pass rate
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <Card className="p-3 bg-white/5 border-white/10">
            <p className="text-[10px] text-white/50 uppercase tracking-wider">This Week</p>
            <p className="text-xl font-bold text-white mt-1">{compliance.inspectionsThisWeek}</p>
          </Card>
          <Card className="p-3 bg-[#07f880]/10 border-[#07f880]/20">
            <p className="text-[10px] text-[#07f880]/70 uppercase tracking-wider">Pass Rate</p>
            <p className="text-xl font-bold text-[#07f880] mt-1">{compliance.passRate}%</p>
          </Card>
          <Card className="p-3 bg-red-500/10 border-red-500/20">
            <p className="text-[10px] text-red-400/70 uppercase tracking-wider">Non-Conformities</p>
            <p className="text-xl font-bold text-red-400 mt-1">{compliance.openNonConformities}</p>
          </Card>
          <Card className="p-3 bg-amber-500/10 border-amber-500/20">
            <p className="text-[10px] text-amber-400/70 uppercase tracking-wider">Pending Actions</p>
            <p className="text-xl font-bold text-amber-400 mt-1">{compliance.pendingActions}</p>
          </Card>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              placeholder="Search inspections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
          </div>
          <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button className="bg-[#07f880] hover:bg-[#07f880]/90 text-black">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Inspection
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-6 mt-4 justify-start bg-transparent border-b border-white/10 rounded-none h-10">
          <TabsTrigger 
            value="inspections" 
            className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#07f880] data-[state=active]:text-[#07f880]"
          >
            Recent Inspections
          </TabsTrigger>
          <TabsTrigger 
            value="non-conformities" 
            className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-red-400 data-[state=active]:text-red-400"
          >
            Non-Conformities ({compliance.openNonConformities})
          </TabsTrigger>
          <TabsTrigger 
            value="scheduled" 
            className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-400 data-[state=active]:text-blue-400"
          >
            Scheduled
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-6 py-4">
          <TabsContent value="inspections" className="m-0 space-y-3">
            {compliance.recentInspections.map(inspection => {
              const config = resultConfig[inspection.result]
              const Icon = config.icon

              return (
                <Card
                  key={inspection.id}
                  onClick={() => openDrawer({
                    id: inspection.id,
                    type: 'inspection',
                    name: `Inspection - ${inspection.farm_name}`,
                    data: inspection,
                  })}
                  className="p-4 bg-white/5 border-white/10 hover:border-[#07f880]/30 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-lg border ${config.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-white group-hover:text-[#07f880] transition-colors">
                          {inspection.farm_name}
                        </h3>
                        <Badge className={config.color}>
                          {inspection.result}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-white/40">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {inspection.date}
                        </span>
                        {inspection.score && (
                          <span className="flex items-center gap-1">
                            Score: {inspection.score}%
                          </span>
                        )}
                      </div>
                    </div>

                    {inspection.score && (
                      <div className="w-32">
                        <Progress 
                          value={inspection.score} 
                          className="h-2 bg-white/10"
                        />
                      </div>
                    )}

                    <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-[#07f880]" />
                  </div>
                </Card>
              )
            })}
          </TabsContent>

          <TabsContent value="non-conformities" className="m-0">
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">Non-conformities data loading...</p>
            </div>
          </TabsContent>

          <TabsContent value="scheduled" className="m-0">
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">No scheduled inspections</p>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}
