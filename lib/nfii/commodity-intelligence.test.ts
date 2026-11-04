import {describe,it,expect} from 'vitest'
import {buildCommoditySignal} from './commodity-intelligence'
import type {FoodBalanceResult} from '@/lib/food-security/balance'
const sample=(days:number|null,deficit=0):FoodBalanceResult=>({
 commodityId:'tomato',fromDate:'2026-11-01',toDate:'2026-11-30',
 days:30,sourceMode:'live',status:'complete',
 totals:{
  openingStockTonnes:50,domesticProductionTonnes:20,confirmedImportsTonnes:30,
  consumptionTonnes:70,lossesTonnes:10,projectedBalanceTonnes:20,
  projectedClosingStockTonnes:20,deficitTonnes:deficit,surplusTonnes:20,
  projectedCoverageDays:days,
 },
 evidence:{stockSnapshotId:'snap',flowIds:[],coverageIds:[],
  sourceRefs:['stock','imports'],missingCoverage:[],warnings:[]},
})
describe('Per-commodity intelligence signals',()=>{
 it('does not turn absent source data into zero stock or green status',()=>{
  const x=buildCommoditySignal(null)
  expect(x.risk).toBe('unknown')
  expect(x.coverageFraction).toBeNull()
  expect(x.usableStockTonnes).toBeNull()
  expect(buildCommoditySignal({...sample(31),status:'insufficient_data'}).complete).toBe(false)
 })
 it('classifies verified coverage without treating a threshold as policy',()=>{
  expect(buildCommoditySignal(sample(4)).risk).toBe('critical')
  expect(buildCommoditySignal(sample(10)).risk).toBe('high')
  expect(buildCommoditySignal(sample(20)).risk).toBe('attention')
  expect(buildCommoditySignal(sample(35)).risk).toBe('stable')
  expect(buildCommoditySignal(sample(null)).risk).toBe('unknown')
  expect(buildCommoditySignal(sample(45)).coverageFraction).toBe(1)
  expect(buildCommoditySignal(sample(40,3)).risk).toBe('critical')
 })
 it('uses only the selected verified commodity flow totals',()=>{
  const x=buildCommoditySignal(sample(20))
  expect(x.availableTonnes).toBe(100)
  expect(x.requiredTonnes).toBe(80)
  expect(x.domesticShare).toBeCloseTo(.2)
  expect(x.importShare).toBeCloseTo(.3)
  expect(x.sourceCount).toBe(2)
 })
})
