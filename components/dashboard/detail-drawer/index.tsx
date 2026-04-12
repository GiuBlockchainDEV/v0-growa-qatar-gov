'use client'

import { X, MapPin, Activity, Thermometer, Droplets, AlertTriangle, Calendar, TrendingUp, FileText, ChevronRight } from 'lucide-react'
import { useDrawer, DrawerObjectType } from '@/contexts/drawer-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

// Icon mapping for object types
const objectTypeIcons: Record<DrawerObjectType, React.ReactNode> = {
  farm: <MapPin className="h-5 w-5 text-[#07f880]" />,
  zone: <MapPin className="h-5 w-5 text-blue-400" />,
  sensor: <Activity className="h-5 w-5 text-amber-400" />,
  alert: <AlertTriangle className="h-5 w-5 text-red-400" />,
  inspection: <FileText className="h-5 w-5 text-purple-400" />,
  program: <TrendingUp className="h-5 w-5 text-cyan-400" />,
  crop: <Activity className="h-5 w-5 text-[#07f880]" />,
}

const objectTypeLabels: Record<DrawerObjectType, string> = {
  farm: 'Farm',
  zone: 'Zone',
  sensor: 'Sensor',
  alert: 'Alert',
  inspection: 'Inspection',
  program: 'Program',
  crop: 'Crop',
}

// Mock KPIs based on object type
function getObjectKPIs(type: DrawerObjectType) {
  switch (type) {
    case 'farm':
      return [
        { label: 'Active Zones', value: '12', change: '+2', trend: 'up' },
        { label: 'Water Usage', value: '2,450 m³', change: '-5%', trend: 'down' },
        { label: 'Crop Health', value: '94%', change: '+3%', trend: 'up' },
        { label: 'Active Alerts', value: '2', change: '-1', trend: 'down' },
      ]
    case 'zone':
      return [
        { label: 'Soil Moisture', value: '68%', change: '+2%', trend: 'up' },
        { label: 'Temperature', value: '32°C', change: '+1°C', trend: 'up' },
        { label: 'EC Level', value: '1.8 mS/cm', change: '0', trend: 'stable' },
        { label: 'pH', value: '6.5', change: '-0.1', trend: 'down' },
      ]
    case 'sensor':
      return [
        { label: 'Current Value', value: '24.5°C', change: '+0.5°C', trend: 'up' },
        { label: 'Battery', value: '85%', change: '-2%', trend: 'down' },
        { label: 'Signal', value: 'Strong', change: '', trend: 'stable' },
        { label: 'Last Reading', value: '2 min ago', change: '', trend: 'stable' },
      ]
    case 'alert':
      return [
        { label: 'Severity', value: 'High', change: '', trend: 'stable' },
        { label: 'Duration', value: '2h 15m', change: '', trend: 'stable' },
        { label: 'Affected Zones', value: '3', change: '', trend: 'stable' },
        { label: 'Status', value: 'Active', change: '', trend: 'stable' },
      ]
    default:
      return [
        { label: 'Status', value: 'Active', change: '', trend: 'stable' },
        { label: 'Last Updated', value: 'Just now', change: '', trend: 'stable' },
      ]
  }
}

// Mock timeline events
function getObjectTimeline(type: DrawerObjectType) {
  return [
    { time: '14:30', event: 'Soil moisture reading updated', status: 'info' },
    { time: '14:15', event: 'Irrigation cycle completed', status: 'success' },
    { time: '13:45', event: 'Temperature alert triggered', status: 'warning' },
    { time: '12:00', event: 'Daily inspection completed', status: 'success' },
    { time: '10:30', event: 'Fertigation started', status: 'info' },
  ]
}

