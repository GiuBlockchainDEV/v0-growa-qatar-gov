'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  buildOperationalContextParams,
  parseOperationalContext,
  type OperationalContext,
} from '@/lib/domain/operational-context'
import {
  navigateToFarm,
  navigateToHarvestField,
  navigateToParcel,
  navigateToSignal,
  navigateToSignalOnMap,
  navigateToModuleWithContext,
  type NavigationTarget,
} from '@/lib/dashboard/operational-navigation'
import type { HarvestFieldNavTarget } from '@/lib/harvest/field-navigation'
import type { HarvestMode } from '@/lib/harvest/types'
import type { IntelligenceSignal } from '@/lib/domain/types'
import type { WatchtowerTimeframe } from '@/lib/domain/types'
import { parseWatchtowerTimeframe } from '@/lib/domain/timeframes'
import { clearOperationalOverlayParams } from '@/lib/dashboard/context-navigation'
import { resolveDashboardHref } from '@/lib/dashboard/dashboard-navigation'

interface OperationalContextValue {
  context: OperationalContext
  timeframe: WatchtowerTimeframe
  selectedSignalId: string | null
  activeMapLayers: string[]
  setTimeframe: (timeframe: WatchtowerTimeframe) => void
  setContext: (updates: Partial<OperationalContext>) => void
  clearContext: () => void
  goToFarm: (farmId: string, module?: string) => void
  goToParcel: (parcelId: string, module?: string) => void
  goToHarvestField: (
    field: HarvestFieldNavTarget,
    options?: { mode?: HarvestMode; signalId?: string }
  ) => void
  goToSignal: (signal: IntelligenceSignal, options?: { onMap?: boolean }) => void
  goToModule: (module: string, ctx?: Partial<NavigationTarget>) => void
  toggleMapLayer: (layerId: string) => void
  setMapLayers: (layerIds: string[]) => void
}

const OperationalContextReact = createContext<OperationalContextValue | null>(null)

