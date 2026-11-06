import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {
 QATAR_SPECTRAL_BBOX,qatarMosaicSearch,spectralTileParams,
 isMicrosoftTileUrl,SPECTRAL_INDEX_CONFIG,selectQatarSentinelScenes,
 SPECTRAL_OVERVIEW_ZOOM,SPECTRAL_DETAIL_ZOOM,SPECTRAL_DETAIL_START_ZOOM,
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
  expect(SPECTRAL_INDEX_CONFIG.ndsi.expression).toBe('(B04-B08)/(B04+B08)')
  expect(spectralTileParams('ndsi').getAll('assets')).toEqual(['B04','B08'])
  expect(spectralTileParams('ndsi').get('colormap_name')).toBe('purples')
  expect(spectralTileParams('ndsi').get('rescale')).toBe('-0.1,0.7')
  // Visual legend must stay aligned with the actual TiTiler purple ramp,
  // not merely recolor the UI while leaving the imagery red/green.
  expect(SPECTRAL_INDEX_CONFIG.ndsi.palette).not.toBe(SPECTRAL_INDEX_CONFIG.ndvi.palette)
  expect(SPECTRAL_INDEX_CONFIG.ndsi.palette).not.toBe(SPECTRAL_INDEX_CONFIG.ndmi.palette)
  expect(read('components/dashboard/qatar-spectral-layers.tsx')).toContain(
   "const NDSI_COLORS=['#fcfbfd','#dadaeb','#9e9ac8','#756bb1','#54278f']")

  expect(spectralTileParams('ndvi').get('asset_as_band')).toBe('true')
  expect(spectralTileParams('ndvi').get('rescale')).toBe('-0.2,0.9')
  expect(spectralTileParams('ndmi').get('rescale')).toBe('-0.35,0.35')
 })
 it('accepts only the trusted Planetary Computer mosaic image template',()=>{
  const base='https://planetarycomputer.microsoft.com/api/data/v1/mosaic/abc123/tiles/WebMercatorQuad/{z}/{x}/{y}.png'
  expect(isMicrosoftTileUrl(base)).toBe(true)
  expect(isMicrosoftTileUrl('https://planetarycomputer.microsoft.com/api/data/v1/mosaic/collections/sentinel-2-l2a/tiles/WebMercatorQuad/{z}/{x}/{y}@1x')).toBe(true)

  expect(isMicrosoftTileUrl('https://planetarycomputer.microsoft.com/api/data/v1/mosaic/tiles/abcdef1234567890abcdef1234567890/WebMercatorQuad/{z}/{x}/{y}@1x?assets=B08')).toBe(true)
  expect(isMicrosoftTileUrl('https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?collection=sentinel-2-l2a')).toBe(true)
  expect(isMicrosoftTileUrl(base.replace('planetarycomputer.microsoft.com','other.example'))).toBe(false)
  expect(isMicrosoftTileUrl('javascript:alert(1)')).toBe(false)
  expect(isMicrosoftTileUrl('https://planetarycomputer.microsoft.com/api/data/v1/mosaic/info')).toBe(false)
 })

 it('selects recent cloud-screened Sentinel-2 scenes by MGRS region',()=>{
  const scene=(id:string,tile:string,date:string,cloud:number)=>({
   id,bbox:[50.8,25.1,51.4,25.7],assets:{B08:{},B04:{},B11:{}},
   properties:{datetime:date,'eo:cloud_cover':cloud,'s2:mgrs_tile':tile},
  })
  const selected=selectQatarSentinelScenes([
   scene('old','T39RXJ','2026-09-01T00:00:00Z',10),
   scene('latest','T39RXJ','2026-10-12T00:00:00Z',8),
   scene('cloudy','T39RXK','2026-10-13T00:00:00Z',75),
   scene('another','T39RXK','2026-10-10T00:00:00Z',12),
  ],'ndmi',12)
  expect(selected.map(x=>x.id)).toEqual(['old','another','latest'])
  expect(selected.filter(x=>x.tile==='T39RXJ')).toHaveLength(2)
 })
 it('prioritizes national coverage before including backup scenes for a tile',()=>{
  const make=(id:string,tile:string,date:string)=>({
    id,bbox:[50.8,24.5,51.4,25.8],assets:{B08:{},B04:{},B11:{}},
    properties:{datetime:date,'eo:cloud_cover':5,'s2:mgrs_tile':tile},
  })
  const items=[
    make('A3','A','2026-11-03T12:00:00Z'),
    make('A2','A','2026-11-02T12:00:00Z'),
    make('A1','A','2026-11-01T12:00:00Z'),
    make('A0','A','2026-10-31T12:00:00Z'),
    make('B2','B','2026-11-01T12:00:00Z'),
    make('B1','B','2026-10-31T12:00:00Z'),
  ]
  const two=selectQatarSentinelScenes(items,'ndvi',2)
  expect(two.map(x=>x.id)).toContain('A3')
  expect(two.map(x=>x.id)).toContain('B2')
  const full=selectQatarSentinelScenes(items,'ndvi',18)
  expect(full.filter(x=>x.tile==='A')).toHaveLength(3)
  expect(full.filter(x=>x.tile==='B')).toHaveLength(2)
  expect(full.map(x=>x.id)).not.toContain('A0')
 })
 it('only shows the controls on the Live Map and preserves all other map contexts',()=>{
  const page=read('app/dashboard/page.tsx')
  const map=read('components/dashboard/satellite-map.tsx')
  const widget=read('components/dashboard/qatar-spectral-layers.tsx')
  expect(page).toContain("spectralEnabled={moduleKey === 'live-map'}")
  expect(map).toContain('spectralEnabled&&<QatarSpectralLayers map={mapForReadout}/>')
  expect(widget).toContain("([null,'ndvi','ndmi','ndsi'] as const)")
  expect(widget).toContain("index==='ndmi'?NDMI_COLORS:NDSI_COLORS")
  expect(widget).toContain('Sand and bare soil are not classified as saline')
  expect(widget).toContain("setOpacity(choice==='ndsi'?.35:.7)")
  expect(widget).toContain('setIndex(choice===index?null:choice)')
  expect(widget).toContain('overlay.current?.remove()')
  expect(widget).toContain('clipTileToQatar(context')
  expect(widget).toContain('L.GridLayer.extend(')
  expect(widget).toContain('blendSpectralPixels(')
  expect(widget).toContain('context.drawImage(sourceCanvas,0,0,TILE_SIZE,TILE_SIZE)')
  expect(widget).toContain("payload.mode==='stac-composite'")
  expect(widget).not.toContain('for(const item of tiles)')
  expect(widget).toContain("('/api/satellite/qatar-spectral?index='+index")
  expect(widget).toContain('pane.style.opacity=String(opacity)')
  expect(widget).toContain('maxNativeZoom:SPECTRAL_OVERVIEW_ZOOM')
  expect(widget).toContain('minNativeZoom:SPECTRAL_OVERVIEW_ZOOM')
  expect(widget).toContain('maxNativeZoom:SPECTRAL_DETAIL_ZOOM')
  expect(widget).toContain('minZoom:SPECTRAL_DETAIL_START_ZOOM')
  expect(widget).toContain('detailOverlay.current?.remove()')
  expect(widget).toContain('const Raster=L.GridLayer.extend({')
  expect(widget).toContain('for(const raster of [layer,detailLayer])')
  expect(widget).toContain('detailOverlay.current?.remove()')
  expect(widget).not.toContain('SFIM + HPA')
  expect(widget).not.toContain('sfimHpaSpectralVisualFusion')
  expect(widget).not.toContain('nirGuideTileUrl')
  expect(widget).not.toContain('FusedRaster')
  expect(widget).not.toContain('sfimOverviewOverlay')
  expect(widget).toContain('cachedRaster(url)')
  expect(widget).toContain('rememberRaster(url,pixels)')
  expect(widget).toContain('keepBuffer:8')
  expect(SPECTRAL_OVERVIEW_ZOOM).toBe(10)
  expect(SPECTRAL_DETAIL_ZOOM).toBe(13)
  expect(SPECTRAL_DETAIL_START_ZOOM).toBe(13)
 })
 it('does not pretend to have observations on service failure',()=>{
  const api=read('app/api/satellite/qatar-spectral/route.ts')
  expect(api).toContain('if(!url||!isMicrosoftTileUrl(url))')
  expect(api).toContain('503')
  expect(api).toContain('mosaic/register')
  expect(api).toContain('mosaic/'+ "'+registered.searchid+" + "'/tilejson.json'")
  expect(api).not.toContain("MOSAIC_API+'/mosaic/collections/sentinel-2-l2a/tilejson.json'")
  expect(api).toContain("STAC_API+'/search'")
  expect(api).toContain('stacComposite(')
  expect(api).toContain("mode:'mosaic'|'stac-composite'")
  expect(api).toContain('Promise.allSettled')
  expect(api).toContain('detail,retryable:true')
 })
})
