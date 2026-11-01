/**
 * WIDER free agricultural discovery for crops whose named company directory
 * is sparse. OSM's "place=farm" and farmyard/greenhouse tags describe mapped
 * agricultural locations, NOT the selected crop, a registered supplier, a
 * quotation or export capability.
 *
 * One combined Overpass request returns first crop-tagged locations and then
 * a bounded set of *named* farms. It deliberately excludes input shops,
 * ordinary greengrocers, unnamed fields and generic commercial businesses.
 * Data and API availability vary dramatically by territory.
 */
import {resolveCommodity} from '@/lib/platform/commodity-catalog'
import {isWorldCountryCode,countryName} from './world-countries'
import {overpassCropQuery,parseMappedCropLeads} from './world-crop-mapping'
import type {CropProducerEvidence} from './crop-producer-directory'

type Dict=Record<string,unknown>
const object=(v:unknown):Dict=>
  v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Dict:{}
const string=(v:unknown)=>typeof v==='string'?v.trim():''
const CHECKED_ON=()=>new Date().toISOString().slice(0,10)

export function expandedFarmQuery(commodity:string,country:string):string{
  const crop=resolveCommodity(commodity)
  const iso=country.trim().toUpperCase()
  if(!crop||!isWorldCountryCode(iso))throw Error('Invalid crop or country')
  const exact=overpassCropQuery(crop.id,iso)
  // The preceding query ends with out tags center 60; it leaves the selected
  // named administrative area (.country) available for this second query.
  const types=[
    'nwr(area.country)["name"]["place"="farm"];',
    'nwr(area.country)["name"]["landuse"="farmyard"];',
    'nwr(area.country)["name"]["landuse"="greenhouse_horticulture"];',
    'nwr(area.country)["name"]["shop"="farm"];',
  ]
  if(crop.id==='rice')
    types.push('nwr(area.country)["name"]["landuse"="paddy"];')
  if(crop.id==='date')
    types.push('nwr(area.country)["name"]["landuse"="orchard"];')
  if(crop.id==='milk')
    types.push('nwr(area.country)["name"]["shop"="dairy"];')
  return exact+'('+types.join('')+');out tags center 75;'
}

const cropText=(commodity:string)=>({
  tomato:'tomatoes',cucumber:'cucumbers',pepper:'peppers',
  lettuce:'lettuce',date:'dates',barley:'barley',milk:'milk',
  rice:'rice',wheat:'wheat',
}[commodity]??commodity)

function farmType(tags:Dict,commodity:string):string|null{
  const place=string(tags.place)
  const landuse=string(tags.landuse)
  const shop=string(tags.shop)
  if(place==='farm')return 'Individually named farm'
  if(landuse==='farmyard')return 'Farmstead / farm buildings'
  if(landuse==='greenhouse_horticulture')return 'Greenhouse horticulture site'
  if(shop==='farm')return 'Farm produce shop'
  if(commodity==='date'&&landuse==='orchard')return 'Orchard (crop unverified)'
  if(commodity==='rice'&&landuse==='paddy')return 'Rice paddy land (business unverified)'
  if(commodity==='milk'&&shop==='dairy')return 'Dairy shop (not a dairy farm)'
  return null
}

export type ExpandedFarmResult={
  cropTagged:CropProducerEvidence[]
  agriculturalCandidates:CropProducerEvidence[]
}
export function parseExpandedFarmResults(raw:unknown,commodity:string,country:string):
  ExpandedFarmResult{
  const crop=resolveCommodity(commodity),iso=country.toUpperCase()
  if(!crop||!isWorldCountryCode(iso))throw Error('Invalid crop or country')
  const payload=object(raw)
  const remark=string(payload.remark)
  if(/runtime error|timed out|out of memory/i.test(remark))
    throw Error('Overpass returned partial or timed-out coverage')
  if(!Array.isArray(payload.elements))throw Error('Invalid OSM agricultural response')
  const cropTagged=parseMappedCropLeads(raw,crop.id,iso)
  const existing=new Set(cropTagged.map(row=>row.sourceUrl))
  const agriculturalCandidates:CropProducerEvidence[]=[]
  const seen=new Set<string>()
  for(const element of payload.elements.slice(0,650)){
    const row=object(element),tags=object(row.tags)
    const name=string(tags.name)
    const id=row.id
    const type=string(row.type)
    if(!name||name.length>160||/[\x00-\x1f<>]/.test(name)||
      !Number.isSafeInteger(id)||Number(id)<=0||
      !['node','way','relation'].includes(type))continue
    const tag=farmType(tags,crop.id)
    if(!tag)continue
    const sourceUrl='https://www.openstreetmap.org/'+type+'/'+id
    if(existing.has(sourceUrl)||seen.has(sourceUrl))continue
    seen.add(sourceUrl)
    const shop=string(tags.shop)
    agriculturalCandidates.push({
      recordId:'OSM-AGRI-'+type+'-'+id,
      organizationName:name,countryCode:iso,countryName:countryName(iso),
      certifier:'Unverified mapped location',
      listedProducts:[],
      matchedProduct:'Crop NOT verified ('+cropText(crop.id)+')',
      commodityId:crop.id,
      sourceName:'OpenStreetMap contributors – agricultural location',
      sourceUrl,registryCheckedOn:CHECKED_ON(),
      evidenceType:'mapped_agricultural_business',
      supplierRole:shop==='farm'||shop==='dairy'?'trader':'farm_other',
      evidenceSummary:tag+'. This is a community-mapped location, not evidence '+
        'that the entity produces '+cropText(crop.id)+', is legally registered, '+
        'trades in bulk or has Qatar export authorization.',
      cropGrowerConfirmed:false,currentCertificateConfirmed:false,
      exportCapabilityConfirmed:false,capacityTonnes:null,supplierApproved:false,
    })
    if(agriculturalCandidates.length>=45)break
  }
  return {cropTagged,agriculturalCandidates}
}

const LIMIT=120
const cache=new Map<string,{until:number;promise:Promise<ExpandedFarmResult>}>()
export async function fetchExpandedFarmResults(commodity:string,country:string):
  Promise<ExpandedFarmResult>{
  const key=commodity.toLowerCase()+':'+country.toUpperCase()
  const now=Date.now(),last=cache.get(key)
  if(last&&last.until>now)return last.promise
  const query=expandedFarmQuery(commodity,country)
  const work=(async()=>{
    const response=await fetch('https://overpass-api.de/api/interpreter',{
      method:'POST',
      headers:{
        'Content-Type':'application/x-www-form-urlencoded',
        'User-Agent':'Growa-NFII/1.0 agricultural-source-discovery',
      },
      body:new URLSearchParams({data:query}).toString(),
      cache:'no-store',signal:AbortSignal.timeout(12500),
    })
    if(!response.ok)throw Error('OpenStreetMap Overpass HTTP '+response.status)
    const text=await response.text()
    if(text.length>1_100_000)throw Error('Mapped response too large')
    return parseExpandedFarmResults(JSON.parse(text) as unknown,commodity,country)
  })()
  cache.set(key,{until:now+2*60*60*1000,promise:work})
  if(cache.size>LIMIT)cache.delete(cache.keys().next().value!)
  void work.catch(()=>{
    // Public Overpass can return 429/504. Cool down failed requests rather
    // than hammering a shared community resource on each page refresh.
    const entry=cache.get(key)
    if(entry?.promise===work)entry.until=Date.now()+5*60*1000
  })
  return work
}
