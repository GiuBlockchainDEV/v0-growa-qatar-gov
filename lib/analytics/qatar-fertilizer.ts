/** Qatar Fertilizer Intelligence: documented market benchmarks and explicitly
 * hypothetical stock/stress calculations. No live supplier quotes or inventory
 * are invented. World Bank Pink Sheet (CC BY 4.0), October 2026 release.
 */
export type FertilizerId='urea'|'dap'|'potash'|'npk'|'calcium-nitrate'
export type FertilizerHorizon=30|90|365
export type FertilizerRisk='high'|'watch'|'normal'|'unassessed'
export type FertilizerPrice={month:string;usdPerTonne:number}
export type FertilizerProduct={
 id:FertilizerId;name:string;category:string;formula:string;origin:string;
 basis:string;sourceUrl:string;prices:FertilizerPrice[]
}
export type FertilizerTrade={
 year:number;importsQar:number|null;exportsQar:number|null;reexportsQar:number|null
}
export type FertilizerSnapshot={
 scope:'qatar-national-fertilizers';asOf:string;generatedAt:string;
 benchmarkPeriod:'2026-10';benchmarks:FertilizerProduct[];
 trade:FertilizerTrade[];tradeStatus:'available'|'unavailable'|'empty';
 tradeDetail:string;production:{
  producer:'QAFCO';product:'Urea';capacityTonnesPerYear:number;
  sourceYear:number;sourceUrl:string;note:string
 }
}
export type FertilizerStock={
 stockTonnes:number|null;weeklyUseTonnes:number|null;
 inboundTonnes:number|null;leadDays:number|null;confirmed:boolean
}
export type FertilizerStress={
 logisticsDelayDays:number;demandShockPct:number;priceShockPct:number
}
export type FertilizerAssessment={
 horizon:FertilizerHorizon;availableTonnes:number|null;needTonnes:number|null;
 balanceTonnes:number|null;coverageDays:number|null;shortfallTonnes:number|null;
 risk:FertilizerRisk;reason:string
}
export const WORLD_BANK_FERTILIZER_SOURCE='https://www.worldbank.org/en/research/commodity-markets'
export const QATAR_FERTILIZER_TRADE_SOURCE='https://www.data.gov.qa/explore/dataset/trade-data-for-fertilizers/'
export const QAFCO_REPORT_URL='https://iq.com.qa/media/3tjkd13b/iq-annual-report-2024-en-digital.pdf'
export const USD_QAR_REFERENCE=3.64 // illustrative peg-based display, not a live FX transaction quote
export const FERTILIZER_MONTHS=[
 '2025-11','2025-12','2026-01','2026-02','2026-03','2026-04',
 '2026-05','2026-06','2026-07','2026-08','2026-09','2026-10',
] as const
const series=(numbers:readonly number[]):FertilizerPrice[]=>
 numbers.map((usdPerTonne,index)=>({month:FERTILIZER_MONTHS[index],usdPerTonne}))
