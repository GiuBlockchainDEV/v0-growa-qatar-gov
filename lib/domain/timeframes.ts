import type { WatchtowerTimeframe } from '@/lib/domain/types'

export const WATCHTOWER_TIMEFRAMES: WatchtowerTimeframe[] = ['now', '24h', '7d', '30d', 'season']

export function parseWatchtowerTimeframe(input: string | null | undefined): WatchtowerTimeframe {
  const normalized = input?.trim().toLowerCase()
  if (normalized && WATCHTOWER_TIMEFRAMES.includes(normalized as WatchtowerTimeframe)) {
    return normalized as WatchtowerTimeframe
  }
  return 'season'
}

export function timeframeLabel(timeframe: WatchtowerTimeframe): string {
  switch (timeframe) {
    case 'now':
      return 'NOW'
    case '24h':
      return '24H'
    case '7d':
      return '7D'
    case '30d':
      return '30D'
    case 'season':
      return 'SEASON'
    default:
      return timeframe.toUpperCase()
  }
}

export function timeframeComparisonLabel(timeframe: WatchtowerTimeframe): string {
  switch (timeframe) {
    case 'now':
      return 'vs previous hour'
    case '24h':
      return 'vs previous 24 hours'
    case '7d':
      return 'vs previous 7 days'
    case '30d':
      return 'vs previous 30 days'
    case 'season':
      return 'vs seasonal baseline'
    default:
      return 'vs previous period'
  }
}

export interface TimeWindow {
  start: Date
  end: Date
  comparisonStart: Date
  comparisonEnd: Date
  label: string
}

export function resolveTimeWindow(timeframe: WatchtowerTimeframe, reference = new Date()): TimeWindow {
  const end = new Date(reference)
  const start = new Date(reference)
  const comparisonEnd = new Date(reference)
  const comparisonStart = new Date(reference)

  switch (timeframe) {
    case 'now':
      start.setHours(start.getHours() - 1)
      comparisonEnd.setHours(comparisonEnd.getHours() - 1)
      comparisonStart.setHours(comparisonStart.getHours() - 2)
      break
    case '24h':
      start.setDate(start.getDate() - 1)
      comparisonEnd.setDate(comparisonEnd.getDate() - 1)
      comparisonStart.setDate(comparisonStart.getDate() - 2)
      break
    case '7d':
      start.setDate(start.getDate() - 7)
      comparisonEnd.setDate(comparisonEnd.getDate() - 7)
      comparisonStart.setDate(comparisonStart.getDate() - 14)
      break
    case '30d':
      start.setDate(start.getDate() - 30)
      comparisonEnd.setDate(comparisonEnd.getDate() - 30)
      comparisonStart.setDate(comparisonStart.getDate() - 60)
      break
    case 'season':
      start.setMonth(start.getMonth() - 3)
      comparisonEnd.setMonth(comparisonEnd.getMonth() - 3)
      comparisonStart.setMonth(comparisonStart.getMonth() - 6)
      break
  }

  return {
    start,
    end,
    comparisonStart,
    comparisonEnd,
    label: timeframeComparisonLabel(timeframe),
  }
}
