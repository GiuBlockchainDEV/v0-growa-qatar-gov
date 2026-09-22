import { describe, expect, it } from 'vitest'
import { partitionSignalsByPriority, sortSignalsByPriority } from '@/lib/watchtower/signal-priority'
import type { IntelligenceSignal } from '@/lib/domain/types'

function signal(id: string, severity: IntelligenceSignal['severity'], deviationPercent?: number): IntelligenceSignal {
  return {
    id,
    type: 'production',
    severity,
    title: id,
    summary: 'test',
    detectedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deviationPercent,
  }
}

describe('signal priority', () => {
  it('sorts by severity then deviation', () => {
    const sorted = sortSignalsByPriority([
      signal('info', 'info'),
      signal('critical', 'critical', 10),
      signal('high', 'high', 40),
      signal('attention', 'attention', 80),
    ])

    expect(sorted.map((entry) => entry.id)).toEqual(['critical', 'high', 'attention', 'info'])
  })

  it('partitions priority and routine signals', () => {
    const { priority, routine } = partitionSignalsByPriority([
      signal('info', 'info'),
      signal('critical', 'critical'),
      signal('attention', 'attention'),
    ])

    expect(priority.map((entry) => entry.id)).toEqual(['critical'])
    expect(routine.map((entry) => entry.id)).toEqual(['attention', 'info'])
  })
})
