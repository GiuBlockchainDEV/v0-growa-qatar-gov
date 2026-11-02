/**
 * Client-side Watchtower route evidence.
 *
 * Observed trails use distinct ADS-B/AIS position samples received while this
 * browser session is open. They are NOT historical full-flight/voyage tracks.
 *
 * A short forward line is ONLY a constant-course/speed geodesic projection
 * from the last received fix, not a published flight plan or navigable sea route.
 */
import {freshAsset, separationKm, type TrackingAsset} from './global-tracking'

export type TrackPoint={lat:number;lon:number;time:string}
export type GeoPoint={lat:number;lon:number}
export type ObservedRoute={
  segments:TrackPoint[][]
  sampleCount:number
  firstSeenAt:string|null
  lastSeenAt:string|null
  observedDistanceKm:number
}
export type CourseProjection={
  path:GeoPoint[]
  horizonMinutes:number
  distanceKm:number
  observedAt:string
  projectedUntil:string
  basis:'constant_course_speed'
}
export const MAX_HISTORY_ASSETS=2000
const RAD=Math.PI/180

const HISTORY_WINDOW_MS={aircraft:3*3600000,vessel:12*3600000} as const
const MAX_SAMPLES={aircraft:160,vessel:240} as const
const GAP_LIMIT_MS={aircraft:7*60000,vessel:45*60000} as const
const MAX_TRAVEL_KMH={aircraft:2200,vessel:110} as const
const HORIZON_MINUTES={aircraft:20,vessel:60} as const

const normalizeLon=(lon:number)=>((lon+180)%360+360)%360-180

/**
 * Takes only provider fixes, ordered by their actual observation timestamps.
 * It never inserts interpolated positions. Store is bounded for dashboard use.
 */
export function captureObservedPositions(
  store:Map<string,TrackPoint[]>,
  assets:readonly TrackingAsset[],
  now=Date.now(),
):void{
  for(const asset of assets){
    if(!Number.isFinite(asset.lat)||!Number.isFinite(asset.lon)||
      Math.abs(asset.lat)>85||Math.abs(asset.lon)>180)continue
    const stamp=Date.parse(asset.observedAt)
    if(!Number.isFinite(stamp)||stamp>now+60000||
      now-stamp>HISTORY_WINDOW_MS[asset.kind])continue
    const points=store.get(asset.id)??[]
    const last=points[points.length-1]
    if(!last||Date.parse(last.time)<stamp){
      points.push({lat:asset.lat,lon:asset.lon,time:asset.observedAt})
    }
    const cutoff=now-HISTORY_WINDOW_MS[asset.kind]
    const updated=points.filter(p=>Date.parse(p.time)>=cutoff)
      .slice(-MAX_SAMPLES[asset.kind])
    if(updated.length)store.set(asset.id,updated)
  }
  for(const [id,points] of store){
    const kind=id.startsWith('sea:')?'vessel':'aircraft'
    const cutoff=now-HISTORY_WINDOW_MS[kind]
    const valid=points.filter(p=>Date.parse(p.time)>=cutoff)
    if(!valid.length)store.delete(id)
    else if(valid.length!==points.length)store.set(id,valid)
  }
  while(store.size>MAX_HISTORY_ASSETS){
    const oldest=store.keys().next().value
    if(!oldest)break
    store.delete(oldest)
  }
}

export function observedRoute(points:readonly TrackPoint[],kind:TrackingAsset['kind']):ObservedRoute{
  const sorted=[...points].filter(p=>
    Number.isFinite(Date.parse(p.time))&&Number.isFinite(p.lat)&&
    Number.isFinite(p.lon)&&Math.abs(p.lat)<=85&&Math.abs(p.lon)<=180)
    .sort((a,b)=>Date.parse(a.time)-Date.parse(b.time))
  const segments:TrackPoint[][]=[]
  let current:TrackPoint[]=[]
  let distance=0
  for(const point of sorted){
    const prev=current[current.length-1]
    if(prev){
      const dt=Date.parse(point.time)-Date.parse(prev.time)
      const km=separationKm(prev,point)
      if(dt<=0)continue
      // A large gap or implausible position jump must not become a solid line.
      if(dt>GAP_LIMIT_MS[kind]||km>MAX_TRAVEL_KMH[kind]*dt/3600000+2){
        if(current.length)segments.push(current)
        current=[]
      }else{
        distance+=km
      }
    }
    current.push(point)
  }
  if(current.length)segments.push(current)
  const first=segments[0]?.[0],last=segments[segments.length-1]?.at(-1)
  return {
    segments,sampleCount:segments.reduce((sum,s)=>sum+s.length,0),
    firstSeenAt:first?.time??null,lastSeenAt:last?.time??null,
    observedDistanceKm:Math.round(distance*10)/10,
  }
}

