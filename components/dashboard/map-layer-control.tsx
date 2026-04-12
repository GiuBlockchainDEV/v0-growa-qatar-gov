'use client'

import { useState } from 'react'
import { 
  Layers, ChevronDown, ChevronRight, Eye, EyeOff,
  Shield, Truck, DollarSign, Activity, RotateCcw
} from 'lucide-react'
import { useMapLayers, LayerCategory } from '@/contexts/map-layer-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const categoryConfig: Record<LayerCategory, { label: string; icon: React.ReactNode; color: string }> = {
  regulatory: {
    label: 'Regulatory',
    icon: <Shield className="h-4 w-4" />,
    color: 'text-amber-400',
  },
  commercial: {
    label: 'Commercial',
    icon: <Truck className="h-4 w-4" />,
    color: 'text-blue-400',
  },
  finance: {
    label: 'Finance',
    icon: <DollarSign className="h-4 w-4" />,
    color: 'text-cyan-400',
  },
  technical: {
    label: 'Technical',
    icon: <Activity className="h-4 w-4" />,
    color: 'text-purple-400',
  },
}

export function MapLayerControl() {
  const { layers, toggleLayer, getLayersByCategory, resetLayers, visibleLayers } = useMapLayers()
  const [isOpen, setIsOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<LayerCategory[]>(['regulatory'])

  const toggleCategory = (category: LayerCategory) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const categories: LayerCategory[] = ['regulatory', 'commercial', 'finance', 'technical']

  return (
    <div className="absolute top-20 right-6 z-[1000]">
      {/* Toggle Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0c0c0e]/90 border border-white/10 hover:border-[#07f880]/50 transition-all shadow-lg',
          isOpen && 'border-[#07f880]/50'
        )}
        variant="ghost"
      >
        <Layers className={cn('h-4 w-4', isOpen ? 'text-[#07f880]' : 'text-white')} />
        <span className="text-sm text-white">Layers</span>
        {visibleLayers.length > 1 && (
          <span className="px-1.5 py-0.5 rounded-full bg-[#07f880]/20 text-[#07f880] text-xs">
            {visibleLayers.length}
          </span>
        )}
      </Button>

      {/* Layer Panel */}
      {isOpen && (
        <div className="absolute top-12 right-0 w-72 bg-[#0c0c0e]/95 border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
            <span className="text-sm font-semibold text-white">Map Layers</span>
            <Button
              onClick={resetLayers}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-white/50 hover:text-[#07f880]"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>

          {/* Categories */}
          <div className="max-h-80 overflow-y-auto">
            {categories.map(category => {
              const config = categoryConfig[category]
              const categoryLayers = getLayersByCategory(category)
              const isExpanded = expandedCategories.includes(category)
              const activeCount = categoryLayers.filter(l => l.visible).length

              if (categoryLayers.length === 0) return null

              return (
                <div key={category} className="border-b border-white/5 last:border-b-0">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={config.color}>{config.icon}</span>
                      <span className="text-sm font-medium text-white">{config.label}</span>
                      {activeCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#07f880]/20 text-[#07f880] text-[10px]">
                          {activeCount}
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-white/50" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-white/50" />
                    )}
                  </button>

                  {/* Layers */}
                  {isExpanded && (
                    <div className="px-2 pb-2">
                      {categoryLayers.map(layer => (
                        <button
                          key={layer.id}
                          onClick={() => toggleLayer(layer.id)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all',
                            layer.visible 
                              ? 'bg-white/10 border border-white/10' 
                              : 'hover:bg-white/5'
                          )}
                        >
                          {/* Color indicator */}
                          <div 
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: layer.color }}
                          />
                          
                          {/* Layer name */}
                          <span className={cn(
                            'flex-1 text-left text-xs',
                            layer.visible ? 'text-white' : 'text-white/60'
                          )}>
                            {layer.name}
                          </span>

                          {/* Visibility icon */}
                          {layer.visible ? (
                            <Eye className="h-3.5 w-3.5 text-[#07f880]" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5 text-white/30" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-white/10 bg-white/5">
            <p className="text-[10px] text-white/40">
              {visibleLayers.length} of {layers.length} layers visible
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
