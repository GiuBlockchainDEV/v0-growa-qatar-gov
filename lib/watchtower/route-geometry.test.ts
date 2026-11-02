import {describe,expect,it} from 'vitest'
import {automaticRouteEvidence,captureObservedPositions,destinationPoint,forwardCourseProjection,observedRoute,
  worldCopyPolyline} from './route-geometry'
import type {TrackingAsset} from './global-tracking'
const now=Date.parse('2026-11-02T08:00:00Z')
const asset=(override:Partial<TrackingAsset>={}):TrackingAsset=>({
  id:'air:abc123',kind:'aircraft',lat:25,lon:51,heading:90,speedKnots:450,
  altitudeFt:35000,observedAt:new Date(now-10000).toISOString(),
  label:'FDX123',source:'ADSB.lol',sourceUrl:'https://www.adsb.lol/',
  type:'B763',cargo:'operator_inferred',foodCargoVerified:false,destination:null,
  ...override,
})
describe('observed vs projected tracking routes',()=>{
  it('records only ordered distinct real fixes and does not fabricate history',()=>{
    const history=new Map()
    captureObservedPositions(history,[asset()],now)
    captureObservedPositions(history,[asset()],now)
    expect(history.get('air:abc123')).toHaveLength(1)
    const a=asset({lat:25.2,observedAt:new Date(now+50000).toISOString()})
    captureObservedPositions(history,[a],now+60000)
    const route=observedRoute(history.get('air:abc123')!,'aircraft')
    expect(route.sampleCount).toBe(2)
    expect(route.segments).toHaveLength(1)
    expect(route.observedDistanceKm).toBeGreaterThan(0)
    expect(route.firstSeenAt).toBe(asset().observedAt)
  })
  it('breaks history on long gaps or impossible position jumps',()=>{
    const start={lat:25,lon:51,time:new Date(now-180000).toISOString()}
    const nearby={lat:25.03,lon:51,time:new Date(now-120000).toISOString()}
    const jump={lat:-25,lon:51,time:new Date(now-60000).toISOString()}
    const route=observedRoute([start,nearby,jump],'aircraft')
    expect(route.segments.map(s=>s.length)).toEqual([2,1])
    expect(route.observedDistanceKm).toBeLessThan(10)
    const gap=observedRoute([start,{...nearby,time:new Date(now+3600000).toISOString()}],'aircraft')
    expect(gap.segments).toHaveLength(2)
  })
  it('projects only a short, source-labelled direction of travel for recent moving vehicles',()=>{
    const p=forwardCourseProjection(asset(),now)!
    expect(p.horizonMinutes).toBe(20)
    expect(p.basis).toBe('constant_course_speed')
    expect(p.path).toHaveLength(21)
    expect(p.path[0]).toEqual({lat:25,lon:51})
    expect(p.path.at(-1)!.lon).toBeGreaterThan(51)
    expect(p.distanceKm).toBeCloseTo(277.8,1)
    const v=forwardCourseProjection(asset({id:'sea:123456789',kind:'vessel',
      speedKnots:15,altitudeFt:null}),now)!
    expect(v.horizonMinutes).toBe(60)
    expect(v.distanceKm).toBeCloseTo(27.8,1)
  })
  it('does not imply planned routes when direction/speed or freshness is unavailable',()=>{
    expect(forwardCourseProjection(asset({heading:null}),now)).toBeNull()
    expect(forwardCourseProjection(asset({speedKnots:null}),now)).toBeNull()
    expect(forwardCourseProjection(asset({speedKnots:0}),now)).toBeNull()
    expect(forwardCourseProjection(asset({observedAt:new Date(now-900000).toISOString()}),now)).toBeNull()
    expect(forwardCourseProjection(asset({kind:'vessel',id:'sea:123456789',
      observedAt:new Date(now-660000).toISOString()}),now)).toBeNull()
    expect(forwardCourseProjection(asset({speedKnots:10000}),now)).toBeNull()
  })
  it('keeps geometry continuous across antimeridian and spherical latitude',()=>{
    const p=destinationPoint({lat:0,lon:179.9},90,60)
    expect(p.lon).toBeLessThan(-179)
    const projected=worldCopyPolyline([{lat:0,lon:179.9},p],180)
    expect(Math.abs(projected[1][1]-projected[0][1])).toBeLessThan(1)
    expect(projected[1][1]).toBeGreaterThan(180)
    const shifted=worldCopyPolyline([{lat:0,lon:179.9},p],-180)
    expect(shifted[0][1]).toBeCloseTo(-180.1,2)
  })
  it('caps in-browser history and ignores stale/out-of-order samples',()=>{
    const history=new Map()
    captureObservedPositions(history,[asset({observedAt:new Date(now-86400000).toISOString()})],now)
    expect(history.size).toBe(0)
    captureObservedPositions(history,[asset()],now)
    captureObservedPositions(history,[asset({lat:5,observedAt:new Date(now-20000).toISOString()})],now)
    expect(history.get('air:abc123')).toHaveLength(1)
  })
  it('displays automatically for all eligible assets without a selection',()=>{
    const a=asset()
    const b=asset({id:'air:def456',lat:27,lon:55,heading:180})
    const future=automaticRouteEvidence([a,b],new Map(),now)
    expect(future).toHaveLength(2)
    expect(future.every(r=>r.projection!==null)).toBe(true)
    expect(future.every(r=>r.observedSegments.length===0)).toBe(true)
    const history=new Map([[a.id,[
      {lat:25,lon:50.8,time:new Date(now-70000).toISOString()},
      {lat:25,lon:51,time:a.observedAt},
    ]]])
    const tracked=automaticRouteEvidence([a,b],history,now)
    expect(tracked.find(r=>r.id===a.id)?.observedSegments).toHaveLength(1)
    expect(tracked.find(r=>r.id===b.id)?.observedSegments).toHaveLength(0)
    expect(automaticRouteEvidence([asset({heading:null})],new Map(),now)).toEqual([])
  })
})
