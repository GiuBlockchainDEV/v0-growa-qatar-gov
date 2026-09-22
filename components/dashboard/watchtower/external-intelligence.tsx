'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Globe, ArrowRight } from 'lucide-react'

interface FeedItem {
  id: string
  title: string
  source: string
  category: string
  publishedAt: string
}

export function ExternalIntelligencePanel() {
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
    <div className="rounded-lg border border-white/10 bg-[#0a0d12] p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-white/40" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">External intelligence</h3>
        </div>
        <Link href="/dashboard?module=rss-feed" className="text-[10px] text-white/40 hover:text-[#07f880]">
          All feeds →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-8 bg-white/5 rounded animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-white/40">No relevant external feeds available.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded border border-white/5 px-2 py-1.5">
              <p className="text-[11px] text-white/75 line-clamp-2 leading-snug">{item.title}</p>
              <p className="text-[9px] text-white/35 mt-0.5">{item.source} · {item.category}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
