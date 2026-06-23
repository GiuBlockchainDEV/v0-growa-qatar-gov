'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { UserMenu } from './user-menu'
import { LanguageToggle } from '@/components/language-toggle'
import { Bell, Search, Command, Activity, PanelLeft, Globe, MapPin } from 'lucide-react'
import { useRoleNavigation } from '@/hooks/use-role-navigation'
import { useAuth } from '@/hooks/use-auth'
import { buildLiveMapTargetHref } from '@/lib/navigation/live-map-navigation'

interface DashboardHeaderProps {
  onMenuToggle: () => void
  menuOpen: boolean
  sidebarOffsetClassName?: string
  hideMenuToggle?: boolean
  hideBrand?: boolean
}

type FarmSearchOption = {
  id: string
  name: string
  location: string
  source: 'farm' | 'point'
  lat?: number
  lng?: number
}

export function DashboardHeader({
  onMenuToggle,
  menuOpen,
  sidebarOffsetClassName = '',
  hideMenuToggle = false,
  hideBrand = false,
}: DashboardHeaderProps) {
  const { locale } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const { effectiveRole, roleProfile, isLoading: roleLoading } = useRoleNavigation()
  const [searchQuery, setSearchQuery] = useState('')
  const [farmOptions, setFarmOptions] = useState<FarmSearchOption[]>([])
  const [cachedFarmOptions, setCachedFarmOptions] = useState<FarmSearchOption[]>([])
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isLoadingFarms, setIsLoadingFarms] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement | null>(null)

  const mapFarmRows = (rows: unknown): FarmSearchOption[] =>
    (Array.isArray(rows) ? rows : [])
      .map((farm: Record<string, unknown>) => {
        const id = typeof farm.id === 'string' ? farm.id : ''
        if (!id) return null
        const legacyName = typeof farm.name === 'string' ? farm.name : ''
        const nameEn = typeof farm.name_en === 'string' ? farm.name_en : ''
        const nameAr = typeof farm.name_ar === 'string' ? farm.name_ar : ''
        const location = typeof farm.location === 'string' ? farm.location : 'Unknown location'
        return {
          id,
          name:
            (locale === 'ar' && nameAr) ||
            nameEn ||
            legacyName ||
            nameAr ||
            `Farm ${id.slice(0, 8)}`,
          location,
          source: 'farm',
        }
      })
      .filter((farm): farm is FarmSearchOption => Boolean(farm))

  const mapPointRows = (
    rows: unknown,
    polygonCountByPointId: Record<string, number> = {}
  ): FarmSearchOption[] =>
    (Array.isArray(rows) ? rows : [])
      .map((entry): FarmSearchOption | null => {
        if (!entry || typeof entry !== 'object') return null
        const row = entry as Record<string, unknown>
        const id = typeof row.id === 'string' ? row.id : ''
        const lat = typeof row.lat === 'number' ? row.lat : Number.NaN
        const lng = typeof row.lng === 'number' ? row.lng : Number.NaN
        if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
        const label = typeof row.label === 'string' ? row.label.trim() : ''
        const polygonCount = polygonCountByPointId[id] || 0
        const polygonLabel = `${polygonCount} polygon${polygonCount === 1 ? '' : 's'}`
        return {
          id,
          name: label || `Point ${id.slice(0, 8)}`,
          location: polygonLabel,
          source: 'point',
          lat,
          lng,
        } satisfies FarmSearchOption
      })
      .filter((point): point is FarmSearchOption => Boolean(point))

  const activeRoleLabel = (() => {
    const roleKey = roleProfile || effectiveRole
    if (!roleKey) return locale === 'ar' ? 'دور غير محدد' : 'Role Unresolved'
    return roleKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  })()

  const loadFarms = async (signal: AbortSignal, queryValue = '') => {
    try {
      setIsLoadingFarms(true)
      const params = new URLSearchParams()
      const normalizedQuery = queryValue.trim()
      if (normalizedQuery) {
        params.set('q', normalizedQuery)
      }
      params.set('debugSearch', '1')
      const requestUrl = `/api/operations/farms${params.size ? `?${params.toString()}` : ''}`
      console.log('[farm-search-debug] fetching farms', {
        query: normalizedQuery,
        requestUrl,
      })
      const response = await fetch(requestUrl, {
        cache: 'no-store',
        signal,
      })
      const payload = await response.json().catch(() => null)
      console.log('[farm-search-debug] farms response', {
        query: normalizedQuery,
        status: response.status,
        ok: response.ok,
        isArray: Array.isArray(payload),
        rawCount: Array.isArray(payload) ? payload.length : null,
        payload,
      })
      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error || 'Failed to load farms')
      }

      const mapped = mapFarmRows(payload)
      console.log('[farm-search-debug] mapped farm options', {
        query: normalizedQuery,
        mappedCount: mapped.length,
        mapped,
      })
      let pointMapped: FarmSearchOption[] = []
      let polygonCountByPointId: Record<string, number> = {}
      try {
        const polygonResponse = await fetch('/api/operations/custom-point-polygons', {
          cache: 'no-store',
          signal,
        })
        const polygonPayload = await polygonResponse.json().catch(() => null)
        if (polygonResponse.ok && Array.isArray(polygonPayload)) {
          polygonCountByPointId = polygonPayload.reduce<Record<string, number>>((acc, row) => {
            const pointId =
              (typeof row?.pointId === 'string' && row.pointId) ||
              (typeof row?.custom_point_id === 'string' && row.custom_point_id) ||
              ''
            if (!pointId) return acc
            acc[pointId] = (acc[pointId] || 0) + 1
            return acc
          }, {})
        }
      } catch {
        polygonCountByPointId = {}
      }
      try {
        const pointResponse = await fetch('/api/operations/custom-map-points', {
          cache: 'no-store',
          signal,
        })
        const pointPayload = await pointResponse.json().catch(() => null)
        if (pointResponse.ok) {
          pointMapped = mapPointRows(pointPayload, polygonCountByPointId)
        } else {
          pointMapped = []
        }
      } catch {
        pointMapped = []
      }

      if (normalizedQuery) {
        const q = normalizedQuery.toLowerCase()
        pointMapped = pointMapped.filter((point) => {
          return (
            point.name.toLowerCase().includes(q) ||
            point.location.toLowerCase().includes(q) ||
            point.id.toLowerCase().includes(q)
          )
        })
      }

      const merged = [...mapped, ...pointMapped]
      if (!normalizedQuery) {
        setCachedFarmOptions(merged)
        setFarmOptions(merged)
        return
      }

      // If query endpoint returns no rows in mixed-schema deployments, keep a local fallback
      // from the cached full list so users still get autocomplete while typing.
      let effectiveCache = cachedFarmOptions
      if (mapped.length === 0 && effectiveCache.length === 0) {
        const fullListResponse = await fetch('/api/operations/farms?debugSearch=1', {
          cache: 'no-store',
          signal,
        })
        const fullListPayload = await fullListResponse.json().catch(() => null)
        if (fullListResponse.ok) {
          effectiveCache = [...mapFarmRows(fullListPayload), ...pointMapped]
          setCachedFarmOptions(effectiveCache)
          console.log('[farm-search-debug] populated fallback cache from full list', {
            fullCount: effectiveCache.length,
          })
        }
      }

      if (merged.length === 0 && effectiveCache.length > 0) {
        const q = normalizedQuery.toLowerCase()
        const fallback = effectiveCache.filter((farm) => {
          return (
            farm.name.toLowerCase().includes(q) ||
            farm.location.toLowerCase().includes(q) ||
            farm.id.toLowerCase().includes(q)
          )
        })
        console.log('[farm-search-debug] fallback options from cache', {
          query: normalizedQuery,
          fallbackCount: fallback.length,
          fallback,
        })
        setFarmOptions(fallback)
      } else {
        setFarmOptions(merged)
      }
    } catch (error) {
      if (signal.aborted) return
      console.error('[header] farm search load failed', error)
      setFarmOptions([])
    } finally {
      if (!signal.aborted) setIsLoadingFarms(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    loadFarms(controller.signal, '')
    return () => controller.abort()
  }, [locale, user?.id])

  useEffect(() => {
    const controller = new AbortController()
    loadFarms(controller.signal, searchQuery)
    return () => controller.abort()
  }, [pathname, searchQuery])

  useEffect(() => {
    if (searchQuery.trim()) {
      setIsSearchOpen(true)
    }
  }, [searchQuery])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!searchContainerRef.current?.contains(target)) {
        setIsSearchOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSelectFarm = (farm: FarmSearchOption) => {
    setSearchQuery(farm.name)
    setIsSearchOpen(false)
    router.push(
      buildLiveMapTargetHref({
        pointId: farm.source === 'point' ? farm.id : undefined,
        farmId: farm.source === 'farm' ? farm.id : undefined,
        lat: farm.lat,
        lng: farm.lng,
        zoom: 17,
      })
    )
  }

  const shouldShowSearchDropdown =
    (isSearchOpen || searchQuery.trim().length > 0) &&
    (isLoadingFarms || farmOptions.length > 0 || searchQuery.trim().length > 0)

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[1200] h-16 bg-[#0c0c0e]/95 backdrop-blur-xl border-b border-white/5 ${sidebarOffsetClassName}`}
    >
      <div className="flex items-center justify-between h-full px-4">
        {/* Left - Menu Toggle + Logo */}
        <div className="flex items-center gap-3">
          {/* Menu Toggle Button */}
          {!hideMenuToggle ? (
            <button
              onClick={onMenuToggle}
              className="flex items-center justify-center h-10 w-10 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#07f880]/50 transition-all"
              title={menuOpen ? 'Close Menu' : 'Open Menu'}
            >
              <PanelLeft className={`h-5 w-5 transition-colors ${menuOpen ? 'text-[#07f880]' : 'text-white/70'}`} />
            </button>
          ) : null}

          {!hideBrand ? (
            <div className="flex items-center gap-2.5">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo512-dN5LxVKBkzU9yWpc5ROgvoTj7C4wM5.png"
                alt="Growa"
                className="h-8 w-8"
              />
              <div className="hidden sm:flex flex-col">
                <span className="font-bold text-white tracking-tight leading-none">GROWA</span>
                <span className="text-[10px] text-[#07f880] uppercase tracking-widest font-medium">Qatar Operations</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Center - Search */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-xl mx-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 group-focus-within:text-[#07f880] transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => {
                console.log('[farm-search-debug] input change', { value: event.target.value })
                setSearchQuery(event.target.value)
                setIsSearchOpen(true)
              }}
              onFocus={() => {
                console.log('[farm-search-debug] input focus')
                setIsSearchOpen(true)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setIsSearchOpen(false)
                  return
                }
                if (event.key === 'Enter' && farmOptions.length > 0) {
                  event.preventDefault()
                  handleSelectFarm(farmOptions[0])
                }
              }}
              placeholder={locale === 'ar' ? 'ابحث عن مزرعة...' : 'Search farms...'}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pl-10 pr-20 text-sm text-white placeholder-white/40 focus:border-[#07f880]/50 focus:bg-white/10 focus:outline-none transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[10px] text-white/30">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 font-mono">
                <Command className="h-3 w-3 inline" />
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 font-mono">K</kbd>
            </div>
          </div>
          {shouldShowSearchDropdown && (
            <div className="absolute left-0 right-0 top-full z-[2200] mt-1 rounded-xl border border-white/10 bg-[#0c0c0e] p-2 shadow-2xl">
              {isLoadingFarms ? (
                <div className="px-3 py-4 text-sm text-white/60">
                  {locale === 'ar' ? 'جاري تحميل المزارع...' : 'Loading farms...'}
                </div>
              ) : farmOptions.length === 0 ? (
                <div className="px-3 py-4 text-sm text-white/60">
                  {locale === 'ar' ? 'لا توجد نتائج.' : 'No farm suggestions found.'}
                </div>
              ) : (
                farmOptions.map((farm) => (
                  <button
                    key={farm.id}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      handleSelectFarm(farm)
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{farm.name}</p>
                      <p className="truncate text-xs text-white/50">{farm.location}</p>
                    </div>
                    <MapPin className="h-4 w-4 text-[#07f880]" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right - Status, Notifications, Language, User */}
        <div className="flex items-center gap-2">
          {/* Active Role Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5">
            <Globe className="h-3.5 w-3.5 text-white/60" />
            <span className="text-[11px] text-white/55 uppercase tracking-wider">
              {locale === 'ar' ? 'الدور' : 'Role'}
            </span>
            <span className="text-xs font-medium text-white">
              {roleLoading ? (locale === 'ar' ? 'جار التحميل...' : 'Loading...') : activeRoleLabel}
            </span>
          </div>

          {/* Online Status */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#07f880]/30 bg-[#07f880]/10">
            <Activity className="h-3.5 w-3.5 text-[#07f880]" />
            <span className="text-xs font-medium text-[#07f880]">Online</span>
          </div>

          {/* Notifications */}
          <button className="relative h-10 w-10 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
            <Bell className="h-4 w-4 text-white/70" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#07f880]" />
          </button>

          {/* Language */}
          <div className="hidden sm:block">
            <LanguageToggle />
          </div>

          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