export const FERTILIZER_PRODUCTS:FertilizerProduct[]=[
 {id:'urea',name:'Urea',category:'Nitrogen',formula:'46-0-0',
  origin:'QAFCO / international market',basis:'World Bank Pink Sheet · FOB Middle East',
  sourceUrl:WORLD_BANK_FERTILIZER_SOURCE,
  prices:series([409.3,392.5,415.4,472,725.6,856.9,770.5,453.1,400,390,407.5,420])},
 {id:'dap',name:'DAP',category:'Phosphates',formula:'18-46-0',
  origin:'International import reference',basis:'World Bank Pink Sheet · FOB US Gulf',
  sourceUrl:WORLD_BANK_FERTILIZER_SOURCE,
  prices:series([708.3,627.5,619.2,626.5,658.3,725.3,769.5,783.8,781.3,793.5,800.6,803.1])},
 {id:'potash',name:'Potash · MOP',category:'Potassium',formula:'0-0-60',
  origin:'International import reference',basis:'World Bank Pink Sheet · CFR Brazil',
  sourceUrl:WORLD_BANK_FERTILIZER_SOURCE,
  prices:series([353.8,358.3,366,372.5,380.6,401.3,405,402.5,396.5,386.9,367.5,357.5])},
 {id:'npk',name:'Compound NPK',category:'Blended fertilizer',formula:'Varies',
  origin:'Supplier price required',basis:'No comparable universal price; product recipes differ',
  sourceUrl:WORLD_BANK_FERTILIZER_SOURCE,prices:[]},
 {id:'calcium-nitrate',name:'Calcium nitrate',category:'Speciality / greenhouse',formula:'Ca + N',
  origin:'Supplier price required',basis:'No verified country benchmark in source dataset',
  sourceUrl:WORLD_BANK_FERTILIZER_SOURCE,prices:[]},
]
export const FERTILIZER_IDS=FERTILIZER_PRODUCTS.map(p=>p.id)
export const DEFAULT_FERTILIZER_STRESS:FertilizerStress={
 logisticsDelayDays:0,demandShockPct:0,priceShockPct:0,
}
export const emptyStock=():FertilizerStock=>({
 stockTonnes:null,weeklyUseTonnes:null,inboundTonnes:null,leadDays:null,confirmed:false,
})
export function parseFertilizerTrade(payload:unknown):FertilizerTrade[]{
 const root=payload&&typeof payload==='object'?payload as Record<string,unknown>:null
 const rows=Array.isArray(root?.results)?root.results:[]
 const values=new Map<number,FertilizerTrade>()
 const num=(x:unknown):number|null=>{
  const n=typeof x==='number'?x:typeof x==='string'&&x.trim()?Number(x):NaN
  return Number.isFinite(n)&&n>=0?n:null
 }
 for(const raw of rows){
  if(!raw||typeof raw!=='object')continue
  const rec=raw as Record<string,unknown>
  const fields=rec.fields&&typeof rec.fields==='object'?
   rec.fields as Record<string,unknown>:rec
  const match=String(fields.year??'').match(/^(20\d\d)/)
  if(!match)continue
  const year=Number(match[1])
  values.set(year,{
   year,importsQar:num(fields.import),
   exportsQar:num(fields.export),
   reexportsQar:num(fields.re_export),
  })
 }
 return [...values.values()].sort((a,b)=>a.year-b.year)
}
export function latestFertilizerPrice(product:FertilizerProduct){
 return product.prices.at(-1)??null
}
export function fertilizerPriceChange(product:FertilizerProduct,months=1):number|null{
 const current=product.prices.at(-1)
 const past=product.prices.at(-(months+1))
 return !current||!past||past.usdPerTonne<=0?null:
  (current.usdPerTonne-past.usdPerTonne)/past.usdPerTonne*100
}
export function averageFertilizerBenchmark(products=FERTILIZER_PRODUCTS):number|null{
 const priced=products.map(latestFertilizerPrice).filter((x):x is FertilizerPrice=>x!==null)
 return priced.length?priced.reduce((sum,p)=>sum+p.usdPerTonne,0)/priced.length:null
}
/** Stock projection: only user-entered stock, demand and validated lead time.
 * Unknown inputs mean unassessed, never zero.
 */
