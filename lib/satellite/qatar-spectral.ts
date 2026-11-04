/**
 * Qatar-wide Sentinel-2 L2A spectral rendering through the public
 * Microsoft Planetary Computer PgSTAC mosaic + TiTiler API.
 */
export const QATAR_SPECTRAL_BBOX=[50.69,24.42,51.73,26.26] as const
export type SpectralIndex='ndvi'|'ndmi'
export const SPECTRAL_WINDOW_DAYS=120
export const MOSAIC_API='https://planetarycomputer.microsoft.com/api/data/v1'
export const SPECTRAL_INDEX_CONFIG={
 ndvi:{
  label:'NDVI',bands:['B08','B04'] as const,
  expression:'(B08-B04)/(B08+B04)',
  description:'Vegetation greenness · near infrared vs red',
  palette:'rdylgn',rescale:'-0.2,0.9',
 },
 ndmi:{
  label:'NDMI',bands:['B08','B11'] as const,
  expression:'(B08-B11)/(B08+B11)',
  description:'Vegetation canopy moisture proxy · near infrared vs SWIR',
  palette:'rdbu',rescale:'-0.6,0.6',
 },
} as const
export function qatarMosaicSearch(date:Date){
 const through=date.toISOString().slice(0,10)
 const from=new Date(date.getTime()-SPECTRAL_WINDOW_DAYS*86400000).toISOString().slice(0,10)
 return {
  collections:['sentinel-2-l2a'],
  bbox:[...QATAR_SPECTRAL_BBOX],
  datetime:from+'T00:00:00Z/'+through+'T23:59:59Z',
  query:{'eo:cloud_cover':{lt:35}},
  sortby:[{field:'eo:cloud_cover',direction:'asc'}],
  metadata:{type:'mosaic',pixel_selection:'first'},
  limit:200,
 }
}
export function spectralTileParams(index:SpectralIndex):URLSearchParams{
 const config=SPECTRAL_INDEX_CONFIG[index]
 const params=new URLSearchParams()
 for(const band of config.bands)params.append('assets',band)
 params.set('expression',config.expression)
 params.set('asset_as_band','true')
 params.set('rescale',config.rescale)
 params.set('colormap_name',config.palette)
 params.set('tile_format','png')
 params.set('collection','sentinel-2-l2a')
 return params
}
export function isMicrosoftTileUrl(url:string):boolean{
 try{
  const parsed=new URL(url)
  return parsed.protocol==='https:'&&parsed.hostname==='planetarycomputer.microsoft.com'&&
   /^\/api\/data\/v1\/mosaic\/[^/]+\/tiles\//.test(parsed.pathname)&&
   parsed.pathname.includes('{z}')&&parsed.pathname.includes('{x}')&&
   parsed.pathname.includes('{y}')
 }catch{return false}
}
