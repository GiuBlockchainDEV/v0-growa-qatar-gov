import type {SecurityIntelligence} from './logistics-security'
import type {Mode} from './logistics-screening'
export type ExposureAssessment={index:number|null;label:'critical'|'high'|'elevated'|'limited_evidence'|'unknown';confidence:'partial'|'unavailable';hormuzExposure:boolean;airspaceClosure:'not_verified';hormuzClosure:'not_verified';evidence:string[];sources:string[]}
const gulfOrigin=new Set(['SA','AE','KW','BH','IQ','IR'])
export function crossesHormuz(country:string,mode:Mode){return mode==='sea'&&!gulfOrigin.has(country.toUpperCase())}
export function assessExposure(mode:Mode,country:string,security:SecurityIntelligence,hasGdacs:boolean):ExposureAssessment{
  const {aviation:air,maritime:sea}=security
  const hormuz=crossesHormuz(country,mode),evidence:string[]=[],sources:string[]=[]
  let index:number|null=null
  if(mode==='air'){
    if(air.state==='available'){
      const dest=air.notices.filter(x=>x.countries.includes('QA'))
      const origin=air.notices.filter(x=>x.countries.includes(country))
      const matched=[...new Map([...dest,...origin].map(x=>[x.id,x])).values()]
      index=matched.length?Math.min(100,35+(dest.length?25:0)+(origin.length?20:0)+5*Math.max(0,matched.length-1)):10
      if(matched.length){
        for(const n of matched){
          evidence.push('EASA active advisory: '+n.title+' (to '+n.validUntil+'). Advisory does NOT prove flight closure')
          sources.push(n.url)
        }
      }else evidence.push('No active CZIB matched origin/Qatar: does not confirm any open air corridor')
      sources.push(air.sourceUrl)
    }else evidence.push('EASA airspace feed unavailable: security exposure unknown')
  }else if(mode==='sea'){
    if(hormuz){
      evidence.push('Candidate import route enters Persian Gulf through Strait of Hormuz; not a confirmed carrier track')
      if(sea.state==='available'){
        index=25
        sources.push(sea.sourceUrl)
        if(sea.trafficDropPct!==null){
          index+=Math.min(30,Math.round(sea.trafficDropPct*.3))
          evidence.push('AIS crossing decline '+sea.trafficDropPct+'%: last 24h '+sea.crossings24h+
            ', 30-day daily mean '+(sea.crossings30d!/30).toFixed(1)+'. Jamming can cause undercount')
        }
      }else evidence.push('AIS traffic unavailable/stale, not evidence of normal passage')
      if(sea.incidentsState==='available'){
        index??=25
        const attacks=sea.attackCount30d??0
        index+=Math.min(35,attacks*12+Math.max(0,(sea.incidentCount30d??0)-attacks)*3)
        evidence.push('UKMTO-derived Hormuz incidents, last 30 days: '+sea.incidentCount30d+' (attacks '+attacks+')')
        sources.push(sea.incidentSourceUrl)
      }else evidence.push('Recent incident evidence unavailable; no zero-risk assumption')
    }else{
      evidence.push('Both reference sea ports lie inside Gulf; no compulsory Hormuz transit for this route')
      if(sea.state==='available'){index=15;sources.push(sea.sourceUrl)}
    }
  }else evidence.push('No validated cross-border truck safety feed')
  if(hasGdacs){if(index!==null)index+=10;evidence.push('GDACS orange/red nearby: endpoint alert, not confirmed route interruption')}
  if(index!==null)index=Math.min(100,Math.max(0,Math.round(index)))
  return {index,label:index===null?'unknown':index>=80?'critical':index>=60?'high':index>=35?'elevated':'limited_evidence',
    confidence:index===null?'unavailable':'partial',hormuzExposure:hormuz,
    airspaceClosure:'not_verified',hormuzClosure:'not_verified',evidence,sources:[...new Set(sources)]}
}
