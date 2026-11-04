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
  palette:'rdylgn',rescale:'-0.05,0.65',
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
  sortby:[{field:'datetime',direction:'desc'}],
  metadata:{type:'mosaic'},
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
   /^\/api\/data\/v1\/(?:mosaic\/tiles\/[a-z0-9-]+|mosaic\/[a-z0-9-]+\/tiles|mosaic\/collections\/[a-z0-9-]+\/tiles|mosaic\/searches\/[a-z0-9-]+\/tiles|item\/tiles)\/(?:WebMercatorQuad\/)?\{z\}\/\{x\}\/\{y\}(?:@\d+x)?(?:\.(?:png|jpg|jpeg|webp))?$/i.test(decodeURIComponent(parsed.pathname))
 }catch{return false}
}

/** Public STAC item tiles are a fallback when PgSTAC mosaic registration is
 * temporarily degraded (not a synthetic national raster).
 */
export const STAC_API='https://planetarycomputer.microsoft.com/api/stac/v1'
export type SpectralTile={
 url:string
 bbox:[number,number,number,number]
 sceneDate:string
}
export type SentinelScene={
 id:string
 tile:string
 bbox:[number,number,number,number]
 sceneDate:string
 cloudCover:number
}
export type StacSceneFeature={
 id?:unknown
 bbox?:unknown
 properties?:Record<string,unknown>
 assets?:Record<string,unknown>
}
export function selectQatarSentinelScenes(
 features:readonly StacSceneFeature[],index:SpectralIndex,max=12,
):SentinelScene[]{
 const required=SPECTRAL_INDEX_CONFIG[index].bands
 const available:SentinelScene[]=[]
 for(const feature of features){
  if(typeof feature.id!=='string'||!feature.id||
   !Array.isArray(feature.bbox)||feature.bbox.length!==4||
   !feature.bbox.every(v=>typeof v==='number'&&Number.isFinite(v))||
   !feature.properties)continue
  if(!required.every(b=>feature.assets&&b in feature.assets))continue
  const bbox=feature.bbox as [number,number,number,number]
  if(bbox[0]>=bbox[2]||bbox[1]>=bbox[3]||
   bbox[0]>=QATAR_SPECTRAL_BBOX[2]||bbox[2]<=QATAR_SPECTRAL_BBOX[0]||
   bbox[1]>=QATAR_SPECTRAL_BBOX[3]||bbox[3]<=QATAR_SPECTRAL_BBOX[1])continue
  const acquisition=feature.properties.datetime
  const cloud=feature.properties['eo:cloud_cover']
  if(typeof acquisition!=='string'||!Number.isFinite(Date.parse(acquisition))||
   typeof cloud!=='number'||!Number.isFinite(cloud)||cloud>=35)continue
  const tile=feature.properties['s2:mgrs_tile']
  available.push({id:feature.id,tile:typeof tile==='string'?tile:feature.id,
   bbox,sceneDate:acquisition.slice(0,10),cloudCover:cloud})
 }
 available.sort((a,b)=>b.sceneDate.localeCompare(a.sceneDate)||a.cloudCover-b.cloudCover)
 const seen=new Set<string>()
 const selected:SentinelScene[]=[]
 for(const scene of available){
  if(seen.has(scene.tile))continue
  seen.add(scene.tile)
  selected.push(scene)
  if(selected.length>=Math.max(1,Math.min(max,20)))break
 }
 return selected.sort((a,b)=>a.sceneDate.localeCompare(b.sceneDate))
}
