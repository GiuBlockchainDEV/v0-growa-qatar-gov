'use client'
import {useEffect,useMemo,useState} from 'react'
import {
 Activity,ArrowUpRight,BarChart3,ChartNoAxesCombined,CloudSun,
 Database,ExternalLink,Globe2,Leaf,RefreshCw,ShieldCheck,
 Sprout,TrendingUp,Warehouse,Droplets,Landmark,
} from 'lucide-react'
import type {
 QatarCountrySnapshot,IndicatorSeries,CropProduction,SelfSufficiency,
} from '@/lib/analytics/qatar-country'
import {sumLatestProduction,farmsByMunicipality,sourceCoverage,latestYear,
 WORLD_BANK_INDICATORS,DATASET_URL} from '@/lib/analytics/qatar-country'
import type {CommodityMarketsSnapshot,MarketInstrument} from '@/lib/watchtower/commodity-markets'
import styles from './qatar-country-command.module.css'

type Scope={producers:number;crops:number;tonnes:number;waterM3:number;energyKwh:number;polygons:number}
type Section='overview'|'agriculture'|'trade'|'sources'
type View='production'|'self-sufficiency'|'farms'
const fmt=(n:number|null|undefined,digits=0)=>{
 if(n===null||n===undefined||!Number.isFinite(n))return 'N/A'
 return n.toLocaleString('en-US',{maximumFractionDigits:digits})
}
const signed=(n:number|null|undefined)=>
 n===null||n===undefined?'N/A':(n>0?'+':'')+fmt(n,1)+'%'
const resolveIndicator=(data:QatarCountrySnapshot|null,key:keyof typeof WORLD_BANK_INDICATORS)=>
 data?.indicators.find(s=>s.key===key)??null
const toDate=(iso:string)=>Number.isFinite(Date.parse(iso))?
 new Date(iso).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Qatar'}):'Unknown'
const numberLine=(year:number|null,detail:string)=>year===null?'No published observation':
 detail+' · '+year

/** A chart that renders real annual points ONLY. All years on the x-axis
 * correspond to distinct recorded observations. Missing years stay gaps.
 */
