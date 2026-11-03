import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {dryCargoCategory,parseDataTrackingShips,parseCrossingCount,
  TRACKED_CHOKEPOINTS} from './data-tracking-net'
import {freshAsset,mergeAssets} from './global-tracking'

const t=Date.now()
const stamp=(ageMinutes:number)=>new Date(t-ageMinutes*60000).toISOString()
const vessel=(overrides:Record<string,unknown>={})=>({
  mmsi:123456789,name:'TEST CARGO 12',category:'bulk_carrier',lat:26.4,lon:56.1,
  speed:11,course:140,last_seen:stamp(35),destination:'HAMAD',...overrides,
})

describe('Data-tracking.net public chokepoint AIS adapter',()=>{
  it('supports documented cargo classes, not tanker or passenger traffic',()=>{
    expect(dryCargoCategory({type:70})).toBe(true)
    expect(dryCargoCategory({ship_type:'container_ship'})).toBe(true)
    expect(dryCargoCategory({category:'bulk_carrier'})).toBe(true)
    expect(dryCargoCategory({category:'general cargo'})).toBe(true)
    expect(dryCargoCategory({category:'reefer'})).toBe(true)
    expect(dryCargoCategory({category:'oil_tanker'})).toBe(false)
    expect(dryCargoCategory({type:80})).toBe(false)
    expect(dryCargoCategory({category:'passenger ship'})).toBe(false)
    expect(dryCargoCategory({category:'unknown'})).toBe(false)
  })
  it('requires real AIS coordinates and timestamps without removing non-cargo vessels',()=>{
    const result=parseDataTrackingShips({
      last_poll:stamp(29),
      ships:[vessel(),vessel({mmsi:'bad'}),
        vessel({mmsi:123456790,category:'oil_tanker'}),
        vessel({mmsi:123456791,lat:999}),
        vessel({mmsi:123456792,last_seen:stamp(12000)}),
      ],
    },'hormuz',t)
    expect(result.assets).toHaveLength(3)
    expect(result.assets.find(a=>a.id==='sea:123456790')).toMatchObject({cargo:'unverified'})
    expect(result.usablePositionRows).toBe(3)
    expect(result.usableCargoRows).toBe(2)
    expect(result.assets[0]).toMatchObject({
      id:'sea:123456789',kind:'vessel',cargo:'ais_cargo_class',
      chokepointId:'hormuz',observationBasis:'position_report',
      destination:'HAMAD',foodCargoVerified:false,
    })
    expect(result.totalRows).toBe(5)
    expect(result.lastPoll).toBe(stamp(29))
    expect(freshAsset(result.assets[0],t)).toBe(true) // relative to 30-minute feed cadence
  })
  it('shows delayed data as delayed, without rolling the time forward',()=>{
    const old=stamp(120)
    const result=parseDataTrackingShips({ships:[vessel({
      last_seen:old,
    })]},'bab_el_mandeb',t)
    expect(result.assets).toHaveLength(1)
    expect(result.assets[0].observedAt).toBe(old)
    expect(freshAsset(result.assets[0],t)).toBe(false)
  })
  it('distinguishes ship-specific timestamps from a dataset-wide poll',()=>{
    const result=parseDataTrackingShips({last_poll:stamp(44),
      ships:[vessel({last_seen:null})]},'hormuz',t)
    expect(result.assets).toHaveLength(1)
    expect(result.assets[0].observationBasis).toBe('snapshot_poll')
    expect(result.assets[0].observedAt).toBe(stamp(44))
    expect(result.timestamped).toBe(0)
    expect(parseDataTrackingShips({ships:[vessel({last_seen:null})]},'hormuz',t).assets).toHaveLength(0)
  })
  it('accepts nested AIS response wrappers and prioritizes ships reporting movement',()=>{
    const result=parseDataTrackingShips({data:{payload:{ships:[
      vessel({mmsi:123456780,speed:0}),vessel({mmsi:123456781,speed:14}),
    ]}},last_poll:stamp(20)},'hormuz',t)
    expect(result.assets).toHaveLength(2)
    expect(result.assets[0].id).toBe('sea:123456781')
  })
  it('never replaces a source-dated AIS position with a webpage capture time',()=>{
    const observed=parseDataTrackingShips({last_poll:stamp(30),ships:[vessel()]},'hormuz',t).assets[0]
    const capture={...observed,lat:25,lon:51.6,
      observedAt:new Date(t).toISOString(),observationBasis:'webpage_capture' as const}
    expect(mergeAssets([observed,capture])[0].lat).toBe(observed.lat)
    expect(mergeAssets([capture,observed])[0].lat).toBe(observed.lat)
  })
  it('does not invent 24-hour crossing counts',()=>{

    expect(parseCrossingCount({total_crossings:23})).toBe(23)
    expect(parseCrossingCount({inbound:4,outbound:8})).toBe(12)
    expect(parseCrossingCount({data:{crossings_24h:19}})).toBe(19)
    expect(parseCrossingCount({ships:[]})).toBeNull()
    expect(parseCrossingCount({total_crossings:-2})).toBeNull()
  })
  it('declares exactly two covered chokepoints while preserving all seven regions',()=>{
    expect(TRACKED_CHOKEPOINTS).toHaveLength(7)
    expect(TRACKED_CHOKEPOINTS.filter(p=>p.feed).map(p=>p.id))
      .toEqual(['hormuz','bab_el_mandeb'])
    expect(TRACKED_CHOKEPOINTS.find(p=>p.id==='malacca')?.feed).toBe(false)
    expect(TRACKED_CHOKEPOINTS.find(p=>p.id==='suez')?.feed).toBe(false)
  })
  it('keeps source calls server-side and the map independent of licensed AIS',()=>{
    const file=(path:string)=>readFileSync(join(process.cwd(),path),'utf8')
    const route=file('app/api/watchtower/chokepoints/route.ts')
    const map=file('components/dashboard/watchtower/global-tracking-map.tsx')
    const ui=file('components/dashboard/watchtower/global-watchtower.tsx')
    const provider=file('lib/watchtower/data-tracking-net.ts')
    expect(route).toContain('supabase.auth.getUser()')
    expect(route).toContain('private, no-store')
    expect(provider).toContain('/api/ships')
    expect(provider).toContain('/api/bab/ships')
    expect(provider).toContain('CC BY 4.0')
    expect(ui).toContain('/api/watchtower/chokepoints')
    expect(ui).toContain('maritimeFeed?.assets')
    expect(ui).toContain('chooseChokepoint')
    expect(map).toContain('TRACKED_CHOKEPOINTS')
    expect(map).toContain('onChokepointClick')
    expect(map).toContain('automaticRouteEvidence')
    expect(map).not.toContain('Math.random')
  })
})
