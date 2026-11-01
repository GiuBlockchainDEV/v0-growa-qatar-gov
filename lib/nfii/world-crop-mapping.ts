/**
 * Public OpenStreetMap crop-tag discovery via Overpass.
 * A named mapped feature with an explicit crop/produce tag is NOT proof
 * of legal company identity, crop ownership, export eligibility or stock.
 * The API is best-effort, rate-limited, and may return zero for any country.
 * Do not infer crop matches from a generic place/business name.
 */
import {resolveCommodity} from '@/lib/platform/commodity-catalog'
import {isWorldCountryCode} from './world-countries'
import type {CropProducerEvidence} from './crop-producer-directory'

type JsonObject=Record<string,unknown>
const dict=(v:unknown):JsonObject=>
  v!==null&&typeof v==='object'&&!Array.isArray(v)?v as JsonObject:{}
const str=(v:unknown)=>typeof v==='string'?v.trim():''
const TERMS:Record<string,readonly string[]>={
 tomato:['tomato','tomatoes','tomate','tomates'],
 cucumber:['cucumber','cucumbers','gherkin','gherkins'],
 pepper:['bell pepper','bell peppers','sweet pepper','sweet peppers','capsicum'],
 lettuce:['lettuce','lettuces'],
 date:['date palm','date palms','dates','phoenix dactylifera'],
 barley:['barley'],
 milk:['milk','dairy milk'],
 rice:['rice','paddy rice'],
 wheat:['wheat'],
}
const regexFor=(words:readonly string[])=>
  words.map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')

export function overpassCropQuery(commodity:string,country:string):string{
  const crop=resolveCommodity(commodity)
  const iso=country.trim().toUpperCase()
  if(!crop||!isWorldCountryCode(iso))throw Error('Invalid world crop query')
  const pattern=regexFor(TERMS[crop.id]??[crop.id])
  return '[out:json][timeout:17][maxsize:12000000];'+
    'area["ISO3166-1"="'+iso+'"]["admin_level"="2"]->.country;'+
    '(nwr(area.country)["name"]["crop"~"'+pattern+'",i];'+
    'nwr(area.country)["name"]["produce"~"'+pattern+'",i];);'+
    'out tags center 60;'
}

function hasExactCropTag(v:string,commodity:string):boolean{
  if(!v)return false
  const terms=TERMS[commodity]??[commodity]
  return v.toLowerCase().split(/[;,/]/).some(item=>
    terms.some(term=>{
      const label=item.trim().toLowerCase()
      return label===term||label===term+'s'
    }))
}

export function parseMappedCropLeads(raw:unknown,commodity:string,country:string):
  CropProducerEvidence[]{
  const data=dict(raw),elements=data.elements
  if(!Array.isArray(elements))throw Error('OSM returned invalid response')
  const crop=resolveCommodity(commodity)
  if(!crop||!isWorldCountryCode(country))throw Error('Invalid mapped crop')
  const result:CropProducerEvidence[]=[]
  const keys=new Set<string>()
  for(const item of elements.slice(0,300)){
    const itemData=dict(item),tags=dict(itemData.tags)
    const name=str(tags.name)
    const osmType=str(itemData.type)
    const id=itemData.id
    if(!name||name.length>160||!['node','way','relation'].includes(osmType)||
      !Number.isSafeInteger(id)||Number(id)<=0)continue
    const explicit=[str(tags.crop),str(tags.produce)]
      .find(value=>hasExactCropTag(value,crop.id))
    if(!explicit)continue
    const key=(osmType+':'+id)
    if(keys.has(key))continue
    keys.add(key)
    const original='https://www.openstreetmap.org/'+osmType+'/'+id
    result.push({
      recordId:'OSM-'+osmType+'-'+id,
      organizationName:name,countryCode:country.toUpperCase(),countryName:'',
      certifier:'Not established by source',
      listedProducts:[explicit],matchedProduct:explicit,
      commodityId:crop.id,sourceName:'OpenStreetMap contributors – mapped crop/produce tag',
      sourceUrl:original,registryCheckedOn:new Date().toISOString().slice(0,10),
      evidenceType:'community_mapped_crop_tag',
      cropGrowerConfirmed:false,currentCertificateConfirmed:false,
      exportCapabilityConfirmed:false,capacityTonnes:null,supplierApproved:false,
      supplierRole:'farm_other',
      evidenceSummary:'Community-mapped agricultural location with an explicit crop/produce tag. '+
        'Not a confirmed company, grower identity, licence or commercial supplier.',
    })
    if(result.length>=50)break
  }
  return result
}

export async function fetchMappedCropLeads(commodity:string,country:string):
  Promise<CropProducerEvidence[]>{
  const query=overpassCropQuery(commodity,country)
  const response=await fetch('https://overpass-api.de/api/interpreter',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded',
      'User-Agent':'NFII-Growa-Procurement/1.0 (public crop discovery)'},
    body:new URLSearchParams({data:query}).toString(),
    signal:AbortSignal.timeout(9500),
    cache:'no-store',
  })
  if(!response.ok)throw Error('OpenStreetMap Overpass unavailable (HTTP '+response.status+')')
  const text=await response.text()
  if(text.length>950_000)throw Error('OpenStreetMap response too large')
  return parseMappedCropLeads(JSON.parse(text) as unknown,commodity,country)
}
