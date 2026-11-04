import {describe,expect,it} from 'vitest'
import {DEMO_VESSEL_MARKERS,sparseAreaDemoVessels} from './demo-vessels'
import type {TrackingAsset} from './global-tracking'

const ais=(id:string,lat:number,lon:number):TrackingAsset=>({
  id:'sea:'+id,kind:'vessel',label:'REAL AIS VESSEL',lat,lon,
  heading:90,speedKnots:12,altitudeFt:null,
  observedAt:'2026-11-04T12:00:00.000Z',source:'OpenSeaFeed AIS',
  sourceUrl:'https://openseafeed.com',type:'AIS cargo ship',
  cargo:'ais_cargo_class',foodCargoVerified:false,destination:null,
  observationBasis:'position_report',
})

describe('clearly separated demonstration ships',()=>{
  it('keeps marker counts explicit and substantially increases Arabian Sea scenarios',()=>{
    const points=sparseAreaDemoVessels([])
    expect(points).toHaveLength(29)
    for(const id of ['red_sea','gulf_of_aden'])
      expect(points.filter(x=>x.region===id)).toHaveLength(4)
    expect(points.filter(x=>x.region==='arabian_sea')).toHaveLength(21)
    expect(new Set(points.map(x=>x.id)).size).toBe(29)
    expect(points.every(x=>x.label.startsWith('DEMO'))).toBe(true)
    expect(DEMO_VESSEL_MARKERS.every(x=>x.id.startsWith('demo:'))).toBe(true)
  })
  it('never introduces an MMSI, source timestamp or AIS-asset identity',()=>{
    for(const point of DEMO_VESSEL_MARKERS){
      expect('observedAt' in point).toBe(false)
      expect('source' in point).toBe(false)
      expect('speedKnots' in point).toBe(false)
      expect(point.id.startsWith('sea:')).toBe(false)
    }
  })
  it('reduces demo markers only where a real AIS vessel exists',()=>{
    const result=sparseAreaDemoVessels([
      ais('123456789',22.6,37.4),ais('223456789',22.0,37.6),
      ais('323456789',12.5,49.4),
    ])
    expect(result.filter(x=>x.region==='red_sea')).toHaveLength(2)
    expect(result.filter(x=>x.region==='gulf_of_aden')).toHaveLength(3)
    expect(result.filter(x=>x.region==='arabian_sea')).toHaveLength(21)
  })
  it('keeps synthetic Arabian markers offshore and geographically plausible',()=>{
    const markers=DEMO_VESSEL_MARKERS.filter(x=>x.region==='arabian_sea')
    expect(markers).toHaveLength(21)
    expect(markers.every(x=>x.lat>=14&&x.lat<=23.2&&x.lon>=54.2&&x.lon<=74)).toBe(true)
    expect(new Set(markers.map(x=>x.lat+':'+x.lon)).size).toBe(42)
    expect(markers.filter(x=>x.lon>=65).length).toBeGreaterThan(5)
  })
  it('keeps real records out of the demo overlay',()=>{
    const trueAis=ais('123456789',19.4,39.0)
    const result=sparseAreaDemoVessels([trueAis])
    expect(result.every(x=>x.id!==trueAis.id)).toBe(true)
    expect(trueAis.id.startsWith('sea:')).toBe(true)
  })
})
