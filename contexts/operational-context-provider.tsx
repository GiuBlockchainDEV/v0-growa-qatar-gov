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
  navigateToParcel,
  navigateToSignal,
  navigateToSignalOnMap,
  navigateToModuleWithContext,
  type NavigationTarget,
} from '@/lib/dashboard/operational-navigation'
import type { IntelligenceSignal } from '@/lib/domain/types'
import type { WatchtowerTimeframe } from '@/lib/domain/types'
import { parseWatchtowerTimeframe } from '@/lib/domain/timeframes'

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
  goToSignal: (signal: IntelligenceSignal, options?: { onMap?: boolean }) => void
  goToModule: (module: string, ctx?: Partial<NavigationTarget>) => void
  toggleMapLayer: (layerId: string) => void
  setMapLayers: (layerIds: string[]) => void
}

const OperationalContextReact = createContext<OperationalContextValue | null>(null)

function parseMapLayers(params: URLSearchParams): string[] {
  const raw = params.get('mapLayer') || params.get('mapLayers')
  if (!raw) return ['farms', 'intelligence-signals']
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

  const pushParams = useCallback(
    (params: URLSearchParams) => {
      router.replace(`/dashboard?${params.toString()}`, { scroll: false })
    },
    [router]
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
    const moduleKey = params.get('module') || 'watchtower'
    pushParams(new URLSearchParams(`module=${moduleKey}&timeframe=${timeframe}`))
  }, [pushParams, searchParams, timeframe])

  const setTimeframe = useCallback(
    (next: WatchtowerTimeframe) => {
      setContext({ timeRange: next, module: context.module || 'watchtower' })
    },
    [context.module, setContext]
  )

  const goToFarm = useCallback(
    (farmId: string, module = 'live-map') => {
      pushParams(new URLSearchParams(navigateToFarm(searchParams, farmId, module).split('?')[1] || ''))
    },
    [pushParams, searchParams]
  )

  const goToParcel = useCallback(
    (parcelId: string, module = 'harvest') => {
      const url = navigateToParcel(searchParams, parcelId, { module })
      pushParams(new URLSearchParams(url.split('?')[1] || ''))
    },
    [pushParams, searchParams]
  )

  const goToSignal = useCallback(
    (signal: IntelligenceSignal, options?: { onMap?: boolean }) => {
      const url = options?.onMap
        ? navigateToSignalOnMap(searchParams, signal)
        : navigateToSignal(searchParams, signal)
      const query = url.includes('?') ? url.split('?')[1] : ''
      pushParams(new URLSearchParams(query))
    },
    [pushParams, searchParams]
  )

  const goToModule = useCallback(
    (module: string, ctx?: Partial<NavigationTarget>) => {
      const url = navigateToModuleWithContext(searchParams, module, {
        ...ctx,
        timeframe,
      })
      pushParams(new URLSearchParams(url.split('?')[1] || ''))
    },
    [pushParams, searchParams, timeframe]
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
