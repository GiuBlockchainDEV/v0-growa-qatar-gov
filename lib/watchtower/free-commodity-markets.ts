/**
 * Public, no-key commodity data. Monthly published prices come from World
 * Bank and IMF/FRED. USDA AMS provides independently dated daily cash-bid
 * REPORT LINKS only until a structured, unit-safe price extractor exists.
 * Never conflate US grain bids, world benchmarks and Qatar landed prices.
 */
import {COMMODITY_CATALOG,getCommodityMarketsSnapshot,
 type CommodityMarketsSnapshot,type MarketInstrument} from './commodity-markets'
import {getWorldBankMonthly,WORLD_BANK_LANDING_URL} from './world-bank-pink-sheet'
import {getUsdaPublicReports,type UsdaGrainReport} from './usda-public-reports'

export type PublicCommodityMarketsSnapshot=CommodityMarketsSnapshot&{
 providerAvailability:{
  worldBank:number
  imfFred:number
  usdaPublishedReports:number
 }
 usdaReports:UsdaGrainReport[]
 sources:{name:string;url:string;frequency:'monthly'|'daily_reports';note:string}[]
}
export function combinePublicCommodityMarkets(
 imf:CommodityMarketsSnapshot,worldBank:readonly MarketInstrument[],
 usdaReports:readonly UsdaGrainReport[],
):PublicCommodityMarketsSnapshot{
 const wb=new Map(worldBank.map(x=>[x.id,x]))
 const imfById=new Map(imf.instruments.map(x=>[x.id,x]))
 const instruments:MarketInstrument[]=[]
 for(const def of COMMODITY_CATALOG){
  const original=imfById.get(def.id)
  const bank=wb.get(def.id)
  // Choose the newest real observation. Prefer WB for an identical
  // observation month to reduce single-provider dependence on FRED.
  const chosen=bank&&(!original||bank.latestDate>=original.latestDate)
   ?bank:original
  if(chosen)instruments.push({
   ...chosen,sourceName:chosen.sourceName??'IMF via FRED',
  })
 }
 const found=new Set(instruments.map(x=>x.id))
 const latestObservationMonth=instruments.length?
  instruments.map(x=>x.latestDate).sort().at(-1)??null:null
 const available=instruments.length
 const sourceCount=usdaReports.filter(x=>x.status==='published').length
 return {
  ...imf,
  source:'World Bank Pink Sheet + IMF/FRED public monthly prices',
  sourceUrl:WORLD_BANK_LANDING_URL,
  generatedAt:new Date().toISOString(),
  status:available===0?'unavailable':available<COMMODITY_CATALOG.length?'partial':'available',
  latestObservationMonth,
  available,tracked:COMMODITY_CATALOG.length,
  unavailableIds:COMMODITY_CATALOG.filter(x=>!found.has(x.id)).map(x=>x.id),
  instruments,
  providerAvailability:{
   worldBank:worldBank.length,
   imfFred:imf.instruments.length,
   usdaPublishedReports:sourceCount,
  },
  usdaReports:[...usdaReports],
  sources:[
   {name:'World Bank Pink Sheet',url:WORLD_BANK_LANDING_URL,frequency:'monthly',
    note:'International observed benchmark monthly averages. No sign-in or key.'},
   {name:'IMF via FRED',url:'https://fred.stlouisfed.org/',frequency:'monthly',
    note:'Public published monthly index series. No API key required.'},
   {name:'USDA AMS Market News',url:'https://www.ams.usda.gov/market-news/state-grain-reports',
    frequency:'daily_reports',
    note:'Public USDA cash-grain reports and publication dates. NOT machine-readable prices or market quotes.'},
  ],
  disclaimer:'Verified World Bank and IMF/FRED monthly reference observations. USDA shows links and publication dates of public daily cash-grain reports; their underlying PDFs are not presented as extracted numeric quotes. This is NOT intraday pricing, a farmgate price, or a supplier quotation. USD/t and QAR/t use the Qatar Central Bank 3.64 parity; quality, transport, tariffs, CIF/FOB terms and freight are excluded. Unavailable inputs remain unavailable.',
 }
}
export async function getPublicCommodityMarketsSnapshot():Promise<PublicCommodityMarketsSnapshot>{
 const [imf,worldBank,usda]=await Promise.all([
  getCommodityMarketsSnapshot(),getWorldBankMonthly(),getUsdaPublicReports(),
 ])
 return combinePublicCommodityMarkets(imf,worldBank,usda)
}
