'use client'

import { useState } from 'react'
import { ArrowLeft, Search, Filter, AlertTriangle, AlertCircle, Clock, CheckCircle, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNationalStats } from '@/hooks/use-national-stats'
import { useDrawer } from '@/contexts/drawer-context'
import { formatDistanceToNow } from 'date-fns'

export default function AlertsPage() {
  const router = useRouter()
  const { alerts, isLoading } = useNationalStats()
  const { openDrawer } = useDrawer()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (activeTab === 'all') return matchesSearch
    return matchesSearch && alert.type === activeTab
  })

  const severityConfig = {
    critical: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertTriangle },
    high: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: AlertCircle },
    medium: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Clock },
    low: { color: 'bg-white/10 text-white/60 border-white/20', icon: CheckCircle },
  }

  const alertCounts = {
    all: alerts.length,
    critical: alerts.filter(a => a.type === 'critical').length,
    high: alerts.filter(a => a.type === 'high').length,
    medium: alerts.filter(a => a.type === 'medium').length,
    low: alerts.filter(a => a.type === 'low').length,
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
            <h1 className="text-xl font-bold text-white">Active Alerts</h1>
            <p className="text-sm text-white/50">{alerts.length} total alerts</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              placeholder="Search alerts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
          </div>
          <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-6 mt-4 justify-start bg-transparent border-b border-white/10 rounded-none h-10">
          <TabsTrigger 
            value="all" 
            className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#07f880] data-[state=active]:text-[#07f880]"
          >
            All ({alertCounts.all})
          </TabsTrigger>
          <TabsTrigger 
            value="critical" 
            className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-red-400 data-[state=active]:text-red-400"
          >
            Critical ({alertCounts.critical})
          </TabsTrigger>
          <TabsTrigger 
            value="high" 
            className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-amber-400 data-[state=active]:text-amber-400"
          >
            High ({alertCounts.high})
          </TabsTrigger>
          <TabsTrigger 
            value="medium" 
            className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-400 data-[state=active]:text-blue-400"
          >
            Medium ({alertCounts.medium})
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-3">
            {filteredAlerts.map(alert => {
              const config = severityConfig[alert.type]
              const Icon = config.icon
              const timeAgo = formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })

              return (
                <Card
                  key={alert.id}
                  onClick={() => openDrawer({
                    id: alert.id,
                    type: 'alert',
                    name: alert.title,
                    data: alert,
                  })}
                  className="p-4 bg-white/5 border-white/10 hover:border-[#07f880]/30 cursor-pointer transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-lg border ${config.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-semibold text-white group-hover:text-[#07f880] transition-colors">
                          {alert.title}
                        </h3>
                        <Badge className={config.color}>
                          {alert.type}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-white/50 mb-2">{alert.description}</p>

                      <div className="flex items-center gap-4 text-xs text-white/40">
                        {alert.farm_name && (
                          <span className="px-2 py-0.5 rounded bg-white/5">{alert.farm_name}</span>
                        )}
                        <span>{alert.location}</span>
                        {alert.affected_area && (
                          <span>{alert.affected_area} affected</span>
                        )}
                        <span>{timeAgo}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white/40 hover:text-[#07f880] hover:bg-[#07f880]/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Acknowledge alert
                        }}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white/40 hover:text-red-400 hover:bg-red-400/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Dismiss alert
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}

            {filteredAlerts.length === 0 && (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-[#07f880] mx-auto mb-4" />
                <p className="text-white/70">No alerts found</p>
                <p className="text-sm text-white/40 mt-1">All systems operating normally</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  )
}
