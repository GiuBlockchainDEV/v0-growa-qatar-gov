import {describe,it,expect} from 'vitest'
import {planFefoRelease,planReserveCoverage,reserveDemandWindow} from './reserve-planning'
import type {ReserveAgentReport,ReserveLotView} from './reserves-intelligence'
const lot=(id:string,expiry:number,free:number,eligible=true):ReserveLotView=>({
 id,reference:id,warehouseId:'wh',warehouse:'Doha warehouse',commodityCode:'rice',
 commodityName:'Rice',shipmentRef:'BL-1',status:'approved',expiryDate:'2026-11-30',
 daysToExpiry:expiry,receivedTonnes:100,releasedTonnes:0,onHandTonnes:100,
 approvedCommitmentTonnes:100-free,pendingRequestedTonnes:0,
 uncommittedTonnes:free,eligible,issues:eligible?[]:['Unverified expiry'],
})
const coverage:ReserveAgentReport['coverage']=[
 {commodityCode:'rice',commodityName:'Rice',days:10,dailyDemand:5,
  uncommittedTonnes:50,sourceRefs:['source-1'],},
 {commodityCode:'barley',commodityName:'Barley',days:null,dailyDemand:null,
  uncommittedTonnes:70,sourceRefs:[]},
 {commodityCode:'milk',commodityName:'Milk',days:40,dailyDemand:1,
  uncommittedTonnes:40,sourceRefs:['source-2']},
]
describe('Reserve coverage and replenishment planning',()=>{
 it('compares organization reserves against an explicitly chosen planning horizon',()=>{
  const r=planReserveCoverage(coverage,30)
  const rice=r.find(x=>x.commodityCode==='rice')!
  expect(rice.status).toBe('below_target')
  expect(rice.targetReserveTonnes).toBe(150)
  expect(rice.suggestedReplenishmentTonnes).toBe(100)
  expect(rice.coverageDays).toBe(10)
  expect(rice.sourceRefs).toBe(1)
 })
 it('does not manufacture cover from missing demand or empty source references',()=>{
  const r=planReserveCoverage(coverage,30).find(x=>x.commodityCode==='barley')!
  expect(r.status).toBe('insufficient_evidence')
  expect(r.suggestedReplenishmentTonnes).toBeNull()
  expect(r.coverageDays).toBeNull()
 })
 it('keeps at-target replenishment at zero and changes with chosen horizon',()=>{
  expect(planReserveCoverage(coverage,30).find(x=>x.commodityCode==='milk')?.suggestedReplenishmentTonnes).toBe(0)
  expect(planReserveCoverage(coverage,60).find(x=>x.commodityCode==='milk')?.suggestedReplenishmentTonnes).toBe(20)
 })
})
describe('FEFO release planning',()=>{
 it('prioritizes usable earliest-expiring lots and subtracts approved commitments once',()=>{
  const rows=[lot('late',80,25),lot('early',3,20),lot('invalid',1,90,false),lot('expired',-5,40)]
  const before=JSON.stringify(rows)
  const r=planFefoRelease(rows,'rice',35)
  expect(r.allocations.map(x=>[x.lotRef,x.tonnes])).toEqual([['early',20],['late',15]])
  expect(r.availableTonnes).toBe(45)
  expect(r.shortfallTonnes).toBe(0)
  expect(JSON.stringify(rows)).toBe(before)
 })
 it('reports shortages without allocating from invalid or expired lots',()=>{
  const r=planFefoRelease([lot('early',1,12)],'rice',20)
  expect(r.allocatedTonnes).toBe(12)
  expect(r.shortfallTonnes).toBe(8)
 })
 it('rejects invalid quantity and never allocates other commodities',()=>{
  expect(planFefoRelease([lot('early',1,12)],'wheat',20).allocations).toEqual([])
  expect(planFefoRelease([lot('early',1,12)],'rice',-2).valid).toBe(false)
  expect(planFefoRelease([lot('early',1,12)],'rice',Number.NaN).valid).toBe(false)
 })
})

describe('Reserve consumption period',()=>{
 it('queries exactly 30 complete historical days rather than a future interval',()=>{
  expect(reserveDemandWindow('2026-11-04',30)).toEqual({
   from:'2026-10-05',through:'2026-11-03',days:30,
  })
 })
 it('handles a leap year and month boundary',()=>{
  expect(reserveDemandWindow('2024-03-01',30).from).toBe('2024-01-31')
  expect(reserveDemandWindow('2024-03-01',30).through).toBe('2024-02-29')
 })
 it('rejects invalid report dates',()=>{
  expect(()=>reserveDemandWindow('2026-02-30')).toThrow('Invalid reserve demand date')
 })
})
