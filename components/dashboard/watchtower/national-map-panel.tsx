'use client'

import { useMemo } from 'react'
import { Layers } from 'lucide-react'
import { SatelliteMap } from '@/components/dashboard/satellite-map'
import { WATCHTOWER_MAP_LAYERS } from '@/lib/watchtower/map-layers'
import { useOperationalContextOptional } from '@/contexts/operational-context-provider'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface NationalMapPanelProps {
  locale: string
  targetFarmId?: string | null
  targetPointId?: string | null
  targetFocusToken?: string | null
  targetZoom?: number
  targetCropFilter?: string | null
}

export function NationalMapPanel({
  locale,
  targetFarmId,
  targetPointId,
  targetFocusToken,
  targetZoom,
  targetCropFilter,
}: NationalMapPanelProps) {
  const { t } = useI18n()
  const opCtx = useOperationalContextOptional()
  const activeLayers = opCtx?.activeMapLayers ?? ['farms', 'intelligence-signals']

  const layersByCategory = useMemo(() => {
    const groups = new Map<string, typeof WATCHTOWER_MAP_LAYERS>()
    for (const layer of WATCHTOWER_MAP_LAYERS) {
      if (!groups.has(layer.category)) groups.set(layer.category, [])
      groups.get(layer.category)!.push(layer)
    }
    return groups
  }, [])

  return (
    <div className="flex h-full min-h-[360px] flex-col rounded-lg border border-white/10 bg-[#06080c] overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#07f880]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
            {t('watchtower.national_map')}
          </span>
        </div>
        <span className="text-[10px] text-white/35">
          {activeLayers.length} {t('watchtower.layers_active')}
        </span>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="hidden sm:flex w-36 shrink-0 flex-col gap-2 border-r border-white/10 p-2 overflow-y-auto">
          {Array.from(layersByCategory.entries()).map(([category, layers]) => (
            <div key={category}>
              <p className="text-[9px] uppercase tracking-widest text-white/30 mb-1">{category}</p>
              {layers.map((layer) => {
                const active = activeLayers.includes(layer.id)
                return (
                  <button
                    key={layer.id}
                    type="button"
                    disabled={!layer.available}
                    onClick={() => opCtx?.toggleMapLayer(layer.id)}
                    className={cn(
                      'w-full text-left rounded px-1.5 py-1 text-[10px] mb-0.5 transition-colors',
                      !layer.available && 'opacity-30 cursor-not-allowed',
                      active
                        ? 'bg-[#07f880]/15 text-[#07f880]'
                        : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                    )}
                  >
                    {layer.label}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="relative flex-1 min-h-[320px]">
          <SatelliteMap
            locale={locale}
            targetFarmId={targetFarmId}
            targetPointId={targetPointId}
            targetFocusToken={targetFocusToken}
            targetZoom={targetZoom}
            targetCropFilter={targetCropFilter}
            isLateralMode
            lateralPanelOpen={false}
          />
        </div>
      </div>
    </div>
  )
}
