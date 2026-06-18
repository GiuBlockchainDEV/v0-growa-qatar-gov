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
    title: 'Date palm farmers urged to maintain harvest hygiene and monitor infestations',
    summary:
      'As the date harvesting season begins, the Ministry of Municipality calls on farmers to clean harvest boxes and tools regularly, monitor palm trees for spider mites, and apply treatment early to protect crop quality.',
    source: 'The Peninsula Qatar',
    sourceUrl: 'https://thepeninsulaqatar.com/article/17/06/2026/date-palm-farmers-urged-to-maintain-harvest-hygiene-monitor-infestations',
    category: 'policy',
    publishedAt: '2026-06-17T08:00:00Z',
    region: 'Qatar',
  },
  {
    id: 'rss-2',
    title: '2025-26 season delivers strongest agricultural yield in recent years',
    summary:
      'Local farm managers report around 20% production growth thanks to improved government support, stronger marketing channels, and higher procurement through Mahaseel and the central market, despite March storm damage to some greenhouses.',
    source: 'Gulf Times',
    sourceUrl: 'https://menafn.com/1111126009/Seasons-Agriculture-Yield-The-Best-In-Years-Thanks-To-Government-Support',
    category: 'market',
    publishedAt: '2026-06-16T10:30:00Z',
    region: 'Qatar',
  },
  {
    id: 'rss-3',
    title: 'June heat advisory: daytime highs above 40°C, limit outdoor farm work to early hours',
    summary:
      'Qatar enters peak summer with average highs near 42°C and minimal rainfall. Farm operators should schedule irrigation and field work before 10:00, ensure greenhouse cooling systems are serviced, and increase hydration protocols for outdoor crews.',
    source: 'Qatar Meteorology',
    sourceUrl: 'https://www.qweather.gov.qa',
    category: 'weather',
    publishedAt: '2026-06-15T05:15:00Z',
    region: 'Qatar',
  },
  {
    id: 'rss-4',
    title: 'Ministry issues red palm weevil advisory ahead of date harvest',
    summary:
      'Farmers are urged to conduct regular palm tree inspections for early detection of red palm weevil infestations, discontinue pesticides once fruits ripen, and submit pest control requests through the Oun mobile application.',
    source: 'Qatar Ministry of Municipality',
    sourceUrl: 'https://thepeninsulaqatar.com/article/14/06/2026/farmers-urged-to-intensify-palm-tree-monitoring-against-red-palm-weevil',
    category: 'policy',
    publishedAt: '2026-06-14T07:45:00Z',
    region: 'Qatar',
  },
  {
    id: 'rss-5',
    title: 'Dubai GigaFarm nears first harvest with 20 vertical farming towers going online',
    summary:
      'Construction of the world\'s first circular GigaFarm in Food Tech Valley is nearing completion, with the first phase bringing 20 Growth Towers online this summer and crops expected to replace about 1% of UAE fresh produce imports.',
    source: 'Food Business MEA',
    sourceUrl: 'https://www.foodbusinessmea.com/gigafarm-in-dubai-builds-worlds-first-circular-vertical-farming-system-first-harvest-due-this-year/',
    category: 'technology',
    publishedAt: '2026-06-09T12:00:00Z',
    region: 'UAE / GCC',
  },
  {
    id: 'rss-6',
    title: 'Al Ain vertical tomato farm targets 150,000 kg annual output with 90% water savings',
    summary:
      'UNS Vertical Farms opened a 10,000 sqm controlled-environment facility using hydroponics, IoT, and AI to produce tomatoes year-round, delivering to retail and HORECA customers within 24–48 hours of harvest.',
    source: 'Gulf News',
    sourceUrl: 'https://gulfnews.com/business/retail/uae-tomato-farm-cuts-import-risk-with-150000kg-local-supply-push-1.500525958',
    category: 'market',
    publishedAt: '2026-06-11T09:00:00Z',
    region: 'UAE',
  },
  {
    id: 'rss-7',
    title: 'GCC workshop advances AI and IoT adoption for water-efficient farm management',
    summary:
      'A three-day Gulf workshop in Muscat examined a joint GCC-ICARDA project to deploy AI, IoT, and digital tools across open-field crops, date palm plantations, and protected agriculture to boost productivity in arid environments.',
    source: 'Muscat Daily',
    sourceUrl: 'https://www.muscatdaily.com/2026/06/08/gcc-turns-to-ai-to-battle-water-scarcity-secure-food-supply/',
    category: 'water',
    publishedAt: '2026-06-08T11:30:00Z',
    region: 'GCC',
  },
  {
    id: 'rss-8',
    title: 'QRDI Council prepares sixth-cycle food security research awards for June–July',
    summary:
      'The Qatar Research, Development and Innovation Council is finalizing awards from its sixth joint food security call with the Ministry of Municipality, covering greenhouse disease surveillance, agricultural robotics, and digital food system innovation.',
    source: 'QRDI Council',
    sourceUrl: 'https://www.qrdi.org.qa',
    category: 'technology',
    publishedAt: '2026-06-06T08:00:00Z',
    region: 'Qatar',
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
