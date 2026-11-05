import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {
 FERTILIZER_PRODUCTS,assessFertilizerStock,DEFAULT_FERTILIZER_STRESS,
 fertilizerPriceChange,fertilizerMarketPressure,modeledDeliveredPrice,
} from './qatar-fertilizer'

const page=readFileSync(join(process.cwd(),'components/dashboard/fertilizer-intelligence.tsx'),'utf8')
const energy=readFileSync(join(process.cwd(),'components/dashboard/energy-intelligence-workspace.tsx'),'utf8')
const main=readFileSync(join(process.cwd(),'app/dashboard/page.tsx'),'utf8')

describe('Fertilizer Intelligence executive dashboard contract',()=>{
 it('has no N/A placeholders and no synthetic country inventory or quotes',()=>{
  expect(page).not.toContain('N/A')
  expect(page).toContain('Supplier quote needed')
  expect(page).toContain('Awaiting integration')
  expect(page).toContain('not a supplier offer')
  expect(page).toContain('not available stock')
  expect(page).toContain('No warehouse-level stock source linked')
 })
 it('remains a standalone module and is not nested under Energy',()=>{
  expect(main).toContain("moduleKey === 'fertilizer-intelligence'")
  expect(main).toContain('<FertilizerIntelligence />')
  expect(energy).not.toContain('FertilizerIntelligence')
 })
 it('provides market history, five-product matrix, and all scenario horizons',()=>{
  expect(page).toContain('Risk horizon heatmap')
  expect(page).toContain('MarketChart')
  expect(page).toContain('selectedId')
  expect(page).toContain('drafts[selectedId]')
  expect(page).toContain('Scenario laboratory')
  expect(page).toContain('Decision room')
  expect(page).toContain('30 days')
  expect(page).toContain('90 days')
  expect(page).toContain('12 months')
  expect(page).toContain("supplier quote")
 })
 it('never treats a generic basket price as an NPK or calcium nitrate quote',()=>{
  const products=FERTILIZER_PRODUCTS
  expect(products.find(p=>p.id==='npk')?.prices).toEqual([])
  expect(products.find(p=>p.id==='calcium-nitrate')?.prices).toEqual([])
  for(const id of ['npk','calcium-nitrate'] as const){
   const p=products.find(p=>p.id===id)!
   expect(modeledDeliveredPrice(p,DEFAULT_FERTILIZER_STRESS)).toBeNull()
   expect(fertilizerPriceChange(p)).toBeNull()
  }
 })
 it('keeps pressure scores as scenario-based rather than asserted outage probabilities',()=>{
  const p=FERTILIZER_PRODUCTS[0]
  const base=fertilizerMarketPressure(p,DEFAULT_FERTILIZER_STRESS,90)
  const shock=fertilizerMarketPressure(p,{
   logisticsDelayDays:21,demandShockPct:20,priceShockPct:30,
  },90)
  expect(shock.score).toBeGreaterThan(base.score)
  const inventory=assessFertilizerStock({
   stockTonnes:null,weeklyUseTonnes:null,leadDays:null,
   inboundTonnes:null,confirmed:false,
  },30,DEFAULT_FERTILIZER_STRESS)
  expect(inventory.availableTonnes).toBeNull()
  expect(inventory.risk).toBe('unassessed')
 })
})
