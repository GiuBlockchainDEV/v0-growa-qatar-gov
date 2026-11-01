import {describe,expect,it} from 'vitest'
import {buildScreenedRoutes} from './logistics-screening'
import {extractSeaRoute,parseLpi,parseMarineWave,seaRoutesRequest} from './logistics-providers'
import {HUB_COUNTRIES,CARGO_SPECS,validateLaneInput} from './logistics-lanes'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8')
const API=read('app/api/nfii/logistics/corridors/route.ts')
const UI=read('components/dashboard/nfii-ops/logistics-corridor-intelligence.tsx')
const WORKSPACE=read('components/dashboard/nfii-ops/operations-workspace.tsx')
const input=(options:Partial<Parameters<typeof buildScreenedRoutes>[0]>={})=>({
  country:'IN',commodity:'rice',tonnes:20,limitDays:60,
  rates:{sea:null,air:null,road:null},
  seaDistances:null,lpi:null,lpiYear:null,waves:null,weatherAgeHours:null,
  ...options,
})

describe('Source-labelled food logistics corridors',()=>{
  it('supports food-specific constraints and representative origin countries',()=>{
    expect(Object.keys(CARGO_SPECS)).toHaveLength(9)
    expect(HUB_COUNTRIES.length).toBeGreaterThanOrEqual(30)
    expect(CARGO_SPECS.lettuce.coldChain).toBe(true)
    expect(CARGO_SPECS.rice.coldChain).toBe(false)
    expect(validateLaneInput(new URLSearchParams({
      country:'IN',commodity:'rice',tonnes:'20',limitDays:'60',
    })).ok).toBe(true)
    expect(validateLaneInput(new URLSearchParams({
      country:'ZZ',commodity:'rice',tonnes:'20',limitDays:'60',
    })).ok).toBe(false)
  })
  it('never claims an unauthenticated sea transit time or freight quote',()=>{
    const routes=buildScreenedRoutes(input())
    const sea=routes.find(r=>r.id==='sea_direct')!
    expect(sea.estimatedDays).toBeNull()
    expect(sea.distanceType).toBe('straight_line_lower_bound')
    expect(sea.freightQarKg).toBeNull()
    expect(sea.freightTotalQar).toBeNull()
    expect(sea.bookingConfirmed).toBe(false)
    expect(sea.requiresQuote).toBe(true)
    expect(routes.some(r=>r.id==='air_direct')).toBe(true)
    expect(routes.some(r=>r.id==='air_dubai')).toBe(false)
    expect(routes.every(r=>r.riskScore===null)).toBe(true)
    expect(routes.find(r=>r.mode==='air')?.estimatedDays).toBeGreaterThan(1)
    expect(routes.some(r=>r.id==='road_candidate')).toBe(false)
  })
  it('uses SeaRoutes geometry only when a valid observation exists',()=>{
    const routes=buildScreenedRoutes(input({
      seaDistances:{sea_direct:{km:3000,durationDays:8,
        routeUrl:'https://developer.searoutes.com/reference/getsearoute'}},
    }))
    const direct=routes.find(r=>r.id==='sea_direct')!
    expect(direct.distanceKm).toBe(3000)
    expect(direct.estimatedDays).toBe(8)
    expect(direct.distanceType).toBe('observed_sea_route')
    expect(routes.some(r=>r.id==='sea_salalah')).toBe(false)
  })
  it('computes QAR/kg only from user-supplied rates, not invented benchmark prices',()=>{
    const routes=buildScreenedRoutes(input({tonnes:25,
      rates:{sea:420,air:8800,road:null},
    }))
    const sea=routes.find(r=>r.id==='sea_direct')!
    expect(sea.freightTotalQar).toBe(10500)
    expect(sea.freightQarKg).toBe(.42)
    expect(sea.costSource).toBe('user_supplied_rate')
    expect(routes.find(r=>r.id==='air_direct')?.freightTotalQar).toBe(220000)
  })
  it('includes Gulf road screening but rejects false worldwide land corridors',()=>{
    const gulf=buildScreenedRoutes(input({
      country:'SA',commodity:'tomato',limitDays:7,roadDistanceKm:600}))
    expect(gulf.some(r=>r.mode==='road')).toBe(true)
    const distant=buildScreenedRoutes(input({country:'BR'}))
    expect(distant.some(r=>r.mode==='road')).toBe(false)
    expect(gulf.some(r=>r.reeferRequired)).toBe(true)
  })
  it('parses strictly positive route distance, actual World Bank country score and marine sample',()=>{
    expect(extractSeaRoute({features:[{properties:{
      distance:2_500_000,duration:7*86400000,
    }}]})?.km).toBe(2500)
    expect(extractSeaRoute({features:[{properties:{distance:0}}]})).toBeNull()
    expect(parseLpi([{page:1},[{date:'2023',value:3.2},{date:'2022',value:2.4}]])?.value).toBe(3.2)
    expect(parseLpi([{page:1},[]])).toBeNull()
    expect(parseMarineWave({daily:{wave_height_max:[1.1,3.3,null]}})).toBe(3.3)
    expect(parseMarineWave({daily:{wave_height_max:[]}})).toBeNull()
    expect(seaRoutesRequest('IN','direct')).toContain('INNSA;QAHMD')
    expect(seaRoutesRequest('IN','jebel')).toContain('INNSA;AEJEA;QAHMD')
  })
  it('isolates credentials server-side, requires sign-in, uses no fake carrier prices',()=>{
    expect(API).toContain('supabase.auth.getUser()')
    expect(API).toContain("requireCapability('supply.view',org)")
    expect(API).not.toContain('createAdminClient')
    expect(API).not.toMatch(/\.insert\(|\.update\(|\.upsert\(/)
    expect(UI).toContain('Compare transport options')
    expect(UI).toContain('Security exposure index · 0–100 (NOT a probability)')
    expect(UI).toContain('Quoted freight costs · QAR/kg')
    expect(WORKSPACE).toContain('<LogisticsCorridorIntelligence')
  })
})
