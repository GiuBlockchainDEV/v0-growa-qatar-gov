import {describe,expect,it} from 'vitest'
import {expandedFarmQuery,parseExpandedFarmResults} from './world-agricultural-leads'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8')
const endpoint=read('app/api/nfii/procurement/crop-producers/route.ts')
const ui=read('components/dashboard/nfii-ops/crop-producer-discovery.tsx')

describe('Broad country supplier research with explicit verification tiers',()=>{
  it('queries both named crop farms and wider named agricultural sites',()=>{
    const query=expandedFarmQuery('tomato','MA')
    expect(query).toContain('["ISO3166-1"="MA"]')
    expect(query).toContain('["name"]["crop"')
    expect(query).toContain('["name"]["landuse"="farmyard"]')
    expect(query).toContain('["name"]["landuse"="greenhouse_horticulture"]')
    expect(query).toContain('out tags center 75;')
    expect(()=>expandedFarmQuery('tomato','XX')).toThrow()
    expect(()=>expandedFarmQuery('not-a-crop','MA')).toThrow()
  })
  it('separates explicit product tags from unverified named farm activity',()=>{
    const input={elements:[
      {type:'node',id:1,tags:{name:'Riad Tomatoes',crop:'tomato',place:'farm'}},
      {type:'way',id:2,tags:{name:'مزرعة الهدى',landuse:'greenhouse_horticulture'}},
      {type:'way',id:3,tags:{name:'Farm valley',landuse:'farmyard'}},
      {type:'node',id:4,tags:{name:'Green Valley Bakery',shop:'bakery'}},
      {type:'node',id:5,tags:{name:'Open field',landuse:'farmland'}},
      {type:'node',id:6,tags:{name:'Farm shop',shop:'farm'}},
      {type:'way',id:7,tags:{landuse:'farmyard'}},
    ]}
    const result=parseExpandedFarmResults(input,'tomato','MA')
    expect(result.cropTagged).toHaveLength(1)
    expect(result.agriculturalCandidates).toHaveLength(3)
    expect(result.agriculturalCandidates.map(r=>r.organizationName))
      .toContain('مزرعة الهدى')
    expect(result.agriculturalCandidates.every(r=>
      r.evidenceType==='mapped_agricultural_business'&&
      r.matchedProduct.includes('NOT verified')&&
      r.cropGrowerConfirmed===false&&r.supplierApproved===false)).toBe(true)
    expect(result.cropTagged[0].organizationName).toBe('Riad Tomatoes')
    expect(result.agriculturalCandidates.some(r=>r.organizationName==='Riad Tomatoes')).toBe(false)
    expect(()=>parseExpandedFarmResults({remark:'runtime error: timeout',elements:[]},'tomato','MA')).toThrow()
  })
  it('keeps API signed-in and marks supply role and source availability',()=>{
    expect(endpoint).toContain("supabase.auth.getUser()")
    expect(endpoint).toContain("requireCapability('supply.view',organizationId)")
    expect(endpoint).toContain('fetchExpandedFarmResults')
    expect(endpoint).toContain("research=params.get('research')??'expanded'")
    expect(endpoint).toContain('agriculturalCandidateCount')
    expect(endpoint).toContain('cropTaggedCount')
    expect(endpoint).not.toContain('createAdminClient')
    expect(endpoint).not.toMatch(/\.insert\(|\.upsert\(|\.update\(/)
  })
  it('shows different crop-specific and unverified categories and actionable source messages',()=>{
    expect(ui).toContain("useState<'curated'|'mapped'|'expanded'|'places'>('expanded')")
    expect(ui).toContain('Broad free search: crops + mapped farms')
    expect(ui).toContain('MAPPED FARM / BUSINESS · CROP NOT VERIFIED')
    expect(ui).toContain('Published crop evidence')
    expect(ui).toContain('Other agricultural candidates · crop unverified')
    expect(ui).toContain('The free live map source did not respond.')
  })
})
