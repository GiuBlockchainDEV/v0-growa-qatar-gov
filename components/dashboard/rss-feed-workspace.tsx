'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Globe, RefreshCw, Search } from 'lucide-react'
import { CardAction, EmptyState, ErrorState, LoadingState, Notice, PageHeader, Tile } from '@/components/brand/layout'
import { Field, Metric, SegmentedToggle, StatusDot, Tag } from '@/components/brand/ui'
import { useI18n } from '@/lib/i18n'

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

type Translate = ReturnType<typeof useI18n>['tr']

function toRelativeDateLabel(value: string, tr: Translate) {
  const published = new Date(value)
  if (Number.isNaN(published.getTime())) return tr('Recently')
  const now = Date.now()
  const diffHours = Math.max(1, Math.round((now - published.getTime()) / (1000 * 60 * 60)))
  if (diffHours < 24) return tr('{hours}h ago', { hours: diffHours })
  const days = Math.round(diffHours / 24)
  return tr('{days}d ago', { days })
}

export function RssFeedWorkspace() {
  const { tr } = useI18n()
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
    <div className="growa h-full overflow-y-auto overscroll-contain bg-background">
      <div className="mx-auto max-w-5xl p-6 space-y-4">
        <PageHeader
          eyebrow={tr('External intelligence')}
          title={tr('Qatar and Gulf agriculture feed')}
          subtitle={
            <>
              {tr('Live agriculture and agritech intelligence from Qatar, the Gulf and global AgriTech sources.')}
              {lastFetchedAt ? (
                <span className="block mt-1 text-[12px]">
                  {tr('Last updated {time}', { time: toRelativeDateLabel(lastFetchedAt, tr) })} · AgriTech MEA, AgFunder, Gulf Times, Qatar Tribune, Arab News, Google News
                </span>
              ) : null}
            </>
          }
          actions={<CardAction icon={RefreshCw} label={tr('Refresh feed')} onClick={() => void loadFeeds(true)} disabled={loading || refreshing} spinning={refreshing} />}
          className="!mb-2"
        />

        {error ? <ErrorState message={error} onRetry={() => void loadFeeds(true)} retryLabel={tr('Retry')} /> : null}
        {feedWarnings.length > 0 ? (
          <Notice tone="warning" title={tr('Some sources were temporarily unavailable')}>
            {feedWarnings.join(' · ')}
          </Notice>
        ) : null}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Tile className="p-4" style={{ borderRadius: 'var(--radius-xl)' }}><Metric label={tr('Visible stories')} value={highlights.total} /></Tile>
          <Tile className="p-4" style={{ borderRadius: 'var(--radius-xl)' }}><Metric label={tr('Qatar stories')} value={highlights.qatar} /></Tile>
          <Tile className="p-4" style={{ borderRadius: 'var(--radius-xl)' }}>
            <Metric label={<span className="inline-flex items-center gap-1.5"><StatusDot tone="warning" size={6} />{tr('Water and weather')}</span>} value={highlights.waterWeather} />
          </Tile>
          <Tile className="p-4" style={{ borderRadius: 'var(--radius-xl)' }}><Metric label={tr('Market updates')} value={highlights.market} /></Tile>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Field
            className="flex-1 min-w-[240px]"
            aria-label={tr('Search the feed')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tr('Search title, source, region, keyword…')}
            prefix={<Search strokeWidth={1.5} className="h-4 w-4" />}
          />
          <div className="overflow-x-auto scrollbar-none">
            <SegmentedToggle
              size="sm"
              ariaLabel={tr('Category')}
              value={selectedCategory}
              onChange={(v) => setSelectedCategory(v as typeof selectedCategory)}
              options={[
                { value: 'all', label: tr('All') },
                ...(Object.keys(CATEGORY_LABELS) as FeedCategory[]).map((category) => ({ value: category, label: tr(CATEGORY_LABELS[category]) })),
              ]}
            />
          </div>
        </div>

        {loading ? (
          <LoadingState label={tr('Loading live feeds from Qatar and the Gulf…')} />
        ) : filteredItems.length === 0 ? (
          <div className="bg-card border border-line" style={{ borderRadius: 'var(--radius-xl)' }}>
            <EmptyState title={tr('No stories match your filters')} />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <article
                key={item.id}
                className="bg-card border border-line p-5 transition-colors hover:border-line-strong"
                style={{ borderRadius: 'var(--radius-xl)' }}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-content-soft">
                  <Tag size="sm" variant="outline">{CATEGORY_LABELS[item.category] ? tr(CATEGORY_LABELS[item.category]) : item.category}</Tag>
                  <span>{item.region}</span>
                  <span aria-hidden="true">·</span>
                  <span>{toRelativeDateLabel(item.publishedAt, tr)}</span>
                </div>
                <h2 className="text-[16px] text-content" style={{ fontWeight: 500 }}>{item.title}</h2>
                {item.summary && <p className="mt-1.5 text-[14px] text-content-soft leading-[1.45]">{item.summary}</p>}
                <div className="mt-4 pt-3 border-t border-dotted border-line-strong flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-[12px] text-content-soft">
                    <Globe strokeWidth={1.5} className="h-3.5 w-3.5" />
                    {item.source}
                  </span>
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] text-sage-700 hover:text-ink transition-colors"
                  >
                    {tr('Open source')}
                    <ExternalLink strokeWidth={1.5} className="h-3.5 w-3.5" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