function parseMapLayers(params: URLSearchParams): string[] {
  const raw = params.get('mapLayer') || params.get('mapLayers')
  if (!raw) {
    const module = params.get('module')
    if (module === 'watchtower' || module === 'national-overview' || !module) {
      return ['fields', 'production', 'harvest-forecast', 'crop-health', 'intelligence-signals']
    }
    return ['farms', 'intelligence-signals']
  }
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

export function OperationalContextProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeMapLayers, setActiveMapLayers] = useState<string[]>(() => parseMapLayers(searchParams))

  const context = useMemo(() => parseOperationalContext(searchParams), [searchParams])
  const timeframe = parseWatchtowerTimeframe(
    searchParams.get('timeframe') || searchParams.get('timeRange')
  )
  const selectedSignalId = searchParams.get('signalId')

  useEffect(() => {
    setActiveMapLayers(parseMapLayers(searchParams))
  }, [searchParams])

  const navigateToUrl = useCallback(
    (target: string) => {
      const href = resolveDashboardHref(searchParams, target)
      const nextParams = new URLSearchParams(href.split('?')[1] || '')
      const currentModule = searchParams.get('module') || 'watchtower'
      const nextModule = nextParams.get('module') || 'watchtower'
      const navigate = currentModule === nextModule ? router.replace : router.push
      navigate(href, { scroll: false })
    },
    [router, searchParams]
  )

  const pushParams = useCallback(
    (params: URLSearchParams) => {
      if (!params.get('module')) {
        params.set('module', searchParams.get('module') || 'watchtower')
      }
      navigateToUrl(`/dashboard?${params.toString()}`)
    },
    [navigateToUrl, searchParams]
  )

  const setContext = useCallback(
    (updates: Partial<OperationalContext>) => {
      const params = buildOperationalContextParams(searchParams, updates)
      if (updates.mapLayer) {
        params.set('mapLayer', updates.mapLayer)
      }
      pushParams(params)
    },
    [pushParams, searchParams]
  )

  const clearContext = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    clearOperationalOverlayParams(params)
    if (!params.get('timeframe')) {
      params.set('timeframe', timeframe)
    }
    if (!params.get('timeRange')) {
      params.set('timeRange', timeframe)
    }
    pushParams(params)
  }, [pushParams, searchParams, timeframe])

  const setTimeframe = useCallback(
    (next: WatchtowerTimeframe) => {
      setContext({ timeRange: next, module: context.module || 'watchtower' })
    },
    [context.module, setContext]
  )

  const goToFarm = useCallback(
    (farmId: string, module = 'harvest') => {
      navigateToUrl(navigateToFarm(searchParams, farmId, module))
    },
    [navigateToUrl, searchParams]
  )

  const goToParcel = useCallback(
    (parcelId: string, module = 'harvest') => {
      navigateToUrl(navigateToParcel(searchParams, parcelId, { module }))
    },
    [navigateToUrl, searchParams]
  )

  const goToHarvestField = useCallback(
    (field: HarvestFieldNavTarget, options?: { mode?: HarvestMode; signalId?: string }) => {
      navigateToUrl(
        navigateToHarvestField(searchParams, field, {
          mode: options?.mode,
          signalId: options?.signalId,
          timeframe,
        })
      )
    },
    [navigateToUrl, searchParams, timeframe]
  )

  const goToSignal = useCallback(
    (signal: IntelligenceSignal, options?: { onMap?: boolean }) => {
      const url = options?.onMap
        ? navigateToSignalOnMap(searchParams, signal)
        : navigateToSignal(searchParams, signal)
      navigateToUrl(url)
    },
    [navigateToUrl, searchParams]
  )

  const goToModule = useCallback(
    (module: string, ctx?: Partial<NavigationTarget>) => {
      navigateToUrl(
        navigateToModuleWithContext(searchParams, module, {
          ...ctx,
          timeframe,
          harvestMode:
            ctx?.harvestMode ||
            (module === 'harvest' || module === 'production-harvest' ? 'predict' : undefined),
        })
      )
    },
    [navigateToUrl, searchParams, timeframe]
  )

  const toggleMapLayer = useCallback(
    (layerId: string) => {
      setActiveMapLayers((current) => {
        const next = current.includes(layerId)
          ? current.filter((id) => id !== layerId)
          : [...current, layerId]
        const params = new URLSearchParams(searchParams.toString())
        params.set('mapLayers', next.join(','))
        if (next[0]) params.set('mapLayer', next[0])
        pushParams(params)
        return next
      })
    },
    [pushParams, searchParams]
  )

  const setMapLayers = useCallback(
    (layerIds: string[]) => {
      setActiveMapLayers(layerIds)
      const params = new URLSearchParams(searchParams.toString())
      params.set('mapLayers', layerIds.join(','))
      if (layerIds[0]) params.set('mapLayer', layerIds[0])
      pushParams(params)
    },
    [pushParams, searchParams]
  )

  const value = useMemo(
    () => ({
      context,
      timeframe,
      selectedSignalId,
      activeMapLayers,
      setTimeframe,
      setContext,
      clearContext,
      goToFarm,
      goToParcel,
      goToHarvestField,
      goToSignal,
      goToModule,
      toggleMapLayer,
      setMapLayers,
    }),
    [
      context,
      timeframe,
      selectedSignalId,
      activeMapLayers,
      setTimeframe,
      setContext,
      clearContext,
      goToFarm,
      goToParcel,
      goToHarvestField,
      goToSignal,
      goToModule,
      toggleMapLayer,
      setMapLayers,
    ]
  )

  return (
    <OperationalContextReact.Provider value={value}>{children}</OperationalContextReact.Provider>
  )
}

export function useOperationalContext() {
  const ctx = useContext(OperationalContextReact)
  if (!ctx) {
    throw new Error('useOperationalContext must be used within OperationalContextProvider')
  }
  return ctx
}

export function useOperationalContextOptional() {
  return useContext(OperationalContextReact)
}