export function DetailDrawer() {
  const { isOpen, object, closeDrawer } = useDrawer()

  if (!object) return null

  const kpis = getObjectKPIs(object.type)
  const timeline = getObjectTimeline(object.type)

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 z-50 w-96 bg-[#0c0c0e] border-l border-white/10 transform transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-3">
          {objectTypeIcons[object.type]}
          <div>
            <h3 className="text-sm font-semibold text-white">{object.name}</h3>
            <p className="text-xs text-white/50">{objectTypeLabels[object.type]}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={closeDrawer}
          className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex-1">
        <TabsList className="grid w-full grid-cols-3 rounded-none bg-transparent border-b border-white/10 h-10">
          <TabsTrigger
            value="overview"
            className="rounded-none text-xs data-[state=active]:bg-transparent data-[state=active]:text-[#07f880] data-[state=active]:border-b-2 data-[state=active]:border-[#07f880]"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="timeline"
            className="rounded-none text-xs data-[state=active]:bg-transparent data-[state=active]:text-[#07f880] data-[state=active]:border-b-2 data-[state=active]:border-[#07f880]"
          >
            Timeline
          </TabsTrigger>
          <TabsTrigger
            value="actions"
            className="rounded-none text-xs data-[state=active]:bg-transparent data-[state=active]:text-[#07f880] data-[state=active]:border-b-2 data-[state=active]:border-[#07f880]"
          >
            Actions
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[calc(100vh-120px)]">
          {/* Overview Tab */}
          <TabsContent value="overview" className="m-0 p-4 space-y-4">
            {/* KPIs Grid */}
            <div className="grid grid-cols-2 gap-3">
              {kpis.map((kpi, index) => (
                <div key={index} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] text-white/50 uppercase tracking-wider">{kpi.label}</p>
                  <p className="text-lg font-bold text-white mt-1">{kpi.value}</p>
                  {kpi.change && (
                    <p className={cn(
                      'text-xs mt-1',
                      kpi.trend === 'up' ? 'text-[#07f880]' : kpi.trend === 'down' ? 'text-red-400' : 'text-white/50'
                    )}>
                      {kpi.change}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Info */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
              <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider">Details</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Location</span>
                  <span className="text-white">Al Shamal, Qatar</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Owner</span>
                  <span className="text-white">Farm Co. Qatar</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Status</span>
                  <Badge className="bg-[#07f880]/20 text-[#07f880] border-[#07f880]/30">Active</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Last Inspection</span>
                  <span className="text-white">2 days ago</span>
                </div>
              </div>
            </div>

            {/* Mini Charts Placeholder */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">7-Day Trend</h4>
              <div className="h-24 flex items-end gap-1">
                {[40, 55, 45, 60, 50, 70, 65].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-[#07f880]/30 rounded-t"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-white/40">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
            </div>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="m-0 p-4">
            <div className="space-y-4">
              {timeline.map((item, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      item.status === 'success' ? 'bg-[#07f880]' :
                      item.status === 'warning' ? 'bg-amber-400' :
                      item.status === 'error' ? 'bg-red-400' : 'bg-blue-400'
                    )} />
                    {index < timeline.length - 1 && (
                      <div className="w-px flex-1 bg-white/10 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-xs text-white/50">{item.time}</p>
                    <p className="text-sm text-white mt-0.5">{item.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="m-0 p-4 space-y-3">
            <Button
              variant="outline"
              className="w-full justify-between border-white/10 bg-white/5 hover:bg-white/10 text-white"
            >
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#07f880]" />
                View on Map
              </span>
              <ChevronRight className="h-4 w-4 text-white/50" />
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-between border-white/10 bg-white/5 hover:bg-white/10 text-white"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-400" />
                Generate Report
              </span>
              <ChevronRight className="h-4 w-4 text-white/50" />
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-between border-white/10 bg-white/5 hover:bg-white/10 text-white"
            >
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-400" />
                Schedule Inspection
              </span>
              <ChevronRight className="h-4 w-4 text-white/50" />
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-between border-white/10 bg-white/5 hover:bg-white/10 text-white"
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                View Alerts
              </span>
              <ChevronRight className="h-4 w-4 text-white/50" />
            </Button>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}
