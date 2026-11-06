import {describe,it,expect} from 'vitest'
import {blendSpectralPixels,tileScenePixelBox,intersectsPixelTile} from './qatar-raster-composite'

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




