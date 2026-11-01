import {resolveCommodity} from '@/lib/platform/commodity-catalog'

export type ProcurementProvider='gleif'|'places'|'comtrade'
export type SupplierCandidate={
  source:'GLEIF'|'Google Places'
  sourceId:string
  name:string
  countryCode:string|null
  address:string|null
  legalEntityStatus:string|null
  registrationStatus:string|null
  lei:string|null
  website:string|null
  phone:string|null
  sourceUrl:string
  businessStatus:string|null
  /** NONE of these provider matches certifies commodity supply or approves a supplier. */
  supplierQualification:'not_assessed'
}
export type TradePartner={
  partnerCode:number
  countryCode:string|null
  countryName:string
  tradeValueUsd:number|null
  netWeightTonnes:number|null
}
export type TradeResearch={
  commodityId:string
  hsCode:string
  hsLabel:string
  year:number
  reporter:'Qatar'
  partners:TradePartner[]
  worldTradeValueUsd:number|null
  resultCount:number
  limitedPreview:boolean
  sourceUrl:string
  note:string
}
type Dict=Record<string,unknown>
const obj=(v:unknown):Dict=>v!==null && typeof v==='object' && !Array.isArray(v)?v as Dict:{}
const string=(v:unknown):string=>typeof v==='string'?v.trim():''
const stringOrNull=(v:unknown):string|null=>string(v)||null
const number=(v:unknown):number|null=>(typeof v==='number'&&Number.isFinite(v)&&v>=0)?v:null
const unique=(arr:string[])=>[...new Set(arr.filter(Boolean))]

export const HS_CODES:Record<string,{code:string;label:string}>={
  tomato:{code:'0702',label:'Tomatoes, fresh or chilled'},
  cucumber:{code:'0707',label:'Cucumbers and gherkins, fresh or chilled'},
  pepper:{code:'070960',label:'Fresh Capsicum / Pimenta fruits'},
  lettuce:{code:'0705',label:'Lettuce and chicory, fresh or chilled (broader heading)'},
  date:{code:'080410',label:'Fresh or dried dates'},
  barley:{code:'1003',label:'Barley'},
  milk:{code:'0401',label:'Milk and cream, not concentrated (broader heading)'},
  rice:{code:'1006',label:'Rice'},
  wheat:{code:'1001',label:'Wheat and meslin'},
}
export const PROCUREMENT_COUNTRIES=[
  {code:'IN',name:'India'}, {code:'PK',name:'Pakistan'},
  {code:'TR',name:'Türkiye'}, {code:'AU',name:'Australia'},
  {code:'BR',name:'Brazil'}, {code:'DE',name:'Germany'},
  {code:'FR',name:'France'}, {code:'ES',name:'Spain'},
  {code:'IT',name:'Italy'}, {code:'NL',name:'Netherlands'},
  {code:'SA',name:'Saudi Arabia'}, {code:'AE',name:'United Arab Emirates'},
  {code:'QA',name:'Qatar'}, {code:'EG',name:'Egypt'},
  {code:'US',name:'United States'}, {code:'CN',name:'China'},
  {code:'VN',name:'Viet Nam'}, {code:'TH',name:'Thailand'},
  {code:'AR',name:'Argentina'}, {code:'ZA',name:'South Africa'},
  {code:'KE',name:'Kenya'}, {code:'MA',name:'Morocco'},
] as const
export const COUNTRY_NAME:Record<string,string>=Object.fromEntries(
  PROCUREMENT_COUNTRIES.map(row=>[row.code,row.name]),
)
const LEI=/^[A-Z0-9]{20}$/
const ISO3_TO_2:Record<string,string>={
  IND:'IN',PAK:'PK',TUR:'TR',AUS:'AU',BRA:'BR',DEU:'DE',
  FRA:'FR',ESP:'ES',ITA:'IT',NLD:'NL',SAU:'SA',ARE:'AE',
  QAT:'QA',EGY:'EG',USA:'US',CHN:'CN',VNM:'VN',THA:'TH',
  ARG:'AR',ZAF:'ZA',KEN:'KE',MAR:'MA',GBR:'GB',POL:'PL',
  RUS:'RU',UKR:'UA',KAZ:'KZ',IDN:'ID',MYS:'MY',JPN:'JP',
  CAN:'CA',NZL:'NZ',KOR:'KR',TWN:'TW',PHL:'PH',SGP:'SG',
  BGD:'BD',LKA:'LK',ETH:'ET',OMN:'OM',KWT:'KW',BHR:'BH',
  IRN:'IR',IRQ:'IQ',SDN:'SD',JOR:'JO',SYR:'SY',TZA:'TZ',
  UGA:'UG',NGA:'NG',GHA:'GH',CIV:'CI',SEN:'SN',PRY:'PY',
  URY:'UY',CHL:'CL',COL:'CO',PER:'PE',MEX:'MX',USA2:'US',
  PRT:'PT',GRC:'GR',ROU:'RO',CHE:'CH',SWE:'SE',NOR:'NO',
  DNK:'DK',FIN:'FI',BEL:'BE',AUT:'AT',CZE:'CZ',HUN:'HU',
  LTU:'LT',LVA:'LV',EST:'EE',HRV:'HR',SVK:'SK',SVN:'SI',
}


