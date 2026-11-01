import {describe,expect,it} from 'vitest'
import {WORLD_COUNTRIES,WORLD_COUNTRY_CODES,isWorldCountryCode} from './world-countries'
import {overpassCropQuery,parseMappedCropLeads} from './world-crop-mapping'
import {globalCropPlacesQueries} from './world-crop-places'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

const route=readFileSync(join(process.cwd(),'app/api/nfii/procurement/crop-producers/route.ts'),'utf8')
const ui=readFileSync(join(process.cwd(),'components/dashboard/nfii-ops/crop-producer-discovery.tsx'),'utf8')

describe('Worldwide evidence-led crop discovery',()=>{
  it('offers all ISO countries and territories without implying producer coverage',()=>{
    expect(WORLD_COUNTRY_CODES).toHaveLength(249)
    expect(new Set(WORLD_COUNTRY_CODES).size).toBe(249)
    expect(WORLD_COUNTRIES.some(c=>c.code==='QA'&&c.name==='Qatar')).toBe(true)
    for(const country of ['US','BR','CN','IN','ES','MA','EG','ZA','SA','AE','AU','NZ'])
      expect(isWorldCountryCode(country)).toBe(true)
    expect(isWorldCountryCode('XX')).toBe(false)
    expect(ui).toContain('feasibleCountries.map')
    expect(ui).toContain('All documented countries')
    expect(ui).not.toContain('WORLD_COUNTRIES.map')
  })
  it('builds safe, bounded Overpass queries with explicit ISO territory and crop',()=>{
    const q=overpassCropQuery('tomato','BR')
    expect(q).toContain('["ISO3166-1"="BR"]')
    expect(q).toContain('["name"]["crop"')
    expect(q).toContain('out tags center 60;')
    expect(()=>overpassCropQuery('rice','XX')).toThrow()
    expect(()=>overpassCropQuery('not-real','DE')).toThrow()
  })
  it('requires explicit crop tags and named locations; no supplier approval inferred',()=>{
    const items=parseMappedCropLeads({elements:[
      {type:'node',id:123,tags:{name:'Example Tomato Farm',crop:'tomatoes',landuse:'farmland'}},
      {type:'way',id:456,tags:{name:'Generic Garden',crop:'barley'}},
      {type:'node',id:789,tags:{name:'Tomato General Company'}},
      {type:'way',id:321,tags:{crop:'tomato'}},
      {type:'node',id:123,tags:{name:'Duplicate',crop:'tomatoes'}},
    ]},'tomato','BR')
    expect(items).toHaveLength(1)
    expect(items[0].recordId).toBe('OSM-node-123')
    expect(items[0].evidenceType).toBe('community_mapped_crop_tag')
    expect(items[0].sourceUrl).toBe('https://www.openstreetmap.org/node/123')
    expect(items[0].supplierApproved).toBe(false)
    expect(items[0].cropGrowerConfirmed).toBe(false)
    expect(()=>parseMappedCropLeads({invalid:true},'tomato','BR')).toThrow()
  })
  it('keeps Google Places keyword search geographically scoped and opt-in',()=>{
    const names=globalCropPlacesQueries('rice','IN')
    expect(names).toHaveLength(2)
    expect(names.every(s=>s.includes('India'))).toBe(true)
    expect(()=>globalCropPlacesQueries('rice','XXX')).toThrow()
    expect(route).toContain("research==='places'&&!organizationId")
    expect(route).toContain('researchStatus')
    expect(route).toContain('documentedCount')
    expect(route).toContain('exploratoryCount')
    expect(ui).toContain('Google Places (paid)')
    expect(ui).toContain('COMMUNITY-MAPPED CROP LOCATION · COMPANY UNVERIFIED')
    expect(ui).toContain('KEYWORD BUSINESS LEAD · PRODUCT UNVERIFIED')
  })
})
