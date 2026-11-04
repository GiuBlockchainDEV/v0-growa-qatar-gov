/** Qatar national water/energy statistics. Annual public records are not live telemetry. */
export type UtilityDomain='water'|'energy'
export type MetricPoint={year:number;value:number}
export type UtilitySeries={id:string;label:string;unit:string;description:string;sourceId:string;sourceUrl:string;points:MetricPoint[]}
export type UtilitySource={id:string;label:string;url:string;status:'available'|'unavailable'|'empty';latestYear:number|null;count:number;note:string}
export type UtilitySnapshot={domain:UtilityDomain;scope:'qatar-national';generatedAt:string;sources:UtilitySource[];series:UtilitySeries[]}
export type SourceSpec={id:string;label:string;dataset:string;fields?:Record<string,{label:string;unit:string;description:string;keys:string[]}>;mode?:'water-balance'|'load-factor'}
export const UTILITY_DATASETS:Record<UtilityDomain,readonly SourceSpec[]>={
 water:[
  {id:'water-production',label:'Annual potable water production',dataset:'total-annual-water-production-million-cubic-meters',fields:{
   production_mm3:{label:'Potable water production',unit:'million m³/year',description:'Potable production, primarily desalination and RO, not all national water sources.',keys:['production_mm3']}}},
  {id:'groundwater',label:'Groundwater abstraction',dataset:'total-abstraction-from-ground-water',fields:{
   groundwater_mm3:{label:'Groundwater abstraction',unit:'million m³/year',description:'Water withdrawn, not measured aquifer depletion or recharge.',keys:['ground_water_abstraction_mm3','groundwater_abstraction_mm3','ground_water_abstraction','groundwater_abstraction','abstraction_mm3']}}},
  {id:'water-losses',label:'Water distribution losses',dataset:'water-real-losses-reduction-by-year',fields:{
   losses_pct:{label:'Real network water losses',unit:'%',description:'Measured distribution loss percentage, not total water stress.',keys:['real_losses_percentage']}}},
  {id:'water-balance',label:'Qatar water balance',dataset:'water-production-abstraction-losses-and-uses',mode:'water-balance'},
 ],
 energy:[
  {id:'generation',label:'Electricity generation',dataset:'annual-electricity-generation',fields:{
   generation_gwh:{label:'Electricity generation',unit:'GWh/year',description:'National generation, not final-energy use.',keys:['gigawatt_hours']}}},
  {id:'peak-demand',label:'Peak electricity demand',dataset:'maximum-electricity-demand-by-sector-mw',fields:{
   peak_mw:{label:'System peak demand',unit:'MW',description:'Annual peak power, not annual energy.',keys:['system_maximum_demand']},
   domestic_peak_mw:{label:'Domestic peak demand',unit:'MW',description:'Domestic sector maximum, not necessarily simultaneous with system peak.',keys:['domestic_maximum_demand']},
   industrial_peak_mw:{label:'Industrial peak demand',unit:'MW',description:'Industrial sector maximum, not necessarily simultaneous with system peak.',keys:['industrial_maximum_demand']}}},
  {id:'renewables',label:'SDG 7.2.1 renewable final energy',dataset:'sdg-7-2-1-renewable-energy-share-in-total-final-energy-consumption',fields:{
   renewable_final_energy_pct:{label:'Renewable share of final energy',unit:'%',description:'Final energy across all fuels, not renewable share of electricity generation.',keys:['proportion']}}},
  {id:'load-factor',label:'Electricity load factors',dataset:'annual-load-factors-by-sector',mode:'load-factor'},
 ],
}
export const datasetUrl=(id:string)=>'https://www.data.gov.qa/explore/dataset/'+id+'/'
const record=(x:unknown):Record<string,unknown>|null=>x!==null&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:null
const numeric=(x:unknown):number|null=>{
 const n=typeof x==='number'?x:typeof x==='string'&&x.trim()?Number(x):NaN
 return Number.isFinite(n)?n:null
}
export function resultRows(payload:unknown):Record<string,unknown>[]{
 const root=record(payload),rows=root?.results??root?.records
 if(!Array.isArray(rows))throw Error('Missing source records')
 return rows.map(x=>record(x)?.fields??x).map(record).filter((x):x is Record<string,unknown>=>x!==null)
}
export const yearOf=(x:unknown):number|null=>{
 if(typeof x!=='number'&&typeof x!=='string')return null
 const match=String(x).match(/^\s*(20\d\d)/)
 const y=Number(match?.[1])
 return Number.isInteger(y)&&y<=2100?y:null
}
const balance=[
 ['water_system_input_mm3','Potable system input','system volume input','System input, primarily desalinated, not the country total.'],
 ['water_groundwater_balance_mm3','Groundwater abstraction','total abstraction from groundwater','Withdrawal, not depletion or aquifer level.'],
 ['water_tse_reuse_mm3','Treated sewage reuse','total reuse of treated sewage water','Reused treated water across all purposes.'],
 ['water_agricultural_wells_mm3','Agricultural well abstraction','of which from agricultural wells','Agricultural groundwater extraction.'],
 ['water_tse_agriculture_mm3','Treated water for agriculture','of which for irrigation in agriculture','Treated effluent reused for irrigation.'],
 ['water_real_losses_mm3','Real distribution losses','total real water losses','Water distribution volume lost.'],
] as const
export function parseUtilityDataset(spec:SourceSpec,payload:unknown):UtilitySeries[]{
 const rows=resultRows(payload),out:UtilitySeries[]=[]
 const extract=(id:string,label:string,unit:string,description:string,keys:string[],filter?:(r:Record<string,unknown>)=>boolean)=>{
  const seen=new Map<number,number>()
  for(const row of rows){
   const y=yearOf(row.year)
   if(y===null||filter&&!filter(row))continue
   let v:number|null=null
   for(const key of keys){v=numeric(row[key]);if(v!==null)break}
   if(v===null||v<0||seen.has(y))continue
   seen.set(y,v)
  }
  if(seen.size)out.push({id,label,unit,description,sourceId:spec.id,
   sourceUrl:datasetUrl(spec.dataset),
   points:[...seen].map(([year,value])=>({year,value})).sort((a,b)=>a.year-b.year)})
 }
 if(spec.mode==='water-balance')for(const [id,label,term,desc] of balance)
  extract(id,label,'million m³/year',desc,['value'],r=>
   typeof r.item==='string'&&r.item.trim().toLowerCase().startsWith(term))
 else if(spec.mode==='load-factor')for(const sector of ['System Maximum','Domestic Maximum','Industrial Maximum'])
  extract('load_factor_'+sector.split(' ')[0].toLowerCase(),sector+' load factor',
   '%','Annual grid load factor, with methodology changes possible.',['load_factor'],
   r=>typeof r.demand_type==='string'&&r.demand_type.trim().toLowerCase()===sector.toLowerCase())
 else for(const [id,field] of Object.entries(spec.fields??{}))
  extract(id,field.label,field.unit,field.description,field.keys)
 return out
}
export const findSeries=(s:UtilitySnapshot|null,id:string)=>s?.series.find(x=>x.id===id)??null
export const latestPoint=(s:UtilitySeries|null|undefined)=>s?.points.at(-1)??null
export function yearChange(s:UtilitySeries|null|undefined){
 if(!s||s.points.length<2)return null
 const [a,b]=s.points.slice(-2)
 if(a.value===0||b.year!==a.year+1)return null
 return (b.value-a.value)/a.value*100
}
export type UtilityFinding={id:string;title:string;detail:string;sourceUrl:string|null;year:number|null;priority:'watch'|'info'}
export function utilityFindings(snapshot:UtilitySnapshot|null):UtilityFinding[]{
 if(!snapshot)return [{id:'no-evidence',title:'National records unavailable',detail:'No source-backed country conclusion can be generated.',sourceUrl:null,year:null,priority:'info'}]
 const sourceIds=snapshot.domain==='water'?['groundwater_mm3','losses_pct','production_mm3','water_tse_reuse_mm3']:
  ['generation_gwh','peak_mw','renewable_final_energy_pct','load_factor_system']
 const out:UtilityFinding[]=[]
 for(const id of sourceIds){
  const s=findSeries(snapshot,id),latest=latestPoint(s),change=yearChange(s)
  if(!s||!latest)continue
  const significant=change!==null&&Math.abs(change)>=3
  out.push({id,title:s.label,sourceUrl:s.sourceUrl,year:latest.year,priority:significant?'watch':'info',
   detail:latest.value.toLocaleString('en-US',{maximumFractionDigits:2})+' '+s.unit+' in '+latest.year+
    (change!==null?'; change vs previous year '+(change>0?'+':'')+change.toFixed(1)+'%.':' (annual comparison unavailable).')+
    ' '+s.description})
 }
 return out.length?out:[{id:'no-compatible',title:'Insufficient compatible metrics',detail:'The public datasets did not return compatible source fields. Missing values are not shown as zero.',sourceUrl:null,year:null,priority:'info'}]
}
export function utilityScenario(snapshot:UtilitySnapshot|null,percent:number){
 if(!snapshot||!Number.isFinite(percent))return null
 const pct=Math.max(0,Math.min(10,percent))
 const id=snapshot.domain==='water'?'water_system_input_mm3':'peak_mw'
 const series=findSeries(snapshot,id),point=latestPoint(series)
 if(!point||!series)return null
 return {title:snapshot.domain==='water'?'Illustrative network-loss reduction':'Illustrative peak-shaving target',
  year:point.year,baseline:point.value,unit:series.unit,value:point.value*pct/100,
  sourceUrl:series.sourceUrl,note:snapshot.domain==='water'?
  'Hypothetical percentage-point reduction × annual system input. Not a forecast of achievable savings.':
  'Hypothetical reduction in peak MW; this is not generated energy or GWh saved.'}
}
