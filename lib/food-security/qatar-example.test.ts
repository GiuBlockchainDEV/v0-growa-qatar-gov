import {describe,expect,it} from 'vitest'
import { calculateFoodBalance } from './balance'
import { buildQatarIllustrativeFoodBalanceInput } from './demo-data'
import { COMMODITY_CATALOG } from '@/lib/platform/commodity-catalog'

describe('Qatar commodity examples reuse existing seed assumptions',()=>{
  it('covers every existing commodity for all supported horizons',()=>{
    for(const commodity of COMMODITY_CATALOG){
      for(const days of [7,30,90,180]){
        const input=buildQatarIllustrativeFoodBalanceInput(commodity.id,'2026-11-01',days)
        const result=calculateFoodBalance(input)
        expect(result.status).toBe('complete')
        expect(result.sourceMode).toBe('demo')
        expect(result.days).toBe(days)
        expect(result.evidence.missingCoverage).toEqual([])
        expect(input.flows).toHaveLength(4*days)
        expect(result.evidence.sourceRefs.join(' ')).toContain('SIMQA26/SYNTHETIC')
      }
    }
  })
  it('computes rice from seed daily assumptions, not the legacy demo figures',()=>{
    const r=calculateFoodBalance(buildQatarIllustrativeFoodBalanceInput('rice','2026-11-01',30))
    expect(r.totals.openingStockTonnes).toBe(320)
    expect(r.totals.domesticProductionTonnes).toBe(0)
    expect(r.totals.confirmedImportsTonnes).toBe(210)
    expect(r.totals.consumptionTonnes).toBe(270)
    expect(r.totals.lossesTonnes).toBe(1.8)
    expect(r.totals.projectedBalanceTonnes).toBe(258.2)
  })
  it('applies existing seasonal multiplier to Qatar tomato production',()=>{
    const r=calculateFoodBalance(buildQatarIllustrativeFoodBalanceInput('tomato','2026-11-01',30))
    expect(r.totals.domesticProductionTonnes).toBe(69.3)
    expect(r.totals.confirmedImportsTonnes).toBe(35.1)
    expect(r.totals.projectedClosingStockTonnes).toBe(25.8)
  })
  it('rejects unknown commodity and unsupported horizons',()=>{
    expect(()=>buildQatarIllustrativeFoodBalanceInput('unknown','2026-11-01',30)).toThrow()
    expect(()=>buildQatarIllustrativeFoodBalanceInput('rice','2026-11-01',365)).toThrow()
  })
})
