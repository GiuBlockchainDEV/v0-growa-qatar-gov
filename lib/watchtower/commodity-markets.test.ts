import {describe,expect,it} from 'vitest'
import {COMMODITY_CATALOG,USD_QAR_PEG,nativeToUsdPerTonne,
  parseFredSeries,percentChange,toMarketInstrument} from './commodity-markets'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

const descriptor=COMMODITY_CATALOG.find(x=>x.id==='wheat')!
const csv=[
 'observation_date,PWHEAMTUSDM',
 '2025-09-01,210',
 '2025-10-01,200',
 '2025-11-01,225',
 '2025-12-01,230',
 '2026-01-01,235',
 '2026-02-01,245',
 '2026-03-01,250',
 '2026-04-01,240',
 '2026-05-01,230',
 '2026-06-01,220',
 '2026-07-01,200',
 '2026-08-01,225',
 '2026-09-01,220',
 '2026-10-01,240',
].join('\n')
const now=Date.parse('2026-11-02T00:00:00Z')

describe('Watchtower commodity market benchmark integrity',()=>{
 it('parses real monthly observations only and rejects placeholders and future values',()=>{
   const input=csv+'\n2026-12-01,350\n2026-09-01,.\n2026-10-01,garbage\n2026-06-05,900\n'
   const points=parseFredSeries(input,'PWHEAMTUSDM',now)
   expect(points.at(-1)).toEqual({date:'2026-10-01',nativePrice:240})
   expect(points).toHaveLength(14)
   expect(parseFredSeries('<html>not CSV</html>','PWHEAMTUSDM',now)).toEqual([])
   expect(parseFredSeries('DATE,PWHEAMTUSDM\n2026-10-01,-1','PWHEAMTUSDM',now)).toEqual([])
 })
 it('calculates exact calendar-month changes without filling missing observations',()=>{
   const points=parseFredSeries(csv,'PWHEAMTUSDM',now)
   const latest=toMarketInstrument(descriptor,points,now)!
   expect(latest.change1mPct).toBeCloseTo((240/220-1)*100,6)
   expect(latest.change3mPct).toBeCloseTo((240/200-1)*100,6)
   expect(latest.change12mPct).toBeCloseTo((240/200-1)*100,6)
   expect(latest.latestQarTonne).toBeCloseTo(240*3.64,8)
   expect(latest.high12mUsdTonne).toBe(250)
   expect(latest.low12mUsdTonne).toBe(200)
   expect(latest.volatility12mPct).not.toBeNull()
   expect(latest.stale).toBe(false)
 })
 it('keeps missing monthly data unavailable rather than using the nearest point',()=>{
   const input=csv.replace('2026-09-01,220\n','')
   const points=parseFredSeries(input,'PWHEAMTUSDM',now)
   const quote=toMarketInstrument(descriptor,points,now)!
   expect(quote.change1mPct).toBeNull()
   expect(quote.change3mPct).toBeCloseTo(20,4)
   expect(percentChange(100,null)).toBeNull()
   expect(percentChange(100,0)).toBeNull()
 })
 it('converts cents/lb and USD/tonne consistently for QAR/tonne comparison',()=>{
   expect(USD_QAR_PEG).toBe(3.64)
   expect(nativeToUsdPerTonne(100,'usd_cents_per_lb')).toBeCloseTo(2204.6226218488,5)
   expect(nativeToUsdPerTonne(100,'usd_per_tonne')).toBe(100)
   expect(new Set(COMMODITY_CATALOG.map(x=>x.id)).size).toBe(COMMODITY_CATALOG.length)
   expect(new Set(COMMODITY_CATALOG.map(x=>x.seriesId)).size).toBe(COMMODITY_CATALOG.length)
 })
 it('uses an authenticated API and no fabricated market fallback',()=>{
   const route=readFileSync(join(process.cwd(),'app/api/watchtower/commodity-markets/route.ts'),'utf8')
   const client=readFileSync(join(process.cwd(),'components/dashboard/watchtower/commodity-markets.tsx'),'utf8')
   const nav=readFileSync(join(process.cwd(),'components/dashboard/watchtower-workspace.tsx'),'utf8')
   expect(route).toContain('supabase.auth.getUser()')
   expect(route).toContain('private, no-store')
   expect(client).toContain('/api/watchtower/commodity-markets')
   expect(client).toContain('Published monthly average, not a live exchange quote')
   expect(client).toContain('No verified market data returned')
   expect(nav).toContain("id: 'markets'")
   expect(nav).toContain("<CommodityMarkets />")
   expect(nav.indexOf("id: 'markets'")).toBeLessThan(nav.indexOf("id: 'food'"))
 })
})
