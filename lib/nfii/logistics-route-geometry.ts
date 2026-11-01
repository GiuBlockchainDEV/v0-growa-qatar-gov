/** Sanitized GeoJSON linework for NFII logistics. Coordinates are [lat, lon] for Leaflet. */
export type GeoPointTuple=readonly [latitude:number,longitude:number]
export type GeoLine=GeoPointTuple[][]
type Obj=Record<string,unknown>
const object=(x:unknown):Obj=>x&&typeof x==='object'&&!Array.isArray(x)?x as Obj:{}
const good=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x)
const point=(c:unknown):GeoPointTuple|null=>{
  if(!Array.isArray(c)||c.length<2||!good(c[0])||!good(c[1]))return null
  const [lon,lat]=c as [number,number]
  if(Math.abs(lat)>90||Math.abs(lon)>180)return null
  return [lat,lon]
}
const clean=(input:unknown,limit=160):GeoPointTuple[]=>{
  if(!Array.isArray(input))return []
  const parsed=input.slice(0,24000).map(point).filter((p):p is GeoPointTuple=>p!==null)
  if(parsed.length<2)return []
  const step=Math.max(1,Math.ceil((parsed.length-1)/(limit-1)))
  const sampled=parsed.filter((_,i)=>i%step===0)
  if(sampled[sampled.length-1]!==parsed[parsed.length-1])
    sampled.push(parsed[parsed.length-1])
  return sampled.slice(0,limit)
}
/** SeaRoutes GeoJSON FeatureCollection; rejects partial or absurd geometries. */
export function readSeaRouteGeometry(raw:unknown):GeoLine|null{
  const doc=object(raw),features=doc.features
  const rawGeometry=Array.isArray(features)?object(object(features[0]).geometry):object(doc.geometry)
  const typ=rawGeometry.type
  const coordinates=rawGeometry.coordinates
  if(!Array.isArray(coordinates))return null
  const lines=typ==='LineString'?[coordinates]:
    typ==='MultiLineString'?coordinates.slice(0,24):[]
  const output=lines.map(line=>clean(line)).filter(line=>line.length>=2)
  if(!output.length||output.reduce((sum,line)=>sum+line.length,0)>2000)return null
  return output
}
/** Consecutive segments spanning the dateline are split to prevent world wraps. */
export function splitAtDateline(lines:GeoLine):GeoLine{
  const result:GeoLine=[]
  for(const line of lines){
    let segment:GeoPointTuple[]=[]
    for(const p of line){
      if(segment.length&&Math.abs(p[1]-segment[segment.length-1][1])>180){
        if(segment.length>=2)result.push(segment)
        segment=[]
      }
      segment.push(p)
    }
    if(segment.length>=2)result.push(segment)
  }
  return result
}

/**
 * Geographic shortest-path reference for an air leg, sampled on a sphere.
 * This is NOT an airline service, airway, flight plan, observed track or ETA.
 * It must remain illustrative in both the API and map legend.
 */
export function makeAirGreatCircle(
  origin:GeoPointTuple,destination:GeoPointTuple,
):GeoLine{
  const rad=Math.PI/180
  const vector=(p:GeoPointTuple):[number,number,number]=>{
    const lat=p[0]*rad,lon=p[1]*rad
    return [Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)]
  }
  const a=vector(origin),b=vector(destination)
  const dot=Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2]))
  const angle=Math.acos(dot),sinAngle=Math.sin(angle)
  // The antipodal case has no uniquely defined shortest great circle.
  if(angle<1e-8||Math.abs(sinAngle)<1e-8)return []
  const segments=Math.min(128,Math.max(24,Math.ceil(angle*6371/150)))
  const points:GeoPointTuple[]=[]
  for(let i=0;i<=segments;i++){
    if(i===0){points.push(origin);continue}
    if(i===segments){points.push(destination);continue}
    const t=i/segments
    const first=Math.sin((1-t)*angle)/sinAngle
    const second=Math.sin(t*angle)/sinAngle
    const x=first*a[0]+second*b[0]
    const y=first*a[1]+second*b[1]
    const z=first*a[2]+second*b[2]
    points.push([Math.atan2(z,Math.hypot(x,y))/rad,Math.atan2(y,x)/rad])
  }
  // Split at the antimeridian instead of drawing an incorrect world-spanning line.
  return splitAtDateline([points])
}

/**
 * Ensure a returned maritime geometry actually joins the requested port
 * references. Also require optional via-point passage for named transfers.
 * This rejects unrelated GeoJSON features and ignored via-hub parameters.
 */
export function matchesRequestedSeaPorts(
  lines:GeoLine,origin:GeoPointTuple,destination:GeoPointTuple,
  via?:GeoPointTuple,
):boolean{
  const flattened=lines.flat()
  if(flattened.length<2)return false
  const distance=(a:GeoPointTuple,b:GeoPointTuple)=>{
    const rad=Math.PI/180
    const la=(b[0]-a[0])*rad,lo=(b[1]-a[1])*rad
    const d=Math.sin(la/2)**2+
      Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(lo/2)**2
    return 12742*Math.asin(Math.min(1,Math.sqrt(d)))
  }
  const start=flattened[0],end=flattened[flattened.length-1]
  const aligned=(distance(start,origin)<300&&distance(end,destination)<300)||
    (distance(start,destination)<300&&distance(end,origin)<300)
  if(!aligned)return false
  if(via&&!flattened.some(point=>distance(point,via)<180))return false
  return true
}
