'use client'
import {useEffect,useState} from 'react'
import {Activity} from 'lucide-react'
import styles from './commodity-intelligence-cockpit.module.css'

export type PriceEvidence={
 commodity:string
 historicalAnnual:{year:number;qarPerKg:number;qarPerTonne:number;weightTonnes:number;basis:string;sourceUrl:string}[]
 originPrices:{countryCode:string;countryName:string;qarPerTonne:number;weightTonnes:number}[]
 sourceName:string;sourceUrls:string[];sourceYear:number|null
 productScope:string;dataKind:'annual_customs'|'origin_comparison'|'unavailable'
 notes:string[]
}
const fmt=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:0})
export function CommodityImportPrices({commodity}:{commodity:string}){
 const [data,setData]=useState<PriceEvidence|null>(null)
 const [error,setError]=useState(false)
 const [loading,setLoading]=useState(true)
 useEffect(()=>{
  const ctrl=new AbortController()
  let active=true
  setData(null);setError(false);setLoading(true)
  fetch('/api/watchtower/commodity-price-evidence?'+new URLSearchParams({commodity}),{
   signal:ctrl.signal,cache:'no-store',
  }).then(async response=>{
   if(!response.ok)throw Error('Customs source returned '+response.status)
   return response.json() as Promise<PriceEvidence>
  }).then(body=>{if(active)setData(body)})
   .catch(()=>{if(active)setError(true)})
   .finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false;ctrl.abort()}
 },[commodity])
 if(loading)return <div className={styles.noMarket}><Activity size={20}/>
  <strong>Loading historical import evidence…</strong></div>
 if(!data||error)return <div className={styles.noMarket}>
  <strong>Historical import evidence unavailable</strong>
  <span>Data source did not respond. No prices have been fabricated.</span></div>
 const years=data.historicalAnnual
 if(years.length>=2){
  const vals=years.map(x=>x.qarPerTonne)
  const lower=Math.min(...vals),upper=Math.max(...vals),span=Math.max(1,upper-lower)
  const coords=years.map((p,i)=>({
   x:25+i/Math.max(1,years.length-1)*650,
   y:125-(p.qarPerTonne-lower)/span*100,
  }))
  const path=coords.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ')
  return <div className={styles.sparkChart}>
   <div className={styles.priceHeadline}><div>
    <small>QATAR IMPORT UNIT VALUE · ANNUAL HISTORY</small>
    <strong>{fmt(vals[vals.length-1])}<span> QAR/t</span></strong>
    <p>{data.productScope} · {years.at(-1)?.year}</p>
   </div><span>{years.length} observations</span></div>
   <svg role="img" aria-label="Historical annual Qatar customs price observations"
    viewBox="0 0 700 150" preserveAspectRatio="none">
    <path d={path} stroke="var(--growa-cream)" strokeWidth="3"
     fill="none" vectorEffect="non-scaling-stroke"/>
    {coords.map((c,i)=><circle key={years[i].year} cx={c.x} cy={c.y}
     r={5} fill="var(--growa-cream)">
     <title>{years[i].year+': '+fmt(years[i].qarPerTonne)+' QAR/t'}</title>
    </circle>)}
   </svg>
   <div className={styles.chartDates}><span>{years[0].year}</span>
    <span>{years[years.length-1].year}</span></div>
   <p className={styles.priceFoot}>UN Comtrade / WITS · yearly customs unit values. NOT monthly prices or supplier quotations.</p>
  </div>
 }
 if(data.originPrices.length>=2){
  const origins=data.originPrices
  const max=Math.max(...origins.map(p=>p.qarPerTonne),1)
  return <div className={styles.importComparison}>
   <div className={styles.importHeading}><small>HISTORICAL QATAR IMPORT PRICES</small>
    <strong>Origin comparison · {data.sourceYear??'2024'}</strong>
    <p>{data.productScope}</p></div>
   <div className={styles.importRows}>{origins.map(p=><div key={p.countryCode}
    className={styles.importRow}><span title={p.countryName}>{p.countryName}</span>
    <div className={styles.importTrack}><i style={{width:(p.qarPerTonne/max*100)+'%'}}/></div>
    <strong>{fmt(p.qarPerTonne)} QAR/t</strong>
   </div>)}</div>
   <p className={styles.importNote}>One verified annual country breakdown, not a time trend. Historical customs values may include freight. Source: {data.sourceName}.</p>
  </div>
 }
 if(years.length===1)return <div className={styles.importComparison}>
  <div className={styles.importHeading}><small>QATAR HISTORICAL IMPORT REFERENCE</small>
   <strong>{fmt(years[0].qarPerTonne)} QAR/t · {years[0].year}</strong>
   <p>Only one year is verified; a trend cannot be calculated.</p>
  </div></div>
 return <div className={styles.noMarket}><Activity size={20}/>
  <strong>No verified market or customs price comparison</strong>
  <span>No matching observations were returned for this product.</span>
 </div>
}