export function assessFertilizerStock(
 stock:FertilizerStock,horizon:FertilizerHorizon,
 stress:FertilizerStress=DEFAULT_FERTILIZER_STRESS,
):FertilizerAssessment{
 const {stockTonnes,weeklyUseTonnes,inboundTonnes,leadDays,confirmed}=stock
 if(stockTonnes===null||weeklyUseTonnes===null||leadDays===null||
  !Number.isFinite(stockTonnes)||stockTonnes<0||
  !Number.isFinite(weeklyUseTonnes)||weeklyUseTonnes<=0||
  !Number.isFinite(leadDays)||leadDays<0){
  return {horizon,availableTonnes:null,needTonnes:null,balanceTonnes:null,
   coverageDays:null,shortfallTonnes:null,risk:'unassessed',
   reason:'Enter on-hand stock, weekly use and supplier lead time. Unknown stock is not zero.'}
 }
 const effectiveDemand=weeklyUseTonnes*(1+Math.max(0,stress.demandShockPct)/100)
 const inbound=confirmed?Math.max(0,inboundTonnes??0):0
 const eta=leadDays+Math.max(0,stress.logisticsDelayDays)
 const willArrive=eta<=horizon
 const availableTonnes=stockTonnes+(willArrive?inbound:0)
 const needTonnes=effectiveDemand*horizon/7
 const balanceTonnes=availableTonnes-needTonnes
 const shortfallTonnes=Math.max(0,-balanceTonnes)
 const coverageDays=stockTonnes/effectiveDemand*7
 // A stockout before inbound delivery is a distinct issue from end-of-window surplus.
 const beforeInbound=eta>0&&coverageDays<Math.min(eta,horizon)
 const risk:FertilizerRisk=shortfallTonnes>0||beforeInbound?'high':
  coverageDays<Math.min(horizon,eta+14)?'watch':'normal'
 const reason=shortfallTonnes>0?
  'Projected unmet demand '+shortfallTonnes.toFixed(1)+' t if the scenario occurs.':
  beforeInbound?'Inventory may run out before confirmed replenishment arrives.':
  risk==='watch'?'Limited stock buffer relative to lead time and scenario demand.':
  'No modeled stock deficit in this horizon; supplier availability remains unverified.'
 return {horizon,availableTonnes,needTonnes,balanceTonnes,coverageDays,
  shortfallTonnes,risk,reason}
}
export function fertilizerMarketPressure(
 product:FertilizerProduct,stress:FertilizerStress,
 horizon:FertilizerHorizon,
):{risk:Exclude<FertilizerRisk,'unassessed'>;score:number;drivers:string[]}{
 const mom=fertilizerPriceChange(product,1)
 const three=fertilizerPriceChange(product,3)
 const drivers:string[]=[]
 let score=22
 if(mom!==null&&mom>4){score+=14;drivers.push('Recent benchmark price inflation')}
 if(three!==null&&three>12){score+=14;drivers.push('Three-month price acceleration')}
 if(stress.logisticsDelayDays>0){score+=Math.min(25,stress.logisticsDelayDays/3);drivers.push('Assumed shipping delay')}
 if(stress.priceShockPct>0){score+=Math.min(25,stress.priceShockPct*.75);drivers.push('User-specified price shock')}
 if(stress.demandShockPct>0){score+=Math.min(16,stress.demandShockPct*.5);drivers.push('User-specified demand increase')}
 if(horizon===90)score+=6
 if(horizon===365)score+=11
 if(!product.prices.length){drivers.push('Unpriced formulation: no comparable published benchmark');score+=8}
 const value=Math.max(0,Math.min(100,Math.round(score)))
 return {score:value,risk:value>=65?'high':value>=40?'watch':'normal',
  drivers:drivers.length?drivers:['Baseline scenario; no verified immediate disruption']}
}
export function modeledDeliveredPrice(
 product:FertilizerProduct,stress:FertilizerStress,
):number|null{
 const price=latestFertilizerPrice(product)?.usdPerTonne
 return price===undefined?null:price*(1+Math.max(-50,stress.priceShockPct)/100)
}
export function shortTermRecommendations(
 product:FertilizerProduct,stock:FertilizerStock,stress:FertilizerStress,
):{priority:'critical'|'watch'|'info';title:string;detail:string}[]{
 const short=assessFertilizerStock(stock,30,stress)
 const out:{priority:'critical'|'watch'|'info';title:string;detail:string}[]=[]
 if(short.risk==='unassessed')out.push({
  priority:'critical',title:'Inventory evidence missing',
  detail:'Request supplier-verified on-hand quantity, consumption rate and delivery lead time before claiming availability.',
 })
 else if(short.risk==='high')out.push({
  priority:'critical',title:'Procurement review now',
  detail:'Check confirmed deliveries and an alternate supplier; the 30-day stock scenario indicates possible interruption.',
 })
 else if(short.risk==='watch')out.push({
  priority:'watch',title:'Increase stock buffer',
  detail:'Review reorder point against lead-time uncertainty and seasonal demand.',
 })
 const change=fertilizerPriceChange(product)
 if(change!==null&&change>3)out.push({
  priority:'watch',title:'Benchmark rising month on month',
  detail:'Compare contract and landed quotes against the World Bank reference before approving procurement.',
 })
 if(stress.logisticsDelayDays>0)out.push({
  priority:'watch',title:'Validate logistics alternative',
  detail:'Scenario applies '+stress.logisticsDelayDays+' days additional transit. Request real carrier quotations and updated ETA.',
 })
 if(!product.prices.length)out.push({
  priority:'info',title:'Obtain grade-specific quotations',
  detail:'NPK and speciality grades need formula, delivery basis, volume and supplier evidence; a generic fertilizer average is not a quote.',
 })
 if(!out.length)out.push({priority:'info',title:'Maintain verification cadence',
  detail:'Reconcile inventory and supplier delivery evidence weekly; current risk calculation is indicative only.'})
 return out
}
