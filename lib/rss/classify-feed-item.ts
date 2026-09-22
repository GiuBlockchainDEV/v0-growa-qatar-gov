import type { FeedCategory } from '@/lib/rss/feed-sources'

const AGRICULTURE_KEYWORDS = [
  'agri',
  'farm',
  'farmer',
  'farming',
  'crop',
  'harvest',
  'food security',
  'food production',
  'food supply',
  'food basket',
  'livestock',
  'poultry',
  'dairy',
  'fisher',
  'aquacult',
  'hydropon',
  'greenhouse',
  'vertical farm',
  'irrigation',
  'desalination',
  'water efficiency',
  'water project',
  'palm',
  'date',
  'vegetable',
  'fruit',
  'tonnes',
  'agritech',
  'agri-tech',
  'precision ag',
  'sustainable ag',
  'silos',
  'wheat',
  'tomato',
  'ministry of municipality',
  'municipality',
  'hassad',
  'nutrition',
  'organic',
  'fertilizer',
  'fisheries',
  'marine farm',
  'desert green',
  'food systems',
  'food waste',
  'agrifood',
  'agro',
  'greenhouse',
  'livestock',
]

const CATEGORY_RULES: Array<{ category: FeedCategory; keywords: string[] }> = [
  {
    category: 'weather',
    keywords: ['weather', 'fog', 'mist', 'visibility', 'temperature', 'heat', 'meteorology', 'climate', 'storm', 'rain'],
  },
  {
    category: 'water',
    keywords: ['water', 'irrigation', 'desalination', 'aquifer', 'dam', 'scada', 'treated-water'],
  },
  {
    category: 'policy',
    keywords: ['ministry', 'government', 'policy', 'regulation', 'law', 'cabinet', 'municipality', 'labour', 'safety'],
  },
  {
    category: 'technology',
    keywords: [
      'agritech',
      'agri-tech',
      'hydropon',
      'innovation',
      'startup',
      'ai ',
      ' artificial intelligence',
      'precision',
      'greenhouse',
      'technology',
      'analytics',
      'automation',
    ],
  },
  {
    category: 'market',
    keywords: ['sales', 'market', 'production', 'tonnes', 'festival', 'export', 'import', 'price', 'trade', 'investment'],
  },
]

function normalizeText(input: string) {
  return input.toLowerCase().replace(/\s+/g, ' ')
}

export function isAgricultureRelevant(title: string, description: string) {
  const haystack = normalizeText(`${title} ${description}`)
  return AGRICULTURE_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

export function classifyFeedItem(title: string, description: string, fallback: FeedCategory): FeedCategory {
  const haystack = normalizeText(`${title} ${description}`)

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule.category
    }
  }

  return fallback
}

export function buildFeedItemId(sourceId: string, guid: string) {
  return `${sourceId}:${guid}`.replace(/\s+/g, '-').slice(0, 180)
}

export function summarizeDescription(description: string, maxLength = 280) {
  const normalized = description.trim()
  if (!normalized) return 'No summary available for this article.'
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trim()}…`
}
