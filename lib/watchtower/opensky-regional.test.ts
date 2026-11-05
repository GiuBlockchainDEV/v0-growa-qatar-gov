import {describe,it,expect} from 'vitest'
import {parseOpenSky} from './opensky-regional'
const now=Date.UTC(2026,10,5,9)
const sample=(id:string,lat:number,lon:number,call:string,age=10)=>[
 id,call,'',Math.floor(now/1000)-age,Math.floor(now/1000),lon,lat,8000,false,220,130,0,null,8100,
]
describe('independent OpenSky position parsing',()=>{
 it('maps actual Saudi, Oman, Yemen positions without inventing aircraft',()=>{
  const assets=parseOpenSky({time:now/1000,states:[
   sample('abc123',24.9,46.7,'SVA201'),
   sample('def123',23.5,58.3,'OMA300'),
   sample('aaa111',15.5,44.2,'UPS201'),
  ]},now)
  expect(assets).toHaveLength(3)
  expect(assets.find(a=>a.label==='UPS201')?.cargo).toBe('operator_inferred')
  expect(assets.find(a=>a.label==='SVA201')?.cargo).toBe('unverified')
  expect(assets.every(a=>a.source==='OpenSky Network')).toBe(true)
 })
 it('rejects stale ground, out of area, and missing fixes',()=>{
  const data={time:now/1000,states:[
   sample('abc123',24.9,46.7,'FREIGHT',700),
   sample('eee555',40,12,'EUROPE'),
   [...sample('ddd111',15,45,'GROUND').slice(0,8),true,220,130,0,null,8100],
  ]}
  expect(parseOpenSky(data,now)).toHaveLength(0)
  expect(()=>parseOpenSky({time:now/1000-700,states:[]},now)).toThrow()
 })
})
