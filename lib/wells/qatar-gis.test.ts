import {describe,it,expect} from 'vitest'
import {parseQatarGisWells,mergePublicWells,QATAR_GIS_DATASETS} from './qatar-gis'
import type {QatarWell} from './qatar-wells'

describe('Qatar public GIS well dataset normalization',()=>{
 it('accepts only real Point GeoJSON features inside the Qatar boundary',()=>{
  const wells=parseQatarGisWells({type:'FeatureCollection',features:[
   {type:'Feature',id:11,geometry:{type:'Point',coordinates:[51.531,25.2854]},
    properties:{OBJECTID:11,well_name:'Doha Water Well',well_depth:120}},
   {type:'Feature',id:12,geometry:{type:'Point',coordinates:[50,25]},
    properties:{well_name:'Outside Qatar'}},
   {type:'Feature',id:13,geometry:{type:'Polygon',coordinates:[]},
    properties:{well_name:'Area not point'}},
  ]},QATAR_GIS_DATASETS[0])
  expect(wells).toHaveLength(1)
  expect(wells[0]).toMatchObject({
   origin:'un-gis',lat:25.2854,lng:51.531,depthM:120,
   liveTelemetry:false,lastSensorUpdate:null,
  })
  expect(wells[0].sourceUrl).toContain('FeatureServer/0')
 })
 it('rejects error payloads and missing point geometries',()=>{
  expect(()=>parseQatarGisWells({error:{code:404}},QATAR_GIS_DATASETS[0])).toThrow()
  expect(parseQatarGisWells({type:'FeatureCollection',features:[]},
   QATAR_GIS_DATASETS[1])).toEqual([])
 })
 it('deduplicates exact public well coordinates without merging distinct nearby wells',()=>{
  const one:QatarWell={
   id:'osm:node:123',name:'Well 1',lat:25.2854,lng:51.531,
   origin:'openstreetmap',kind:'water_well',osmUrl:'https://www.openstreetmap.org/node/123',
   operator:null,reference:null,drinkingWater:null,pump:null,depthM:null,
   liveTelemetry:false,lastSensorUpdate:null,
  }
  expect(mergePublicWells([[one],[{...one,id:'gis:a:1',origin:'un-gis'}]])).toHaveLength(1)
  expect(mergePublicWells([[one],[{...one,id:'gis:a:2',origin:'un-gis',lng:51.5312}]])).toHaveLength(2)
 })
})