/** Great-circle forward point on a sphere; no waypoint or coast routing. */
export function destinationPoint(start:GeoPoint,headingDeg:number,distanceKm:number):GeoPoint{
  const angular=distanceKm/6371.0088
  const lat1=start.lat*RAD,lon1=start.lon*RAD,bearing=headingDeg*RAD
  const lat2=Math.asin(Math.sin(lat1)*Math.cos(angular)+
    Math.cos(lat1)*Math.sin(angular)*Math.cos(bearing))
  const lon2=lon1+Math.atan2(Math.sin(bearing)*Math.sin(angular)*Math.cos(lat1),
    Math.cos(angular)-Math.sin(lat1)*Math.sin(lat2))
  return {lat:lat2/RAD,lon:normalizeLon(lon2/RAD)}
}

export function forwardCourseProjection(asset:TrackingAsset,now=Date.now()):
  CourseProjection|null{
  if(!freshAsset(asset,now)||asset.heading===null||asset.speedKnots===null||
    !Number.isFinite(asset.heading)||!Number.isFinite(asset.speedKnots)||
    asset.heading<0||asset.heading>=360||
    asset.speedKnots<(asset.kind==='aircraft'?40:1)||
    asset.speedKnots>(asset.kind==='aircraft'?1000:55)||
    !Number.isFinite(asset.lat)||!Number.isFinite(asset.lon)||
    Math.abs(asset.lat)>85||Math.abs(asset.lon)>180)return null
  // Preserve TypeScript's non-null narrowing across the Array.from callback.
  // Asset properties can be mutable, but this checked primitive cannot.
  const headingDeg: number = asset.heading
  const minutes=HORIZON_MINUTES[asset.kind],distanceKm=asset.speedKnots*1.852*minutes/60
  const intervals=20
  const path=Array.from({length:intervals+1},(_,index)=>
    destinationPoint(asset,headingDeg,distanceKm*index/intervals))
  return {path,horizonMinutes:minutes,distanceKm:Math.round(distanceKm*10)/10,
    observedAt:asset.observedAt,
    projectedUntil:new Date(Date.parse(asset.observedAt)+minutes*60000).toISOString(),
    basis:'constant_course_speed'}
}

/**
 * Avoid 360-degree world-spanning lines at the antimeridian.
 * Align an entire segment with the nearest repeated Esri/Leaflet world copy.
 */
export function worldCopyPolyline(points:readonly GeoPoint[],mapCenterLon:number):
  [number,number][]{
  if(!points.length)return []
  const first=normalizeLon(points[0].lon)
  const shift=360*Math.round((mapCenterLon-first)/360)
  const result:[number,number][]=[[points[0].lat,first+shift]]
  for(let i=1;i<points.length;i++){
    const raw=normalizeLon(points[i].lon)
    const previous=result[i-1][1]
    const lng=raw+360*Math.round((previous-raw)/360)
    result.push([points[i].lat,lng])
  }
  return result
}

/**
 * Last-known direction cue for a map. This is NEVER a track, route or
 * future-position forecast. It can be shown when the ADS-B/AIS observation is
 * no longer recent, but only inside the provider ingestion age window.
 */
export type CourseCue={
  headingDeg:number
  ageSeconds:number
  quality:'recent'|'stale_last_known'
  observedAt:string
}
export function lastKnownCourseCue(asset:TrackingAsset, now=Date.now()):CourseCue|null{
  const observed=Date.parse(asset.observedAt)
  const heading=asset.heading, speed=asset.speedKnots
  const maxAgeMs=asset.kind==='aircraft'?15*60000:30*60000
  if(!Number.isFinite(observed)||observed>now+60000||
    now-observed>maxAgeMs||heading===null||speed===null||
    !Number.isFinite(heading)||!Number.isFinite(speed)||
    heading<0||heading>=360||
    speed<(asset.kind==='aircraft'?40:1)||
    speed>(asset.kind==='aircraft'?1000:55)||
    !Number.isFinite(asset.lat)||!Number.isFinite(asset.lon)||
    Math.abs(asset.lat)>85||Math.abs(asset.lon)>180)return null
  return {
    headingDeg:heading,
    ageSeconds:Math.max(0,Math.floor((now-observed)/1000)),
    quality:freshAsset(asset,now)?'recent':'stale_last_known',
    observedAt:asset.observedAt,
  }
}

/**
 * Route geometry to show AUTOMATICALLY for every tracked asset in the current
 * viewport. Selection is intentionally not an input: it only changes styling.
 * One initial observation can yield an honest forward projection; past tracks
 * require at least two observed fixes.
 */
export type AutomaticRouteEvidence = {
  id: string
  kind: TrackingAsset['kind']
  observedSegments: TrackPoint[][]
  projection: CourseProjection | null
  cue: CourseCue | null
}
export function automaticRouteEvidence(
  assets: readonly TrackingAsset[],
  history: ReadonlyMap<string, TrackPoint[]>,
  now = Date.now(),
): AutomaticRouteEvidence[] {
  const routes: AutomaticRouteEvidence[] = []
  for (const asset of assets) {
    const observed = observedRoute(history.get(asset.id) ?? [], asset.kind)
    const observedSegments = observed.segments.filter(segment => segment.length >= 2)
    const projection = forwardCourseProjection(asset, now)
    const cue = lastKnownCourseCue(asset, now)
    if (observedSegments.length || projection || cue) routes.push({
      id: asset.id, kind: asset.kind, observedSegments, projection, cue,
    })
  }
  return routes
}
