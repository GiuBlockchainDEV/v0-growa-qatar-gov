import {describe,it,expect} from 'vitest'
import {annualQatarImportPrices} from './commodity-import-price-history'
import type {YearObservation} from './origin-price-model'
const yr=(year:number,usd:number,kg:number,incompletePreview=false):YearObservation=>({
 year,sourceUrl:'https://source.example/'+year,incompletePreview,
 partners:[{countryCode:'IN',countryName:'India',importValueUsd:usd/2,
  importWeightKg:kg/2,estimatedNetWeight:false},
  {countryCode:'TR',countryName:'Türkiye',importValueUsd:usd/2,
   importWeightKg:kg/2,estimatedNetWeight:false}],
 worldTotal:{countryCode:'',countryName:'World',
  importValueUsd:usd,importWeightKg:kg,estimatedNetWeight:false},
})
describe('Annual Qatar import price evidence',()=>{
 it('correctly converts annual USD per kilogram to QAR per tonne',()=>{
  const history=annualQatarImportPrices([
   yr(2025,100000,100000),yr(2024,120000,100000)],'UN Comtrade')
  expect(history.map(p=>p.year)).toEqual([2024,2025])
  expect(history[0].qarPerKg).toBe(4.368)
  expect(history[0].qarPerTonne).toBe(4368)
  expect(history[0].basis).toBe('published_world_total')
 })
 it('never infers national value from a partial customs preview',()=>{
  const incomplete=yr(2024,120000,100000,true)
  expect(annualQatarImportPrices([{...incomplete,worldTotal:undefined}],'Source')).toEqual([])
 })
 it('labels a complete reported partner aggregate explicitly',()=>{
  const [p]=annualQatarImportPrices([{...yr(2024,120000,100000),worldTotal:undefined}],'Source')
  expect(p.basis).toBe('reported_partner_aggregate')
 })
 it('rejects negative and missing weights',()=>{
  expect(annualQatarImportPrices([yr(2024,100000,0)],'Source')).toEqual([])
 })
})
