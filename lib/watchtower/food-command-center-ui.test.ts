import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

const component=readFileSync(join(process.cwd(),
  'components/dashboard/watchtower/food-command-center.tsx'),'utf8')
const css=readFileSync(join(process.cwd(),
  'components/dashboard/watchtower/food-command-center.module.css'),'utf8')

describe('Food Security Command Center interface',()=>{
  it('preserves live organization-scoped data without a fabricated fallback',()=>{
    expect(component).toContain("/api/watchtower/food-security?")
    expect(component).toContain("payload.scope !== 'organization'")
    expect(component).toContain("payload.sourceMode !== 'live'")
    expect(component).toContain("setLiveData(null)")
    expect(component).not.toContain('buildIllustrativeFoodPosture')
    expect(component).not.toContain('Math.random(')
  })
  it('shows explicit uncertainty and only derived risk counts',()=>{
    expect(component).toContain("assessed ? format(data.deficitCount, 0) : '—'")
    expect(component).toContain('Unknown does not mean safe')
    expect(component).toContain('Risk cannot be classified without evidence.')
    expect(component).toContain('readiness / 100')
    expect(component).toContain('style={{ width: coverageWidth(row.coverageDays)')
  })
  it('preserves decision workflow, bilingual UI and historic periods',()=>{
    expect(component).toContain('WatchtowerResilienceDesk posture={data}')
    expect(component).toContain('scopeLink(orgId, row.commodityId)')
    expect(component).toContain('tx(')
    for(const period of ['7, 30, 90, 180'])
      expect(component).toContain(period)
  })
  it('uses Growa brand tokens, risk semantics and responsive layout',()=>{
    expect(css).toContain('background:var(--growa-ink)')
    expect(css).toContain('[data-band=\'unknown\']')
    expect(css).toContain('var(--status-critical)')
    expect(css).toContain('@media(max-width:670px)')
    expect(css).toContain('prefers-reduced-motion')
  })
})
