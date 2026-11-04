import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {
 QATAR_SPECTRAL_BBOX,qatarMosaicSearch,spectralTileParams,
 isMicrosoftTileUrl,SPECTRAL_INDEX_CONFIG,
} from './qatar-spectral'
const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8')
describe('Qatar nationwide Microsoft Planetary Computer spectral imagery',()=>{
 it('uses a Qatar-wide bounding box with a finite recent Sentinel-2 range',()=>{
  const bbox=QATAR_SPECTRAL_BBOX
  expect(bbox).toEqual([50.69,24.42,51.73,26.26])
  const search=qatarMosaicSearch(new Date('2026-11-04T00:00:00Z'))
  expect(search.collections).toEqual(['sentinel-2-l2a'])
  expect(search.datetime).toContain('2026-11-04')
  expect(search.datetime).toContain('2026-07-07')
  expect(search.query['eo:cloud_cover'].lt).toBe(35)
 })
 it('computes NDVI from NIR and red and NDMI from NIR and SWIR',()=>{
  expect(SPECTRAL_INDEX_CONFIG.ndvi.expression).toBe('(B08-B04)/(B08+B04)')
  expect(SPECTRAL_INDEX_CONFIG.ndmi.expression).toBe('(B08-B11)/(B08+B11)')
  expect(spectralTileParams('ndvi').getAll('assets')).toEqual(['B08','B04'])
  expect(spectralTileParams('ndmi').getAll('assets')).toEqual(['B08','B11'])
  expect(spectralTileParams('ndvi').get('asset_as_band')).toBe('true')
 })
 it('accepts only the trusted Planetary Computer mosaic image template',()=>{
  const base='https://planetarycomputer.microsoft.com/api/data/v1/mosaic/abc123/tiles/WebMercatorQuad/{z}/{x}/{y}.png'
  expect(isMicrosoftTileUrl(base)).toBe(true)
  expect(isMicrosoftTileUrl(base.replace('planetarycomputer.microsoft.com','other.example'))).toBe(false)
  expect(isMicrosoftTileUrl('javascript:alert(1)')).toBe(false)
  expect(isMicrosoftTileUrl('https://planetarycomputer.microsoft.com/api/data/v1/mosaic/info')).toBe(false)
 })
 it('only shows the controls on the Live Map and preserves all other map contexts',()=>{
  const page=read('app/dashboard/page.tsx')
  const map=read('components/dashboard/satellite-map.tsx')
  const widget=read('components/dashboard/qatar-spectral-layers.tsx')
  expect(page).toContain("spectralEnabled={moduleKey === 'live-map'}")
  expect(map).toContain('spectralEnabled&&<QatarSpectralLayers map={mapForReadout}/>')
  expect(widget).toContain("([null,'ndvi','ndmi'] as const)")
  expect(widget).toContain('setIndex(choice===index?null:choice)')
  expect(widget).toContain('overlay.current?.remove()')
  expect(widget).toContain("('/api/satellite/qatar-spectral?index='+index")
  expect(widget).toContain('setOpacity(opacity)')
 })
 it('does not pretend to have observations on service failure',()=>{
  const api=read('app/api/satellite/qatar-spectral/route.ts')
  expect(api).toContain('if(!tileUrl||!isMicrosoftTileUrl(tileUrl))')
  expect(api).toContain('503')
  expect(api).toContain('mosaic/register')
  expect(api).toContain('mosaic/'+ "'+registered.searchid+" + "'/tilejson.json'")
 })
})
