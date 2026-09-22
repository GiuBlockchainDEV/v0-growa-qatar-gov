import { NextResponse } from 'next/server'
import { fetchRssFeedItems } from '@/lib/rss/fetch-feeds'

export const revalidate = 300

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const requestedLimit = Number(searchParams.get('limit') || 60)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100)
    : 60

  try {
    const payload = await fetchRssFeedItems(limit)
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load RSS feeds'
    return NextResponse.json({ error: message, items: [], meta: { fetchedAt: new Date().toISOString() } }, { status: 500 })
  }
}