export function comtradeCountryCodeFromIso(iso:string):string|null{
  const code=iso.trim().toUpperCase()
  const normalized=ISO3_TO_2[code]??code
  return /^[A-Z]{2}$/.test(normalized)?normalized:null
}

export function validateProcurementQuery(params:URLSearchParams):
  |{ok:true;value:{
    provider:ProcurementProvider;query:string;country:string;
    commodity:string;year:number
  }}
  |{ok:false;message:string}{
  const provider=params.get('provider')||'gleif'
  if(!['gleif','places','comtrade'].includes(provider))
    return {ok:false,message:'Invalid supplier discovery provider'}
  const q=(params.get('q')||'').trim().replace(/\s+/g,' ')
  if(q.length>85 || /[\x00-\x1F\x7F<>]/.test(q))
    return {ok:false,message:'Query must be at most 85 printable characters'}
  if(provider!=='comtrade' && (q.length<3||q.length>85))
    return {ok:false,message:'Enter a company or industry keyword (3-85 characters)'}
  const country=(params.get('country')||'').trim().toUpperCase()
  if(country && !/^[A-Z]{2}$/.test(country))
    return {ok:false,message:'Country must be an ISO two-letter code'}
  const commodity=params.get('commodity')||'rice'
  if(!resolveCommodity(commodity)||!HS_CODES[commodity])
    return {ok:false,message:'Commodity is not in the NFII catalogue'}
  const year=Number(params.get('year')||'2024')
  if(!Number.isInteger(year)||year<2020||year>2025)
    return {ok:false,message:'Select a complete historical year (2020-2025)'}
  return {ok:true,value:{provider:provider as ProcurementProvider,
    query:q,country,commodity,year}}
}

export function gleifUrl(query:string,country:string):string{
  const url=new URL('https://api.gleif.org/api/v1/lei-records')
  url.searchParams.set('filter[entity.legalName]',query)
  if(country)url.searchParams.set('filter[entity.legalAddress.country]',country)
  url.searchParams.set('page[size]','18')
  url.searchParams.set('page[number]','1')
  return url.toString()
}

export function parseGleifCandidates(raw:unknown):SupplierCandidate[]{
  const rows=obj(raw).data
  if(!Array.isArray(rows))throw Error('GLEIF returned an unexpected result')
  return rows.slice(0,18).flatMap((record:unknown)=>{
    const row=obj(record),lei=string(row.id).toUpperCase()
    if(!LEI.test(lei))return []
    const a=obj(row.attributes)
    const entity=obj(a.entity)
    const registration=obj(a.registration)
    const legalAddress=obj(entity.legalAddress)
    const legalName=obj(entity.legalName)
    const name=string(legalName.name)
    if(!name)return []
    const country=string(legalAddress.country).toUpperCase()
    const lines=legalAddress.addressLines
    const address=unique([
      ...(Array.isArray(lines)?lines.map(string):[]),
      string(legalAddress.city),string(legalAddress.region),country,
    ]).join(', ')
    return [{
      source:'GLEIF' as const,sourceId:lei,name,
      countryCode:/^[A-Z]{2}$/.test(country)?country:null,
      address:address||null,legalEntityStatus:stringOrNull(entity.status),
      registrationStatus:stringOrNull(registration.status),
      lei,website:null,phone:null,
      sourceUrl:'https://search.gleif.org/#/record/'+encodeURIComponent(lei),
      businessStatus:null,
      supplierQualification:'not_assessed' as const,
    }]
  })
}

