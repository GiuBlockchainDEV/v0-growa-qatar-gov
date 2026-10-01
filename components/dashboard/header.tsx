'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buildFarmSearchMapUrl } from '@/lib/dashboard/map-navigation'
import { useI18n } from '@/lib/i18n'
import { UserMenu } from './user-menu'
import { Bell, Search, Command, PanelLeft, Globe } from 'lucide-react'
import { useSharedRoleNavigation } from '@/contexts/role-navigation-context'
import { useAuth } from '@/hooks/use-auth'
import { PlatformShellControls } from '@/components/platform/platform-shell-controls'
import { Logo } from '@/components/brand/logo'
import { StatusDot } from '@/components/brand/ui'
import { sharedFetch } from '@/lib/client/shared-fetch'

interface DashboardHeaderProps {
  onMenuToggle: () => void
  menuOpen: boolean
  sidebarOffsetClassName?: string
  hideMenuToggle?: boolean
  hideBrand?: boolean
  platformShell?: boolean
}

type FarmSearchOption = {
  id: string
  name: string
  location: string
  source: 'farm' | 'point'
}

export function DashboardHeader({
  onMenuToggle,
  menuOpen,
  sidebarOffsetClassName = '',
  hideMenuToggle = false,
  hideBrand = false,
  platformShell = false,
}: DashboardHeaderProps) {
  const { locale, tr } = useI18n()
  const router = useRouter()
  const { user } = useAuth()
  const { effectiveRole, roleProfile, isLoading: roleLoading } = useSharedRoleNavigation()
  const [searchQuery, setSearchQuery] = useState('')
  const [farmOptions, setFarmOptions] = useState<FarmSearchOption[]>([])
  const [cachedFarmOptions, setCachedFarmOptions] = useState<FarmSearchOption[]>([])
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isLoadingFarms, setIsLoadingFarms] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1)

  /* ⌘K / Ctrl+K was printed in the field but did nothing. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const mapFarmRows = (rows: unknown): FarmSearchOption[] =>
    (Array.isArray(rows) ? rows : [])
      .map((farm: Record<string, unknown>) => {
        const id = typeof farm.id === 'string' ? farm.id : ''
        if (!id) return null
        const legacyName = typeof farm.name === 'string' ? farm.name : ''
        const nameEn = typeof farm.name_en === 'string' ? farm.name_en : ''
        const nameAr = typeof farm.name_ar === 'string' ? farm.name_ar : ''
        const location = typeof farm.location === 'string' ? farm.location : tr('Unknown location')
        return {
          id,
          name:
            (locale === 'ar' && nameAr) ||
            nameEn ||
            legacyName ||
            nameAr ||
            tr('Farm {id}', { id: id.slice(0, 8) }),
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
        const polygonLabel =
          polygonCount === 1 ? tr('{count} polygon', { count: polygonCount }) : tr('{count} polygons', { count: polygonCount })
        return {
          id,
          name: label || tr('Point {id}', { id: id.slice(0, 8) }),
          location: polygonLabel,
          source: 'point',
        } satisfies FarmSearchOption
      })
      .filter((point): point is FarmSearchOption => Boolean(point))

  const activeRoleLabel = (() => {
    const roleKey = roleProfile || effectiveRole
    if (!roleKey) return tr('Role unresolved')
    // Sentence case (brand rule): "Farm manager", not "Farm Manager".
    const spaced = roleKey.replace(/_/g, ' ')
    return tr(spaced.charAt(0).toUpperCase() + spaced.slice(1))
  })()

  const loadFarms = async (signal: AbortSignal, queryValue = '') => {
    try {
      setIsLoadingFarms(true)
      const params = new URLSearchParams()
      const normalizedQuery = queryValue.trim()
      if (normalizedQuery) {
        params.set('q', normalizedQuery)
      }
      const requestUrl = `/api/operations/farms${params.size ? `?${params.toString()}` : ''}`
      // Shared cache: the same lists feed the map; abort only guards the state updates below.
      const response = await sharedFetch(requestUrl)
      if (signal.aborted) return
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error || 'Failed to load farms')
      }

      const mapped = mapFarmRows(payload)
      let pointMapped: FarmSearchOption[] = []
      let polygonCountByPointId: Record<string, number> = {}
      try {
        const polygonResponse = await sharedFetch('/api/operations/custom-point-polygons')
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
        const pointResponse = await sharedFetch('/api/operations/custom-map-points')
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
        const fullListResponse = await sharedFetch('/api/operations/farms')
        const fullListPayload = await fullListResponse.json().catch(() => null)
        if (fullListResponse.ok) {
          effectiveCache = [...mapFarmRows(fullListPayload), ...pointMapped]
          setCachedFarmOptions(effectiveCache)
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

  /* Search loads when it is used, not on every page: nothing is fetched
     until the field is opened, and typing is debounced (it used to fire up
     to four requests per keystroke and again on every route change). */
  useEffect(() => {
    if (!isSearchOpen && !searchQuery.trim()) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => loadFarms(controller.signal, searchQuery), searchQuery.trim() ? 250 : 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearchOpen, locale, searchQuery, user?.id])

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

  useEffect(() => {
    setActiveOptionIndex(-1)
  }, [farmOptions])

  const handleSelectFarm = (farm: FarmSearchOption) => {
    setSearchQuery(farm.name)
    setIsSearchOpen(false)
    router.push(buildFarmSearchMapUrl(farm), { scroll: false })
  }

  /* Open only while the field is in use: with a leftover query the list used
     to stay on screen after Escape or a click elsewhere, under other menus. */
  const shouldShowSearchDropdown =
    isSearchOpen && (isLoadingFarms || farmOptions.length > 0 || searchQuery.trim().length > 0)
  const optionId = (index: number) => `farm-search-option-${index}`

  return (
    <header
      // One inline-start value only: `start-0` plus an offset class would both
      // set `inset-inline-start` and the stylesheet order would pick one.
      className={`growa fixed top-0 end-0 z-[1200] h-16 bg-page border-b border-line transition-[inset-inline-start] duration-200 ease-[var(--ease-brand)] ${sidebarOffsetClassName || 'start-0'}`}
    >
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left - Menu Toggle + Logo */}
        <div className="flex items-center gap-3">
          {/* Menu Toggle Button */}
          {!hideMenuToggle ? (
            <button
              onClick={onMenuToggle}
              className="flex items-center justify-center h-9 w-9 text-stone-600 hover:text-ink transition-colors -ms-2"
              title={menuOpen ? tr('Collapse menu') : tr('Expand menu')}
              aria-label={menuOpen ? tr('Collapse menu') : tr('Expand menu')}
              aria-expanded={menuOpen}
            >
              <PanelLeft strokeWidth={1.5} className="h-[22px] w-[22px] rtl:-scale-x-100" />
            </button>
          ) : null}

          {/* Bare mark, no tile (Brand Book p.22). The sub-line keeps the
              clear space: 0.4 × 20px = 8px, and the gap is 12px. */}
          {!hideBrand ? (
            <div className="flex items-center gap-3">
              <Logo className="h-5 w-auto text-ink" />
              <span className="hidden sm:inline text-[12px] text-content-soft">{tr('Qatar operations')}</span>
            </div>
          ) : null}
        </div>

        {/* Center - Search */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-xl mx-4">
          <div className="relative group">
            <Search strokeWidth={1.5} aria-hidden="true" className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-soft group-focus-within:text-content transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setIsSearchOpen(true)
              }}
              onFocus={() => {
                setIsSearchOpen(true)
              }}
              ref={searchInputRef}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setIsSearchOpen(false)
                  setActiveOptionIndex(-1)
                  event.currentTarget.blur()
                  return
                }
                // Arrow keys move through the suggestions, as a combobox should.
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  if (farmOptions.length === 0) return
                  event.preventDefault()
                  setIsSearchOpen(true)
                  setActiveOptionIndex((current) => {
                    const step = event.key === 'ArrowDown' ? 1 : -1
                    return (current + step + farmOptions.length) % farmOptions.length
                  })
                  return
                }
                if (event.key === 'Enter' && farmOptions.length > 0) {
                  event.preventDefault()
                  handleSelectFarm(farmOptions[Math.max(0, activeOptionIndex)] ?? farmOptions[0])
                }
              }}
              aria-controls="farm-search-listbox"
              aria-activedescendant={shouldShowSearchDropdown && activeOptionIndex >= 0 ? optionId(activeOptionIndex) : undefined}
              placeholder={tr('Search farms…')}
              aria-label={tr('Search farms')}
              role="combobox"
              aria-expanded={shouldShowSearchDropdown}
              aria-autocomplete="list"
              className="w-full h-10 rounded-lg border border-line-strong bg-card ps-10 pe-20 text-[14px] text-content placeholder:text-content-soft focus:border-sage focus:outline-none transition-colors"
            />
            <div aria-hidden="true" className="absolute end-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[10px] text-content-soft">
              <kbd className="px-1.5 py-0.5 bg-muted rounded-xs border border-line">
                <Command strokeWidth={1.5} className="h-3 w-3 inline" />
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-muted rounded-xs border border-line">K</kbd>
            </div>
          </div>
          {shouldShowSearchDropdown && (
            <div id="farm-search-listbox" role="listbox" className="absolute start-0 end-0 top-full z-[2200] mt-2 rounded-xl border border-line bg-card p-2 shadow-panel">
              {isLoadingFarms ? (
                <div className="px-3 py-4 text-[14px] text-content-soft">
                  {tr('Loading farms…')}
                </div>
              ) : farmOptions.length === 0 ? (
                <div className="px-3 py-4 text-[14px] text-content-soft">
                  {tr('No farm suggestions found.')}
                </div>
              ) : (
                farmOptions.map((farm, index) => (
                  <button
                    key={farm.id}
                    id={optionId(index)}
                    onMouseEnter={() => setActiveOptionIndex(index)}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      handleSelectFarm(farm)
                    }}
                    role="option"
                    aria-selected={index === activeOptionIndex}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start transition-colors ${
                      index === activeOptionIndex ? 'bg-muted' : 'hover:bg-muted'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] text-content">{farm.name}</p>
                      <p className="truncate text-[12px] text-content-soft">{farm.location}</p>
                    </div>
                    {/* Farms and points are data points: the brand square, not a pin. */}
                    <StatusDot tone={farm.source === 'farm' ? 'ink' : 'good'} size={7} />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {platformShell ? <PlatformShellControls /> : null}

        {/* Right - Status, Notifications, Language, User */}
        <div className="flex items-center gap-2">
          {!platformShell && (
            <>
              <div className="hidden lg:flex items-center gap-2 h-7 px-3 rounded-pill border border-line-strong">
                <Globe strokeWidth={1.5} className="h-3.5 w-3.5 text-content-soft" />
                <span className="text-[12px] text-content-soft">
                  {tr('Role')}
                </span>
                <span className="text-[12px] font-medium text-content">
                  {roleLoading ? tr('Loading…') : activeRoleLabel}
                </span>
              </div>
              <span className="hidden md:inline-flex g-tag g-tag--outline" style={{ height: 28, padding: '0 12px', fontSize: 'var(--text-caption)' }}>
                <StatusDot tone="good" size={6} />
                {tr('Online')}
              </span>
              <button
                aria-label={tr('Notifications')}
                className="relative flex items-center justify-center h-9 w-9 text-stone-600 hover:text-ink transition-colors"
              >
                <Bell strokeWidth={1.5} className="h-5 w-5" />
                <span aria-hidden="true" className="absolute top-2 end-2 h-1.5 w-1.5 bg-ink" style={{ borderRadius: 1 }} />
              </button>
            </>
          )}

          {/* Language lives in Settings → Preferences only. */}
          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
