/**
 * Qatar national food-system analytics, read-only and source-attributed.
 *
 * National Planning Council published datasets (State of Qatar Open Data)
 * and the World Bank Indicators API. Missing observations are NULL, never 0.
 * Growa user-input farm estimates MUST NOT be presented as national totals.
 */
export const QATAR_DATASETS={
 production:'production-area-and-average-yield-of-crops',
 farms:'number-of-farms-and-total-area-by-type-of-the-farm-and-municipality',
 sufficiency:'quantity-of-agricultural-production-and-self-sufficiency',
} as const
export type QatarDataset=keyof typeof QATAR_DATASETS
export const DATASET_URL=(id:QatarDataset)=>
 'https://www.data.gov.qa/explore/dataset/'+QATAR_DATASETS[id]+'/'
export const WORLD_BANK_INDICATORS={
 population:{code:'SP.POP.TOTL',label:'Resident population',unit:'people'},
 foodImportShare:{code:'TM.VAL.FOOD.ZS.UN',label:'Food share of merchandise imports',unit:'%'},
 agriculturalLand:{code:'AG.LND.AGRI.ZS',label:'Agricultural land',unit:'% of land'},
 agricultureGdp:{code:'NV.AGR.TOTL.ZS',label:'Agriculture, forestry and fishing',unit:'% of GDP'},
} as const
export type WorldBankKey=keyof typeof WORLD_BANK_INDICATORS
export type TimePoint={year:number;value:number}
export type IndicatorSeries={
 key:WorldBankKey;code:string;label:string;unit:string;
 url:string;latest:TimePoint|null;history:TimePoint[]
}
export type CropProduction={
 year:number;crop:string;group:string;tonnes:number;areaHa:number|null;yieldTonnesHa:number|null
}
export type FarmMunicipality={
 year:number;municipality:string;farmType:string;farms:number;areaHa:number|null
}
export type SelfSufficiency={
 year:number;product:string;group:string;quantityTonnes:number|null;ratioPercent:number
}
/**
 * Qatar Ministry of Municipality, 2025 self-sufficiency indicators,
 * reported by Qatar News Agency on 15 October 2026, and reported ministry
 * figures for table eggs and red meat in The Peninsula on 2 January 2026.
 *
 * These are curated, product-specific officially attributed 2025 indicators,
 * NOT the incompatible/ambiguous raw 2013–2023 data.gov.qa API series.
 * Do not combine with seasonal (100% peak) vegetables or 2024 values.
 */
export const QATAR_VERIFIED_SUFFICIENCY_SOURCES={
 ministry:'https://qna.org.qa/en/news/news-details?date=15%2F10%2F2026&id=qatar-targets-sustainable-food-production-as-self-sufficiency-reaches-99-for-fresh-poultry-and-dairy',
 other:'https://thepeninsulaqatar.com/article/02/01/2026/local-vegetable-output-hits-75000-tonnes-in-2025',
} as const
export type VerifiedSufficiency=SelfSufficiency & {
 sourceUrl:string
 sourceLabel:string
 publicationDate:string
}
export const QATAR_VERIFIED_SUFFICIENCY_2025:readonly VerifiedSufficiency[]=[
 {year:2025,product:'Fresh poultry',group:'Meat',quantityTonnes:null,ratioPercent:99,
  sourceUrl:QATAR_VERIFIED_SUFFICIENCY_SOURCES.ministry,sourceLabel:'Ministry of Municipality / QNA',publicationDate:'2026-10-15'},
 {year:2025,product:'Fresh milk & dairy',group:'Dairy',quantityTonnes:null,ratioPercent:99,
  sourceUrl:QATAR_VERIFIED_SUFFICIENCY_SOURCES.ministry,sourceLabel:'Ministry of Municipality / QNA',publicationDate:'2026-10-15'},
 {year:2025,product:'Fresh fish',group:'Fish',quantityTonnes:null,ratioPercent:67,
  sourceUrl:QATAR_VERIFIED_SUFFICIENCY_SOURCES.ministry,sourceLabel:'Ministry of Municipality / QNA',publicationDate:'2026-10-15'},
 {year:2025,product:'Basic vegetables',group:'Vegetables',quantityTonnes:null,ratioPercent:47,
  sourceUrl:QATAR_VERIFIED_SUFFICIENCY_SOURCES.ministry,sourceLabel:'Ministry of Municipality / QNA',publicationDate:'2026-10-15'},
 {year:2025,product:'Table eggs',group:'Eggs',quantityTonnes:null,ratioPercent:27,
  sourceUrl:QATAR_VERIFIED_SUFFICIENCY_SOURCES.other,sourceLabel:'Ministry figures / The Peninsula',publicationDate:'2026-01-02'},
 {year:2025,product:'Red meat',group:'Meat',quantityTonnes:null,ratioPercent:19,
  sourceUrl:QATAR_VERIFIED_SUFFICIENCY_SOURCES.other,sourceLabel:'Ministry figures / The Peninsula',publicationDate:'2026-01-02'},
]
export type SourceHealth={
 id:'world-bank'|QatarDataset
 label:string;status:'available'|'unavailable'
 url:string;latestYear:number|null;count:number
 note:string
}
export type QatarCountrySnapshot={
 generatedAt:string;indicators:IndicatorSeries[];
 production:CropProduction[];farms:FarmMunicipality[];sufficiency:SelfSufficiency[];
 sources:SourceHealth[]
}
const record=(x:unknown):Record<string,unknown>|null=>
 x!==null&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:null
