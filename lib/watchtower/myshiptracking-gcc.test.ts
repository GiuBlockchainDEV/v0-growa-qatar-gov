import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {GCC_PORTS,GCC_RADAR_INTERVAL_MS,GCC_RADAR_MIN_SPEED_KNOTS,
 isDryCargoVessel,parsePortCalls,parseMstVessels} from './myshiptracking-gcc'

const now=Date.parse('2026-11-03T07:00:00.000Z')
const calls={
 status:'success',data:[
  {mmsi:123456789,event:'DEPARTURE',time_utc:'2026-11-03T06:00:00Z'},
  {mmsi:223456789,event:'ARRIVAL',time_utc:'2026-11-03T05:00:00Z'},
  {mmsi:323456789,event:'DEPARTURE',time_utc:'2026-11-03T04:00:00Z'},
 ]}
const vessel=(fields:Record<string,unknown>={})=>({
  mmsi:123456789,vessel_name:'GCC DRY BULK',
  vessel_type:'Bulk Carrier',ais_type:70,lat:25.06,lng:55.04,
  speed:12.2,course:95,received:'2026-11-03T06:55:00Z',
  last_port:'Jebel Ali',last_port_unloco:'AEJEA',
  next_port:'Hamad Port',next_port_unloco:'QAHMD',
  ...fields,
})
describe('GCC licensed API radar',()=>{
 it('uses exactly five minutes and prevents tankers being reported as food cargo',()=>{
  expect(GCC_RADAR_INTERVAL_MS).toBe(300000)
  expect(GCC_RADAR_MIN_SPEED_KNOTS).toBe(1.5)
  expect(GCC_PORTS.map(x=>x.id)).toEqual(['AEJEA','QAHMD','QADOH','QARLF'])
  expect(isDryCargoVessel(vessel())).toBe(true)
  expect(isDryCargoVessel(vessel({vessel_type:'Oil Tanker',ais_type:80}))).toBe(false)
  expect(isDryCargoVessel({vessel_type:'Unknown',vtype:7})).toBe(false)
 })
 it('reads reported port departures and caps recent candidate calls',()=>{
  const result=parsePortCalls(calls,'AEJEA',now)
  expect(result.length).toBe(3)
  expect(result[0]).toMatchObject({hubId:'AEJEA',event:'DEPARTURE',mmsi:'123456789'})
  expect(parsePortCalls({status:'success',data:[{
    mmsi:123456789,event:'DEPARTURE',time_utc:'2025-01-01T00:00:00Z',
  }]},'AEJEA',now)).toHaveLength(0)
 })
 it('maps current GPS positions, reported ports, speed and provider ETA without guessing manifests',()=>{
  const known=parsePortCalls(calls,'AEJEA',now)
  const ships=parseMstVessels({status:'success',data:[
    vessel(),
    vessel({mmsi:223456789,received:'2026-11-03T06:56:00Z',speed:0.1}),
    vessel({mmsi:323456789,vessel_type:'LNG Tanker'}),
  ]},known,now,12)
  expect(ships).toHaveLength(1)
  const asset=ships[0]
  expect(asset.source).toBe('MyShipTracking API')
  expect(asset.id).toBe('sea:123456789')
  expect(asset.hubId).toBe('AEJEA')
  expect(asset.speedKnots).toBe(12.2)
  expect(asset.itinerary?.origin?.code).toBe('AEJEA')
  expect(asset.itinerary?.destination?.code).toBe('QAHMD')
  expect(asset.itinerary?.destination?.lat).not.toBeNull()
  expect(asset.foodCargoVerified).toBe(false)
 })
 it('does not fabricate endpoint routes or current positions from only a port call',()=>{
  const refs=parsePortCalls(calls,'AEJEA',now)
  expect(parseMstVessels({status:'success',data:[]},refs,now)).toHaveLength(0)
  const ships=parseMstVessels({status:'success',data:[vessel({
    last_port:null,last_port_unloco:null,next_port:null,
    next_port_unloco:null,destination:null,
  })]},refs,now)
  expect(ships).toHaveLength(1)
  expect(ships[0].itinerary?.destination).toBeNull()
  expect(ships[0].itinerary?.origin?.code).toBe('AEJEA')
 })
 it('uses authenticated server-only requests with explicit opt-in and org allowlist',()=>{
  const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8')
  const route=read('app/api/watchtower/gcc-radar/route.ts')
  const source=read('lib/watchtower/myshiptracking-gcc.ts')
  const ui=read('components/dashboard/watchtower/global-watchtower.tsx')
  expect(route).toContain("requireCapability('supply.view',org)")
  expect(route).toContain('isGccRadarAllowed(org)')
  expect(route).toContain('private, no-store')
  expect(source).toContain("WATCHTOWER_MST_ENABLED==='true'")
  expect(source).toContain('WATCHTOWER_MST_ALLOWED_ORG_IDS')
  expect(source).toContain('MYSHIPTRACKING_API_KEY')
  expect(ui).toContain('/api/watchtower/gcc-radar?')
  expect(ui).toContain('setInterval(()=>void load(),300000)')
  expect(ui).not.toContain('MYSHIPTRACKING_API_KEY')
 })
})
