import {describe,expect,it} from 'vitest'
import {readSeaRouteGeometry,splitAtDateline,matchesRequestedSeaPorts,makeAirGreatCircle} from './logistics-route-geometry'
import {makeRouteMapOverlays,previewRouteMapOverlays} from './logistics-route-map'
import {buildScreenedRoutes} from './logistics-screening'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

const api=readFileSync(join(process.cwd(),'app/api/nfii/logistics/corridors/route.ts'),'utf8')
const ui=readFileSync(join(process.cwd(),'components/dashboard/nfii-ops/logistics-corridor-intelligence.tsx'),'utf8')
const map=readFileSync(join(process.cwd(),'components/dashboard/nfii-ops/logistics-route-map.tsx'),'utf8')
describe('Interactive food import routes on a real map',()=>{
  it('sanitizes GeoJSON [longitude,latitude] and limits payload size',()=>{
    const coords={type:'FeatureCollection',features:[{geometry:{
      type:'LineString',coordinates:[[72.95,18.95],[66.98,24.82],[51.61,25]],
    }}]}
    const lines=readSeaRouteGeometry(coords)
    expect(lines).toEqual([[[18.95,72.95],[24.82,66.98],[25,51.61]]])
    expect(readSeaRouteGeometry({features:[{geometry:{type:'LineString',
      coordinates:[[300,25],[66,24]]}}]})).toBeNull()
    expect(readSeaRouteGeometry({features:[{geometry:{type:'Point',
      coordinates:[51,25]}}]})).toBeNull()
    expect(readSeaRouteGeometry({features:[{geometry:{type:'MultiLineString',
      coordinates:[[[51,25],[52,26]],[[53,27],[54,28]]]}}]})).toHaveLength(2)
    const many=Array.from({length:4000},(_,i)=>[50+i/4000,20+i/4000])
    expect(readSeaRouteGeometry({features:[{geometry:{
      type:'LineString',coordinates:many,
    }}]})?.[0].length).toBeLessThanOrEqual(160)
  })
  it('splits lines that cross the international dateline',()=>{
    expect(splitAtDateline([[[12,177],[13,179],[13,-179],[14,-175]]]))
      .toEqual([[[12,177],[13,179]],[[13,-179],[14,-175]]])
  })
  it('draws API-provided sea paths as sourced and other routes as illustrative',()=>{
    const screened=buildScreenedRoutes({
      commodity:'rice',country:'IN',tonnes:20,limitDays:60,
      rates:{sea:null,air:null,road:null},
      lpi:null,lpiYear:null,waves:null,weatherAgeHours:null,
      seaDistances:{sea_direct:{
        km:3000,durationDays:8,routeUrl:'https://developer.searoutes.com/reference/getsearoute',
        geometry:[[[18.95,72.95],[25,51.61]]],
      }},
    })
    const routed=makeRouteMapOverlays(screened,'IN',{
      sea_direct:{km:3000,durationDays:8,
        routeUrl:'https://developer.searoutes.com/reference/getsearoute',
        geometry:[[[18.95,72.95],[25,51.61]]]},
    })
    expect(routed.find(x=>x.id==='sea_direct')?.fidelity).toBe('provider_geometry')
    expect(routed.find(x=>x.id==='air_direct')?.fidelity).toBe('illustrative')
    expect(routed.find(x=>x.id==='air_direct')?.paths[0].length).toBeGreaterThan(16)
    expect(routed.find(x=>x.id==='air_direct')?.source).toContain('not a verified flight path')
    expect(routed.some(x=>x.id==='sea_salalah')).toBe(false)
    expect(routed.find(x=>x.id==='sea_direct')?.paths[0][0]).toEqual([18.95,72.95])
    expect(routed.every(x=>x.destination[0]>24)).toBe(true)
  })
  it('shows unverified map preview before an API assessment',()=>{
    const preliminary=previewRouteMapOverlays('IN')
    expect(preliminary.some(x=>x.id==='sea_direct')).toBe(true)
    expect(preliminary.some(x=>x.id==='air_direct')).toBe(true)
    expect(preliminary.every(x=>x.fidelity==='illustrative')).toBe(true)
    expect(preliminary.find(x=>x.id==='sea_direct')?.paths).toEqual([])
    expect(preliminary.find(x=>x.id==='air_direct')?.paths[0].length).toBeGreaterThan(16)
    expect(preliminary.some(x=>x.id==='air_dubai')).toBe(false)
    expect(preliminary.some(x=>x.id==='sea_salalah')).toBe(false)
    expect(previewRouteMapOverlays('XX')).toEqual([])
  })
  it('draws an interpolated great circle, never a straight planar air segment',()=>{
    const origin:[number,number]=[40.6413,-73.7781]
    const destination:[number,number]=[25.2731,51.608]
    const lines=makeAirGreatCircle(origin,destination)
    const points=lines.flat()
    expect(points.length).toBeGreaterThan(40)
    expect(points[0]).toEqual(origin)
    expect(points[points.length-1]).toEqual(destination)
    expect(points.every(([lat,lon])=>Number.isFinite(lat)&&Number.isFinite(lon)&&
      Math.abs(lat)<=90&&Math.abs(lon)<=180)).toBe(true)
    expect(Math.max(...points.map(p=>p[0]))).toBeGreaterThan(40.7)
    expect(lines.every(line=>line.every((p,i)=>i===0||
      Math.abs(p[1]-line[i-1][1])<=180))).toBe(true)
  })
  it('rejects sea geometry that does not join the actual endpoints or declared hub',()=>{
    const src:[number,number]=[18.95,72.95]
    const dest:[number,number]=[25,51.61]
    expect(matchesRequestedSeaPorts([[[18.95,72.95],[25,51.61]]],src,dest)).toBe(true)
    expect(matchesRequestedSeaPorts([[[18.95,72.95],[25,51.61]]],src,dest,[24.99,55.06])).toBe(false)
    expect(matchesRequestedSeaPorts([[[10,20],[11,22]]],src,dest)).toBe(false)
  })
  it('wires map selection to details while preserving source distinctions',()=>{
    expect(api).toContain('mapRoutes:makeRouteMapOverlays')
    expect(ui).toContain('<LogisticsRouteMap')
    expect(ui).toContain('previewRouteMapOverlays(country)')
    expect(ui).toContain('onSelect={id=>data?setSelected(id):setPreviewSelected(id)}')
    expect(map).toContain("void import('leaflet')")
    expect(map).toContain('fitBounds')
    expect(map).toContain('route.paths.length')
    expect(map).toContain("line.on('click'")
    expect(map).toContain('OpenStreetMap contributors')
  })
})