export function parseGooglePlacesCandidates(raw:unknown):SupplierCandidate[]{
  const rows=obj(raw).places
  if(!Array.isArray(rows))throw Error('Places returned an unexpected result')
  return rows.slice(0,12).flatMap((record:unknown)=>{
    const row=obj(record),name=string(obj(row.displayName).text)
    const placeId=string(row.id)
    if(!name||!placeId||placeId.length>160)return []
    const components=Array.isArray(row.addressComponents)?row.addressComponents:[]
    const countryComp=components.map(obj).find(a=>
      Array.isArray(a.types)&&a.types.includes('country'))
    const country=string(countryComp?.shortText).toUpperCase()
    const web=string(row.websiteUri)
    // External URLs must be https; no raw upstream html, redirect or javascript links.
    let website:string|null=null
    try{
      const candidate=new URL(web)
      if(candidate.protocol==='https:')website=candidate.toString()
    }catch{}
    return [{
      source:'Google Places' as const,sourceId:placeId,name,
      countryCode:/^[A-Z]{2}$/.test(country)?country:null,
      address:stringOrNull(row.formattedAddress),
      legalEntityStatus:null,registrationStatus:null,lei:null,
      website,phone:stringOrNull(row.internationalPhoneNumber),
      sourceUrl:'https://www.google.com/maps/place/?q=place_id:'+encodeURIComponent(placeId),
      businessStatus:stringOrNull(row.businessStatus),
      supplierQualification:'not_assessed' as const,
    }]
  })
}

export function comtradeUrl(commodity:string,year:number):string{
  const hs=HS_CODES[commodity]
  if(!hs)throw Error('Unsupported commodity for international trade data')
  const url=new URL('https://comtradeapi.un.org/public/v1/preview/C/A/HS')
  url.searchParams.set('reporterCode','634') // Qatar UN M49
  url.searchParams.set('period',String(year))
  url.searchParams.set('cmdCode',hs.code)
  url.searchParams.set('flowCode','M')
  url.searchParams.set('partner2Code','0')
  url.searchParams.set('customsCode','C00')
  url.searchParams.set('motCode','0')
  url.searchParams.set('maxRecords','500')
  return url.toString()
}

export function parseComtradeTrade(
  raw:unknown,commodityId:string,year:number,sourceUrl:string,
):TradeResearch{
  const hs=HS_CODES[commodityId]
  if(!hs)throw Error('Unsupported commodity')
  const root=obj(raw),rows=root.data
  if(!Array.isArray(rows))throw Error('UN Comtrade returned an unexpected result')
  const partners=new Map<number,TradePartner>()
  let worldTradeValueUsd:number|null=null
  for(const item of rows){
    const row=obj(item)
    if(Number(row.reporterCode)!==634 || Number(row.refYear)!==year ||
      string(row.flowCode).toUpperCase()!=='M' ||
      string(row.cmdCode)!==hs.code)continue
    // Ignore secondary-partner, special customs and transport subtotals if included.
    if(row.partner2Code!==undefined && Number(row.partner2Code)!==0)continue
    if(row.customsCode!==undefined && string(row.customsCode)!=='C00')continue
    if(row.motCode!==undefined && Number(row.motCode)!==0)continue
    const partner=Number(row.partnerCode)
    if(!Number.isInteger(partner)||partner<0)continue
    const tradeValueUsd=number(row.primaryValue)
    const weightKg=number(row.netWgt)
    const netWeightTonnes=weightKg===null?null:
      Math.round(weightKg/1000*1000)/1000
    if(partner===0){
      worldTradeValueUsd=tradeValueUsd??worldTradeValueUsd
      continue
    }
    const countryName=string(row.partnerDesc)
    if(!countryName)continue
    const iso=string(row.partnerISO).toUpperCase()
    const code=ISO3_TO_2[iso]??iso
    const candidate:TradePartner={
      partnerCode:partner,countryName,
      countryCode:/^[A-Z]{2}$/.test(code)?code:null,
      tradeValueUsd,netWeightTonnes,
    }
    // Duplicate partner totals should not be summed; keep a single most
    // complete report. A preview is never a verified national aggregate.
    const prior=partners.get(partner)
    if(!prior || (candidate.tradeValueUsd??0)>(prior.tradeValueUsd??0))
      partners.set(partner,candidate)
  }
  const partnerList=[...partners.values()].sort(
    (a,b)=>(b.tradeValueUsd??0)-(a.tradeValueUsd??0))
  const count=number(root.count)??rows.length
  return {
    commodityId,hsCode:hs.code,hsLabel:hs.label,year,reporter:'Qatar',
    partners:partnerList.slice(0,15),worldTradeValueUsd,
    resultCount:count,limitedPreview:count>=500||rows.length>=500,
    sourceUrl,
    note:'UN Comtrade preview: historical Qatar imports by partner country, not '+
      'supplier-level data, current contract prices or verified 2026 shipments. '+
      'HS headings may group more than one type of food.',
  }
}

export function supplierDraftCode(candidate:SupplierCandidate):string{
  if(candidate.lei)return 'LEI-'+candidate.lei
  const cleaned=candidate.sourceId.replace(/[^A-Za-z0-9]/g,'')
  return 'PL-'+cleaned.slice(0,50)
}
