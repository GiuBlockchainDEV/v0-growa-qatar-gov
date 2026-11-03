import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {parseDataTrackingShips,dryCargoCategory,parseCrossingCount} from './data-tracking-net'
import {parseAISHistory} from './data-tracking-history'

const now=Date.now()
const iso=(min:number)=>new Date(now-min*60000).toISOString()
const ship={mmsi:123456789,ship_name:'FOOD ROUTE CANDIDATE',
  ship_type:'Bulk Carrier',lat:26.5,lon:56.1,speed:11,course:95}

describe('public chokepoint AIS recovery',()=>{
  it('supports a ships array with no individual timestamps using the summary last poll',()=>{
    const r=parseDataTrackingShips({ships:[ship]},'hormuz',now,iso(5))
    expect(r.totalRows).toBe(1)
    expect(r.usableCargoRows).toBe(1)
    expect(r.assets).toHaveLength(1)
    expect(r.assets[0].id).toBe('sea:123456789')
    expect(r.assets[0].observationBasis).toBe('snapshot_poll')
    expect(r.assets[0].observedAt).toBe(iso(5))
    expect(r.assets[0].foodCargoVerified).toBe(false)
  })
  it('shows delayed provider observations with their actual timestamps, not fake new fixes',()=>{
    const r=parseDataTrackingShips({ships:[ship],last_poll:iso(6500)},'hormuz',now)
    expect(r.assets).toHaveLength(1)
    expect(r.assets[0].observedAt).toBe(iso(6500))
    expect(parseDataTrackingShips({ships:[ship],last_poll:iso(46000)},'hormuz',now).assets).toEqual([])
  })
  it('accepts MMSI-keyed arrays, preserves distinct vessel classes and identifies dry cargo',()=>{
    const fixture={ships:{'123456789':{...ship,mmsi:undefined},
      '123456790':{...ship,mmsi:123456790,ship_type:'Oil Tanker'}}}
    const r=parseDataTrackingShips(fixture,'hormuz',now,iso(15))
    expect(r.totalRows).toBe(2)
    expect(r.assets).toHaveLength(2)
    expect(r.assets.find(a=>a.id==='sea:123456789')?.cargo).toBe('ais_cargo_class')
    expect(r.assets.find(a=>a.id==='sea:123456790')?.cargo).toBe('unverified')
    expect(dryCargoCategory({category:'Dry bulk carrier'})).toBe(true)
    expect(dryCargoCategory({category:'Oil/Chemical Tanker'})).toBe(false)
  })
  it('interprets 24-hour crossings only if actually present',()=>{
    expect(parseCrossingCount({total_crossings:14})).toBe(14)
    expect(parseCrossingCount({inbound:4,outbound:6})).toBe(10)
    expect(parseCrossingCount({})).toBeNull()
  })
  it('renders only real provider AIS coordinates and breaks impossible jumps',()=>{
    const rows=[
      {lat:25.5,lon:55.4,timestamp:iso(180)},
      {lat:25.52,lon:55.46,timestamp:iso(150)},
      {lat:25.55,lon:55.5,timestamp:iso(120)},
      {lat:25.5,lon:90,timestamp:iso(90)},
    ]
    const segments=parseAISHistory({history:rows},now)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toHaveLength(3)
    expect(segments[0][0].time).toBe(iso(180))
    expect(parseAISHistory({positions:[{lat:25,lon:50}]},now)).toEqual([])
  })
  it('builds a separate authenticated historical route endpoint and renders without clicking',()=>{
    const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8')
    const route=read('app/api/watchtower/chokepoint-tracks/route.ts')
    const map=read('components/dashboard/watchtower/global-tracking-map.tsx')
    const ui=read('components/dashboard/watchtower/global-watchtower.tsx')
    expect(route).toContain('supabase.auth.getUser()')
    expect(route).toContain('private, no-store')
    expect(ui).toContain('/api/watchtower/chokepoint-tracks')
    expect(ui).toContain('aisRoutes={aisHistory}')
    expect(map).toContain('route.segments')
    expect(map).toContain('visibleShips.has(route.id)')
    expect(map).not.toContain('Math.random')
  })
})
