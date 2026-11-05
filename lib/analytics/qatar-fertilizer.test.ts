import {describe,expect,it} from 'vitest'
import {
 FERTILIZER_PRODUCTS,assessFertilizerStock,averageFertilizerBenchmark,
 fertilizerMarketPressure,fertilizerPriceChange,modeledDeliveredPrice,
 parseFertilizerTrade,shortTermRecommendations,emptyStock,
} from './qatar-fertilizer'
const urea=FERTILIZER_PRODUCTS[0]
const stress={logisticsDelayDays:0,demandShockPct:0,priceShockPct:0}
describe('fertilizer reference prices and uncertainty',()=>{
 it('keeps prices source dated and uses only comparable benchmark products',()=>{
  expect(urea.prices.at(-1)).toEqual({month:'2026-10',usdPerTonne:420})
  expect(fertilizerPriceChange(urea)).toBeCloseTo((420-407.5)/407.5*100)
  expect(averageFertilizerBenchmark()).toBeCloseTo((420+803.1+357.5)/3)
  expect(FERTILIZER_PRODUCTS.find(x=>x.id==='npk')?.prices).toEqual([])
 })
 it('parses official Qatar trade VALUES as QAR without converting to tonnage',()=>{
  const trade=parseFertilizerTrade({results:[
   {year:'2022',import:61088623,export:13019393607,re_export:110830},
   {fields:{year:'2023',import:0,export:100000,re_export:0}},
  ]})
  expect(trade).toEqual([
   {year:2022,importsQar:61088623,exportsQar:13019393607,reexportsQar:110830},
   {year:2023,importsQar:0,exportsQar:100000,reexportsQar:0},
  ])
  expect(parseFertilizerTrade({results:[{year:'2024',import:'bad',export:null}]}))
   .toEqual([{year:2024,importsQar:null,exportsQar:null,reexportsQar:null}])
 })
 it('never treats missing physical inventory as zero or a measured stock deficit',()=>{
  const assessment=assessFertilizerStock(emptyStock(),30,stress)
  expect(assessment.risk).toBe('unassessed')
  expect(assessment.availableTonnes).toBeNull()
  expect(assessment.shortfallTonnes).toBeNull()
  expect(shortTermRecommendations(urea,emptyStock(),stress)[0].title)
   .toBe('Inventory evidence missing')
 })
 it('computes coverage and explicit stock deficits at every horizon',()=>{
  const inventory={stockTonnes:100,weeklyUseTonnes:50,inboundTonnes:0,
   leadDays:10,confirmed:false}
  const short=assessFertilizerStock(inventory,30,stress)
  const long=assessFertilizerStock(inventory,365,stress)
  expect(short.coverageDays).toBe(14)
  expect(short.shortfallTonnes).toBeCloseTo(50*30/7-100)
  expect(short.risk).toBe('high')
  expect(long.shortfallTonnes).toBeGreaterThan(short.shortfallTonnes!)
 })
 it('does not count unconfirmed inbound as available inventory',()=>{
  const initial={stockTonnes:200,weeklyUseTonnes:35,inboundTonnes:50,leadDays:3,confirmed:false}
  const notConfirmed=assessFertilizerStock(initial,30,stress)
  const confirmed=assessFertilizerStock({...initial,confirmed:true},30,stress)
  expect(confirmed.availableTonnes!-notConfirmed.availableTonnes!).toBe(50)
  const delayed=assessFertilizerStock({...initial,confirmed:true},30,
   {...stress,logisticsDelayDays:35})
  expect(delayed.availableTonnes).toBe(200)
 })
 it('makes stress effects clearly hypothetical and proportional',()=>{
  const scenario={logisticsDelayDays:21,demandShockPct:30,priceShockPct:25}
  const base=fertilizerMarketPressure(urea,stress,90)
  const stressed=fertilizerMarketPressure(urea,scenario,90)
  expect(stressed.score).toBeGreaterThan(base.score)
  expect(modeledDeliveredPrice(urea,scenario)).toBe(525)
  expect(modeledDeliveredPrice(FERTILIZER_PRODUCTS[3],scenario)).toBeNull()
 })
})
