import { describe, expect, it } from 'vitest'
import { getModuleStatus, isLiveModule } from '@/lib/navigation/module-status'

describe('module-status', () => {
  it('marks watchtower as live', () => {
    expect(getModuleStatus('watchtower').status).toBe('live')
    expect(isLiveModule('watchtower')).toBe(true)
  })

  it('marks monitoring as upcoming', () => {
    expect(getModuleStatus('monitoring').status).toBe('upcoming')
    expect(isLiveModule('monitoring')).toBe(false)
  })

  it('normalizes module keys', () => {
    expect(getModuleStatus('alerts_center').status).toBe('partial')
  })
})
