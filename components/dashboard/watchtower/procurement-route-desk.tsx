'use client'
import {useMemo,useState} from 'react'
import dynamic from 'next/dynamic'
import {ArrowUpRight,Check,MapPinned,ShieldAlert,Ship,Truck,Plane} from 'lucide-react'
import type {RouteMapOverlay} from '@/lib/nfii/logistics-route-map'
import {
 mapRouteEvidence,orderRouteAlternatives,routePassages,routeOptionReport,
 preferredCorridor,displayFreight,
 type CorridorPayload,type RouteDetail,type RouteSort,
} from '@/lib/watchtower/procurement-route-evidence'
import styles from './procurement-mission.module.css'

const LogisticsRouteMap=dynamic(
 ()=>import('@/components/dashboard/nfii-ops/logistics-route-map')
  .then(mod=>mod.LogisticsRouteMap),
 {ssr:false,loading:()=> <div className={styles.mapLoading}>Loading route map…</div>}
)
const fmt=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:2})
export function ProcurementRouteDesk({
 corridors,onConfirm,onInvalidate,confirmed,locale,
}:{
 corridors:Readonly<Record<string,CorridorPayload>>
 onConfirm:(routeKeys:string[])=>void
 onInvalidate:()=>void
 confirmed:readonly string[]
 locale:'en'|'ar'
}){
 const all=useMemo(()=>Object.entries(corridors).flatMap(([country,result])=>
  mapRouteEvidence(country,result)),[corridors])
 const recommended=useMemo(()=>preferredCorridor(all),[all])
 const [sort,setSort]=useState<RouteSort>('exposure')
 const ordered=useMemo(()=>orderRouteAlternatives(all,sort),[all,sort])
 const [chosenKey,setChosenKey]=useState<string|null>(null)
 const selected=all.find(x=>x.key===chosenKey)??recommended
 const stats=routeOptionReport(all)
 const singleMap:RouteMapOverlay[]=selected?.overlay?[selected.overlay]:[]
 const evaluatedTonnage=(country:string)=>{
  const qty=corridors[country]?.context?.tonnes
  return typeof qty==='number'?qty:0
 }
 const displayCost=(row:RouteDetail)=>displayFreight(
  row.route,evaluatedTonnage(row.country),evaluatedTonnage(row.country))
 const choose=(id:string)=>{
  if(id===selected?.key)return
  setChosenKey(id)
  onInvalidate()
 }
 const approved=confirmed.length===1&&confirmed[0]===selected?.key
 const risk=(row:RouteDetail)=>row.risk.index===null?'N/A':row.risk.index+'/100'
 const eta=(row:RouteDetail)=>row.route.estimatedDays===null?'Unknown':
  fmt(row.route.estimatedDays)+' days'
 const icon=(mode:string)=>mode==='sea'?<Ship size={14}/>:
  mode==='air'?<Plane size={14}/>:<Truck size={14}/>
 const riskByRoute=useMemo(()=>Object.fromEntries(all.map(x=>[
  x.key,x.risk.band,
 ])) as Record<string,'elevated'|'attention'|'screened'|'unknown'>,[all])
 const currentCost=selected?displayCost(selected):null
 return <section className={styles.routeDecision} aria-label="Route risk and logistics decision room">
  <header className={styles.heading}>
   <span>LOGISTICS INTELLIGENCE / ONE PRIMARY ROUTE</span>
   <h4>Select one primary supply route</h4>
   <p>Growa recommends a screened candidate. Inspect other routes individually,
    then approve one primary planning corridor. Other origins remain contingency alternatives,
    not simultaneous bookings.</p>
  </header>
  <div className={styles.routeSummary}>
   <div><span>Alternatives assessed</span><strong>{stats.total}</strong></div>
   <div><span>Routes with geometry</span><strong>{stats.mapped}</strong></div>
   <div><span>Unknown risk</span><strong>{stats.unknown}</strong></div>
   <div><span>Suggested route</span><strong className={styles.routeSummaryName}>
    {recommended?recommended.country+' / '+recommended.route.mode.toUpperCase():'N/A'}</strong></div>
  </div>
  {all.length===0?<p className={styles.warning}>
   No source-backed corridors available. Supplier screening and a firm freight quote are required.
   The strategy can proceed as research, not a booked shipment.
  </p>:<>
   <div className={styles.routeMap}>
    <LogisticsRouteMap routes={singleMap} selectedId={selected?.key??null}
     riskByRoute={riskByRoute} onSelect={id=>choose(id)} locale={locale}/>
    {!singleMap.length&&<p className={styles.warning}>No route geometry was returned for this
     particular option; its origin and destination are not a verified transport line.</p>}
   </div>
   <div className={styles.riskLegend}>
    <span><i data-risk="screened"/>Lower screened exposure</span>
    <span><i data-risk="attention"/>Review exposure</span>
    <span><i data-risk="elevated"/>Elevated exposure</span>
    <span><i data-risk="unknown"/>Risk evidence missing</span>
   </div>
   <div className={styles.routeToolbar}>
    <label>Sort alternative routes by
     <select value={sort} onChange={e=>setSort(e.target.value as RouteSort)}>
      <option value="exposure">Lower risk index first</option>
      <option value="eta">Shortest theoretical ETA first</option>
      <option value="freight">Lower estimated freight first</option>
     </select>
    </label>
    <span>Exposure index ≠ probability. ETA ≠ booked carrier itinerary.</span>
   </div>
   <div className={styles.routeAlternatives}>
    {ordered.map(row=>{
     const price=displayCost(row)
     return <div key={row.key} className={styles.routeChoice}
      data-focused={selected?.key===row.key} data-risk={row.risk.band}>
      <label><input type="radio" name="primary-sourcing-route"
       checked={selected?.key===row.key} onChange={()=>choose(row.key)}/>
       <span>{icon(row.route.mode)}</span>
       <span className={styles.routeChoiceTitle}>
        <strong>{row.country} · {row.route.mode.toUpperCase()}{row.route.via?
         ' via '+row.route.via:''}</strong>
        <small>{row.route.from} → {row.route.to}</small>
       </span>
      </label>
      <button type="button" className={styles.routeView} onClick={()=>choose(row.key)}>
       <MapPinned size={13}/> View route on map</button>
      <div className={styles.routeChoiceMetrics}>
       <span>Risk index <strong>{risk(row)}</strong></span>
       <span>ETA <strong>{eta(row)}</strong></span>
       <span>Estimated freight <strong>{price?
        fmt(price.minQar)+'–'+fmt(price.maxQar)+' QAR':'Not estimable'}</strong></span>
      </div>
      <p>{row.risk.label} · {price?.source??'No usable freight input'}</p>
     </div>
    })}
   </div>
   {selected&&<div className={styles.routeInspector}>
    <div><strong><ShieldAlert size={15}/> Selected route: {selected.country} / {
     selected.route.mode.toUpperCase()}{selected.route.via?' via '+selected.route.via:''}</strong>
     <p>Exposure index: {risk(selected)}. {selected.risk.riskEvidence}</p>
     <strong>Freight cost for {fmt(evaluatedTonnage(selected.country))} tonnes</strong>
     {currentCost?<>
      <p className={styles.freightTotal}>QAR {fmt(currentCost.minQar)}–{
       fmt(currentCost.maxQar)}</p>
      <p>QAR {fmt(currentCost.perTonneMin)}–{fmt(currentCost.perTonneMax)} / tonne</p>
      <small>Source: {currentCost.source}. {currentCost.caveat}.</small>
     </>:<p className={styles.warning}>Cannot estimate with available evidence.
      The selected route may require a new quantity-based screening and carrier quote.</p>}
     {selected.route.riskDrivers.map((message,i)=><small key={i}>• {message}</small>)}
     {selected.route.sourceUrl&&<a href={selected.route.sourceUrl}
      target="_blank" rel="noreferrer">Route data source <ArrowUpRight size={12}/></a>}
    </div>
    <div><strong>Origin → Qatar → warehouse</strong>
     {routePassages(selected.route).map((point,i)=><div key={i}
      className={styles.routePassage} data-certainty={point.certainty}>
      <span>{point.stage}</span><small>{point.detail}</small>
     </div>)}
    </div>
   </div>}
   <div className={styles.gate}>
    <div><strong><Check size={15}/> Logistics approval checkpoint</strong>
     <p>Approve the selected primary corridor only. Commercial rates, customs,
      carrier availability and supplier capacity still require verification.
      {selected?.route.feasibleBeforeDeadline===false?
       ' This route exceeds the requested time window; review explicitly.':''}</p>
    </div>
    <button type="button" className={styles.primary} disabled={!selected||approved}
     onClick={()=>selected&&onConfirm([selected.key])}>
     <Check size={14}/>{approved?'Primary route approved':'Approve selected logistics alternative'}
    </button>
   </div>
  </>}
 </section>
}
