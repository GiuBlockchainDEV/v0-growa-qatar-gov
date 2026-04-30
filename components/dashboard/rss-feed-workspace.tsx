'use client'

import { useMemo, useState } from 'react'
import { ExternalLink, Globe, Newspaper, RefreshCw, Rss } from 'lucide-react'

type FeedCategory = 'policy' | 'market' | 'weather' | 'technology'

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

const FEED_ITEMS: FeedItem[] = [
  {
    id: 'rss-1',
    title: 'Qatar extends smart irrigation pilots in northern farms',
    summary:
      'The pilot expands telemetry-guided irrigation scheduling to reduce water usage while keeping yield stability for greenhouse crops.',
    source: 'Ministry Agriculture Bulletin',
    sourceUrl: 'https://www.mme.gov.qa',
    category: 'policy',
    publishedAt: '2026-04-18T07:20:00Z',
    region: 'Al Khor',
  },
  {
    id: 'rss-2',
    title: 'Feed barley import prices soften across Gulf routes',
    summary:
      'Regional commodity desks report lower shipping pressure this week, with barley and maize contracts showing moderate downward movement.',
    source: 'Gulf Agri Markets',
    sourceUrl: 'https://www.zawya.com',
    category: 'market',
    publishedAt: '2026-04-18T10:40:00Z',
    region: 'GCC',
  },
  {
    id: 'rss-3',
    title: 'Dust and wind advisory issued for field operations',
    summary:
      'Farm operators are advised to postpone sensitive spraying windows and irrigation fine-tuning during high wind periods.',
    source: 'Qatar Meteorology',
    sourceUrl: 'https://www.qweather.gov.qa',
    category: 'weather',
    publishedAt: '2026-04-19T04:10:00Z',
    region: 'National',
  },
  {
    id: 'rss-4',
    title: 'Autonomous scouting drones detect early pest hotspots',
    summary:
      'New multispectral scouting runs identified early stress patterns and localized pest clusters in open-field tomato blocks.',
    source: 'AgriTech Review',
    sourceUrl: 'https://www.agritechreview.com',
    category: 'technology',
    publishedAt: '2026-04-17T15:15:00Z',
    region: 'Al Rayyan',
  },
  {
    id: 'rss-5',
    title: 'Cold-chain handling guidance updated for leafy exports',
    summary:
      'New quality guidance introduces stricter pre-cooling checks and transport handoff windows for leafy vegetable exports.',
    source: 'Food Logistics Update',
    sourceUrl: 'https://www.foodlogistics.com',
    category: 'policy',
    publishedAt: '2026-04-16T09:05:00Z',
    region: 'Doha',
  },
  {
    id: 'rss-6',
    title: 'Fertilizer spot market volatility eases after April peak',
    summary:
      'Traders indicate that nitrogen products are stabilizing, helping growers improve budget forecasting for next month applications.',
    source: 'MENA Inputs Desk',
    sourceUrl: 'https://www.argusmedia.com',
    category: 'market',
    publishedAt: '2026-04-15T13:30:00Z',
    region: 'MENA',
  },
]

const CATEGORY_LABELS: Record<FeedCategory, string> = {
  policy: 'Policy',
  market: 'Market',
  weather: 'Weather',
  technology: 'Technology',
}

function toRelativeDateLabel(value: string) {
  const published = new Date(value)
  const now = Date.now()
  const diffHours = Math.max(1, Math.round((now - published.getTime()) / (1000 * 60 * 60)))
  if (diffHours < 24) return `${diffHours}h ago`
  const days = Math.round(diffHours / 24)
  return `${days}d ago`
}

export function RssFeedWorkspace() {
  const [selectedCategory, setSelectedCategory] = useState<'all' | FeedCategory>('all')
  const [query, setQuery] = useState('')

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return FEED_ITEMS.filter((item) => {
      const categoryOk = selectedCategory === 'all' || item.category === selectedCategory
      const queryOk =
        !normalizedQuery ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.summary.toLowerCase().includes(normalizedQuery) ||
        item.source.toLowerCase().includes(normalizedQuery)
      return categoryOk && queryOk
    }).sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
  }, [query, selectedCategory])

  const highlights = useMemo(() => {
    return {
      total: filteredItems.length,
      weather: filteredItems.filter((item) => item.category === 'weather').length,
      market: filteredItems.filter((item) => item.category === 'market').length,
    }
  }, [filteredItems])

  return (
    <div className="space-y-5 p-6 pt-20">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
              <Rss className="h-5 w-5 text-[#07f880]" />
              RSS Feed
            </h1>
            <p className="mt-2 text-sm text-white/65">
              Curated agriculture intelligence stream with policy, market, weather, and technology updates.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-[#07f880]/30 bg-[#07f880]/10 px-3 py-2 text-sm text-[#07f880] hover:bg-[#07f880]/20"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Feed
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">Visible stories</p>
          <p className="mt-2 text-2xl font-semibold text-white">{highlights.total}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">Weather alerts</p>
          <p className="mt-2 text-2xl font-semibold text-amber-300">{highlights.weather}</p>
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
          placeholder="Search title, source, keyword..."
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
        {filteredItems.length === 0 ? (
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
