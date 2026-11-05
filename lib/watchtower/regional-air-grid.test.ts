import {describe,it,expect} from 'vitest'
import {REGIONAL_AIR_CENTERS,REGIONAL_AIR_BATCH_COUNT,REGIONAL_AIR_BOUNDS,
 REGIONAL_AIR_PRIORITY_HUBS} from './regional-air-shared'

const nm=(latA:number,lonA:number,latB:number,lonB:number)=>{
  const rad=Math.PI/180,a=latA*rad,b=latB*rad
  const h=Math.sin((b-a)/2)**2+Math.cos(a)*Math.cos(b)*
    Math.sin((lonA-lonB)*rad/2)**2
  return 3440.065*2*Math.asin(Math.sqrt(Math.min(1,h)))
}
describe('Geographic coverage of the full Watchtower screenshot',()=>{
  it('covers the complete Egypt-to-Pakistan rectangle with real 250 NM queries',()=>{
    expect(REGIONAL_AIR_CENTERS).toHaveLength(70)
    expect(REGIONAL_AIR_BATCH_COUNT).toBe(14)
    for(const center of REGIONAL_AIR_CENTERS){
      expect(center.lat).toBeGreaterThanOrEqual(7)
      expect(center.lat).toBeLessThanOrEqual(42)
    }
    let worst=0
    for(let lat=REGIONAL_AIR_BOUNDS.south;lat<=REGIONAL_AIR_BOUNDS.north;lat+=0.5)
      for(let lon=REGIONAL_AIR_BOUNDS.west;lon<=REGIONAL_AIR_BOUNDS.east;lon+=0.5){
        const nearest=Math.min(...REGIONAL_AIR_CENTERS.map(
          c=>nm(lat,lon,c.lat,c.lon)))
        worst=Math.max(worst,nearest)
      }
    expect(worst).toBeLessThan(250)
  })
  it('prioritises the Gulf without losing the 60 real geographical circles',()=>{
    const priority=REGIONAL_AIR_CENTERS.filter(c=>c.batch<2)
    expect(priority).toHaveLength(10)
    expect(priority.some(c=>c.lat>=20&&c.lat<=30&&c.lon>=49&&c.lon<=61)).toBe(true)
    expect(new Set(REGIONAL_AIR_CENTERS.map(c=>c.index)).size).toBe(70)
  })
  it('prioritizes genuine Saudi, Yemeni and Omani positions before generic grid scans',()=>{
    const leading=REGIONAL_AIR_CENTERS.slice(0,10)
    expect(REGIONAL_AIR_PRIORITY_HUBS).toHaveLength(10)
    expect(leading.map(c=>c.hub)).toEqual(REGIONAL_AIR_PRIORITY_HUBS.map(h=>h.id))
    for(const region of ['Saudi Arabia','Yemen','Oman']){
      expect(leading.filter(c=>c.region===region).length).toBeGreaterThanOrEqual(2)
      expect(leading.slice(0,5).some(c=>c.region===region)).toBe(true)
    }
    expect(REGIONAL_AIR_CENTERS.filter(c=>!c.hub)).toHaveLength(60)
    expect(new Set(leading.map(c=>c.lat+':'+c.lon)).size).toBe(10)
  })
  it('splits the area into fourteen serialized five-query batches',()=>{
    for(let batch=0;batch<REGIONAL_AIR_BATCH_COUNT;batch++)
      expect(REGIONAL_AIR_CENTERS.filter(c=>c.batch===batch)).toHaveLength(5)
  })
})

// Geographic priority does not create aircraft; the API still returns only ADS-B fixes.
