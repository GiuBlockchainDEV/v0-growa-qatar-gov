'use client'

import { useMemo, useState } from 'react'
import { ExternalLink, Globe, Newspaper, RefreshCw, Rss } from 'lucide-react'

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

const FEED_ITEMS: FeedItem[] = [
  {
    id: 'rss-1',
    title: 'Qatar greenhouse expansion focuses on high-efficiency vegetable production',
    summary:
      'Protected agriculture programs continue to prioritize local vegetable supply, climate control, and measured irrigation in farm clusters.',
    source: 'Qatar Ministry of Municipality',
    sourceUrl: 'https://www.mm.gov.qa',
    category: 'policy',
    publishedAt: '2026-06-10T06:30:00Z',
    region: 'Qatar',
  },
  {
    id: 'rss-2',
    title: 'Gulf feed grain desks monitor barley and maize freight costs',
    summary:
      'Regional importers are tracking feed barley, maize, and soybean meal landed costs as shipping and currency movements affect livestock margins.',
    source: 'Zawya MENA Markets',
    sourceUrl: 'https://www.zawya.com/en/mena',
    category: 'market',
    publishedAt: '2026-06-10T04:45:00Z',
    region: 'GCC',
  },
  {
    id: 'rss-3',
    title: 'Heat and dust advisory: adjust greenhouse ventilation and irrigation windows',
    summary:
      'Farm operators should avoid peak afternoon irrigation, check pad-and-fan systems, and delay sensitive spraying during dusty wind periods.',
    source: 'Qatar Meteorology',
    sourceUrl: 'https://www.qweather.gov.qa',
    category: 'weather',
    publishedAt: '2026-06-09T18:20:00Z',
    region: 'Qatar',
  },
  {
    id: 'rss-4',
    title: 'Treated wastewater reuse remains a priority for Gulf farm clusters',
    summary:
      'Municipal and utility programs are pushing reclaimed water use for landscaping, fodder, and controlled farm applications to reduce pressure on desalinated supply.',
    source: 'Ashghal',
    sourceUrl: 'https://www.ashghal.gov.qa',
    category: 'water',
    publishedAt: '2026-06-09T11:05:00Z',
    region: 'Qatar',
  },
  {
    id: 'rss-5',
    title: 'ICBA trials salt-tolerant crops for arid Gulf production systems',
    summary:
      'Biosaline agriculture research is relevant for farms managing brackish groundwater, salinity stress, and high summer evapotranspiration.',
    source: 'International Center for Biosaline Agriculture',
    sourceUrl: 'https://www.biosaline.org',
    category: 'technology',
    publishedAt: '2026-06-08T14:15:00Z',
    region: 'UAE / GCC',
  },
  {
    id: 'rss-6',
    title: 'Hydroponic capacity growth raises regional fresh produce competition',
    summary:
      'New greenhouse and vertical farming capacity across Saudi Arabia, the UAE, and Qatar is reshaping lettuce, tomato, cucumber, and herb supply windows.',
    source: 'Gulf Agriculture',
    sourceUrl: 'https://www.gulfagriculture.com',
    category: 'market',
    publishedAt: '2026-06-07T09:30:00Z',
    region: 'Gulf',
  },
  {
    id: 'rss-7',
    title: 'GCC food security teams review local production and import resilience',
    summary:
      'Regional coordination remains focused on strategic reserves, domestic production support, and import route resilience for priority food staples.',
    source: 'GCC Secretariat',
    sourceUrl: 'https://www.gcc-sg.org',
    category: 'policy',
    publishedAt: '2026-06-06T12:10:00Z',
    region: 'GCC',
  },
  {
    id: 'rss-8',
    title: 'FAO NENA highlights water productivity for protected agriculture',
    summary:
      'Regional guidance emphasizes crop-per-drop performance, greenhouse monitoring, and climate-smart practices for arid country food systems.',
    source: 'FAO Near East and North Africa',
    sourceUrl: 'https://www.fao.org/neareast/en',
    category: 'water',
    publishedAt: '2026-06-05T08:00:00Z',
    region: 'Gulf / MENA',
  },
]

const CATEGORY_LABELS: Record<FeedCategory, string> = {
  policy: 'Policy',
  market: 'Market',
  water: 'Water',
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
        item.source.toLowerCase().includes(normalizedQuery) ||
        item.region.toLowerCase().includes(normalizedQuery)
      return categoryOk && queryOk
    }).sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
  }, [query, selectedCategory])

  const highlights = useMemo(() => {
    return {
      total: filteredItems.length,
      qatar: filteredItems.filter((item) => item.region.toLowerCase().includes('qatar')).length,
      waterWeather: filteredItems.filter((item) => item.category === 'water' || item.category === 'weather').length,
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
              Qatar & Gulf Agriculture RSS Feed
            </h1>
            <p className="mt-2 text-sm text-white/65">
              Curated agriculture intelligence for Qatar and the Gulf, covering policy, markets, water, weather, and agri-tech.
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
