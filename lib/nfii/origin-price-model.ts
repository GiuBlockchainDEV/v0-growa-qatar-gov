/**
 * Evidence-based Qatar import-origin screening, not supplier quotations.
 * Unit values are UN Comtrade primaryValue (USD) / netWgt (kg), converted
 * at the official QCB parity of 3.64 QAR/USD. Imports are normally CIF-like,
 * but reporting conventions vary; transport, duties, current offers, specs,
 * timing and quality must be checked before procurement.
 */
import {HS_CODES,comtradeCountryCodeFromIso} from './procurement-global'
import {isWorldCountryCode,countryName} from './world-countries'

export const QAR_PER_USD=3.64
export const COMTRADE_SOURCE='UN Comtrade public annual preview'
export const QCB_PEG_SOURCE='https://www.qcb.gov.qa/en/Pages/MonetaryPolicyTools.aspx'

type Dict=Record<string,unknown>
const obj=(value:unknown):Dict=>
  value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Dict:{}
const string=(value:unknown):string=>typeof value==='string'?value.trim():''
const number=(value:unknown):number|null=>
  typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null

export type ImportOrigin={
  countryCode:string
  countryName:string
  importValueUsd:number
  importWeightKg:number
  importWeightTonnes:number
  unitValueUsdKg:number
  unitValueQarKg:number
  differenceVsMeanPct:number
  previousUnitValueQarKg:number|null
  previousWeightTonnes:number|null
  changeVsPreviousPct:number|null
  importedPreviousYear:boolean
  shareOfRankedWeightPct:number
  estimatedNetWeight:boolean
  sourceYear:number
}

export type OriginPriceReport={
  commodity:string
  hsCode:string
  hsLabel:string
  priceUnit:'QAR/kg'
  conversionQarPerUsd:number
  analyzedYear:number|null
  comparisonYear:number|null
  weightedAverageQarKg:number|null
  lowestObservedQarKg:number|null
  highestObservedQarKg:number|null
  bestObservedCountryCode:string|null
  origins:ImportOrigin[]
  reviewedOriginCount:number
  excludedInsufficientVolumeCount:number
  annualMinimumTonnes:number
  incompletePreview:boolean
  nationalMeanFromWorldTotal:boolean
  sourceDataStatus:'live_comtrade'|'published_wits_2024'|'no_usable_data'
  productScope:string
  sourceUrl:string|null
  previousSourceUrl:string|null
  sourceName:string
  method:'observed_qatar_import_unit_values'
  note:string
}

export type PartnerObservation={
  countryCode:string
  countryName:string
  importValueUsd:number
  importWeightKg:number
  estimatedNetWeight:boolean
}

export type YearObservation={
  year:number
  partners:PartnerObservation[]
  incompletePreview:boolean
  sourceUrl:string
  worldTotal?:PartnerObservation
}

const MIN_TONNES:Record<string,number>={
  tomato:10,cucumber:10,pepper:10,lettuce:10,
  date:20,milk:20,rice:1000,wheat:1000,barley:1000,
}
const MIN_USD=10000
const MAX_ORIGINS=12

export function comtradeOriginUrl(commodity:string,year:number):string{
  const hs=HS_CODES[commodity]
  if(!hs||!Number.isInteger(year)||year<2020||year>2025)
    throw Error('Unsupported commodity or complete historical year')
  const url=new URL('https://comtradeapi.un.org/public/v1/preview/C/A/HS')
  // Public preview uses the lower-case reporter key in the official client.
  url.searchParams.set('reportercode','634')
  url.searchParams.set('period',String(year))
  url.searchParams.set('cmdCode',hs.code)
  url.searchParams.set('flowCode','M')
  url.searchParams.set('partner2Code','0')
  url.searchParams.set('customsCode','C00')
  url.searchParams.set('motCode','0')
  url.searchParams.set('maxRecords','500')
  return url.toString()
}

export function parseImportOriginYear(raw:unknown,commodity:string,year:number,
  sourceUrl:string):YearObservation{
  const hs=HS_CODES[commodity]
  if(!hs||year<2020||year>2025)throw Error('Invalid commodity/year')
  const payload=obj(raw),rows=payload.data
  if(!Array.isArray(rows))throw Error('UN Comtrade returned invalid trade rows')
  if(string(payload.error))throw Error('UN Comtrade reported a data error')
  const countries=new Map<string,PartnerObservation>()
  let worldTotal:PartnerObservation|undefined
  for(const item of rows){
    const row=obj(item)
    if(Number(row.reporterCode)!==634||Number(row.refYear)!==year||
      string(row.cmdCode)!==hs.code||string(row.flowCode).toUpperCase()!=='M')continue
    if(row.partner2Code!==undefined&&Number(row.partner2Code)!==0)continue
    if(row.customsCode!==undefined&&string(row.customsCode)!=='C00')continue
    if(row.motCode!==undefined&&Number(row.motCode)!==0)continue
    if(Number(row.partnerCode)===0){
      const usd=number(row.primaryValue),kg=number(row.netWgt)
      if(usd!==null&&kg!==null&&usd>0&&kg>0)
        worldTotal={countryCode:'',countryName:'World',importValueUsd:usd,
          importWeightKg:kg,estimatedNetWeight:row.isNetWgtEstimated===true}
      continue
    }
    const code=comtradeCountryCodeFromIso(string(row.partnerISO))
    if(!code||code==='QA'||!isWorldCountryCode(code))continue
    const usd=number(row.primaryValue),kg=number(row.netWgt)
    if(usd===null||kg===null||usd<=0||kg<=0)continue
    const candidate:PartnerObservation={
      countryCode:code,countryName:string(row.partnerDesc)||countryName(code),
      importValueUsd:usd,importWeightKg:kg,
      estimatedNetWeight:row.isNetWgtEstimated===true,
    }
    // Preview may contain duplicate partner subtotals; do not add them together.
    // Keep the most complete, highest-value single annual aggregate per partner.
    const existing=countries.get(code)
    if(!existing||candidate.importValueUsd>existing.importValueUsd)
      countries.set(code,candidate)
  }
  const count=number(payload.count)
  return {year,partners:[...countries.values()],
    sourceUrl,worldTotal,incompletePreview:rows.length>=500||(count!==null&&count>=500)}
}

