'use client'

import { useEffect, useState } from 'react'
import { DashboardQueryLink } from '@/components/dashboard/dashboard-query-link'
import { Globe, ArrowRight } from 'lucide-react'
import { Card } from '@/components/brand/layout'
import { useI18n } from '@/lib/i18n'

interface FeedItem {
  id: string
  title: string
  source: string
  category: string
  publishedAt: string
}

export function ExternalIntelligencePanel() {
  const { tr } = useI18n()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/rss/feeds?limit=4', { cache: 'no-store' })
      .then((r) => r.json())
      .then((payload) => {
        const feedItems = Array.isArray(payload?.items) ? payload.items : []
        setItems(
          feedItems.slice(0, 3).map((item: Record<string, unknown>, i: number) => ({
            id: String(item.id || i),
            title: String(item.title || 'Untitled'),
            source: String(item.source || item.feedName || 'RSS'),
            category: String(item.category || 'general'),
            publishedAt: String(item.publishedAt || item.pubDate || ''),
          }))
        )
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card
      icon={Globe}
      title={tr('External intelligence')}
    >
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-9 bg-muted rounded-md animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-content-soft">{tr('No relevant external feeds available.')}</p>
      ) : (
        <ul className="divide-y divide-dotted divide-line-strong -my-1">
          {items.map((item) => (
            <li key={item.id} className="py-2.5">
              <p className="text-[13px] text-content line-clamp-2 leading-snug">{item.title}</p>
              <p className="text-[11px] text-content-soft mt-1">{item.source} · {tr(item.category.charAt(0).toUpperCase() + item.category.slice(1))}</p>
            </li>
          ))}
        </ul>
      )}
      <DashboardQueryLink href="/dashboard?module=rss-feed" className="inline-flex items-center gap-1 text-[12px] text-sage-700 hover:text-ink transition-colors">
        {tr('All feeds')}
        <ArrowRight strokeWidth={1.5} className="h-3.5 w-3.5 rtl:-scale-x-100" />
      </DashboardQueryLink>
    </Card>
  )
}
