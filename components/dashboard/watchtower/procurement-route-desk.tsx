'use client'
import {useEffect,useMemo,useState} from 'react'
import dynamic from 'next/dynamic'
import {ArrowUpRight,Check,MapPinned,ShieldAlert,Ship,Truck,Plane} from 'lucide-react'
import type {RouteMapOverlay} from '@/lib/nfii/logistics-route-map'
import {mapRouteEvidence,orderRouteAlternatives,routePassages,routeOptionReport,
 type CorridorPayload,type RouteDetail,type RouteSort} from '@/lib/watchtower/procurement-route-evidence'
import styles from './procurement-mission.module.css'

const LogisticsRouteMap=dynamic(
 ()=>import('@/components/dashboard/nfii-ops/logistics-route-map')
  .then(mod=>mod.LogisticsRouteMap),
 {ssr:false,loading:()=> <div className={styles.mapLoading}>Loading geographic map…</div>}
)
export function ProcurementRouteDesk({
 corridors,onConfirm,confirmed,locale,
}:{
 corridors:Readonly<Record<string,CorridorPayload>>
 onConfirm:(routeKeys:string[])=>void
 confirmed:readonly string[]
 locale:'en'|'ar'
}){
 const all=useMemo(()=>Object.entries(corridors).flatMap(([country,result])=>
  mapRouteEvidence(country,result)),[corridors])
 const [sort,setSort]=useState<RouteSort>('exposure')
 const ordered=useMemo(()=>orderRouteAlternatives(all,sort),[all,sort])
 const [focused,setFocused]=useState<string|null>(null)
 const [picks,setPicks]=useState<string[]>([])
 const selected=ordered.find(x=>x.key===focused)??ordered[0]??null
 const stats=routeOptionReport(all)
 const mapped=useMemo(()=>all.flatMap(row=>
  row.overlay?[row.overlay]:[]),[all])
 const choose=(id:string)=>{
  setFocused(id)
  setPicks(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])
 }
 useEffect(()=>{
  setPicks([]);setFocused(null)
 },[corridors])
 const selectedOrigins=new Set(picks.map(k=>all.find(x=>x.key===k)?.country)
  .filter((x):x is string=>Boolean(x)))
 const availableOrigins=new Set(all.map(x=>x.country))
 const ready=availableOrigins.size>0&&
  [...availableOrigins].every(code=>selectedOrigins.has(code))&&
  picks.every(id=>all.some(x=>x.key===id&&x.route.feasibleBeforeDeadline!==false))
 const risk=(row:RouteDetail)=>row.risk.index===null?'N/A':row.risk.index+'/100'
 const duration=(row:RouteDetail)=>row.route.estimatedDays===null?'N/A':
  row.route.estimatedDays.toFixed(1)+' d'
 const cost=(row:RouteDetail)=>row.route.costEstimate?
  row.route.costEstimate.minQar.toLocaleString('en-US')+'–'+
  row.route.costEstimate.maxQar.toLocaleString('en-US')+' QAR':
  'Unavailable'
 const icon=(mode:string)=>mode==='sea'?<Ship size={14}/>:
  mode==='air'?<Plane size={14}/>:<Truck size={14}/>
 const overlaySelected:RouteMapOverlay[]=mapped
 const riskByRoute=useMemo(()=>Object.fromEntries(all.map(x=>[
  x.key,x.risk.band,
 ])) as Record<string,'elevated'|'attention'|'screened'|'unknown'>,[all])
 return <section className={styles.routeDecision} aria-label="Route risk and logistics decision room">
  <header className={styles.heading}>
   <span>LOGISTICS INTELLIGENCE / REAL SOURCE GEOMETRY</span>
   <h4>Routes, risk exposure and every intermediate step</h4>
   <p>The map uses actual provider-returned geometry when available. Dashed air lines
    are geographic references, not scheduled flights. Missing sea geometry remains
    absent rather than drawing a fictional line.</p>
  </header>
  <div className={styles.routeSummary}>
   <div><span>Corridor alternatives</span><strong>{stats.total}</strong></div>
   <div><span>Routes with geometry</span><strong>{stats.mapped}</strong></div>
   <div><span>Unknown risk</span><strong>{stats.unknown}</strong></div>
   <div><span>Index range</span><strong>{stats.lowestExposure===null?'N/A':
    stats.lowestExposure+'–'+stats.highestExposure}</strong></div>
  </div>
  {all.length===0?<p className={styles.warning}>No source-backed corridors available
   for the current supplier shortlist. No routes were invented.</p>:<>
   <div className={styles.routeMap}>
    <LogisticsRouteMap routes={overlaySelected} selectedId={selected?.key??null}
     riskByRoute={riskByRoute} onSelect={id=>setFocused(id)} locale={locale}/>
   </div>
   <div className={styles.riskLegend}>
    <span><i data-risk="screened"/>Lower screened exposure</span>
    <span><i data-risk="attention"/>Review exposure</span>
    <span><i data-risk="elevated"/>Elevated exposure</span>
    <span><i data-risk="unknown"/>No risk evidence</span>
   </div>
   <div className={styles.routeToolbar}>
    <label>Compare routes by
     <select value={sort} onChange={e=>setSort(e.target.value as RouteSort)}>
      <option value="exposure">Lower risk index first</option>
      <option value="eta">Shortest theoretical ETA first</option>
      <option value="freight">Lower freight estimate first</option>
     </select>
    </label>
    <span>Index = exposure indicator, never probability of disruption.</span>
   </div>
   <div className={styles.routeAlternatives}>
    {ordered.map(row=><div key={row.key} className={styles.routeChoice}
     data-focused={selected?.key===row.key} data-risk={row.risk.band}>
     <label><input type="checkbox" checked={picks.includes(row.key)}
      onChange={()=>choose(row.key)} />
      <span>{icon(row.route.mode)}</span>
      <span className={styles.routeChoiceTitle}>
       <strong>{row.country} · {row.route.mode.toUpperCase()}{
        row.route.via?' via '+row.route.via:''}</strong>
       <small>{row.route.from} → {row.route.to}</small>
      </span>
     </label>
     <button type="button" className={styles.routeView}
      onClick={()=>setFocused(row.key)}>
      <MapPinned size={13}/> Inspect map & steps</button>
     <div className={styles.routeChoiceMetrics}>
      <span>Exposure <strong>{risk(row)}</strong></span>
      <span>Time <strong>{duration(row)}</strong></span>
      <span>Freight <strong>{cost(row)}</strong></span>
     </div>
     <p data-risk={row.risk.band}>{row.risk.label} · {
      row.route.quality==='route_api'?'Provider/model geometry':
       'Modeled geographic estimate'}</p>
    </div>)}
   </div>
   {selected&&<div className={styles.routeInspector}>
    <div><strong><ShieldAlert size={15}/> Inspection: {
     selected.country} / {selected.route.mode.toUpperCase()}{selected.route.via?
      ' via '+selected.route.via:''}</strong>
     <p>Risk screening {risk(selected)} · {selected.risk.riskEvidence}</p>
     {selected.route.riskDrivers.map((text,i)=>
      <small key={i}>• {text}</small>)}
     {selected.route.sourceUrl&&<a href={selected.route.sourceUrl}
      target="_blank" rel="noreferrer">Source route reference <ArrowUpRight size={12}/></a>}
    </div>
    <div><strong>Origin → delivery sequence</strong>
     {routePassages(selected.route).map((point,i)=><div key={i}
      className={styles.routePassage} data-certainty={point.certainty}>
      <span>{point.stage}</span><small>{point.detail}</small>
     </div>)}
    </div>
   </div>}
   <div className={styles.gate}>
    <div><strong><Check size={15}/> Logistics scenario checkpoint</strong>
     <p>Select at least one evidenced route per international origin.
      This approves analysis, not freight booking or customs clearance.</p></div>
    <button type="button" className={styles.primary} disabled={!ready}
     onClick={()=>onConfirm(picks)}><Check size={14}/>
     Approve selected logistics alternatives</button>
    {confirmed.length>0&&<span className={styles.muted}>
     {confirmed.length} route selections approved for planning</span>}
   </div>
  </>}
 </section>
}
