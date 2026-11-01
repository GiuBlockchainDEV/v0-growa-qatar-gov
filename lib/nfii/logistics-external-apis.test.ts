import {describe,expect,it} from 'vitest'
import {parseFreightosEstimate,fetchFreightEstimate} from './logistics-freight-benchmark'
import {parseRoadApiRoute} from './logistics-road-api'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

const api=readFileSync(join(process.cwd(),'app/api/nfii/logistics/corridors/route.ts'),'utf8')
const ui=readFileSync(join(process.cwd(),'components/dashboard/nfii-ops/logistics-corridor-intelligence.tsx'),'utf8')
const provider=readFileSync(join(process.cwd(),'lib/nfii/logistics-providers.ts'),'utf8')

const SAMPLE={response:{estimatedFreightRates:{numQuotes:'1',mode:{
  mode:'FCL',
  price:{min:{moneyAmount:{amount:'1200',currency:'USD'}},
    max:{moneyAmount:{amount:'1500',currency:'USD'}}},
  transitTimes:{min:'12',max:'19',unit:'days'},
}}}}

describe('External freight and road routing APIs',()=>{
  it('parses real Freightos JSON price interval into QAR/kg, not price guesses',()=>{
    const output=parseFreightosEstimate(SAMPLE,20)
    expect(output?.perKgMinQar).toBeCloseTo(.218,3)
    expect(output?.perKgMaxQar).toBeCloseTo(.273,3)
    expect(output?.amountMinQar).toBe(4368)
    expect(output?.amountMaxQar).toBe(5460)
    expect(output?.daysMin).toBe(12)
    expect(output?.daysMax).toBe(19)
  })
  it('rejects invalid currency, absent data and inverted rate ranges',()=>{
    expect(parseFreightosEstimate({response:{}},20)).toBeNull()
    expect(parseFreightosEstimate({response:{estimatedFreightRates:{mode:{
      mode:'FCL',price:{min:{moneyAmount:{amount:2000,currency:'GBP'}},
        max:{moneyAmount:{amount:3000,currency:'USD'}}}}}}},10)).toBeNull()
    const reversed=JSON.parse(JSON.stringify(SAMPLE)) as typeof SAMPLE
    reversed.response.estimatedFreightRates.mode.price.min.moneyAmount.amount='2500'
    expect(parseFreightosEstimate(reversed,20)).toBeNull()
  })
  it('won’t use dry-container estimates for refrigerated or huge consignments',async()=>{
    expect((await fetchFreightEstimate('IN',10,true)).status).toBe('not_applicable')
    expect((await fetchFreightEstimate('IN',35,false)).status).toBe('not_applicable')
  })
  it('parses Google route car-distance, not a confirmed truck service',()=>{
    const route=parseRoadApiRoute({routes:[{distanceMeters:321000,duration:'18200s'}]})
    expect(route?.distanceKm).toBe(321)
    expect(route?.driveHours).toBeCloseTo(5.1,1)
    expect(route?.method).toBe('google_routes_driving_not_trucking')
    expect(parseRoadApiRoute({routes:[]})).toBeNull()
    expect(parseRoadApiRoute({routes:[{distanceMeters:5000,duration:'abc'}]})).toBeNull()
  })
  it('keeps external keys server-side and labels benchmark costs separately',()=>{
    expect(api).toContain('fetchFreightEstimate')
    expect(api).toContain('roadDistanceKm:evidence.roadRoute?.distanceKm')
    expect(ui).toContain('Freightos marketplace freight benchmark')
    expect(ui).toContain('Non-binding')
    expect(provider).toContain('customer-marine-api.open-meteo.com')
    expect(provider).toContain('fetchRoadEvidence')
    expect(api).toContain('hasSupplierInOrigin')
    expect(ui).toContain('eligible.map(row=>')
  })
})
