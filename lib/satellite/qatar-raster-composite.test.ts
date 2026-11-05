import {describe,it,expect} from 'vitest'
import {blendSpectralPixels,tileScenePixelBox,intersectsPixelTile,superResolveSpectralTile2x,enhanceSpectralVisualDetail} from './qatar-raster-composite'

function filled(size:number,r:number,g:number,b:number){
 const rgba=new Uint8ClampedArray(size*size*4)
 for(let i=0;i<rgba.length;i+=4){
  rgba[i]=r;rgba[i+1]=g;rgba[i+2]=b;rgba[i+3]=255
 }
 return rgba
}
const pixel=(rgba:Uint8ClampedArray,size:number,x:number,y:number)=>{
 const p=(y*size+x)*4
 return [...rgba.slice(p,p+4)]
}
describe('Single-layer Qatar STAC composite',()=>{
 it('does not invent spectral colors where no real scene covers a pixel',()=>{
  const size=20
  const output=blendSpectralPixels([{rgba:filled(size,255,0,0),
   box:{left:0,top:0,right:9,bottom:20}}],size,5)
  expect(pixel(output,size,18,10)[3]).toBe(0)
  expect(pixel(output,size,4,10)[0]).toBe(255)
 })
 it('feathers overlapping Sentinel-2 images rather than drawing hard scene rectangles',()=>{
  const size=200
  const output=blendSpectralPixels([
   {rgba:filled(size,230,10,10),box:{left:-20,top:-10,right:150,bottom:210}},
   {rgba:filled(size,10,190,10),box:{left:70,top:-10,right:220,bottom:210}},
  ],size,50)
  const early=pixel(output,size,85,100)
  const middle=pixel(output,size,110,100)
  const late=pixel(output,size,145,100)
  expect(early[0]).toBeGreaterThan(middle[0])
  expect(middle[0]).toBeGreaterThan(late[0])
  expect(late[1]).toBeGreaterThan(middle[1])
  expect(middle[1]).toBeGreaterThan(early[1])
  expect(middle[3]).toBe(255)
 })
 it('returns transparent on invalid input or empty data, without red fallback bands',()=>{
  const result=blendSpectralPixels([],16)
  expect([...result].every(v=>v===0)).toBe(true)
 })
 it('clips scene-footprint coordinates into a global tile system',()=>{
  const b=tileScenePixelBox([50,24,52,26],(lon,lat)=>({x:lon*10,y:-lat*10}))
  expect(b).toEqual({left:500,top:-260,right:520,bottom:-240})
  expect(intersectsPixelTile(b)).toBe(false)
  expect(intersectsPixelTile({left:-5,top:-5,right:20,bottom:20})).toBe(true)
 })
})


describe('2x visual edge-preserving spectral reconstruction',()=>{
 it('preserves original samples and a flat index color at twice the pixel count',()=>{
  const input=filled(4,20,110,70)
  const enhanced=superResolveSpectralTile2x(input,4)
  expect(enhanced).toHaveLength(8*8*4)
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   expect(pixel(enhanced,8,x,y)).toEqual([20,110,70,255])
  }
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){
   expect(pixel(enhanced,8,x*2,y*2)).toEqual(pixel(input,4,x,y))
  }
 })
 it('keeps all missing or transparent satellite pixels transparent',()=>{
  const input=filled(4,180,40,90)
  for(let y=0;y<4;y++)for(let x=2;x<4;x++)
   input[(y*4+x)*4+3]=0
  const enhanced=superResolveSpectralTile2x(input,4)
  for(let y=0;y<8;y++)for(let x=4;x<8;x++)
   expect(pixel(enhanced,8,x,y)[3]).toBe(0)
  expect(pixel(enhanced,8,3,3)[3]).toBe(0)
  expect(pixel(enhanced,8,2,2)[3]).toBe(255)
 })
 it('limits color overshoot across sharp NDVI/NDMI boundaries',()=>{
  const input=filled(4,15,30,220)
  for(let y=0;y<4;y++)for(let x=2;x<4;x++){
   const p=(y*4+x)*4
   input[p]=240;input[p+1]=80;input[p+2]=15
  }
  const enhanced=superResolveSpectralTile2x(input,4)
  for(let i=0;i<enhanced.length;i+=4){
   if(enhanced[i+3]===0)continue
   expect(enhanced[i]).toBeGreaterThanOrEqual(15)
   expect(enhanced[i]).toBeLessThanOrEqual(240)
   expect(enhanced[i+1]).toBeGreaterThanOrEqual(30)
   expect(enhanced[i+1]).toBeLessThanOrEqual(80)
   expect(enhanced[i+2]).toBeGreaterThanOrEqual(15)
   expect(enhanced[i+2]).toBeLessThanOrEqual(220)
  }
 })
 it('rejects invalid buffer sizes instead of painting fabricated imagery',()=>{
  expect(()=>superResolveSpectralTile2x(new Uint8ClampedArray(3),4)).toThrow('Invalid spectral tile')
  expect(()=>superResolveSpectralTile2x(new Uint8ClampedArray(0),0)).toThrow()
 })
})


describe('adaptive mask-aware spectral visual sharpening',()=>{
 it('changes color boundaries at native zoom rather than just resampling',()=>{
  const src=filled(7,20,20,30)
  for(let y=0;y<7;y++)for(let x=3;x<7;x++){
   const p=(y*7+x)*4
   src[p]=100;src[p+1]=200;src[p+2]=110
  }
  const result=enhanceSpectralVisualDetail(src,7)
  expect([...result].some((v,i)=>v!==src[i])).toBe(true)
  expect(pixel(result,7,2,3)[0]).toBeLessThan(pixel(src,7,2,3)[0])
  expect(pixel(result,7,3,3)[0]).toBeGreaterThan(pixel(src,7,3,3)[0])
 })
 it('does not fill no-data and leaves uniform valid colors alone',()=>{
  const src=filled(7,100,100,100)
  for(let y=0;y<7;y++)for(let x=5;x<7;x++)src[(y*7+x)*4+3]=0
  expect([...enhanceSpectralVisualDetail(src,7)]).toEqual([...src])
 })
 it('is a no-op when disabled and validates dimensions',()=>{
  const src=filled(4,10,80,120)
  expect([...enhanceSpectralVisualDetail(src,4,0)]).toEqual([...src])
  expect(()=>enhanceSpectralVisualDetail(new Uint8ClampedArray(3),4)).toThrow()
 })
})
