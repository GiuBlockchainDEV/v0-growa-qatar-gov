import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {
 parseQatarProduction,parseQatarFarms,parseQatarSufficiency,
 parseWorldBank,sumLatestProduction,farmsByMunicipality,parseYear,
 WORLD_BANK_INDICATORS,sourceCoverage,selfSufficiencyBarPercent,QATAR_VERIFIED_SUFFICIENCY_2025,
} from './qatar-country'
const load=(p:string)=>readFileSync(join(process.cwd(),p),'utf8')
describe('Qatar country intelligence records',()=>{
 it('uses official Qatar year and unit fields without phantom national totals',()=>{
  const rows=parseQatarProduction({results:[
   {year:'2025-01-01',crop_group:'Vegetables',crop:'Tomatoes',production:120,area:10,yield:12},
   {year:'2024',crop_group:'Cereals',crop:'Barley',production:45,area:30,yield:1.5},
   {year:'2025',crop_group:'Vegetables',crop:'Total',production:120},
   {year:'2025',crop_group:'Vegetables',crop:'Tomatoes',production:120,area:10,yield:12},
  ]})
  expect(rows).toHaveLength(2)
  expect(sumLatestProduction(rows)).toEqual({year:2025,tonnes:120})
  expect(parseYear('2025-01-01')).toBe(2025)
 })
 it('groups registered farms by municipality for a single official reference year',()=>{
  const rows=parseQatarFarms({results:[
   {year:'2025',municipality:'Doha',farm_type:'Crops',number_of_farms:20,total_area:30},
   {year:'2025',municipality:'Doha',farm_type:'Mixed',number_of_farms:10,total_area:25},
   {year:'2024',municipality:'Doha',farm_type:'Crops',number_of_farms:9,total_area:14},
  ]})
  expect(farmsByMunicipality(rows,2025)).toEqual([{name:'Doha',farms:30,areaHa:55}])
 })
 it('keeps product-specific self-sufficiency ratios and publication year',()=>{
  const rows=parseQatarSufficiency({results:[
   {year:'2023',product_group:'Eggs',product:'Eggs',quantity:50,self_sufficiency_ratio:66},
   {year:'2023',product_group:'Vegetables',product:'Vegetables',quantity:80,self_sufficiency_ratio:10},
   {year:'2023',product_group:'Eggs',product:'Total',quantity:50,self_sufficiency_ratio:66},
  ]})
  expect(rows).toHaveLength(2)
  expect(rows[0]).toMatchObject({product:'Eggs',ratioPercent:66,year:2023})
 })
 it('uses a strict, common 100-percent reference for all self-sufficiency bars',()=>{
  expect(selfSufficiencyBarPercent(1.7)).toBe(1.7)
  expect(selfSufficiencyBarPercent(25)).toBe(25)
  expect(selfSufficiencyBarPercent(100)).toBe(100)
  expect(selfSufficiencyBarPercent(118)).toBe(100)
  expect(selfSufficiencyBarPercent(-3)).toBe(0)
 })
 it('uses validated 2025 Ministry results instead of suspicious 0.x percent ratios',()=>{
  const values=QATAR_VERIFIED_SUFFICIENCY_2025
  expect(values).toHaveLength(6)
  expect(values.every(r=>r.year===2025)).toBe(true)
  expect(Object.fromEntries(values.map(x=>[x.product,x.ratioPercent]))).toEqual({
   'Fresh poultry':99,
   'Fresh milk & dairy':99,
   'Fresh fish':67,
   'Basic vegetables':47,
   'Table eggs':27,
   'Red meat':19,
  })
  expect(values.every(r=>r.ratioPercent>=19&&r.sourceUrl.startsWith('https://'))).toBe(true)
 })
 it('parses World Bank population with missing observations retained as absent',()=>{
  const parsed=parseWorldBank([{page:1,pages:1},[
   {countryiso3code:'QAT',indicator:{id:WORLD_BANK_INDICATORS.population.code},
    date:'2024',value:2700000},
   {countryiso3code:'QAT',indicator:{id:WORLD_BANK_INDICATORS.population.code},
    date:'2025',value:null},
  ]])
  const population=parsed.find(x=>x.key==='population')
  expect(population?.latest).toEqual({year:2024,value:2700000})
  expect(parsed.find(x=>x.key==='foodImportShare')?.latest).toBeNull()
 })
 it('marks partial source outages instead of inventing public country data',()=>{
  const health=sourceCoverage([
   {id:'production',label:'Crop production',status:'unavailable',url:'https://example.com',
    latestYear:null,count:0,note:'Source not available'},
   {id:'world-bank',label:'World Bank',status:'available',url:'https://example.com',
    latestYear:2025,count:2,note:'Official'},
  ])
  expect(health).toEqual({present:1,total:2,partial:true})
 })
 it('integrates source-authenticated national cards and distinct Growa operations',()=>{
  const page=load('components/dashboard/data-analytics-workspace.tsx')
  const command=load('components/dashboard/qatar-country-command.tsx')
  const api=load('app/api/analytics/qatar-country/route.ts')
  expect(page).toContain('<QatarCountryCommand growaContext={growaContext} growa={{')
  expect(page).toContain('Growa operational deep dive')
  expect(command).toContain('<h2>Qatar <em>Food System</em>')
  expect(command).toContain('Qatar Open Data')
  expect(command).toContain('World Bank')
  expect(command).toContain('<GrowaIntelligencePanel module="data-analytics" context={assistantContext}/>')
  expect(command.indexOf('className={styles.assistantRegion}')).toBeGreaterThan(
   command.indexOf('<AnnualTrend series={selected}/>')
  )
  expect(command).toContain('selfSufficiencyBarPercent(row.ratioPercent)')
  expect(command).not.toContain('What does self-sufficiency mean?')
  expect(command).not.toContain('suffExplanation')
  expect(command).toContain('Ministry of Municipality')
  expect(api).toContain('QATAR_VERIFIED_SUFFICIENCY_2025')
  expect(api).not.toContain("publicDataset('sufficiency',parseQatarSufficiency)")
  expect(command).toContain('onClick={()=>setSelectedYear(p.year)}')
  expect(command).toContain('aria-pressed={active.year===p.year}')
  expect(command).not.toContain('DATA COVERAGE')
  expect(command).not.toContain('national sources responding')
  expect(command).toContain('market?.instruments')
  expect(command).toContain('not national totals')
  expect(api).toContain('auth.getUser()')
  expect(api).toContain('Promise.all([')
  expect(api).toContain('offset=')
  expect(api).not.toContain('Math.random()')
 })
})
