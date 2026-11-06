/**
 * A visual-only composite for Sentinel-2 NDVI/NDMI RGB tiles. Each source
 * is an actual Planetary Computer rendered index. We blend across scene
 * footprints in global WebMercator coordinates to remove hard rectangular
 * overlaps, without fabricating data in areas lacking valid pixels.
 *
 * A color composite is NOT a quantitative, radiometrically harmonized index
 * raster or a time-series observation.
 */
export type SpectralPixelBox={
 left:number;top:number;right:number;bottom:number
}
export type SpectralPixelSource={
 rgba:Uint8ClampedArray
 box:SpectralPixelBox
 cloudCover?:number
}
export function blendSpectralPixels(
 sources:readonly SpectralPixelSource[],size=256,featherPx=64,
):Uint8ClampedArray{
 if(!Number.isInteger(size)||size<1||size>512)throw Error('Invalid tile dimension')
 if(!Number.isFinite(featherPx)||featherPx<=0)throw Error('Invalid feather width')
 const total=size*size
 const colorsR=new Float32Array(total)
 const colorsG=new Float32Array(total)
 const colorsB=new Float32Array(total)
 const weights=new Float32Array(total)
 const opacity=new Float32Array(total)
 for(const source of sources){
  if(source.rgba.length!==total*4)continue
  const {left,top,right,bottom}=source.box
  if(![left,top,right,bottom].every(Number.isFinite)||
   left>=right||top>=bottom)continue
  const reliability=typeof source.cloudCover==='number'&&
   Number.isFinite(source.cloudCover)?
   Math.max(.65,1-Math.max(0,Math.min(100,source.cloudCover))/160):1
  const startX=Math.max(0,Math.floor(left))
  const endX=Math.min(size,Math.ceil(right))
  const startY=Math.max(0,Math.floor(top))
  const endY=Math.min(size,Math.ceil(bottom))
  for(let y=startY;y<endY;y++){
   for(let x=startX;x<endX;x++){
    const edge=Math.min(x+.5-left,right-x-.5,y+.5-top,bottom-y-.5)
    if(edge<=0)continue
    const i=y*size+x,p=i*4
    const alpha=source.rgba[p+3]/255
    if(alpha<=0)continue
    // Feather consistently in map pixel space, not separately per scene
    // layer or tile. A tiny minimum preserves an otherwise isolated scene.
    const factor=Math.max(.01,Math.min(1,edge/featherPx))
    const w=alpha*factor*reliability
    colorsR[i]+=source.rgba[p]*w
    colorsG[i]+=source.rgba[p+1]*w
    colorsB[i]+=source.rgba[p+2]*w
    weights[i]+=w
    opacity[i]+=alpha*factor
   }
  }
 }
 const out=new Uint8ClampedArray(total*4)
 for(let i=0;i<total;i++){
  if(weights[i]<=0)continue
  const p=i*4
  out[p]=colorsR[i]/weights[i]
  out[p+1]=colorsG[i]/weights[i]
  out[p+2]=colorsB[i]/weights[i]
  out[p+3]=Math.min(255,Math.round(opacity[i]*255))
 }
 return out
}

export function tileScenePixelBox(
 bbox:readonly [number,number,number,number],
 project:(lon:number,lat:number)=>{x:number;y:number},
):SpectralPixelBox{
 const northWest=project(bbox[0],bbox[3])
 const southEast=project(bbox[2],bbox[1])
 return {
  left:Math.min(northWest.x,southEast.x),
  top:Math.min(northWest.y,southEast.y),
  right:Math.max(northWest.x,southEast.x),
  bottom:Math.max(northWest.y,southEast.y),
 }
}

export function intersectsPixelTile(box:SpectralPixelBox,size=256):boolean{
 return box.right>0&&box.bottom>0&&box.left<size&&box.top<size
}


