import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const files = [
  'components/dashboard/watchtower-workspace.tsx',
  'components/dashboard/watchtower/resilience-desk.tsx',
  'components/dashboard/watchtower/scenario-room.tsx',
  'components/dashboard/watchtower/operations-pulse.tsx',
  'components/dashboard/nfii-ops/operations-workspace.tsx',
] as const
function read(path: string): string {
  return readFileSync(join(process.cwd(),path),'utf8')
}

describe('NFII Growa brand consistency', () => {
  it('uses the existing Growa design system without dark or blue palettes',()=>{
    const stylesheet=read('styles/nfii-command.css')
    expect(stylesheet).toContain('var(--surface-card)')
    expect(stylesheet).toContain('var(--text-primary)')
    expect(stylesheet).toContain('var(--border-subtle)')
    expect(stylesheet).toContain('var(--growa-cream-100)')
    expect(stylesheet).toContain('var(--growa-ink)')
    expect(stylesheet).toContain('var(--focus-ring)')
    expect(stylesheet).toContain('var(--radius-pill)')
    expect(stylesheet).not.toMatch(/#[0-9a-fA-F]{6}\b/)
    expect(stylesheet).not.toContain('color-scheme: dark')
    expect(stylesheet).not.toContain('--surface-page: #')
  })

  it.each(files)('%s has no hardcoded blue or dark hex colors',path=>{
    const component=read(path)
    expect(component).not.toMatch(/#[0-9a-fA-F]{6}\b/)
    expect(component).not.toMatch(/(?:bg|border|text|divide)-\[#/)
  })

  it('reuses the existing PageHeader in both app surfaces',()=>{
    expect(read(files[0])).toContain("import { PageHeader } from '@/components/brand/layout'")
    expect(read(files[4])).toContain("import { PageHeader } from '@/components/brand/layout'")
    expect(read(files[0])).toContain('<PageHeader')
    expect(read(files[4])).toContain('<PageHeader')
  })

  it('preserves the complete operational workflow and navigation',()=>{
    const command=read(files[0])
    const operations=read(files[4])
    for (const path of ['/dashboard/procurement','/dashboard/logistics','/dashboard/reserves']) {
      expect(command).toContain(path)
      expect(operations).toContain(path)
    }
    expect(command).toContain('<WatchtowerFoodCommandCenter />')
    expect(command).toContain('<WatchtowerScenarioRoom />')
    expect(command).toContain('<WatchtowerOperationsPulse />')
    expect(operations).toContain('/api/nfii/operations')
    expect(operations).toContain('/api/nfii/operations/action')
  })
})
