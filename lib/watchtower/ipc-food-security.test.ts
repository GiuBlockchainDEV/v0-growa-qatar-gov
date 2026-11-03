import {describe,expect,it} from 'vitest'
import {parseIpcCountryRisks,parseIpcCsv,ipcPeriodDate} from './ipc-food-security'
const now=Date.UTC(2026,10,3)
const row=(overrides:Record<string,unknown>={})=>({
  country:'AF',period:'C',from:'2026-09-01',to:'2026-12-31',
  phase3_worse_population:12500000,phase3_worse_percentage:.3,
  phases:[{phase:3,population:10000000},{phase:4,population:2500000},{phase:5,population:0}],
  estimated_population:40000000,...overrides,
})
describe('official country IPC food security feed',()=>{
 it('maps reported IPC Phase 3+ numbers and phase populations without manufacturing risk',()=>{
  const risks=parseIpcCountryRisks([row(),row({country:'SD',phase3_worse_population:14000000})],now)
  expect(risks).toHaveLength(2)
  expect(risks[0].country).toBe('Sudan')
  expect(risks[1].country).toBe('Afghanistan')
  expect(risks[1].phase4).toBe(2500000)
  expect(risks[1].phase5).toBe(0)
  expect(risks[1].period).toBe('current')
 })
 it('preserves expired assessments and rejects invalid rows, deduplicating periods',()=>{
  const risks=parseIpcCountryRisks([row(),row(),row({country:'??'}),
    row({from:'2020-09-01',to:'2020-12-31'}),row({phase3_worse_population:-1}),
    row({country:'SS',period:'P',from:'2026-12-01',to:'2027-03-01'})],now)
  expect(risks).toHaveLength(3)
  expect(risks.some(r=>r.period==='projected')).toBe(true)
 })
 it('parses CSV records with quoted commas and month/year dates',()=>{
  const csv=[
    'country,period,from,to,phase3_worse_population,phase3_worse_percentage,title',
    'AF,C,Sep 2026,Dec 2026,12500000,30,"Afghanistan, assessment"',
  ].join(String.fromCharCode(10))
  const risks=parseIpcCountryRisks(parseIpcCsv(csv),now)
  expect(risks[0].phase3Plus).toBe(12500000)
  expect(risks[0].from).toBe('2026-09-01')
  expect(risks[0].to).toBe('2026-12-31')
  expect(ipcPeriodDate('2026-10',true)).toBe('2026-10-31')
 })
 it('does not invent country coordinates or accept undefined API shapes',()=>{
  const risk=parseIpcCountryRisks([row()],now)[0]
  expect(risk).not.toHaveProperty('lat')
  expect(risk).not.toHaveProperty('lon')
  expect(()=>parseIpcCountryRisks({results:[]},now)).toThrow()
 })
})
