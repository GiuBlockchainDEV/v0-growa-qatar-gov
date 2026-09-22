'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Globe, Loader2, Newspaper, RefreshCw, Rss } from 'lucide-react'

type FeedCategory = 'policy' | 'market' | 'water' | 'weather' | 'technology'

interface FeedItem {
  id: string
  title: string
  summary: string
  source: string
  sourceUrl: string
  category: FeedCategory
  publishedAt: string
  region: string
}

interface FeedResponse {
  items: FeedItem[]
  meta?: {
    fetchedAt?: string
    sourceCount?: number
    successCount?: number
    errors?: string[]
  }
}

const CATEGORY_LABELS: Record<FeedCategory, string> = {
  policy: 'Policy',
  market: 'Market',
  water: 'Water',
  weather: 'Weather',
  technology: 'Technology',
}

function toRelativeDateLabel(value: string) {
  const published = new Date(value)
  if (Number.isNaN(published.getTime())) return 'Recently'
  const now = Date.now()
  const diffHours = Math.max(1, Math.round((now - published.getTime()) / (1000 * 60 * 60)))
  if (diffHours < 24) return `${diffHours}h ago`
  const days = Math.round(diffHours / 24)
  return `${days}d ago`
}

export function RssFeedWorkspace() {
  const [selectedCategory, setSelectedCategory] = useState<'all' | FeedCategory>('all')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null)
  const [feedWarnings, setFeedWarnings] = useState<string[]>([])

  const loadFeeds = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const response = await fetch('/api/rss/feeds?limit=80', { cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as FeedResponse | null

      if (!response.ok || !payload) {
        throw new Error((payload as { error?: string } | null)?.error || 'Failed to load RSS feeds')
      }

      setItems(Array.isArray(payload.items) ? payload.items : [])
      setLastFetchedAt(payload.meta?.fetchedAt || new Date().toISOString())
      setFeedWarnings(Array.isArray(payload.meta?.errors) ? payload.meta.errors : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load RSS feeds')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadFeeds()
  }, [loadFeeds])

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return items
      .filter((item) => {
        const categoryOk = selectedCategory === 'all' || item.category === selectedCategory
        const queryOk =
          !normalizedQuery ||
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.summary.toLowerCase().includes(normalizedQuery) ||
          item.source.toLowerCase().includes(normalizedQuery) ||
          item.region.toLowerCase().includes(normalizedQuery)
        return categoryOk && queryOk
      })
      .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
  }, [items, query, selectedCategory])

  const highlights = useMemo(() => {
    return {
      total: filteredItems.length,
      qatar: filteredItems.filter((item) => item.region.toLowerCase().includes('qatar')).length,
      waterWeather: filteredItems.filter((item) => item.category === 'water' || item.category === 'weather').length,
      market: filteredItems.filter((item) => item.category === 'market').length,
    }
  }, [filteredItems])

  return (
    <div className="h-full overflow-y-auto overscroll-contain space-y-5 p-6 pt-20">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
              <Rss className="h-5 w-5 text-[#07f880]" />
              Qatar & Gulf Agriculture RSS Feed
            </h1>
            <p className="mt-2 text-sm text-white/65">
              Live agriculture and agritech intelligence from Qatar, the Gulf, and global AgriTech sources.
            </p>
            {lastFetchedAt ? (
              <p className="mt-2 text-xs text-white/45">
                Last updated {toRelativeDateLabel(lastFetchedAt)} • AgriTech MEA, AgFunder, Gulf Times, Qatar Tribune, Arab News, Google News
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void loadFeeds(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-[#07f880]/30 bg-[#07f880]/10 px-3 py-2 text-sm text-[#07f880] hover:bg-[#07f880]/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Feed
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {feedWarnings.length > 0 ? (
        <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4 text-xs text-amber-100/90">
          Some sources were temporarily unavailable: {feedWarnings.join(' • ')}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">Visible stories</p>
          <p className="mt-2 text-2xl font-semibold text-white">{highlights.total}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">Qatar stories</p>
          <p className="mt-2 text-2xl font-semibold text-white">{highlights.qatar}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">Water & weather</p>
          <p className="mt-2 text-2xl font-semibold text-amber-300">{highlights.waterWeather}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">Market updates</p>
          <p className="mt-2 text-2xl font-semibold text-sky-300">{highlights.market}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="inline-flex items-center gap-2 px-2 text-xs uppercase tracking-wide text-white/50">
          <Newspaper className="h-3.5 w-3.5" />
          Filters
        </div>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title, source, region, keyword..."
          className="h-9 min-w-[220px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/35 focus:border-[#07f880]/50 focus:outline-none"
        />
        <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`rounded-md px-2.5 py-1 text-xs ${
              selectedCategory === 'all' ? 'bg-[#07f880]/20 text-[#07f880]' : 'text-white/70 hover:bg-white/10'
            }`}
          >
            All
          </button>
          {(Object.keys(CATEGORY_LABELS) as FeedCategory[]).map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`rounded-md px-2.5 py-1 text-xs ${
                selectedCategory === category
                  ? 'bg-[#07f880]/20 text-[#07f880]'
                  : 'text-white/70 hover:bg-white/10'
              }`}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {loading ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/60">
            <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-[#07f880]" />
            Loading live RSS feeds from Qatar and the Gulf...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/60">
            No RSS items match your current filters.
          </div>
        ) : (
          filteredItems.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-[#07f880]/30"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-[#07f880]/30 bg-[#07f880]/10 px-2 py-0.5 text-[#07f880]">
                  {CATEGORY_LABELS[item.category]}
                </span>
                <span className="text-white/45">•</span>
                <span className="text-white/60">{item.region}</span>
                <span className="text-white/45">•</span>
                <span className="text-white/60">{toRelativeDateLabel(item.publishedAt)}</span>
              </div>
              <h2 className="text-base font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm text-white/70">{item.summary}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-xs text-white/60">
                  <Globe className="h-3.5 w-3.5" />
                  {item.source}
                </div>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#07f880] hover:underline"
                >
                  Open source
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
