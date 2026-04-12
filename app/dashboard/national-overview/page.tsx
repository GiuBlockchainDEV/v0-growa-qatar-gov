'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { SatelliteMap } from '@/components/dashboard/satellite-map'
import { KPIBar } from '@/components/dashboard/national-overview/kpi-bar'
import { TodaysPriorities } from '@/components/dashboard/national-overview/todays-priorities'
import { MonitoringSummary } from '@/components/dashboard/national-overview/monitoring-summary'
import { ComplianceSummary } from '@/components/dashboard/national-overview/compliance-summary'
import { ProductionProgramsSummary } from '@/components/dashboard/national-overview/production-programs-summary'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function NationalOverviewPage() {
  const { locale } = useI18n()
  const [selectedTab, setSelectedTab] = useState('overview')

  return (
    <div className="h-screen flex flex-col bg-[#0c0c0e] text-white overflow-hidden">
      {/* KPI Bar */}
      <div className="px-6 py-4 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
        <KPIBar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center: Map */}
        <div className="flex-1 flex flex-col min-w-0">
          <SatelliteMap locale={locale} />
        </div>

        {/* Right: Panels */}
        <div className="w-96 border-l border-white/5 bg-[#0c0c0e] flex flex-col">
          {/* Tabs */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3 rounded-none border-b border-white/5 bg-transparent h-10">
              <TabsTrigger 
                value="overview"
                className="rounded-none data-[state=active]:bg-white/5 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-[#07f880]"
              >
                Today
              </TabsTrigger>
              <TabsTrigger 
                value="alerts"
                className="rounded-none data-[state=active]:bg-white/5 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-[#07f880]"
              >
                Alerts
              </TabsTrigger>
              <TabsTrigger 
                value="compliance"
                className="rounded-none data-[state=active]:bg-white/5 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-[#07f880]"
              >
                Compliance
              </TabsTrigger>
            </TabsList>

            {/* Content */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {/* Today's Priorities Tab */}
                <TabsContent value="overview" className="m-0">
                  <TodaysPriorities />
                </TabsContent>

                {/* Alerts Tab */}
                <TabsContent value="alerts" className="m-0">
                  <MonitoringSummary />
                </TabsContent>

                {/* Compliance Tab */}
                <TabsContent value="compliance" className="m-0">
                  <ComplianceSummary />
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>
      </div>

      {/* Bottom: Summary Panels */}
      <div className="border-t border-white/5 bg-gradient-to-t from-white/5 to-transparent">
        <Tabs defaultValue="monitoring" className="w-full">
          <TabsList className="grid w-full grid-cols-3 rounded-none border-b border-white/5 bg-transparent h-10 px-6">
            <TabsTrigger 
              value="monitoring"
              className="rounded-none data-[state=active]:bg-white/5 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-[#07f880]"
            >
              Monitoring
            </TabsTrigger>
            <TabsTrigger 
              value="compliance-summary"
              className="rounded-none data-[state=active]:bg-white/5 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-[#07f880]"
            >
              Compliance
            </TabsTrigger>
            <TabsTrigger 
              value="production"
              className="rounded-none data-[state=active]:bg-white/5 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-[#07f880]"
            >
              Production
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-64">
            <div className="p-4">
              <TabsContent value="monitoring" className="m-0">
                <MonitoringSummary />
              </TabsContent>

              <TabsContent value="compliance-summary" className="m-0">
                <ComplianceSummary />
              </TabsContent>

              <TabsContent value="production" className="m-0">
                <ProductionProgramsSummary />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  )
}
