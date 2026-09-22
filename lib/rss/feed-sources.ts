export type FeedCategory = 'policy' | 'market' | 'water' | 'weather' | 'technology'

export type FeedFilterMode = 'all' | 'agriculture'

export interface RssFeedSource {
  id: string
  name: string
  url: string
  region: 'Qatar' | 'GCC' | 'Global'
  defaultCategory: FeedCategory
  filterMode: FeedFilterMode
}

export const RSS_FEED_SOURCES: RssFeedSource[] = [
  {
    id: 'agritech-mea',
    name: 'AgriTech Middle East & Africa',
    url: 'https://www.agritechmea.com/feed',
    region: 'GCC',
    defaultCategory: 'technology',
    filterMode: 'all',
  },
  {
    id: 'agfunder',
    name: 'AgFunder News',
    url: 'https://feeds.feedburner.com/agfundernews',
    region: 'Global',
    defaultCategory: 'technology',
    filterMode: 'all',
  },
  {
    id: 'google-news-qatar-agri',
    name: 'Google News — Qatar Agriculture',
    url:
      'https://news.google.com/rss/search?q=Qatar+agriculture+OR+Qatar+farming+OR+Qatar+dates+OR+Qatar+food+security+OR+Qatar+hydroponic&hl=en&gl=QA&ceid=QA:en',
    region: 'Qatar',
    defaultCategory: 'market',
    filterMode: 'all',
  },
  {
    id: 'google-news-gcc-agri',
    name: 'Google News — GCC Food & Agriculture',
    url:
      'https://news.google.com/rss/search?q=GCC+agriculture+OR+Gulf+food+security+OR+Saudi+agritech+OR+UAE+hydroponic+OR+Gulf+greenhouse&hl=en&gl=AE&ceid=AE:en',
    region: 'GCC',
    defaultCategory: 'market',
    filterMode: 'all',
  },
  {
    id: 'qatar-tribune',
    name: 'Qatar Tribune',
    url: 'https://www.qatar-tribune.com/rssFeed/0',
    region: 'Qatar',
    defaultCategory: 'market',
    filterMode: 'agriculture',
  },
  {
    id: 'gulf-times',
    name: 'Gulf Times',
    url: 'https://www.gulf-times.com/rssFeed/0',
    region: 'GCC',
    defaultCategory: 'market',
    filterMode: 'agriculture',
  },
  {
    id: 'gulf-times-qatar',
    name: 'Gulf Times — Qatar',
    url: 'https://www.gulf-times.com/rssFeed/1',
    region: 'Qatar',
    defaultCategory: 'policy',
    filterMode: 'agriculture',
  },
  {
    id: 'arab-news',
    name: 'Arab News',
    url: 'https://www.arabnews.com/rss.xml',
    region: 'GCC',
    defaultCategory: 'market',
    filterMode: 'agriculture',
  },
]
