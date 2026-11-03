import {describe,expect,it} from 'vitest'
import {parseOpenSeaFeedSnapshot} from './openseafeed'
const now=Date.UTC(2026,10,3,12,0)
const vessel=(id:number,lat:number,lon:number,sog:number,extra:Record<string,unknown>={})=>({
  mmsi:id,lat,lon,sog,cog:120,ts:now-2*60000,name:'TEST '+id,type:70,...extra,
})
describe('OpenSeaFeed source-backed AIS',()=>{
  it('maps genuine positions in Gulf and other oceans without inventing movements',()=>{
    const result=parseOpenSeaFeedSnapshot({generated_at_ms:now,count:3,vessels:[
      vessel(123456789,25.2,55.2,10),vessel(234567890,16.2,41.8,9),
      vessel(345678901,50.1,-3.2,0),
    ]},now)
    expect(result.state).toBe('partial')
    expect(result.regional).toBe(2)
    expect(result.accepted).toBe(3)
    expect(result.moving).toBe(2)
    expect(result.assets.find(a=>a.id==='sea:234567890')?.lat).toBe(16.2)
    expect(result.assets[0].foodCargoVerified).toBe(false)
  })
  it('discards impossible timestamps, bad identifiers and coordinates',()=>{
    const result=parseOpenSeaFeedSnapshot({generated_at_ms:now,vessels:[
      vessel(123456789,25,51,4),vessel(111111111,90,56,4),
      vessel(222222222,26,55,4,{ts:now-25*3600000}),
      vessel(333333333,28,55,4,{mmsi:'unknown'}),
    ]},now)
    expect(result.accepted).toBe(1)
  })
  it('marks delayed data stale instead of claiming a live feed',()=>{
    const stamp=now-45*60000
    const result=parseOpenSeaFeedSnapshot({generated_at_ms:stamp,
      vessels:[vessel(123456789,25,55,10,{ts:stamp})]},now)
    expect(result.state).toBe('stale')
    expect(result.accepted).toBe(1)
  })
  it('fails closed on missing fleet data',()=>{
    expect(()=>parseOpenSeaFeedSnapshot({},now)).toThrow()
    expect(()=>parseOpenSeaFeedSnapshot({vessels:[]},now)).toThrow()
  })
})
