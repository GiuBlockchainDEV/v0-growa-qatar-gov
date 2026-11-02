import {describe,expect,it} from 'vitest'
import {estimateFreightCost} from './logistics-cost-estimator'
import type {FreightCostInput} from './logistics-cost-estimator'
import {buildScreenedRoutes} from './logistics-screening'

const sample:FreightCostInput={
  routeId:'sea_direct',mode:'sea',distanceKm:2500,
  distanceType:'observed_sea_route',tonnes:20,coldChain:false,
  via:null,enteredRateQarPerTonne:null,
}

describe('QAR freight budget estimates',()=>{
  it('estimates sea, air and road separately, with explicit uncertainty',()=>{
    const sea=estimateFreightCost(sample)!
    const air=estimateFreightCost({...sample,routeId:'air_direct',mode:'air',
      distanceType:'straight_line_lower_bound'})!
    const road=estimateFreightCost({...sample,routeId:'road_candidate',mode:'road',
      distanceKm:600,distanceType:'observed_road_drive_geometry'})!
    expect(sea.source).toBe('planning_model')
    expect(sea.minQar).toBeGreaterThan(0)
    expect(sea.maxQar).toBeGreaterThan(sea.minQar)
    expect(air.minQar).toBeGreaterThan(sea.minQar)
    expect(road.units).toBe(1)
    expect(air.unitLabel).toContain('weight')
    expect(sea.minQarKg).toBeCloseTo(sea.minQar/20000,3)
  })
  it('prices multiple container loads, cooling and hub transfers',()=>{
    const one=estimateFreightCost(sample)!
    const many=estimateFreightCost({...sample,tonnes:50})!
    const chilled=estimateFreightCost({...sample,coldChain:true})!
    const via=estimateFreightCost({...sample,routeId:'sea_jebel_ali',via:'Jebel Ali'})!
    expect(one.units).toBe(1)
    expect(many.units).toBe(3)
    expect(many.minQar).toBeGreaterThan(one.maxQar)
    expect(chilled.breakdown.coldChain.minQar).toBeGreaterThan(0)
    expect(chilled.units).toBe(2)
    expect(via.breakdown.transferAndBorder.minQar).toBeGreaterThan(0)
  })
  it('uses entered rates instead of the planning model and keeps their source',()=>{
    const entered=estimateFreightCost({...sample,enteredRateQarPerTonne:420})!
    expect(entered.source).toBe('entered_rate')
    expect(entered.minQar).toBe(8400)
    expect(entered.maxQar).toBe(8400)
    expect(entered.minQarKg).toBe(.42)
    expect(entered.breakdown.handling.minQar).toBe(0)
  })
  it('applies marketplace benchmark only to a direct dry <=22t FCL',()=>{
    const quote={
      mode:'sea' as const,amountMinQar:4500,amountMaxQar:6100,
      perKgMinQar:.225,perKgMaxQar:.305,daysMin:10,daysMax:17,
      load:'container40' as const,source:'freightos_marketplace_estimate' as const,
      checkedAt:'2026-11-01T00:00:00.000Z',
      sourceUrl:'https://ship.freightos.com' as const,
    }
    const accepted=estimateFreightCost({...sample,marketplaceEstimate:quote})!
    expect(accepted.source).toBe('marketplace_benchmark')
    expect(accepted.minQar).toBe(4500)
    expect(accepted.maxQar).toBe(6100)
    expect(estimateFreightCost({...sample,coldChain:true,marketplaceEstimate:quote})?.source)
      .toBe('planning_model')
    expect(estimateFreightCost({...sample,routeId:'sea_jebel_ali',marketplaceEstimate:quote})?.source)
      .toBe('planning_model')
  })
  it('increases uncertainty for missing sea geometry and rejects invalid distance',()=>{
    const observed=estimateFreightCost(sample)!
    const proxy=estimateFreightCost({...sample,distanceType:'straight_line_lower_bound'})!
    expect(proxy.maxQar).toBeGreaterThan(observed.maxQar)
    expect(proxy.assumptions.some(a=>a.includes('NOT verified'))).toBe(true)
    expect(estimateFreightCost({...sample,distanceKm:NaN})).toBeNull()
  })
  it('exposes estimated ranges for all screened routes while leaving quotes null',()=>{
    const routes=buildScreenedRoutes({
      country:'IN',commodity:'rice',tonnes:20,limitDays:60,
      rates:{sea:null,air:null,road:null},seaDistances:null,
      lpi:null,lpiYear:null,waves:null,weatherAgeHours:null,
    })
    expect(routes.every(route=>route.costEstimate?.source==='planning_model')).toBe(true)
    expect(routes.every(route=>route.freightTotalQar===null)).toBe(true)
    expect(routes.every(route=>route.costEstimate!.minQar>0)).toBe(true)
  })
})
