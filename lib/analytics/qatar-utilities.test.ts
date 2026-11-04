import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {
 UTILITY_DATASETS,parseUtilityDataset,latestPoint,yearChange,
 utilityFindings,utilityScenario,type UtilitySnapshot,
} from './qatar-utilities'
import {buildUtilityAiContext} from './qatar-utility-agent-context'
const spec=(domain:'water'|'energy',id:string)=>
 UTILITY_DATASETS[domain].find(s=>s.id===id)!
const snap=(domain:'water'|'energy',series:UtilitySnapshot['series']):UtilitySnapshot=>({
 domain,scope:'qatar-national',generatedAt:'2026-11-04T00:00:00Z',
 sources:[],series,
})
describe('Qatar water-energy national command',()=>{
 it('parses published 2025 potable production with exact units',()=>{
  const [s]=parseUtilityDataset(spec('water','water-production'),{
   results:[{year:'2024',production_mm3:676},{year:'2025',production_mm3:666}],
  })
  expect(s.unit).toBe('million m³/year')
  expect(latestPoint(s)).toEqual({year:2025,value:666})
  expect(yearChange(s)).toBeCloseTo(-1.479,2)
 })
 it('preserves GWh generation separately from MW system peak',()=>{
  const generation=parseUtilityDataset(spec('energy','generation'),{
   results:[{year:'2025',gigawatt_hours:59641,annual_increase_percentage:1.7}],
  })
  const demand=parseUtilityDataset(spec('energy','peak-demand'),{
   results:[{year:'2024',system_maximum_demand:10220}],
  })
  expect(latestPoint(generation[0])?.value).toBe(59641)
  expect(generation[0].unit).toBe('GWh/year')
  expect(demand[0].unit).toBe('MW')
 })
 it('rejects incompatible keys rather than silently inventing indicators',()=>{
  expect(parseUtilityDataset(spec('water','groundwater'),{
   results:[{year:'2025',oil_production:999}]})).toEqual([])
 })
 it('returns no annual growth across missing years',()=>{
  const [s]=parseUtilityDataset(spec('energy','generation'),{
   results:[{year:'2022',gigawatt_hours:40000},{year:'2025',gigawatt_hours:50000}],
  })
  expect(yearChange(s)).toBeNull()
 })
 it('keeps peak reduction in MW and never claims GWh savings',()=>{
  const data=snap('energy',parseUtilityDataset(spec('energy','peak-demand'),{
   results:[{year:'2024',system_maximum_demand:10220}],
  }))
  expect(utilityScenario(data,3)).toMatchObject({value:306.6,unit:'MW'})
  expect(utilityFindings(data).length).toBeGreaterThan(0)
 })
 it('carries national utility and cross-resource evidence into Growa LLM context',()=>{
  const water=snap('water',parseUtilityDataset(spec('water','water-production'),{
   results:[{year:'2025',production_mm3:666}],
  }))
  const energy=snap('energy',parseUtilityDataset(spec('energy','generation'),{
   results:[{year:'2025',gigawatt_hours:59641}],
  }))
  const ai=buildUtilityAiContext(water,energy)
  expect(ai.scope).toBe('qatar-national')
  expect(ai.module).toBe('water-intelligence')
  expect(ai.country.series[0].points[0].value).toBe(666)
  expect(ai.peer?.series[0].points[0].value).toBe(59641)
  expect(ai.digest).toContain('NOT LIVE TELEMETRY')
  expect(ai.digest).toContain('2025')
 })
 it('integrates national UI and preserves Growa farm details as a secondary view',()=>{
  const root=process.cwd()
  for(const domain of ['water','energy']){
   const file=readFileSync(join(root,'components/dashboard/'+domain+'-intelligence-workspace.tsx'),'utf8')
   expect(file).toContain('<QatarUtilitiesCommand domain="'+domain+'" />')
   expect(file).toContain('Growa operational deep dive')
   expect(file).toContain('aiAnalysis={null}')
  }
  const command=readFileSync(join(root,'components/dashboard/qatar-utilities-command.tsx'),'utf8')
  expect(command).toContain('<GrowaIntelligencePanel')
  expect(command).toContain('onClick={()=>setSelectedYear(p.year)}')
  expect(command).toContain('National records are not Growa client telemetry')
 })
})