const numeric=(x:unknown):number|null=>{
 if(typeof x==='number')return Number.isFinite(x)?x:null
 if(typeof x==='string'&&x.trim()!==''){
  const n=Number(x);return Number.isFinite(n)?n:null
 }
 return null
}
const textValue=(x:unknown):string=>
 typeof x==='string'?x.replace(/[<>\x00-\x1f\x7f]/g,'').trim().slice(0,95):''
export function parseYear(x:unknown):number|null{
 const year=typeof x==='number'&&Number.isInteger(x)?x:
  typeof x==='string'?Number(x.match(/^\d{4}/)?.[0]):NaN
 return Number.isInteger(year)&&year>=2000&&year<=2100?year:null
}
const valid=(value:number|null)=>value!==null&&value>=0
function rowsOf(payload:unknown):Record<string,unknown>[]{
 const root=record(payload)
 if(!root)throw Error('Expected Opendatasoft response object')
 const results=Array.isArray(root.results)?root.results:
  Array.isArray(root.records)?root.records:[]
 if(!Array.isArray(root.results)&&!Array.isArray(root.records))throw Error('Missing source records')
 return results.map(row=>record(row)?.fields??row).map(record).filter((x):x is Record<string,unknown>=>Boolean(x))
}
const duplicateKey=(...parts:(string|number)[])=>parts.map(x=>String(x).toLowerCase()).join('|')
const isTotal=(x:string)=>/^\s*(total|all|overall|qatar total|grand total)\b/i.test(x)
export function parseQatarProduction(payload:unknown):CropProduction[]{
 const seen=new Set<string>()
 return rowsOf(payload).flatMap(r=>{
  const year=parseYear(r.year),crop=textValue(r.crop),group=textValue(r.crop_group)
  const tonnes=numeric(r.production),area=numeric(r.area),yieldValue=numeric(r.yield)
  if(!year||!crop||!group||isTotal(crop)||!valid(tonnes))return []
  const key=duplicateKey(year,group,crop)
  if(seen.has(key))return []
  seen.add(key)
  return [{year,crop,group,tonnes:tonnes!,areaHa:valid(area)?area:null,
   yieldTonnesHa:valid(yieldValue)?yieldValue:null}]
 }).sort((a,b)=>b.year-a.year||b.tonnes-a.tonnes)
}
export function parseQatarFarms(payload:unknown):FarmMunicipality[]{
 const seen=new Set<string>()
 return rowsOf(payload).flatMap(r=>{
  const year=parseYear(r.year),municipality=textValue(r.municipality),
   farmType=textValue(r.farm_type)
  const farms=numeric(r.number_of_farms),area=numeric(r.total_area)
  if(!year||!municipality||!farmType||isTotal(farmType)||isTotal(municipality)||
   !valid(farms))return []
  const key=duplicateKey(year,municipality,farmType)
  if(seen.has(key))return []
  seen.add(key)
  return [{year,municipality,farmType,farms:farms!,areaHa:valid(area)?area:null}]
 }).sort((a,b)=>b.year-a.year||a.municipality.localeCompare(b.municipality))
}
/** Returns the self-sufficiency percentage exactly as published by NPC.
 * Values are already percentages (e.g. 1.7 means 1.7%, not 170%).
 * A value above 100% can reflect production above estimated domestic use.
 * Very large, implausible ratios are withheld pending source review.
 */
