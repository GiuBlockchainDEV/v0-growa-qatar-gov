import {describe,it,expect} from 'vitest'
import {normalizeQatarWells,normalizeUserMappedWells,wellsSummary} from './qatar-wells'

const osm=(id:number,lat:number,lon:number,tags:Record<string,unknown>)=>
 ({type:'node',id,lat,lon,tags})
describe('Qatar well register',()=>{
 it('includes only explicitly documented water wells inside Qatar',()=>{
  const wells=normalizeQatarWells({elements:[
   osm(1,25.2854,51.5310,{man_made:'water_well',name:'Doha Well',ref:'W-101',depth:'120 m'}),
   osm(2,25.2854,51.5310,{man_made:'petroleum_well',name:'Oil well'}),
   osm(3,25.2854,51.5310,{man_made:'borehole',borehole:'water',name:'Groundwater borehole'}),
   osm(4,25,50.0,{man_made:'water_well',name:'Outside Qatar'}),
  ]})
  expect(wells).toHaveLength(2)
  expect(wells.find(x=>x.reference==='W-101')).toMatchObject({
   lat:25.2854,lng:51.5310,depthM:120,origin:'openstreetmap',
   liveTelemetry:false,lastSensorUpdate:null,
  })
  expect(wells.find(x=>x.name==='Groundwater borehole')?.kind).toBe('water_borehole')
  expect(wells.every(x=>x.osmUrl?.startsWith('https://www.openstreetmap.org/'))).toBe(true)
 })
 it('does not guess connected wells from a farm or nearby generic sensor',()=>{
  const wells=normalizeUserMappedWells([
   {id:'a',label:'Well North',lat:25.2854,lng:51.531},
   {id:'b',label:'Farm Qatar',lat:25.2854,lng:51.531},
   {id:'c',label:'Soil moisture sensor',lat:25.2854,lng:51.531},
   {id:'d',label:'Well outside',lat:25.0,lng:50.0},
  ])
  expect(wells).toHaveLength(1)
  expect(wells[0].id).toBe('growa:a')
  expect(wells[0].liveTelemetry).toBe(false)
  expect(wellsSummary(wells).connected).toBe(0)
 })
 it('rejects missing source coordinates and invented telemetry',()=>{
  expect(normalizeQatarWells({elements:[
   {type:'node',id:10,tags:{man_made:'water_well'}},
  ]})).toEqual([])
  expect(()=>normalizeQatarWells({fake:[]})).toThrow()
 })
 it('accepts a mapped well area center but no unrelated boreholes',()=>{
  const wells=normalizeQatarWells({elements:[
   {type:'way',id:100,center:{lat:25.2854,lon:51.531},
    tags:{man_made:'water_well',pump:'yes'}},
   {type:'node',id:101,lat:25.2854,lon:51.531,
    tags:{man_made:'borehole',borehole:'survey'}},
  ]})
  expect(wells).toHaveLength(1)
  expect(wells[0].pump).toBe('yes')
 })
})
