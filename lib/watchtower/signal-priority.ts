import type { IntelligenceSignal, SignalSeverity } from '@/lib/domain/types'

const SEVERITY_RANK: Record<SignalSeverity, number> = {
  critical: 0,
  high: 1,
  attention: 2,
  info: 3,
}

export function compareSignalsByPriority(a: IntelligenceSignal, b: IntelligenceSignal): number {
  const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  if (severityDiff !== 0) return severityDiff

  const deviationA = Math.abs(a.deviationPercent ?? 0)
  const deviationB = Math.abs(b.deviationPercent ?? 0)
  if (deviationA !== deviationB) return deviationB - deviationA

  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
}

export function sortSignalsByPriority(signals: IntelligenceSignal[]): IntelligenceSignal[] {
  return [...signals].sort(compareSignalsByPriority)
}

export function isPrioritySignal(signal: IntelligenceSignal): boolean {
  return signal.severity === 'critical' || signal.severity === 'high'
}

export function partitionSignalsByPriority(signals: IntelligenceSignal[]) {
  const sorted = sortSignalsByPriority(signals)
  const priority = sorted.filter(isPrioritySignal)
  const routine = sorted.filter((signal) => !isPrioritySignal(signal))
  return { priority, routine, sorted }
}
