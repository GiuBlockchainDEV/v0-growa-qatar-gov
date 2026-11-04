import {describe,it,expect} from 'vitest'
import {QATAR_BOUNDARY,isPointInQatar,clipTileToQatar} from './qatar-clip'

describe('Qatar national clip mask',()=>{
 it('contains multiple national polygon features and islands',()=>{
  expect(QATAR_BOUNDARY.type).toBe('MultiPolygon')
  expect(QATAR_BOUNDARY.coordinates.length).toBeGreaterThan(1)
  expect(QATAR_BOUNDARY.coordinates.every(p=>p.every(r=>r.length>=4))).toBe(true)
 })
 it('excludes the Gulf, Saudi Arabia and adjacent Bahrain',()=>{
  expect(isPointInQatar(51.53,25.29)).toBe(true)
  expect(isPointInQatar(51.0,25.0)).toBe(true)
  expect(isPointInQatar(50.0,25.0)).toBe(false)
  expect(isPointInQatar(51.9,25.3)).toBe(false)
  expect(isPointInQatar(50.7,26.2)).toBe(false)
 })
 it('uses evenodd canvas clipping to keep outside imagery transparent',()=>{
  const calls:string[]=[]
  const context={
   beginPath:()=>calls.push('begin'),
   moveTo:(_x:number,_y:number)=>calls.push('move'),
   lineTo:(_x:number,_y:number)=>calls.push('line'),
   closePath:()=>calls.push('close'),
   clip:(rule?:CanvasFillRule)=>calls.push('clip:'+rule),
  }
  clipTileToQatar(context, (x,y)=>({x:x*10,y:y*10}))
  expect(calls[0]).toBe('begin')
  expect(calls.at(-1)).toBe('clip:evenodd')
  expect(calls.filter(x=>x==='move').length).toBeGreaterThan(1)
 })
})
