/**
 * World food commodity benchmarks for the Watchtower market terminal.
 *
 * Source: IMF Primary Commodity Prices, syndicated through FRED's published
 * monthly CSV series. These are published monthly averages, NEVER exchange
 * ticks, futures order-book prices, supplier quotations, or real-time rates.
 *
 * FRED/IMF attribution and licensing apply to any downstream redistribution.
 * No synthetic or last-price-forward-filled points enter the dataset.
 */
export const USD_QAR_PEG = 3.64
export const POUNDS_PER_METRIC_TON = 2204.6226218488

export type MarketGroup='grains'|'oils'|'protein'|'softs'|'produce'
export type PriceUnit='usd_per_tonne'|'usd_cents_per_lb'
export type MarketDefinition={
  id:string
  label:string
  labelAr:string
  seriesId:string
  group:MarketGroup
  unit:PriceUnit
  benchmark:string
}
export const COMMODITY_CATALOG:readonly MarketDefinition[]=[
  {id:'wheat',label:'Wheat',labelAr:'القمح',seriesId:'PWHEAMTUSDM',group:'grains',unit:'usd_per_tonne',benchmark:'Global wheat reference'},
  {id:'corn',label:'Corn / Maize',labelAr:'الذرة',seriesId:'PMAIZMTUSDM',group:'grains',unit:'usd_per_tonne',benchmark:'Global corn reference'},
  {id:'rice',label:'Rice (Thailand)',labelAr:'الأرز (تايلاند)',seriesId:'PRICENPQUSDM',group:'grains',unit:'usd_per_tonne',benchmark:'Thai rice export benchmark'},
  {id:'soybeans',label:'Soybeans',labelAr:'فول الصويا',seriesId:'PSOYBUSDM',group:'grains',unit:'usd_per_tonne',benchmark:'Global soybean reference'},
  {id:'barley',label:'Barley',labelAr:'الشعير',seriesId:'PBARLUSDM',group:'grains',unit:'usd_per_tonne',benchmark:'Global barley reference'},
  {id:'palm-oil',label:'Palm oil',labelAr:'زيت النخيل',seriesId:'PPOILUSDM',group:'oils',unit:'usd_per_tonne',benchmark:'Global palm oil reference'},
  {id:'sunflower-oil',label:'Sunflower oil',labelAr:'زيت دوار الشمس',seriesId:'PSUNOUSDM',group:'oils',unit:'usd_per_tonne',benchmark:'Global sunflower oil reference'},
  {id:'beef',label:'Beef',labelAr:'لحوم الأبقار',seriesId:'PBEEFUSDM',group:'protein',unit:'usd_cents_per_lb',benchmark:'Global beef reference'},
  {id:'poultry',label:'Poultry',labelAr:'الدواجن',seriesId:'PPOULTUSDM',group:'protein',unit:'usd_cents_per_lb',benchmark:'Global poultry reference'},
  {id:'coffee',label:'Coffee (Arabica)',labelAr:'القهوة أرابيكا',seriesId:'PCOFFOTMUSDM',group:'softs',unit:'usd_cents_per_lb',benchmark:'Other Mild Arabica benchmark'},
  {id:'cocoa',label:'Cocoa',labelAr:'الكاكاو',seriesId:'PCOCOUSDM',group:'softs',unit:'usd_per_tonne',benchmark:'Global cocoa reference'},
  {id:'sugar',label:'Sugar No. 11',labelAr:'السكر رقم 11',seriesId:'PSUGAISAUSDM',group:'softs',unit:'usd_cents_per_lb',benchmark:'Global raw sugar No. 11'},
  {id:'cotton',label:'Cotton',labelAr:'القطن',seriesId:'PCOTTINDUSDM',group:'softs',unit:'usd_cents_per_lb',benchmark:'Global cotton reference'},
  {id:'bananas',label:'Bananas',labelAr:'الموز',seriesId:'PBANSOPUSDM',group:'produce',unit:'usd_per_tonne',benchmark:'Global banana reference'},
]
export type MarketPoint={
  date:string
  priceUsdTonne:number
}
export type MarketInstrument={
  id:string
  label:string
  labelAr:string
  group:MarketGroup
  benchmark:string
  seriesId:string
  sourceUrl:string
  sourceName?:string
  priceUnit:PriceUnit
  latestDate:string
  latestNativePrice:number
  latestUsdTonne:number
  latestQarTonne:number
  change1mPct:number|null
  change3mPct:number|null
  change12mPct:number|null
  high12mUsdTonne:number|null
  low12mUsdTonne:number|null
  volatility12mPct:number|null
  points:MarketPoint[]
  stale:boolean
}
export type CommodityMarketsSnapshot={
  generatedAt:string
  frequency:'monthly'
  source:string
  sourceUrl:'https://fred.stlouisfed.org/'
  fxBasis:'Qatar Central Bank USD/QAR official parity 3.64'
  usdQar:number
  status:'available'|'partial'|'unavailable'
  latestObservationMonth:string|null
  tracked:number
  available:number
  unavailableIds:string[]
  instruments:MarketInstrument[]
  disclaimer:string
  providerAvailability?:{
   worldBank:number;imfFred:number;usdaPublishedReports:number
  }
  usdaReports?:Array<{
   id:number;title:string;markets:readonly string[]
   reportDate:string|null;sourceUrl:string
   status:'published'|'unavailable';frequency:'daily'
  }>
  sources?:Array<{name:string;url:string;frequency:'monthly'|'daily_reports';note:string}>
}

