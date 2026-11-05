import {describe,expect,it} from 'vitest'
import {analyzeUtilityPressure,historyPressureUrl,PRESSURE_REGIONS} from './qatar-utility-pressure'
import type {WeatherHistory} from '@/lib/weather/operational-screen'
const now=Date.UTC(2026,10,5,9)
function point(hoursAgo:number,temp:number,humidity:number,vpd?:number):WeatherHistory{
 const at=new Date(now-hoursAgo*3600000).toISOString()
 return {requestedAt:at,reading:{
  matched_timestamp:at,data_source:'Growa Weather API',
  weather:{temperature_c:temp,humidity_percent:humidity,...(vpd===undefined?{}:{vpd_kpa:vpd})},
 }}
}
describe('Qatar utilities daily and weekly observed pressure',()=>{
 it('builds correct scoped history requests',()=>{
  const doha=PRESSURE_REGIONS[0]
  const daily=new URL('https://example.com'+historyPressureUrl(doha,'daily'))
  const weekly=new URL('https://example.com'+historyPressureUrl(doha,'weekly'))
  expect(daily.searchParams.get('count')).toBe('24')
  expect(daily.searchParams.get('interval_hours')).toBe('1')
  expect(weekly.searchParams.get('interval_hours')).toBe('7')
 })
 it('calculates water VPD with colocated observed humidity and temperature',()=>{
  const result=analyzeUtilityPressure([point(3,35,25),point(2,41,20)],'water','daily',now)
  expect(result.observed).toBe(2)
  expect(result.peak?.value).toBeGreaterThan(5)
  expect(result.highCount).toBe(2)
  expect(result.issues.some(issue=>issue.id==='high-peak')).toBe(true)
 })
 it('preserves observed energy peak, risk bands and chronology',()=>{
  const result=analyzeUtilityPressure([point(3,34,50),point(2,41,50),point(1,37,50)],
   'energy','daily',now)
  expect(result.peak?.value).toBe(41)
  expect(result.highCount).toBe(1)
  expect(result.watchCount).toBe(2)
  expect(result.latest?.value).toBe(37)
  expect(result.changePct).toBeCloseTo((37-34)/34*100)
 })
 it('requires source timestamps and does not use request times as observations',()=>{
  const history:WeatherHistory[]=[
   {requestedAt:new Date(now-60000).toISOString(),
    reading:{data_source:'Weather API',weather:{temperature_c:45}}},
   {requestedAt:new Date(now-60000).toISOString(),reading:null},
  ]
  const result=analyzeUtilityPressure(history,'energy','daily',now)
  expect(result.points).toHaveLength(0)
  expect(result.peak).toBeNull()
  expect(result.issues.some(issue=>issue.id==='low-coverage')).toBe(true)
 })
 it('keeps weekly daily maxima as sampled observations, never fabricates gaps',()=>{
  const result=analyzeUtilityPressure([
   point(49,32,50),point(48,44,50),point(25,39,50),point(2,35,50),
  ],'energy','weekly',now)
  expect(result.dailyPeaks.length).toBeGreaterThanOrEqual(2)
  expect(result.peak?.value).toBe(44)
  expect(result.points).toHaveLength(4)
  expect(result.expected).toBe(24)
 })
})
