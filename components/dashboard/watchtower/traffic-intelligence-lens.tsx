'use client'
import {useMemo,useState} from 'react'
import {ChevronDown,ChevronUp,RadioTower,Ship,Plane} from 'lucide-react'
import {trafficSectorActivity,type TrafficSectorActivity} from '@/lib/watchtower/traffic-intelligence'
import type {TrackingAsset} from '@/lib/watchtower/global-tracking'
import styles from './global-watchtower.module.css'
export function TrafficIntelligenceLens({assets,now,onFocus}:{
 assets:TrackingAsset[];now:number;onFocus:(sector:TrafficSectorActivity)=>void
}){
 const [expanded,setExpanded]=useState(true)
 const sectors=useMemo(()=>trafficSectorActivity(assets,now),[assets,now])
 return <aside className={styles.situationLens} aria-label="Observed traffic intelligence by maritime corridor">
  <div className={styles.situationHeading}>
   <div className={styles.situationLabel}>
    <RadioTower size={14}/><strong>TRAFFIC INTELLIGENCE</strong>
    <span className={styles.situationMeta}>AIS ≤60 min · moving ≥5.1kn</span>
   </div>
   <button type="button" className={styles.situationToggle} onClick={()=>setExpanded(p=>!p)}
    aria-expanded={expanded} aria-label={expanded?'Collapse traffic intelligence':'Expand traffic intelligence'}>
    {expanded?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
   </button>
  </div>
  {expanded&&<>
   <div className={styles.situationGrid}>
    {sectors.map(area=><button type="button" key={area.id} className={styles.situationCell}
     title={'Focus '+area.name+'. Counts are observed fixes, not verified crossings.'}
     onClick={()=>onFocus(area)}>
     <span className={styles.situationName}>{area.name}</span>
     <span className={styles.situationNumbers}><Ship size={12}/><strong>{area.vessels}</strong><small>vessels</small></span>
     <span className={styles.situationAir}><Plane size={11}/>{area.aircraft} aircraft</span>
    </button>)}
   </div>
   <p className={styles.situationFoot}>Source-aged positions, not verified strait transits. Some monitoring boxes overlap; values cannot be summed. Select an area to focus the map.</p>
  </>}
 </aside>
}