import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

const get=(path:string)=>readFileSync(join(process.cwd(),path),'utf8')
const endpoint=get('app/api/nfii/procurement/origin-prices/route.ts')
const ui=get('components/dashboard/nfii-ops/origin-price-intelligence.tsx')
const crop=get('components/dashboard/nfii-ops/crop-producer-discovery.tsx')
const model=get('lib/nfii/origin-price-model.ts')

describe('Commodity-led Qatar price intelligence UI and API security',()=>{
  it('requires authenticated, capability-checked research before fetching trade data',()=>{
    expect(endpoint).toContain('supabase.auth.getUser()')
    expect(endpoint).toContain("requireCapability('supply.view',org)")
    expect(endpoint).toContain("validFoodUuid(org)")
    expect(endpoint).not.toContain('createAdminClient')
    expect(endpoint).not.toMatch(/\.insert\(|\.upsert\(|\.update\(/)
  })
  it('recommends only observed Qatar imports or documented producer countries',()=>{
    expect(endpoint).toContain("feasibility:observed?'observed_import_route':'documented_company_only'")
    expect(endpoint).toContain("sources.get('QA')")
    expect(endpoint).toContain('rankQatarImportOrigins')
    expect(crop).toContain('feasibleCountries.map')
    expect(crop).not.toContain('WORLD_COUNTRIES.map')
    expect(crop).toContain('<OriginPriceIntelligence')
    expect(ui).toContain('onCountriesLoaded(body.localQatar.documentedLeads>0?')
    expect(ui).toContain("onSelectCountry(row.countryCode)")
  })
  it('shows visible historical average prices and price/volume charts',()=>{
    expect(ui).toContain('weightedAverageQarKg')
    expect(ui).toContain('lowestObservedQarKg')
    expect(ui).toContain('Historical unit value by origin · QAR/kg')
    expect(ui).toContain('Qatar imported volume · tonnes')
    expect(ui).toContain('differenceVsMeanPct')
    expect(ui).toContain('providerWarnings')
    expect(ui).toContain('No trustworthy price comparison')
    expect(model).toContain('historical');
  })
  it('never labels historical customs unit values as live vendor offers',()=>{
    expect(model).toContain('not a supplier quote')
    expect(ui).toContain('not supplier quotations')
    expect(model).toContain('3.64')
    expect(endpoint).toContain("dataStatus:years.length?'available':'unavailable'")
  })
})