function AnnualTrend({series}:{series:IndicatorSeries|null}){
 if(!series||series.history.length<2)return <p className={styles.chartEmpty}>
  At least two source observations are needed for a trend.
 </p>
 const points=series.history.slice(-15)
 const width=560,height=165,minX=24,maxX=width-18,minY=20,maxY=height-24
 const lo=Math.min(...points.map(p=>p.value)),hi=Math.max(...points.map(p=>p.value))
 const y=(v:number)=>maxY-(v-lo)/Math.max(hi-lo,.01)*(maxY-minY)
 const x=(yr:number)=>minX+(yr-points[0].year)/
  Math.max(1,points[points.length-1].year-points[0].year)*(maxX-minX)
 // Do not connect missing calendar years as if continuous observations existed.
 const groups:typeof points[]=[]
 let segment:typeof points=[]
 for(const p of points){
  if(segment.length&&p.year-segment.at(-1)!.year>1){groups.push(segment);segment=[]}
  segment.push(p)
 }
 if(segment.length)groups.push(segment)
 return <div className={styles.annualChart}>
  <svg viewBox={`0 0 ${width} ${height}`} role="img"
   aria-label={series.label+' observed values by year'}>
   {[0,.25,.5,.75,1].map(t=><line key={t} x1={minX} y1={minY+(maxY-minY)*t}
    x2={maxX} y2={minY+(maxY-minY)*t} stroke="currentColor"
    strokeOpacity=".12" strokeDasharray="4 4"/>)}
   {groups.map((group,i)=><polyline key={i}
    points={group.map(p=>x(p.year)+','+y(p.value)).join(' ')}
    stroke="#8eb276" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
    fill="none"/>)}
   {points.map(p=><circle key={p.year} cx={x(p.year)} cy={y(p.value)}
    r="3.5" fill="#8eb276"><title>{p.year}: {fmt(p.value,1)} {series.unit}</title></circle>)}
  </svg>
  <div className={styles.axis}><span>{points[0].year}</span>
   <span>{series.unit}</span><span>{points.at(-1)!.year}</span></div>
 </div>
}
function Bars({rows,max=6,percent=false}:{rows:Array<{name:string;value:number;note?:string}>;max?:number;percent?:boolean}){
 const data=rows.filter(x=>Number.isFinite(x.value)&&x.value>=0).slice(0,max)
 const ceiling=Math.max(...data.map(x=>x.value),1)
 return <div className={styles.bars}>
  {data.map((r,i)=><div className={styles.barRow} key={r.name+i}>
   <div className={styles.barLabel}><strong>{r.name}</strong>
    <span>{fmt(r.value,percent?1:0)}{percent?'%':''}{r.note?' · '+r.note:''}</span></div>
   <div className={styles.barTrack}><div className={styles.barFill}
    style={{width:Math.min(100,r.value/ceiling*100)+'%'}}/></div>
  </div>)}
  {!data.length&&<p className={styles.chartEmpty}>No compatible published records from this source.</p>}
 </div>
}
function MarketSpark({points}:{points:{date:string;priceUsdTonne:number}[]}){
 const r=points.slice(-12)
 if(r.length<2)return <div className={styles.sparkEmpty}>N/A</div>
 const lo=Math.min(...r.map(p=>p.priceUsdTonne)),hi=Math.max(...r.map(p=>p.priceUsdTonne))
 const poly=r.map((p,i)=>[
  3+(i/(r.length-1))*114,
  38-(p.priceUsdTonne-lo)/Math.max(hi-lo,.01)*31
 ].join(',')).join(' ')
 return <svg className={styles.spark} viewBox="0 0 120 45" role="img"
  aria-label={'Published monthly trend '+r[0].date+' to '+r.at(-1)!.date}>
  <polyline points={poly} fill="none" stroke="#779d65" strokeWidth="2.8" strokeLinecap="round"/>
 </svg>
}
function SourceLink({href,children}:{href:string;children:React.ReactNode}){
 return <a href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={12}/></a>
}
export function QatarCountryCommand({growa}:{growa:Scope}){
 const [snapshot,setSnapshot]=useState<QatarCountrySnapshot|null>(null)
 const [market,setMarket]=useState<CommodityMarketsSnapshot|null>(null)
 const [countryError,setCountryError]=useState<string|null>(null)
 const [marketError,setMarketError]=useState<string|null>(null)
 const [countryLoading,setCountryLoading]=useState(true)
 const [marketLoading,setMarketLoading]=useState(true)
 const [reload,setReload]=useState(0)
 const [section,setSection]=useState<Section>('overview')
 const [view,setView]=useState<View>('production')
 const [selectedIndicator,setSelectedIndicator]=useState<keyof typeof WORLD_BANK_INDICATORS>('population')
 useEffect(()=>{
  let active=true
  const controller=new AbortController()
  setCountryLoading(true);setMarketLoading(true)
  setCountryError(null);setMarketError(null)
  const fetchSource=async(url:string,apply:(data:unknown)=>void,setError:(error:string)=>void,done:()=>void)=>{
   try{
    const response=await fetch(url,{cache:'no-store',signal:controller.signal})
    const result=await response.json()
    if(!response.ok)throw Error(
     typeof result?.error==='string'?result.error:'Source HTTP '+response.status)
    if(active)apply(result)
   }catch(error){if(active)setError(error instanceof Error?error.message:'Data unavailable')}
   finally{if(active)done()}
  }
  void fetchSource('/api/analytics/qatar-country',
   d=>setSnapshot(d as QatarCountrySnapshot),setCountryError,()=>setCountryLoading(false))
  void fetchSource('/api/watchtower/commodity-markets',
   d=>setMarket(d as CommodityMarketsSnapshot),setMarketError,()=>setMarketLoading(false))
  return ()=>{active=false;controller.abort()}
 },[reload])
 const year=latestYear(snapshot?.production??[])
 const farmYear=latestYear(snapshot?.farms??[])
 const suffYear=latestYear(snapshot?.sufficiency??[])
 const yearRows=snapshot?.production.filter(r=>r.year===year)??[]
 const production=sumLatestProduction(snapshot?.production??[])
 const farmCities=useMemo(()=>farmYear===null?[]:
  farmsByMunicipality(snapshot?.farms??[],farmYear),[snapshot,farmYear])
 const registeredFarms=farmCities.length?farmCities.reduce((s,c)=>s+c.farms,0):null
 const topCrops=[...yearRows].sort((a,b)=>b.tonnes-a.tonnes).slice(0,10)
 const selfRows=(snapshot?.sufficiency??[]).filter(x=>x.year===suffYear)
 const wbPopulation=resolveIndicator(snapshot,'population')
 const wbImport=resolveIndicator(snapshot,'foodImportShare')
 const wbLand=resolveIndicator(snapshot,'agriculturalLand')
 const wbAgr=resolveIndicator(snapshot,'agricultureGdp')
 const selected=resolveIndicator(snapshot,selectedIndicator)
 const sourceStats=sourceCoverage(snapshot?.sources??[])
 const coverage=(snapshot?.sources??[]).length?sourceStats.present+'/'+sourceStats.total:'0/4'
 const availableMarkets=(market?.instruments??[]).filter(x=>!x.stale)
 const trackedMarkets=(market?.instruments??[]).filter(x=>
  ['wheat','corn','rice','barley','soybeans','poultry','sugar','palm-oil'].includes(x.id))
 const cards=[
  {name:'Population',value:wbPopulation?.latest?fmt(wbPopulation.latest.value):'N/A',
   unit:'residents',foot:numberLine(wbPopulation?.latest?.year??null,'World Bank'),source:wbPopulation?.url},
  {name:'Registered farms',value:fmt(registeredFarms),
   unit:'registered holdings',foot:numberLine(farmYear,'NPC · national farm register'),source:DATASET_URL('farms')},
  {name:'Selected crop production',value:fmt(production.tonnes),
   unit:'tonnes',foot:numberLine(production.year,'NPC · published crop groups'),source:DATASET_URL('production')},
  {name:'Food in merchandise imports',value:wbImport?.latest?fmt(wbImport.latest.value,1)+'%':'N/A',
   unit:'trade value share',foot:numberLine(wbImport?.latest?.year??null,'World Bank · NOT import dependency'),source:wbImport?.url},
 ]
 const sections:{key:Section;label:string}[]=[
  {key:'overview',label:'Country overview'},
  {key:'agriculture',label:'Agricultural capacity'},
  {key:'trade',label:'Trade & market pressure'},
  {key:'sources',label:'Evidence & sources'},
 ]
 const markets=trackedMarkets.slice(0,8)
 return <section className={styles.shell} aria-label="Qatar National Food System Analytics">
  <div className={styles.hero}>
   <div className={styles.glow}/>
   <div className={styles.heroContent}>
    <div className={styles.heroIntro}>
     <span className={styles.eyebrow}><Globe2 size={15}/> GROWA · NATIONAL INTELLIGENCE / QATAR</span>
     <h2>Qatar <em>Food System</em><span> Intelligence</span></h2>
     <p>A country-level view of agricultural production, food self-sufficiency, farm geography, demographics and international commodity exposure, with every metric linked to its actual source.</p>
     <div className={styles.heroSignals}>
      <span><ShieldCheck size={12}/> Official published statistics</span>
      <span><Database size={12}/> {coverage} national sources responding</span>
      <span><Activity size={12}/> {market?.available??'N/A'} commodity benchmarks</span>
     </div>
    </div>
    <div className={styles.dataIntegrity}>
     <div><strong>DATA COVERAGE</strong>
      <button type="button" aria-label="Refresh national analytics"
       disabled={countryLoading||marketLoading} onClick={()=>setReload(x=>x+1)}>
       <RefreshCw size={15} className={countryLoading||marketLoading?'animate-spin':''}/>
      </button></div>
     <strong>{countryLoading?'LOADING':coverage}</strong>
     <p>Official data is annual and not a real-time national inventory. Different metrics may have different reference years.</p>
     {countryError&&<p className={styles.warning}>{countryError}</p>}
    </div>
   </div>
   <div className={styles.kpis}>
    {cards.map(c=><div className={styles.kpi} key={c.name}>
     <small>{c.name}</small><strong>{countryLoading?'…':c.value}</strong>
     <span>{c.unit}</span>
     <p>{c.foot}</p>
     {c.source&&<SourceLink href={c.source}>Source</SourceLink>}
    </div>)}
   </div>
  </div>
  <nav className={styles.sections} aria-label="Country analytics views">
   {sections.map(s=><button type="button" key={s.key}
    aria-pressed={section===s.key} onClick={()=>setSection(s.key)}>{s.label}</button>)}
  </nav>
  {(section==='overview'||section==='agriculture')&&<div className={styles.twoColumns}>
   <article className={styles.card}>
    <div className={styles.cardHead}>
     <div><span className={styles.kicker}><Leaf size={15}/> QATAR AGRICULTURE</span>
      <h3>What the country produces</h3>
      <p>Latest published crop output by product; not a forecast or Growa client estimate.</p></div>
     <span className={styles.year}>{year??'N/A'}</span>
    </div>
    <div className={styles.toggles}>
     {[
      ['production','Production'],['self-sufficiency','Self-sufficiency'],['farms','Farm geography'],
     ].map(([id,label])=><button key={id} type="button" aria-pressed={view===id}
      onClick={()=>setView(id as View)}>{label}</button>)}
    </div>
    {view==='production'&&<>
     <Bars rows={topCrops.map(x=>({name:x.crop,value:x.tonnes,
      note:x.areaHa!==null?fmt(x.areaHa,0)+' ha':'area N/A'}))}/>
     <p className={styles.disclaimer}>Published crop production, not all food production. These output tonnes do not include imported food.</p>
    </>}
    {view==='self-sufficiency'&&<>
     <div className={styles.subhead}>Published product-level self-sufficiency · {suffYear??'N/A'}</div>
     <Bars percent rows={[...selfRows].sort((a,b)=>b.ratioPercent-a.ratioPercent)
      .map(x=>({name:x.product,value:x.ratioPercent}))}/>
     <p className={styles.disclaimer}>The ratio is product-specific; it is not an overall national food security score. This source may lag recent production.</p>
    </>}
    {view==='farms'&&<>
     <div className={styles.subhead}>Registered farms by municipality · {farmYear??'N/A'}</div>
     <Bars rows={farmCities.map(x=>({name:x.name,value:x.farms}))}/>
     <p className={styles.disclaimer}>Registered holdings, not necessarily active farms or Growa-managed sites.</p>
    </>}
    <SourceLink href={view==='production'?DATASET_URL('production'):
     view==='farms'?DATASET_URL('farms'):DATASET_URL('sufficiency')}>
     Qatar Open Data · National Planning Council
    </SourceLink>
   </article>
   <article className={styles.card}>
    <div className={styles.cardHead}>
     <div><span className={styles.kicker}><ChartNoAxesCombined size={15}/> ECONOMIC CONTEXT</span>
      <h3>Structural country indicators</h3>
      <p>Historical annual observations from World Bank datasets.</p></div>
     <span className={styles.year}>{selected?.latest?.year??'N/A'}</span>
    </div>
    <div className={styles.indicatorOptions}>
     {([
      ['population','Population'],['foodImportShare','Food import share'],
      ['agriculturalLand','Agricultural land'],['agricultureGdp','Agri share of GDP'],
     ] as const).map(([id,label])=><button type="button" key={id}
      aria-pressed={selectedIndicator===id} onClick={()=>setSelectedIndicator(id)}>{label}</button>)}
    </div>
    <div className={styles.selectedValue}>
     <strong>{fmt(selected?.latest?.value,
      selectedIndicator==='population'?0:2)}</strong>
     <span>{selected?.unit??'No source value'}</span>
    </div>
    <AnnualTrend series={selected}/>
    <p className={styles.disclaimer}>
     {selectedIndicator==='foodImportShare'?
      'Food imports as a share of merchandise import value; it does not measure the share of food consumed that is imported.':
      'Publication lag varies by indicator. Missing years are not interpolated.'}
    </p>
    {selected&&<SourceLink href={selected.url}>World Bank · {selected.code}</SourceLink>}
   </article>
  </div>}

  {(section==='overview'||section==='trade')&&<div className={styles.tradePanel}>
   <div className={styles.cardHead}>
    <div><span className={styles.kicker}><TrendingUp size={15}/> GLOBAL EXPOSURE</span>
     <h3>Commodity market intelligence</h3>
     <p>Published monthly IMF/FRED price benchmarks converted to QAR per tonne. Not actual Qatar import prices or purchase quotations.</p></div>
    <span className={styles.year}>{market?.latestObservationMonth??'N/A'}</span>
   </div>
   <div className={styles.marketGrid}>
    {markets.map(instrument=><div key={instrument.id} className={styles.marketCard}>
     <div><strong>{instrument.label}</strong><small>{instrument.latestDate}{instrument.stale?' · STALE':''}</small></div>
     <div className={styles.marketStat}>
      <strong>{fmt(instrument.latestQarTonne,0)} <small>QAR/t</small></strong>
      <span data-rise={instrument.change1mPct!==null&&instrument.change1mPct>0?'true':'false'}>
       {signed(instrument.change1mPct)} MoM
      </span>
     </div>
     <MarketSpark points={instrument.points}/>
     <SourceLink href={instrument.sourceUrl}>IMF / FRED</SourceLink>
    </div>)}
   </div>
   {!markets.length&&<p className={styles.chartEmpty}>
    {marketLoading?'Loading published commodity benchmarks…':marketError??
     'No verified commodity benchmarks returned. No prices are simulated.'}
   </p>}
   <p className={styles.disclaimer}>QAR conversion uses the published 3.64 USD/QAR parity; excludes freight, customs, grade, supplier margins and insurance. Monthly benchmarks are not live prices.</p>
  </div>}

  {(section==='overview'||section==='agriculture')&&<div className={styles.growaPanel}>
   <div><span className={styles.kicker}><Sprout size={15}/> GROWA · OPERATIONAL FOOTPRINT</span>
    <h3>Local coverage versus the national picture</h3>
    <p>These records belong to the signed-in Growa workspace. They are not national totals and cannot be used to calculate Qatar-wide market share.</p>
   </div>
   <div className={styles.growaStats}>
    {[
     ['Tracked producers',growa.producers,'sites'],
     ['Tracked crops',growa.crops,'crops'],
     ['Estimated production',growa.tonnes,'t'],
     ['Registered polygons',growa.polygons,'plots'],
     ['Water entered',growa.waterM3,'m³'],
     ['Energy entered',growa.energyKwh,'kWh'],
    ].map(([label,value,unit])=><div key={String(label)}>
     <small>{label}</small><strong>{fmt(value as number)}</strong><span>{unit}</span>
    </div>)}
   </div>
  </div>}
  {section==='sources'&&<div className={styles.sourcePanel}>
   <div className={styles.cardHead}><div>
    <span className={styles.kicker}><Database size={15}/> AUDITABLE EVIDENCE</span>
    <h3>Source register</h3><p>Real endpoint status, record count and last available year for each source.</p>
   </div></div>
   <div className={styles.sourceRows}>
    {(snapshot?.sources??[]).map(s=><div key={s.id}>
     <div><strong>{s.label}</strong><small>{s.note}</small></div>
     <span>{s.status==='available'?'Available':'Unavailable'}</span>
     <span>{s.count} observations</span><span>{s.latestYear??'N/A'}</span>
     <SourceLink href={s.url}>Open source</SourceLink>
    </div>)}
   </div>
   {!snapshot&&<p>{countryLoading?'Checking national data providers…':
    countryError??'No national sources loaded.'}</p>}
  </div>}
  <div className={styles.footer}>
   <span><ShieldCheck size={14}/> Published observations only · source years preserved</span>
   <span><Database size={14}/> {coverage} source groups · Qatar data catalogue + World Bank</span>
   <span>Qatar statistics are not Growa account measurements</span>
  </div>
 </section>
}
