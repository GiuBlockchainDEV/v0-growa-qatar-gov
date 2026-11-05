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


/**
 * B08-guided SFIM + HPA for false-color NDVI/NDMI display only.
 *
 * Guide P is a same-acquisition near-infrared (B08) rendered grayscale tile.
 * LP(P) is a 5x5 spatial low-pass. At each valid pixel:
 *   SFIM = I * clamp(P / LP(P), 0.62, 1.38)
 *   HPA  = SFIM + alpha * (P - LP(P))
 * where I is the original false-color luminance, NOT an index measurement.
 * The reconstructed intensity modulates RGB with a bounded, hue-preserving
 * ratio. This is legitimate SFIM/HPA signal fusion on display luminance,
 * NOT physical pan-sharpening of raw B11 reflectance or 5 m NDVI/NDMI.
 *
 * Both source and guidance masks are mandatory. We never create new colored
 * pixels, grow edges into nodata, or change numeric band/index values.
 */
export function sfimHpaSpectralVisualFusion(
 source:Uint8ClampedArray,
 nirGuide:Uint8ClampedArray,
 size=256,
):Uint8ClampedArray{
 if(!Number.isInteger(size)||size<1||size>1024||
   source.length!==size*size*4||nirGuide.length!==source.length)
   throw Error('Invalid SFIM+HPA tile buffers')
 const out=new Uint8ClampedArray(source)
 if(size<2)return out
 const pixels=size*size
 const guidance=new Float32Array(pixels)
 const valid=new Uint8Array(pixels)
 for(let i=0;i<pixels;i++){
  const p=i*4
  if(source[p+3]<8||nirGuide[p+3]<8)continue
  valid[i]=1
  guidance[i]=(nirGuide[p]+nirGuide[p+1]+nirGuide[p+2])/(3*255)
 }
 const radius=2
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,p=i*4
  if(!valid[i])continue
  let total=0,count=0
  // Mask-normalized low-pass avoids inventing texture across satellite gaps.
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   const yy=Math.max(0,Math.min(size-1,y+dy))
   const xx=Math.max(0,Math.min(size-1,x+dx))
   const q=yy*size+xx
   if(!valid[q])continue
   total+=guidance[q];count++
  }
  if(count<4)continue
  const P=guidance[i],P_low=total/count
  if(P_low<0.025)continue
  const I=(.2126*source[p]+.7152*source[p+1]+.0722*source[p+2])/255
  if(I<0.01)continue
  // SFIM multiplicative modulation. Ratio limits guard against extreme
  // values around dark water and low-information desert pixels.
  const ratio=Math.max(.62,Math.min(1.38,P/P_low))
  const sfim=I*ratio
  // HPA high-pass detail injection. Guard values to avoid chromatic halos.
  const highPass=Math.max(-.18,Math.min(.18,P-P_low))
  const hpa=sfim+highPass*.72
  const gain=Math.max(.65,Math.min(1.35,hpa/I))
  for(let c=0;c<3;c++)out[p+c]=Math.max(0,Math.min(255,
    Math.round(source[p+c]*gain)))
  // out[p+3] remains exactly the source alpha.
 }
 return out
}
