import {describe,it,expect} from 'vitest'
import {estimateAreaPlanningPrice} from './procurement-planning-prices'
import {getWits2024Snapshot} from './wits-2024-prices'
import {rankQatarImportOrigins} from './origin-price-model'
const zero=rankQatarImportOrigins('tomato',[])
describe('Origin/area price benchmarks',()=>{
 it('uses observed country value in a WITS historical source',()=>{
  const price=estimateAreaPlanningPrice('IR',zero,getWits2024Snapshot('tomato'))
  expect(price?.kind).toBe('origin_customs')
  expect(price?.year).toBe(2024)
  expect(price?.unitQarPerKg).toBeGreaterThan(0)
 })
 it('builds regional median when country has no recorded price',()=>{
  const price=estimateAreaPlanningPrice('BH',zero,getWits2024Snapshot('cucumber'))
  expect(price?.kind).toBe('regional_proxy')
  expect(price?.area).toBe('Gulf')
  expect(price?.comparisonOrigins).toBeGreaterThanOrEqual(2)
  expect(price?.lowQarPerKg).toBeLessThan(price!.unitQarPerKg)
 })
 it('uses an identified national benchmark when area has no peers',()=>{
  const price=estimateAreaPlanningPrice('NZ',zero,getWits2024Snapshot('tomato'))
  expect(price?.kind).toBe('national_proxy')
  expect(price?.sourceName).toContain('WITS')
  expect(price?.unitQarPerKg).toBeGreaterThan(0)
 })
 it('does not manufacture a price without a source',()=>{
  expect(estimateAreaPlanningPrice('NZ',zero,null)).toBeNull()
 })
})
