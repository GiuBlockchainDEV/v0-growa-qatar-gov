import {describe,it,expect} from 'vitest'
import {MARITIME_AIS_AREAS,parseOpenWatersArea} from './open-waters-ais'
const now=Date.UTC(2026,10,3,11,0)
const feature=(id:number,lat:number,lon:number,ageMin=4,
  type=70,sog=10,kind='vessel')=>({
  type:'Feature',id,geometry:{type:'Point',coordinates:[lon,lat]},
  properties:{mmsi:id,seen:new Date(now-ageMin*60000).toISOString(),
    kind,name:'SEA SHIP '+id,type,sog,cog:120,destination:'JEDDAH',source:'aishub'},
})
describe('Open Waters AIS adapter for waters outside the Persian Gulf',()=>{
  it('covers Red Sea, Gulf of Aden, Arabian Sea, and NW Indian Ocean with bounded searches',()=>{
    const ids=MARITIME_AIS_AREAS.map(a=>a.id)
    for(const name of ['red_sea_north','red_sea_central','red_sea_south',
      'aden_west','aden_east','arabian_west','arabian_east',
      'indian_ocean_west','indian_ocean_central','indian_ocean_east'])
      expect(ids).toContain(name)
    for(const area of MARITIME_AIS_AREAS){
      const [south,west,north,east]=area.bounds
      expect((north-south)*(east-west)).toBeLessThanOrEqual(100)
    }
  })
  it('accepts only real, source-dated GeoJSON vessel coordinates',()=>{
    const result=parseOpenWatersArea({type:'FeatureCollection',features:[
      feature(123456789,17,40),feature(234567890,12,48,8,80,0),
      feature(345678901,16,62,4,75,14,'base'),
      feature(456789012,18,56,160),
      feature(567890123,18,91),
    ],attribution:{aishub:'Credit AISHub contributors, aishub.net'}},now)
    expect(result.assets).toHaveLength(2)
    expect(result.assets[0].cargo).toBe('ais_cargo_class')
    expect(result.assets[1].cargo).toBe('unverified')
    expect(result.assets[0].source).toContain('aishub')
    expect(result.assets[0].foodCargoVerified).toBe(false)
    expect(result.attribution[0]).toContain('AISHub')
  })
  it('does not accept undated or invented trajectories',()=>{
    expect(parseOpenWatersArea({type:'FeatureCollection',features:[
      {type:'Feature',geometry:{type:'Point',coordinates:[44,15]},
        properties:{mmsi:123456789,name:'UNSTAMPED'}},
    ]},now).assets).toHaveLength(0)
    expect(()=>parseOpenWatersArea({features:[]},now)).toThrow()
  })
})
