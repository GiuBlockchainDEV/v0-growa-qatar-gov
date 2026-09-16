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
    title: 'Fresh date sales at malls top 11.7 tonnes as MoM extends support for farmers',
    summary:
      'The Ministry of Municipality reported 11,731 kg of fresh dates sold across Doha Festival City, Landmark Mall, and Villaggio Mall from 24 local farms, extending marketing support beyond the 11th Local Dates Festival.',
    source: 'The Peninsula Qatar',
    sourceUrl:
      'https://thepeninsulaqatar.com/article/18/08/2026/fresh-date-sales-at-malls-top-117-tonnes-as-mom-extends-support-for-farmers',
    category: 'market',
    publishedAt: '2026-08-18T08:00:00+03:00',
    region: 'Qatar',
  },
  {
    id: 'rss-2',
    title: "Qatar's date production tops 26,000 tonnes with 75% self-sufficiency",
    summary:
      'Qatar now produces more than 26,000 tonnes of dates annually from 885 farms and over 638,000 palms, with the 11th Local Fresh Dates Festival at Souq Waqif drawing around 110,000 visitors.',
    source: 'The Peninsula Qatar',
    sourceUrl: 'https://thepeninsulaqatar.com/article/29/07/2026/qatars-date-production-tops-26000-tonnes',
    category: 'market',
    publishedAt: '2026-07-29T09:30:00+03:00',
    region: 'Qatar',
  },
  {
    id: 'rss-3',
    title: 'Qatar Meteorology warns of poor visibility as misty, foggy conditions expected this weekend',
    summary:
      'The Qatar Meteorology Department forecast misty to foggy conditions with poor horizontal visibility, daytime highs of 33–43°C, and southeasterly to northeasterly winds of 5–15 knots through the weekend.',
    source: 'The Peninsula Qatar',
    sourceUrl:
      'https://thepeninsulaqatar.com/article/27/08/2026/qatar-meteorology-warns-of-poor-visibility-as-misty-foggy-conditions-expected-this-weekend',
    category: 'weather',
    publishedAt: '2026-08-27T13:02:00+03:00',
    region: 'Qatar',
  },
  {
    id: 'rss-4',
    title: 'Labour Ministry urges heat safety measures as students return to school',
    summary:
      'The Ministry of Labour advised families to keep children hydrated, avoid direct sunlight, and wait for school buses in shaded areas as students return amid high August temperatures.',
    source: 'The Peninsula Qatar',
    sourceUrl:
      'https://thepeninsulaqatar.com/article/29/08/2026/labour-ministry-urges-heat-safety-measures-as-students-return-to-school',
    category: 'policy',
    publishedAt: '2026-08-29T14:49:00+03:00',
    region: 'Qatar',
  },
  {
    id: 'rss-5',
    title: 'Kuwait accelerates food security drive with major Al-Abdali and Al-Wafra water projects',
    summary:
      'Kuwait launched tenders to develop treated-water systems for Al-Abdali and Al-Wafra farms, including irrigation networks, a third transmission line, and SCADA monitoring to cut losses and support local production.',
    source: 'Times Kuwait',
    sourceUrl: 'https://timeskuwait.com/kuwait-accelerates-food-security-drive-with-major-al-abdali-and-al-wafra-water-projects/',
    category: 'water',
    publishedAt: '2026-08-17T10:00:00+03:00',
    region: 'GCC',
  },
  {
    id: 'rss-6',
    title: 'Estidamah showcases innovations in sustainable agriculture and water efficiency at COP17',
    summary:
      'Saudi Arabia presented precision irrigation, salinity monitoring, soilless farming, and high-tech greenhouse research at COP17, highlighting water use cut from 350 L to 4.9 L per kg of tomatoes.',
    source: 'Arab News',
    sourceUrl: 'https://www.arabnews.com/node/2656149/saudi-arabia',
    category: 'technology',
    publishedAt: '2026-08-28T18:01:00+03:00',
    region: 'GCC',
  },
  {
    id: 'rss-7',
    title: 'Over 12 tonnes of local dates and fruits sold at supermarkets',
    summary:
      'Qatar Tribune reports that mall sales events concluded with 11,731 kg of fresh dates and 1,161 kg of other local fruits from 24 farms, reflecting strong consumer demand for Qatari produce.',
    source: 'Qatar Tribune',
    sourceUrl: 'https://www.qatar-tribune.com/article/249242/nation/over-12-tonnes-of-local-dates-fruits-sold-at-supermarkets',
    category: 'market',
    publishedAt: '2026-08-18T07:30:00+03:00',
    region: 'Qatar',
  },
  {
    id: 'rss-8',
    title: 'Hydroponic farms help offset wartime shortages in Saudi Arabia',
    summary:
      'Glass greenhouse operators such as Dava in Al Kharj report up to 80% water savings and 135 tonnes of daily vegetable output, strengthening Gulf food supply as shipping disruptions pressure imports.',
    source: 'Christian Science Monitor',
    sourceUrl: 'https://www.csmonitor.com/World/Middle-East/2026/0817/saudi-arabia-hydroponic-farms-food-security',
    category: 'technology',
    publishedAt: '2026-08-17T12:00:00+03:00',
    region: 'GCC',
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