export function nativeToUsdPerTonne(value:number,unit:PriceUnit):number{
  return unit==='usd_cents_per_lb'?value*0.01*POUNDS_PER_METRIC_TON:value
}
export function parseFredSeries(text:string,seriesId:string,now=Date.now()):
  Array<{date:string;nativePrice:number}>{
  if(text.length>300000||text.length===0)return []
  const allowed=new Map<string,number>()
  for(const row of text.split(/\r?\n/)){
    const match=row.trim().match(/^(\d{4}-\d{2}-\d{2})[\s,;]+([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/)
    if(!match)continue
    const date=match[1]
    const ms=Date.parse(date+'T00:00:00Z')
    const value=Number(match[2])
    if(!Number.isFinite(ms)||ms>now||!/^\d{4}-\d{2}-01$/.test(date)||
       !Number.isFinite(value)||value<=0||value>10000000)continue
    allowed.set(date,value)
  }
  // Refuse unrelated HTML/XML or another series' CSV header.
  const header=text.slice(0,Math.min(400,text.length))
  if(!header.includes(seriesId)&&!text.includes('DATE')&&!text.includes('observation_date'))
    return []
  return [...allowed.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,nativePrice])=>({date,nativePrice})).slice(-73)
}
function monthBefore(date:string,months:number):string{
  const [y,m]=date.split('-').map(Number)
  return new Date(Date.UTC(y,m-1-months,1)).toISOString().slice(0,10)
}
export function percentChange(current:number,previous:number|null):number|null{
  return previous!==null&&Number.isFinite(previous)&&previous>0
    ?(current/previous-1)*100:null
}
export function toMarketInstrument(
  definition:MarketDefinition,
  points:readonly {date:string;nativePrice:number}[],
  now=Date.now(),
):MarketInstrument|null{
  if(points.length<2)return null
  const last=points[points.length-1]
  const byDate=new Map(points.map(p=>[p.date,p.nativePrice]))
  const current=nativeToUsdPerTonne(last.nativePrice,definition.unit)
  const valueAt=(months:number)=>byDate.get(monthBefore(last.date,months))??null
  const change=(months:number)=>percentChange(last.nativePrice,valueAt(months))
  const recent=points.filter(p=>p.date>=monthBefore(last.date,11))
  const range=recent.map(p=>nativeToUsdPerTonne(p.nativePrice,definition.unit))
  const recentReturns:number[]=[]
  for(let i=1;i<=12;i++){
    const currentMonth=byDate.get(monthBefore(last.date,i-1))
    const previousMonth=byDate.get(monthBefore(last.date,i))
    if(currentMonth!==undefined&&previousMonth!==undefined&&previousMonth>0){
      recentReturns.push((currentMonth/previousMonth-1)*100)
    }
  }
  const mean=recentReturns.reduce((sum,n)=>sum+n,0)/Math.max(recentReturns.length,1)
  const vol=recentReturns.length>=6?Math.sqrt(
    recentReturns.reduce((sum,n)=>sum+(n-mean)**2,0)/recentReturns.length
  ):null
  const periodAge=now-Date.parse(last.date+'T00:00:00Z')
  return {
    id:definition.id,label:definition.label,labelAr:definition.labelAr,
    group:definition.group,benchmark:definition.benchmark,
    seriesId:definition.seriesId,
    sourceUrl:'https://fred.stlouisfed.org/series/'+definition.seriesId,
    sourceName:'IMF via FRED',
    priceUnit:definition.unit,
    latestDate:last.date,latestNativePrice:last.nativePrice,
    latestUsdTonne:current,latestQarTonne:current*USD_QAR_PEG,
    change1mPct:change(1),change3mPct:change(3),change12mPct:change(12),
    high12mUsdTonne:range.length?Math.max(...range):null,
    low12mUsdTonne:range.length?Math.min(...range):null,
    volatility12mPct:vol,
    points:points.map(p=>({date:p.date,priceUsdTonne:nativeToUsdPerTonne(p.nativePrice,definition.unit)})),
    // A missing feed is not magically 'live': display delayed publication.
    stale:periodAge>120*86400000,
  }
}
function parseBody(bytes:string,seriesId:string):ReturnType<typeof parseFredSeries>{
  return parseFredSeries(bytes,seriesId)
}
async function fetchSource(url:string,ms:number):Promise<string>{
  const response=await fetch(url,{
    headers:{Accept:'text/csv,text/plain;q=0.9,*/*;q=0.5'},
    signal:AbortSignal.timeout(ms),
    next:{revalidate:21600},
  })
  if(!response.ok)throw Error('Benchmark source HTTP '+response.status)
  const limit=300000,contentLength=Number(response.headers.get('content-length')??0)
  if(contentLength>limit)throw Error('Benchmark response too large')
  const body=await response.text()
  if(body.length>limit)throw Error('Benchmark response too large')
  return body
}
async function fetchBenchmark(def:MarketDefinition):Promise<MarketInstrument|null>{
  const id=def.seriesId
  try {
    const csv=await fetchSource('https://fred.stlouisfed.org/graph/fredgraph.csv?id='+id,6500)
    const points=parseBody(csv,id)
    if(points.length>=2)return toMarketInstrument(def,points)
  }catch{ /* FRED text format fallback below */ }
  try {
    const txt=await fetchSource('https://fred.stlouisfed.org/data/'+id+'.txt',4500)
    return toMarketInstrument(def,parseBody(txt,id))
  }catch{return null}
}
let cached:{until:number;result:CommodityMarketsSnapshot}|null=null
let pending:Promise<CommodityMarketsSnapshot>|null=null
/** Coalesced server cache: expensive public benchmarks update monthly, not per tick. */
export async function getCommodityMarketsSnapshot():Promise<CommodityMarketsSnapshot>{
  if(cached&&cached.until>Date.now())return cached.result
  if(pending)return pending
  pending=(async()=>{
    const settled=await Promise.allSettled(COMMODITY_CATALOG.map(fetchBenchmark))
    const instruments=settled.flatMap(r=>
      r.status==='fulfilled'&&r.value?[r.value]:[])
    const found=new Set(instruments.map(s=>s.id))
    const unavailableIds=COMMODITY_CATALOG.filter(x=>!found.has(x.id)).map(x=>x.id)
    const result:CommodityMarketsSnapshot={
      generatedAt:new Date().toISOString(),
      source:'IMF Primary Commodity Prices via FRED',
      sourceUrl:'https://fred.stlouisfed.org/',
      frequency:'monthly',fxBasis:'Qatar Central Bank USD/QAR official parity 3.64',
      usdQar:USD_QAR_PEG,
      status:instruments.length===0?'unavailable':unavailableIds.length?'partial':'available',
      latestObservationMonth:instruments.length
        ?instruments.map(x=>x.latestDate).sort().at(-1)??null:null,
      tracked:COMMODITY_CATALOG.length,available:instruments.length,
      unavailableIds,instruments,
      disclaimer:'Published monthly IMF benchmark averages via FRED, not live stock-exchange quotes, futures contracts, farmgate prices, or supplier offers. MoM and YoY changes compare published monthly observations. USD/t and QAR/t are standardized for comparison at QCB parity 3.64; duties, quality, shipping and transaction spreads are excluded. Source licensing and attribution apply.',
    }
    cached={until:Date.now()+(instruments.length?21600000:300000),result}
    return result
  })()
  try{return await pending}finally{pending=null}
}