/**
 * Only commercially significant, positively observed Qatar import links
 * qualify as suggested foreign origins. This is a historical trade screen,
 * NOT a logistics/food-safety certification or guaranteed supplier capacity.
 */
export function rankQatarImportOrigins(
  commodity:string,annual:readonly YearObservation[],
):OriginPriceReport{
  const hs=HS_CODES[commodity]
  if(!hs)throw Error('Unsupported commodity')
  const minimum=MIN_TONNES[commodity]??20
  const recent=[...annual].sort((a,b)=>b.year-a.year)
  const screened=recent.map(year=>({
    ...year,
    qualifying:year.partners.filter(p=>
      p.importWeightKg>=minimum*1000&&p.importValueUsd>=MIN_USD),
  }))
  // Favor latest year if at least one country meets the announced volume
  // threshold; otherwise use the preceding available year and display its date.
  const main=screened.find(year=>year.qualifying.length>0)
  const previous=main?screened.find(year=>year.year===main.year-1):undefined
  const nationalTotal=main?.worldTotal
  const weightedAverage=main?
    nationalTotal?nationalTotal.importValueUsd*QAR_PER_USD/nationalTotal.importWeightKg:
    main.qualifying.reduce((sum,p)=>sum+p.importValueUsd,0)*QAR_PER_USD/
    main.qualifying.reduce((sum,p)=>sum+p.importWeightKg,0):null
  // Avoid ranking countries whose claimed availability is based on a few KG.
  // The 12 largest observed lanes are compared by unit value, not by volume.
  const active=main?[...main.qualifying]
    .sort((a,b)=>b.importWeightKg-a.importWeightKg).slice(0,MAX_ORIGINS):[]
  const totalRankedWeight=active.reduce((sum,p)=>sum+p.importWeightKg,0)
  const previousMap=new Map(previous?.partners.map(p=>[p.countryCode,p])??[])
  const origins:ImportOrigin[]=active.map(p=>{
    const valueQar=p.importValueUsd*QAR_PER_USD/p.importWeightKg
    const prior=previousMap.get(p.countryCode)
    const previousQar=prior?prior.importValueUsd*QAR_PER_USD/prior.importWeightKg:null
    return {
      countryCode:p.countryCode,countryName:p.countryName,
      importValueUsd:p.importValueUsd,importWeightKg:p.importWeightKg,
      importWeightTonnes:p.importWeightKg/1000,
      unitValueUsdKg:p.importValueUsd/p.importWeightKg,
      unitValueQarKg:valueQar,
      differenceVsMeanPct:weightedAverage===null?0:
        (valueQar/weightedAverage-1)*100,
      previousUnitValueQarKg:previousQar,
      previousWeightTonnes:prior?prior.importWeightKg/1000:null,
      changeVsPreviousPct:previousQar===null?null:(valueQar/previousQar-1)*100,
      importedPreviousYear:Boolean(prior),
      shareOfRankedWeightPct:totalRankedWeight?
        p.importWeightKg/totalRankedWeight*100:0,
      estimatedNetWeight:p.estimatedNetWeight,
      sourceYear:main!.year,
    }
  }).sort((a,b)=>a.unitValueQarKg-b.unitValueQarKg)
  return {
    commodity,hsCode:hs.code,hsLabel:hs.label,priceUnit:'QAR/kg',
    conversionQarPerUsd:QAR_PER_USD,
    analyzedYear:main?.year??null,
    comparisonYear:previous?.year??null,
    weightedAverageQarKg:weightedAverage,
    lowestObservedQarKg:origins[0]?.unitValueQarKg??null,
    highestObservedQarKg:origins.length?origins[origins.length-1].unitValueQarKg:null,
    bestObservedCountryCode:origins[0]?.countryCode??null,
    origins,reviewedOriginCount:main?.partners.length??0,
    excludedInsufficientVolumeCount:main?
      main.partners.length-main.qualifying.length:0,
    annualMinimumTonnes:minimum,
    incompletePreview:recent.some(y=>y.incompletePreview),
    nationalMeanFromWorldTotal:Boolean(nationalTotal),
    sourceDataStatus:main?'live_comtrade':'no_usable_data',
    productScope:hs.label,
    sourceUrl:main?.sourceUrl??null,
    previousSourceUrl:previous?.sourceUrl??null,
    sourceName:COMTRADE_SOURCE,
    method:'observed_qatar_import_unit_values',
    note:'Historical Qatar import value (USD) divided by net weight (kg), '+ 
      'then converted at the official 3.64 QAR/USD parity. Weighted mean is '+
      'calculated across all eligible visible origins. Countries shown are '+
      'the 12 largest qualifying import lanes, sorted by unit value. This '+
      'is not a supplier quote, farm-gate price, current landed offer, '+ 
      'delivery guarantee or a food-safety assessment; specifications, '+ 
      'seasonality and HS headings may differ.',
  }
}
