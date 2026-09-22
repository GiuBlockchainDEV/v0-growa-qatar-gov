export interface ParsedRssItem {
  title: string
  link: string
  description: string
  publishedAt: string | null
  guid: string | null
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function stripHtml(input: string) {
  return decodeHtmlEntities(input)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readTag(block: string, tag: string) {
  const patterns = [
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'),
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = block.match(pattern)
    if (match?.[1]) {
      return decodeHtmlEntities(match[1])
    }
  }

  return ''
}

function normalizeDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export function parseRssXml(xml: string): ParsedRssItem[] {
  const items: ParsedRssItem[] = []
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []

  for (const block of itemBlocks) {
    const title = stripHtml(readTag(block, 'title'))
    const link = readTag(block, 'link') || readTag(block, 'guid')
    const description = stripHtml(readTag(block, 'description') || readTag(block, 'content:encoded') || readTag(block, 'summary'))
    const publishedAt = normalizeDate(
      readTag(block, 'pubDate') || readTag(block, 'published') || readTag(block, 'updated') || readTag(block, 'dc:date')
    )
    const guid = readTag(block, 'guid') || link || title

    if (!title || !link) continue

    items.push({
      title,
      link,
      description,
      publishedAt,
      guid,
    })
  }

  return items
}
