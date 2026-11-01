import {describe,expect,it} from 'vitest'
import {getWits2024Snapshot} from './wits-2024-prices'
import {rankQatarImportOrigins} from './origin-price-model'

describe('Published 2024 Qatar WITS fallback (not generated sample data)',()=>{
  const commodities=['rice','tomato','cucumber','pepper','lettuce',
    'date','barley','milk','wheat']
  it('covers each UI commodity with source URLs and original World aggregate',()=>{
    for(const commodity of commodities){
      const snapshot=getWits2024Snapshot(commodity)
      expect(snapshot).not.toBeNull()
      if(!snapshot)continue
      expect(snapshot.year).toBe(2024)
      expect(snapshot.worldImportValueUsd).toBeGreaterThan(0)
      expect(snapshot.worldImportWeightKg).toBeGreaterThan(0)
      expect(snapshot.sourceUrls.every(x=>x.startsWith(
        'https://wits.worldbank.org/trade/comtrade/en/country/QAT/'))).toBe(true)
      expect(snapshot.observation.partners.length).toBeGreaterThan(0)
      expect(snapshot.observation.worldTotal?.importWeightKg)
        .toBe(snapshot.worldImportWeightKg)
      const result=rankQatarImportOrigins(commodity,[snapshot.observation])
      expect(result.analyzedYear).toBe(2024)
      expect(result.origins.length).toBeGreaterThan(0)
      expect(result.weightedAverageQarKg).toBeGreaterThan(0)
      expect(result.nationalMeanFromWorldTotal).toBe(true)
      expect(result.origins.every(x=>x.unitValueQarKg>0)).toBe(true)
    }
  })
  it('matches published world weighted mean, not average of selected rows',()=>{
    const snapshot=getWits2024Snapshot('rice')!
    const report=rankQatarImportOrigins('rice',[snapshot.observation])
    expect(snapshot.worldImportWeightKg).toBe(214290000)
    expect(snapshot.worldImportValueUsd).toBeCloseTo(201724270)
    expect(report.weightedAverageQarKg).toBeCloseTo(
      snapshot.worldImportValueUsd*3.64/snapshot.worldImportWeightKg)
    expect(report.weightedAverageQarKg).toBeCloseTo(3.43,1)
    expect(report.origins[0].countryCode).toBe('VN')
    expect(report.origins[0].unitValueQarKg).toBeCloseTo(3.04,1)
  })
  it('aggregates two published lettuce HS headings without double-counting',()=>{
    const snapshot=getWits2024Snapshot('lettuce')!
    expect(snapshot.sourceUrls).toHaveLength(2)
    expect(snapshot.worldImportValueUsd).toBeCloseTo((11077.64+850.97)*1000)
    expect(snapshot.worldImportWeightKg).toBe(19384300+1907460)
    const result=rankQatarImportOrigins('lettuce',[snapshot.observation])
    expect(result.origins.length).toBeGreaterThan(0)
  })
  it('does not return a historical snapshot for unknown crops',()=>{
    expect(getWits2024Snapshot('coffee')).toBeNull()
  })
})
