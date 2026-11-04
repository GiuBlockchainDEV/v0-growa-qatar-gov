/**
 * Pixel-accurate (within Natural Earth 1:10m coastline precision) clipping
 * of Sentinel-2 tile imagery to Qatar's administrative outline.
 *
 * Geometry: Natural Earth 1:10m via geojson-atlas (CC0)
 * https://github.com/BenPortner/geojson-atlas/tree/main/geojson/natural_earth/countries/10m
 *
 * Includes offshore islands. MultiPolygon combines Qatar's municipalities;
 * their internal boundaries are not rendered or exposed.
 */
import boundary from './qatar-adm0-boundary.json'

type Coordinates = [number,number]
type Ring = Coordinates[]
type Polygon = Ring[]
export type QatarBoundaryGeometry={type:'MultiPolygon';coordinates:Polygon[]}
const geometry=boundary as QatarBoundaryGeometry
export const QATAR_BOUNDARY:QatarBoundaryGeometry=geometry

export function isPointInQatar(lon:number,lat:number):boolean{
 const ringContains=(ring:Ring)=>{
  let inside=false
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
   const [xi,yi]=ring[i]
   const [xj,yj]=ring[j]
   const crosses=(yi>lat)!==(yj>lat)
   if(crosses&&lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)inside=!inside
  }
  return inside
 }
 return geometry.coordinates.some(polygon=>
  polygon.length>0&&ringContains(polygon[0])&&
  !polygon.slice(1).some(ringContains))
}

export type TileProject=(lon:number,lat:number)=>{x:number;y:number}
export interface ClipContext{
 beginPath():void
 moveTo(x:number,y:number):void
 lineTo(x:number,y:number):void
 closePath():void
 clip(fillRule:CanvasFillRule):void
}

/** The projection is CRS EPSG:3857 at the actual tile zoom.
 * The clip is applied before the image is drawn. No image pixels beyond
 * the national boundary enter the displayed canvas.
 */
export function clipTileToQatar(ctx:ClipContext,project:TileProject):void{
 ctx.beginPath()
 for(const polygon of geometry.coordinates){
  for(const ring of polygon){
   ring.forEach(([lon,lat],i)=>{
    const p=project(lon,lat)
    if(i===0)ctx.moveTo(p.x,p.y)
    else ctx.lineTo(p.x,p.y)
   })
   ctx.closePath()
  }
 }
 ctx.clip('evenodd')
}
