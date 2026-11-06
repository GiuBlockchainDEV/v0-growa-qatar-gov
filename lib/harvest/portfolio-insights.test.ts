import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {buildHarvestPortfolio,harvestAetiObservations,harvestMetricRank} from './portfolio-insights'
import type {HarvestAnalyticsField,HarvestAnalyticsResponse} from './types'
const field=(name:string,crop:string,area:number,metrics:HarvestAnalyticsField['metrics'],harvest='2026-12-25'):HarvestAnalyticsField=>({
 parcel_id:name,season_id:1,name,crop,area,start_date:'2026-08-01',harvest_date:harvest,metrics,
})
const fields=[
 field('A','tomato',20000,{aeti:100,tbp:25,bwp:1.5,rwd:.2}),
 field('B','pepper',10000,{aeti:250,tbp:35,bwp:1.1,rwd:.4}),
]
describe('Harvest national command data semantics',()=>{
 it('uses real field area, crop mix and metric coverage',()=>{
  const s=buildHarvestPortfolio(fields,null,['A'],'2026-11-06')
  expect(s.fieldCount).toBe(2)
  expect(s.areaHa).toBe(3)
  expect(s.distinctCrops).toBe(2)
  expect(s.completeFields).toBe(2)
  expect(s.collectingCount).toBe(1)
  expect(s.crops.reduce((a,b)=>a+b.areaHa,0)).toBe(3)
  expect(s.metrics.tbp?.value).toBe(60)
  expect(s.metrics.aeti?.value).toBe(350)
 })
 it('shows missing metrics rather than summing incomplete national aggregates',()=>{
  const partial=[fields[0],field('C','tomato',10000,{aeti:50})]
  const s=buildHarvestPortfolio(partial,null,[],'2026-11-06')
  expect(s.completeFields).toBe(1)
  expect(s.metrics.tbp).toBeUndefined()
  expect(s.tbpCoverage).toBe(1)
  expect(s.missingFields).toHaveLength(1)
 })
 it('preserves API reported aggregates when supplied and tracks provenance',()=>{
  const a:HarvestAnalyticsResponse={
   metrics:[{key:'tbp',agg:'sum',value:99,field_count:2}],fields,
  }
  const s=buildHarvestPortfolio(fields,a,[],'2026-11-06')
  expect(s.metrics.tbp).toMatchObject({value:99,basis:'api-summary'})
 })
 it('never treats scheduled harvest dates as confirmed yields',()=>{
  const s=buildHarvestPortfolio([
   field('past','tomato',10000,{tbp:1},'2026-01-01'),
   field('soon','tomato',10000,{tbp:1},'2026-12-01'),
  ],null,[],'2026-11-06')
  expect(s.schedulePassed.map(x=>x.name)).toEqual(['past'])
  expect(s.upcoming.map(x=>x.name)).toEqual(['soon'])
 })
 it('sorts water-productivity review ascending and biomass descending',()=>{
  expect(harvestMetricRank(fields,'bwp').map(x=>x.field.name)).toEqual(['B','A'])
  expect(harvestMetricRank(fields,'tbp').map(x=>x.field.name)).toEqual(['B','A'])
  expect(harvestMetricRank(fields,'tbp','tomato').map(x=>x.field.name)).toEqual(['A'])
 })
 it('discards malformed time observations rather than filling gaps',()=>{
  expect(harvestAetiObservations([
   {period:'2026-11-01',value:4},{period:'invalid',value:20},
   {period:'2026-10-01',value:3},{period:'2026-11-01',value:6},
  ])).toEqual([{period:'2026-10-01',value:3},{period:'2026-11-01',value:6}])
 })
 it('keeps the existing field operations and advanced investigation',()=>{
  const main=readFileSync(join(process.cwd(),'components/dashboard/harvest-workspace.tsx'),'utf8')
  const command=readFileSync(join(process.cwd(),'components/dashboard/harvest-national-command.tsx'),'utf8')
  expect(main).toContain('<HarvestNationalCommand')
  expect(main).toContain('Watchtower signals, outlook and operational actions')
  expect(main).toContain('<HarvestFieldCreatePanel')
  expect(main).toContain('runYieldEstimate()')
  expect(main).toContain('<GrowaIntelligencePanel module="harvest"')
  expect(command).toContain('Water use timeline')
  expect(command).toContain('Production watchlist')
  expect(command).toContain('Harvest planning calendar')
  expect(command).toContain('Evidence coverage')
  expect(command).not.toContain('national harvested yield confirmed')
 })
})
