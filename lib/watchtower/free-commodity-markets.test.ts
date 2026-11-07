import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {COMMODITY_CATALOG,nativeToUsdPerTonne,toMarketInstrument,
 type CommodityMarketsSnapshot} from './commodity-markets'
import {combinePublicCommodityMarkets} from './free-commodity-markets'
import {parseWorldBankMonthlySheet,WORLD_BANK_MONTHLY_URL} from './world-bank-pink-sheet'
import {parseUsdaLatestRelease,USDA_REPORTS} from './usda-public-reports'

const d=COMMODITY_CATALOG.find(x=>x.id==='corn')!
const now=Date.parse('2026-11-07T00:00:00Z')
function c(ref:string,value:string){return '<c r="'+ref+'" t="inlineStr"><is><t>'+value+'</t></is></c>'}
function n(ref:string,value:number){return '<c r="'+ref+'"><v>'+value+'</v></c>'}
function row(i:number,cells:string){return '<row r="'+i+'">'+cells+'</row>'}
function testSheet(){
 return '<worksheet><sheetData>'+
 row(4,c('A4','Period')+c('B4','MAIZE')+c('C4','WHEAT_US_HRW')+c('D4','SOYBEANS'))+
 row(5,c('A5','Date')+c('B5','($/mt)')+c('C5','($/mt)')+c('D5','($/mt)'))+
 row(13,c('A13','2026M08')+n('B13',220)+n('C13',240)+n('D13',440))+
 row(14,c('A14','2026M09')+n('B14',230)+n('C14',250)+n('D14',450))+
 row(15,c('A15','2026M10')+n('B15',225)+n('C15',245)+n('D15',430))+
 row(16,c('A16','2027M01')+n('B16',999)+n('C16',999)+n('D16',999))+
 '</sheetData></worksheet>'
}
describe('Free World Bank and USDA markets',()=>{
 it('validates monthly World Bank workbook columns, units, dates and future exclusion',()=>{
  const prices=parseWorldBankMonthlySheet(testSheet(),[],now)
  expect(prices.map(p=>p.id)).toEqual(['wheat','corn','soybeans'])
  const corn=prices.find(x=>x.id==='corn')!
  expect(corn.latestUsdTonne).toBe(225)
  expect(corn.latestQarTonne).toBeCloseTo(225*3.64)
  expect(corn.latestDate).toBe('2026-10-01')
  expect(corn.sourceName).toBe('World Bank Pink Sheet')
  expect(corn.sourceUrl).toBe(WORLD_BANK_MONTHLY_URL)
  expect(corn.points).toHaveLength(3)
  expect(parseWorldBankMonthlySheet(testSheet().replace('($/mt)','($/bushel)'),[],now)
   .every(x=>x.id!=='corn')).toBe(true)
 })
 it('tracks USDA published reports with valid dates without fabricating cash prices',()=>{
  const html='<h3>Latest Releases:</h3><p>11/06/2026 - 11/06/2026 Published on: Fri</p>'
  expect(parseUsdaLatestRelease(html,now)).toBe('2026-11-06')
  expect(parseUsdaLatestRelease('<p>Access denied</p>',now)).toBeNull()
  expect(parseUsdaLatestRelease(html.replaceAll('2026','2027'),now)).toBeNull()
  expect(USDA_REPORTS).toHaveLength(4)
  expect(USDA_REPORTS.every(x=>/^[1-9]\d{3}$/.test(String(x.id)))).toBe(true)
 })
 it('prefers newest real monthly quote, reports partial source coverage and never invents prices',()=>{
  const fake=toMarketInstrument(d,[
   {date:'2026-09-01',nativePrice:240},{date:'2026-10-01',nativePrice:245},
  ],now)!
  const old={...fake,latestDate:'2026-09-01',sourceName:'IMF via FRED'}
  const wb={...fake,sourceName:'World Bank Pink Sheet'}
  const base:CommodityMarketsSnapshot={
   generatedAt:'2026-11-07T00:00:00Z',frequency:'monthly',
   source:'IMF via FRED',sourceUrl:'https://fred.stlouisfed.org/',
   fxBasis:'Qatar Central Bank USD/QAR official parity 3.64',usdQar:3.64,
   status:'partial',latestObservationMonth:old.latestDate,
   tracked:14,available:1,unavailableIds:[],instruments:[old],disclaimer:'Monthly'
  }
  const report={id:2932,title:'Missouri Daily Grain Bids',markets:['wheat'],
   reportDate:'2026-11-06',sourceUrl:'https://mymarketnews.ams.usda.gov/viewReport/2932',
   status:'published' as const,frequency:'daily' as const}
  const result=combinePublicCommodityMarkets(base,[wb],[report])
  expect(result.instruments).toHaveLength(1)
  expect(result.instruments[0].sourceName).toBe('World Bank Pink Sheet')
  expect(result.providerAvailability.usdaPublishedReports).toBe(1)
  expect(result.available).toBe(1)
  expect(result.unavailableIds).toHaveLength(COMMODITY_CATALOG.length-1)
  expect(result.disclaimer).toContain('not presented as extracted numeric quotes')
  expect(nativeToUsdPerTonne(1,'usd_per_tonne')).toBe(1)
 })
 it('keeps public-provider adapters on server and official sources visible to users',()=>{
  const route=readFileSync(join(process.cwd(),
   'app/api/watchtower/commodity-markets/route.ts'),'utf8')
  const ui=readFileSync(join(process.cwd(),
   'components/dashboard/watchtower/commodity-markets.tsx'),'utf8')
  expect(route).toContain('getPublicCommodityMarketsSnapshot')
  expect(route).toContain('supabase.auth.getUser()')
  expect(ui).toContain('Daily grain market reports')
  expect(ui).toContain('World Bank Pink Sheet')
  expect(ui).toContain('report.sourceUrl')
  expect(ui).toContain('USDA report dates are not numeric prices')
 })
})