export function parseQatarSufficiency(payload:unknown):SelfSufficiency[]{
 const seen=new Set<string>()
 return rowsOf(payload).flatMap(r=>{
  const year=parseYear(r.year)
  const product=textValue(r.product)
  const group=textValue(r.product_group)
  const tonnes=numeric(r.quantity)
  const ratio=numeric(r.self_sufficiency_ratio)
  if(year===null||!product||!group||isTotal(product)||
   ratio===null||ratio<0||ratio>300)return []
  const key=duplicateKey(year,group,product)
  if(seen.has(key))return []
  seen.add(key)
  return [{year,product,group,quantityTonnes:valid(tonnes)?tonnes:null,
   ratioPercent:ratio}]
 }).sort((a,b)=>b.year-a.year||a.group.localeCompare(b.group)||a.product.localeCompare(b.product))
}

/** A reference scale of 100% is always fixed. Unlike a max-relative chart,
 * 40% will fill precisely 40% of the bar even when 40% is the top product.
 */
export function selfSufficiencyBarPercent(ratioPercent:number):number{
 return Number.isFinite(ratioPercent)?Math.min(100,Math.max(0,ratioPercent)):0
}

export function parseWorldBank(payload:unknown):IndicatorSeries[]{
 if(!Array.isArray(payload)||!Array.isArray(payload[1]))throw Error('Invalid World Bank API response')
 const rows=payload[1] as unknown[]
 const byCode=new Map<string,TimePoint[]>()
 const knownCodes=new Set<string>(Object.values(WORLD_BANK_INDICATORS).map(v=>v.code))
 for(const raw of rows){
  const row=record(raw);if(!row)continue
  const iso=textValue(row.countryiso3code)
  if(iso&&iso!=='QAT')continue
  const ind=record(row.indicator),code=textValue(ind?.id)
  if(!knownCodes.has(code))continue
  const year=parseYear(row.date),value=numeric(row.value)
  if(!year||value===null)continue
  const arr=byCode.get(code)??[]
  if(!arr.some(t=>t.year===year))arr.push({year,value})
  byCode.set(code,arr)
 }
 return (Object.keys(WORLD_BANK_INDICATORS) as WorldBankKey[]).map(key=>{
  const def=WORLD_BANK_INDICATORS[key]
  const history=(byCode.get(def.code)??[]).sort((a,b)=>a.year-b.year)
  return {
   key,code:def.code,label:def.label,unit:def.unit,
   url:'https://data.worldbank.org/indicator/'+def.code+'?locations=QA',
   latest:history.at(-1)??null,history,
  }
 })
}
export function latestYear<T extends {year:number}>(rows:readonly T[]):number|null{
 return rows.length?Math.max(...rows.map(x=>x.year)):null
}
export function sumLatestProduction(rows:readonly CropProduction[]){
 const year=latestYear(rows)
 return {year,tonnes:year===null?null:rows.filter(r=>r.year===year).reduce((sum,r)=>sum+r.tonnes,0)}
}
export function farmsByMunicipality(rows:readonly FarmMunicipality[],year:number){
 const result=new Map<string,{name:string;farms:number;areaHa:number|null}>()
 for(const r of rows.filter(x=>x.year===year)){
  const previous=result.get(r.municipality)??{name:r.municipality,farms:0,areaHa:0}
  previous.farms+=r.farms
  previous.areaHa=previous.areaHa===null||r.areaHa===null?null:previous.areaHa+r.areaHa
  result.set(r.municipality,previous)
 }
 return [...result.values()].sort((a,b)=>b.farms-a.farms)
}
export function sourceCoverage(sources:readonly SourceHealth[]){
 const present=sources.filter(s=>s.status==='available').length
 return {present,total:sources.length,partial:present<sources.length}
}
