import type {
  HarvestAnalyticsField,HarvestAnalyticsResponse,HarvestMetricKey,
  HarvestMetricSummary,HarvestTimeseriesPoint,
} from './types'

/** Portfolio diagnostics over connected Harvest fields.
 * Neither the catalog nor the modelled TBP represents a national census or
 * a confirmed harvested tonnage. Missing observations are never zero-filled.
 */
export type HarvestCropPortfolio={
  name:string
  fields:number
  areaHa:number
  areaKnown:number
  biomassTonnes:number|null
  biomassSampleCount:number
}
export type HarvestPortfolioSummary={
  fields:HarvestAnalyticsField[]
  fieldCount:number
  distinctCrops:number
  areaHa:number
  areaCoverage:number
  crops:HarvestCropPortfolio[]
  metrics:Partial<Record<HarvestMetricKey,{
    value:number;agg:'sum'|'mean';fieldCount:number;basis:'api-summary'|'complete-field-set'|'sampled-mean'
  }>>
  completeFields:number
  tbpCoverage:number
  aetiCoverage:number
  bwpCoverage:number
  collectingCount:number
  highestDeficit:HarvestAnalyticsField|null
  lowestProductivity:HarvestAnalyticsField|null
  missingFields:HarvestAnalyticsField[]
  schedulePassed:HarvestAnalyticsField[]
  upcoming:HarvestAnalyticsField[]
}
const valid=(value:unknown):value is number=>
  typeof value==='number'&&Number.isFinite(value)
const metric=(field:HarvestAnalyticsField,key:HarvestMetricKey):number|null=>
  valid(field.metrics?.[key])?field.metrics[key]!:null
const metricCount=(fields:HarvestAnalyticsField[],key:HarvestMetricKey)=>
  fields.filter(field=>metric(field,key)!==null).length
const consistentArea=(area:number)=>valid(area)&&area>0?area/10000:0
const parsePlannedDate=(raw:string):number|null=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return null
  const timestamp=Date.parse(raw+'T00:00:00Z')
  return Number.isFinite(timestamp)?timestamp:null
}
export function buildHarvestPortfolio(
  catalogFields:HarvestAnalyticsField[],
  analytics:HarvestAnalyticsResponse|null,
  collectingParcelIds:readonly string[]=[],
  today='2026-11-06',
):HarvestPortfolioSummary{
  // Display the same list as the actionable registry; use analytics as a
  // fallback only if its catalog has not populated.
  const fields=catalogFields.length?catalogFields:analytics?.fields??[]
  const count=fields.length
  const crops=new Map<string,HarvestCropPortfolio>()
  for(const field of fields){
    const name=field.crop?.trim()||'Unspecified crop'
    const group=crops.get(name)??{
      name,fields:0,areaHa:0,areaKnown:0,biomassTonnes:null,biomassSampleCount:0,
    }
    group.fields++
    if(valid(field.area)&&field.area>0){
      group.areaKnown++
      group.areaHa+=consistentArea(field.area)
    }
    const biomass=metric(field,'tbp')
    if(biomass!==null){
      group.biomassTonnes=(group.biomassTonnes??0)+biomass
      group.biomassSampleCount++
    }
    crops.set(name,group)
  }
  const coverage={
    aeti:metricCount(fields,'aeti'),
    tbp:metricCount(fields,'tbp'),
    bwp:metricCount(fields,'bwp'),
  }
  const metrics:HarvestPortfolioSummary['metrics']={}
  for(const key of ['aeti','tbp','bwp','cost'] as const){
    const summary:HarvestMetricSummary|undefined=analytics?.metrics.find(item=>item.key===key)
    if(summary&&valid(summary.value)&&summary.field_count>0){
      metrics[key]={value:summary.value,agg:summary.agg,fieldCount:summary.field_count,basis:'api-summary'}
      continue
    }
    const numbers=fields.map(field=>metric(field,key)).filter((v):v is number=>v!==null)
    if(numbers.length===0)continue
    // Additive total only when every field has a reading; partial totals
    // would overstate completeness. A sampled average is labelled as such.
    if(key==='bwp'){
      metrics[key]={value:numbers.reduce((a,b)=>a+b,0)/numbers.length,agg:'mean',fieldCount:numbers.length,basis:'sampled-mean'}
    }else if(numbers.length===count){
      metrics[key]={value:numbers.reduce((a,b)=>a+b,0),agg:'sum',fieldCount:numbers.length,basis:'complete-field-set'}
    }
  }
  const descending=(key:HarvestMetricKey)=>fields
    .filter(field=>metric(field,key)!==null)
    .sort((a,b)=>metric(b,key)!-metric(a,key)!)
  const productivity=fields.filter(field=>metric(field,'bwp')!==null)
    .sort((a,b)=>metric(a,'bwp')!-metric(b,'bwp')!)
  const todayTimestamp=parsePlannedDate(today)??Number.POSITIVE_INFINITY
  const endDay=todayTimestamp+90*86400000
  const scheduled=fields.map(field=>({field,time:parsePlannedDate(field.harvest_date)}))
  const collecting=new Set(collectingParcelIds)
  return {
    fields,fieldCount:count,distinctCrops:crops.size,
    areaHa:fields.reduce((sum,field)=>sum+consistentArea(field.area),0),
    areaCoverage:fields.filter(field=>valid(field.area)&&field.area>0).length,
    crops:[...crops.values()].sort((a,b)=>b.areaHa-a.areaHa||a.name.localeCompare(b.name)),
    metrics,completeFields:fields.filter(field=>['aeti','tbp','bwp'].every(key=>metric(field,key as HarvestMetricKey)!==null)).length,
    tbpCoverage:coverage.tbp,aetiCoverage:coverage.aeti,bwpCoverage:coverage.bwp,
    collectingCount:fields.filter(field=>collecting.has(field.parcel_id)).length,
    highestDeficit:descending('rwd')[0]??null,
    lowestProductivity:productivity[0]??null,
    missingFields:fields.filter(field=>['aeti','tbp','bwp'].some(key=>metric(field,key as HarvestMetricKey)===null)),
    schedulePassed:scheduled.filter(row=>row.time!==null&&row.time<todayTimestamp)
      .map(row=>row.field).sort((a,b)=>a.harvest_date.localeCompare(b.harvest_date)),
    upcoming:scheduled.filter(row=>row.time!==null&&row.time>=todayTimestamp&&row.time<=endDay)
      .map(row=>row.field).sort((a,b)=>a.harvest_date.localeCompare(b.harvest_date)),
  }
}

export function harvestMetricRank(
 fields:HarvestAnalyticsField[],key:HarvestMetricKey,crop='all',
):{field:HarvestAnalyticsField;value:number}[]{
 const rows=fields.filter(field=>crop==='all'||field.crop===crop)
  .map(field=>({field,value:metric(field,key)}))
  .filter((row):row is {field:HarvestAnalyticsField;value:number}=>row.value!==null)
 rows.sort((a,b)=>key==='bwp'?a.value-b.value:b.value-a.value)
 return rows
}
export function harvestAetiObservations(points:HarvestTimeseriesPoint[]):HarvestTimeseriesPoint[]{
 const byPeriod=new Map<string,HarvestTimeseriesPoint>()
 for(const point of points){
  if(!point||!valid(point.value)||point.value<0||
   !/^\d{4}-\d{2}-\d{2}$/.test(point.period))continue
  byPeriod.set(point.period,point)
 }
 return [...byPeriod.values()].sort((a,b)=>a.period.localeCompare(b.period))
}
