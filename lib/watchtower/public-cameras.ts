/** Public camera observations are NOT footage from the selected aircraft or vessel.
 * Windy Webcams v3 returns nearby fixed ground cameras and optional live-player
 * links. Never infer a live video stream from a timelapse player or an AIS fix.
 */
export type NearbyPublicCamera = {
 id:string
 title:string
 lat:number
 lon:number
 distanceKm:number
 playerUrl:string
 detailUrl:string
 imageUrl:string|null
 /** Provider advertises a live player; this does not guarantee availability now. */
 liveCapable:boolean
 lastUpdatedAt:string|null
}
export type PublicCameraResult={
 state:'available'|'no_matches'|'unconfigured'|'unavailable'
 source:'Windy Webcams'
 detail:string
 cameras:NearbyPublicCamera[]
 checkedAt:string
}
const obj=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
const text=(value:unknown,max=140)=>typeof value==='string'?value.trim().slice(0,max):''
const number=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null
export function validCameraCoordinates(lat:number,lon:number):boolean{
 return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180
}
export function publicCameraUrl(raw:unknown):string|null{
 if(typeof raw!=='string'||raw.length>1400)return null
 try{
  const u=new URL(raw)
  if(u.protocol!=='https:'||u.username||u.password||u.port)return null
  const host=u.hostname.toLowerCase()
  // Only official provider-controlled URLs; never iframe arbitrary API content.
  if(host!=='windy.com'&&host!=='www.windy.com'&&!host.endsWith('.windy.com'))return null
  return u.href
 }catch{return null}
}
export function cameraDistanceKm(lat:number,lon:number,targetLat:number,targetLon:number):number{
 const r=Math.PI/180,dLat=(targetLat-lat)*r,dLon=(targetLon-lon)*r
 const a=Math.sin(dLat/2)**2+Math.cos(lat*r)*Math.cos(targetLat*r)*Math.sin(dLon/2)**2
 return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)))
}
export function parseNearbyPublicCameras(raw:unknown,lat:number,lon:number,radiusKm=80):NearbyPublicCamera[]{
 if(!validCameraCoordinates(lat,lon))return []
 const data=obj(raw),rows=Array.isArray(raw)?raw:Array.isArray(data.webcams)?data.webcams:[]
 const mapped:NearbyPublicCamera[]=[]
 const seen=new Set<string>()
 for(const candidate of rows.slice(0,50)){
  const row=obj(candidate)
  if(row.status&&row.status!=='active')continue
  const location=obj(row.location),pLat=number(location.latitude),pLon=number(location.longitude)
  if(pLat===null||pLon===null||!validCameraCoordinates(pLat,pLon))continue
  const distanceKm=cameraDistanceKm(lat,lon,pLat,pLon)
  if(distanceKm>radiusKm)continue
  const id=String(row.webcamId??'')
  if(!/^\d{1,15}$/.test(id)||seen.has(id))continue
  const player=obj(row.player),urls=obj(row.urls),images=obj(row.images)
  const livePlayer=obj(player.live),dayPlayer=obj(player.day)
  const liveUrl=livePlayer.available===true?publicCameraUrl(livePlayer.embed):null
  const dayUrl=publicCameraUrl(dayPlayer.embed)
  const detailUrl=publicCameraUrl(urls.detail??urls.current)
  if(!detailUrl||(!liveUrl&&!dayUrl))continue
  const current=obj(images.current)
  const imageUrl=publicCameraUrl(current.preview)||publicCameraUrl(current.icon)
  const stamp=typeof row.lastUpdatedOn==='string'&&Number.isFinite(Date.parse(row.lastUpdatedOn))?new Date(row.lastUpdatedOn).toISOString():null
  seen.add(id)
  mapped.push({
   id,title:text(row.title,110)||'Public camera '+id,lat:pLat,lon:pLon,
   distanceKm:Math.round(distanceKm*10)/10,
   playerUrl:liveUrl??dayUrl!,detailUrl,imageUrl,
   liveCapable:Boolean(liveUrl),lastUpdatedAt:stamp,
  })
 }
 return mapped.sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,8)
}
