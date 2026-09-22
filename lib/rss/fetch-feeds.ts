import { RSS_FEED_SOURCES, type FeedFilterMode, type RssFeedSource } from '@/lib/rss/feed-sources'
import {
  buildFeedItemId,
  classifyFeedItem,
  isAgricultureRelevant,
  summarizeDescription,
} from '@/lib/rss/classify-feed-item'
import { parseRssXml } from '@/lib/rss/parse-feed'

export interface RssFeedItem {
  id: string
  title: string
  summary: string
  source: string
  sourceUrl: string
  category: 'policy' | 'market' | 'water' | 'weather' | 'technology'
  publishedAt: string
  region: string
  feedId: string
}

const RSS_USER_AGENT = 'Mozilla/5.0 (compatible; GrowaRSS/1.0; +https://growa.ai)'

async function fetchFeedXml(source: RssFeedSource) {
  const response = await fetch(source.url, {
    headers: {
      'User-Agent': RSS_USER_AGENT,
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(12_000),
  })

  if (!response.ok) {
    throw new Error(`Feed ${source.id} returned ${response.status}`)
  }

  return response.text()
}

function shouldIncludeItem(
  filterMode: FeedFilterMode,
  title: string,
  description: string
) {
  if (filterMode === 'all') return true
  return isAgricultureRelevant(title, description)
}

export async function fetchRssFeedItems(limit = 60) {
  const settled = await Promise.allSettled(
    RSS_FEED_SOURCES.map(async (source) => {
      const xml = await fetchFeedXml(source)
      const parsed = parseRssXml(xml)

      return parsed
        .filter((item) => shouldIncludeItem(source.filterMode, item.title, item.description))
        .map((item) => {
          const publishedAt = item.publishedAt || new Date().toISOString()
          const category = classifyFeedItem(item.title, item.description, source.defaultCategory)

          return {
            id: buildFeedItemId(source.id, item.guid || item.link),
            title: item.title,
            summary: summarizeDescription(item.description),
            source: source.name,
            sourceUrl: item.link,
            category,
            publishedAt,
            region: source.region,
            feedId: source.id,
          } satisfies RssFeedItem
        })
    })
  )

  const errors: string[] = []
  const merged: RssFeedItem[] = []

  for (const [index, result] of settled.entries()) {
    const source = RSS_FEED_SOURCES[index]
    if (result.status === 'fulfilled') {
      merged.push(...result.value)
      continue
    }
    const message = result.reason instanceof Error ? result.reason.message : 'Unknown feed error'
    errors.push(`${source.name}: ${message}`)
  }

  const deduped = new Map<string, RssFeedItem>()
  for (const item of merged) {
    const key = item.sourceUrl.trim().toLowerCase()
    if (!deduped.has(key)) {
      deduped.set(key, item)
    }
  }

  const items = Array.from(deduped.values()).sort(
    (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)
  )

  return {
    items: items.slice(0, limit),
    meta: {
      fetchedAt: new Date().toISOString(),
      sourceCount: RSS_FEED_SOURCES.length,
      successCount: settled.filter((entry) => entry.status === 'fulfilled').length,
      errors,
    },
  }
}
