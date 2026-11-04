import {describe,expect,it} from 'vitest'
import {
 assessWeatherOperations,historyQuality,observationStatus,
 weatherNumber,weatherTrend,
} from './operational-screen'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8')
describe('Qatar Weather Command Center data integrity',()=>{
 it('never substitutes missing weather observations with guessed values',()=>{
  expect(weatherNumber(null,'temperature_c')).toBeNull()
  const states=assessWeatherOperations(null)
  expect(states).toHaveLength(4)
  expect(states.every(x=>x.state==='unavailable'&&x.numeric===null)).toBe(true)
 })
 it('screens real weather fields using explicit published UI bands',()=>{
  const risks=assessWeatherOperations({weather:{
   temperature_c:41,humidity_percent:91,wind_speed_km_h:25,
  },agronomy:{eto_daily_estimated_mm_day:7.5}})
  expect(risks.map(x=>[x.id,x.state])).toEqual([
   ['heat','high'],['spraying','high'],['water','high'],['disease','high'],
  ])
  expect(risks[2].detail).toContain('not crop irrigation demand')
 })
 it('prefers API risk indices and avoids mixing units',()=>{
  const risks=assessWeatherOperations({weather:{
   temperature_c:21,humidity_percent:40,wind_speed_km_h:5,
  },agronomy:{thermal_stress_index_0_100:75,
   fungal_risk_index_0_100:12,spray_drift_risk_index_0_100:60}})
  expect(risks[0]).toMatchObject({numeric:75,unit:'/100',state:'high'})
  expect(risks[1]).toMatchObject({numeric:60,unit:'/100',state:'watch'})
  expect(risks[3]).toMatchObject({numeric:12,unit:'/100',state:'normal'})
 })
 it('flags old snapshots rather than claiming live conditions',()=>{
  const t=Date.parse('2026-11-04T10:00:00Z')
  expect(observationStatus({matched_timestamp:'2026-11-04T09:00:00Z'},t).mode).toBe('recent')
  expect(observationStatus({matched_timestamp:'2026-11-02T08:00:00Z'},t).mode).toBe('historical')
  expect(observationStatus(null,t).mode).toBe('missing')
 })
 it('keeps chronological historical points and null gaps',()=>{
  const h=[
   {requestedAt:'2026-11-04T10:00:00Z',reading:{weather:{temperature_c:30}}},
   {requestedAt:'2026-11-04T09:00:00Z',reading:null},
   {requestedAt:'2026-11-04T08:00:00Z',reading:{weather:{temperature_c:27}}},
  ]
  expect(weatherTrend(h,'temperature_c').map(p=>p.value)).toEqual([27,null,30])
  expect(historyQuality(h)).toMatchObject({valid:2,total:3,complete:false})
 })
 it('keeps existing advanced weather analysis and selects a real default location',()=>{
  const weather=read('components/dashboard/weather-workspace.tsx')
  const cockpit=read('components/dashboard/weather-command-center.tsx')
  expect(weather).toContain('<WeatherCommandCenter')
  expect(weather).toContain('lat: 25.2854, lng: 51.5310')
  expect(weather).toContain('Advanced weather investigation')
  expect(weather).toContain('IntelligenceInvestigationLayout')
  expect(weather).toContain('onHistoryMetricClick={openWeatherTrend}')
  expect(cockpit).toContain('What needs attention?')
  expect(cockpit).toContain('24-hour observed trend')
  expect(cockpit).toContain('aria-pressed={trendKey===metric.key}')
  expect(cockpit).toContain('Missing readings remain gaps.')
 })
})
