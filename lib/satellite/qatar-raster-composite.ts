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
 * 2× *visual* spectral reconstruction, using a separable cubic kernel with
 * contrast limiting to avoid false-color ringing/halos. No ML inference,
 * new Sentinel-2 observations, or increase in geophysical spatial resolution.
 *
 * Transparencies are a strict valid-data mask: interpolated pixels are NEVER
 * opaque if either adjacent original observation is missing. The source
 * samples remain identical at even/even output coordinates. In particular,
 * this must not turn an unobserved farm into a colored NDVI/NDMI value.
 */
export function superResolveSpectralTile2x(
 rgba:Uint8ClampedArray,size=256,
):Uint8ClampedArray{
 if(!Number.isInteger(size)||size<1||size>1024||
  rgba.length!==size*size*4)throw Error('Invalid spectral tile dimensions')
 const doubled=size*2
 const horizontal=new Uint8ClampedArray(doubled*size*4)
 const output=new Uint8ClampedArray(doubled*doubled*4)
 // Midpoint cubic: (-a+9b+9c-d)/16, clamped between b and c so
 // false-color ramps stay monotonic and cloud/no-data edges do not halo.
 const mid=(a:number,b:number,c:number,d:number)=>
  Math.max(Math.min(b,c),Math.min(Math.max(b,c),
   (-a+9*b+9*c-d)/16))
 for(let y=0;y<size;y++){
  const row=y*size*4
  const wideRow=y*doubled*4
  for(let x=0;x<size;x++){
   const p=row+x*4
   const q=wideRow+x*8
   horizontal.set(rgba.subarray(p,p+4),q)
   const next=x<size-1?p+4:p
   if(rgba[p+3]===0||rgba[next+3]===0)continue
   const left=x>0?p-4:p
   const right=x+2<size?p+8:next
   for(let c=0;c<4;c++){
    horizontal[q+4+c]=c===3?
      (rgba[p+3]+rgba[next+3])/2:
      mid(rgba[left+3]?rgba[left+c]:rgba[p+c],
          rgba[p+c],rgba[next+c],
          rgba[right+3]?rgba[right+c]:rgba[next+c])
   }
  }
 }
 for(let y=0;y<size;y++){
  const row=y*doubled*4
  const outRow=y*2*doubled*4
  output.set(horizontal.subarray(row,row+doubled*4),outRow)
  const next=y<size-1?row+doubled*4:row
  const prev=y>0?row-doubled*4:row
  const after=y+2<size?row+2*doubled*4:next
  for(let x=0;x<doubled;x++){
   const p=row+x*4
   const n=next+x*4
   const q=outRow+doubled*4+x*4
   if(horizontal[p+3]===0||horizontal[n+3]===0)continue
   for(let c=0;c<4;c++){
    output[q+c]=c===3?
      (horizontal[p+3]+horizontal[n+3])/2:
      mid(horizontal[prev+x*4+3]?horizontal[prev+x*4+c]:horizontal[p+c],
          horizontal[p+c],horizontal[n+c],
          horizontal[after+x*4+3]?horizontal[after+x*4+c]:horizontal[n+c])
   }
  }
 }
 return output
}

/** Display-only adaptive unsharp mask. Source index measurements stay unchanged.
 * Alpha and no-data pixels remain untouched. Never use for quantitative maps. */
export function enhanceSpectralVisualDetail(
 rgba:Uint8ClampedArray,size=256,strength=1.7,
):Uint8ClampedArray{
 if(!Number.isInteger(size)||size<1||size>1024||
  rgba.length!==size*size*4||!Number.isFinite(strength)||
  strength<0||strength>3)throw Error('Invalid enhancement input')
 const out=new Uint8ClampedArray(rgba)
 if(strength===0||size===1)return out
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const p=(y*size+x)*4
  if(rgba[p+3]===0)continue
  const sum=[0,0,0],minimum=[255,255,255],maximum=[0,0,0]
  let weight=0
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const xx=Math.max(0,Math.min(size-1,x+dx))
   const yy=Math.max(0,Math.min(size-1,y+dy))
   const q=(yy*size+xx)*4,alpha=rgba[q+3]/255
   if(!alpha)continue
   weight+=alpha
   for(let c=0;c<3;c++){
    sum[c]+=rgba[q+c]*alpha
    minimum[c]=Math.min(minimum[c],rgba[q+c])
    maximum[c]=Math.max(maximum[c],rgba[q+c])
   }
  }
  if(weight<=1)continue
  for(let c=0;c<3;c++){
   const original=rgba[p+c],range=maximum[c]-minimum[c]
   if(range<4)continue
   const delta=Math.max(-38,Math.min(38,
      (original-sum[c]/weight)*strength*Math.min(1,range/32)))
   // Bounded overshoot is deliberately visual, never a new index value.
   out[p+c]=Math.max(0,Math.min(255,
     Math.max(minimum[c]-12,Math.min(maximum[c]+12,original+delta))))
  }
 }
 return out
}
