import type {UtilitySnapshot,UtilityDomain} from './qatar-utilities'
import {latestPoint,utilityFindings,utilityScenario} from './qatar-utilities'
export interface UtilityNationalAiContext{
 module:'water-intelligence'|'energy-intelligence'
 scope:'qatar-national'
 generatedAt:string
 digest:string
 headline:{
  domain:UtilityDomain;sourceCount:number;availableSources:number;
  metricCount:number;crossDomainAvailable:boolean
 }
 country:UtilitySnapshot
 peer:UtilitySnapshot|null
 analysis:{
  findings:ReturnType<typeof utilityFindings>
  scenario:ReturnType<typeof utilityScenario>
  protocol:string[]
 }
 dataGaps:string[]
}
export function buildUtilityAiContext(
 country:UtilitySnapshot,peer:UtilitySnapshot|null,percent=2,
):UtilityNationalAiContext{
 const findings=utilityFindings(country)
 const scenario=utilityScenario(country,percent)
 const gaps=country.sources.filter(s=>s.status!=='available')
  .map(s=>s.label+': '+s.status+'; '+s.note)
 if(!peer)gaps.push('Other national utility dataset is unavailable')
 const protocol=[
  'Observe: report source URL, exact year and unit of every cited observation.',
  'Diagnose: separate verified annual trend from suggested vulnerability; do not invent probabilities.',
  'Model: hypothetical scenario sensitivity is not predicted realized savings.',
  'Validate: list missing measurements, responsible organizations and confidence limitations.',
  'Separate water production, abstraction, reuse and losses; do not sum incompatible definitions.',
  'Separate electricity generation GWh from peak load MW; final-energy renewable share is not grid renewables.',
  'No infrastructure control commands; do not confuse Growa farm records with Qatar national statistics.',
 ]
 const digest=[
  'QATAR NATIONAL '+country.domain.toUpperCase()+' INTELLIGENCE; NOT LIVE TELEMETRY',
  ...country.sources.map(s=>'Source: '+s.label+' | '+s.status+' | '+s.url+
   ' | latest '+(s.latestYear??'N/A')),
  ...country.series.map(s=>'Indicator '+s.label+': '+
   (latestPoint(s)?latestPoint(s)!.value+' '+s.unit+' ('+latestPoint(s)!.year+')':'N/A')+
   ' | '+s.description+' | '+s.sourceUrl+
   ' | history '+JSON.stringify(s.points.slice(-20))),
  'Cross-resource indicators: '+(peer?
   peer.series.map(s=>s.label+' '+(latestPoint(s)?.value??'N/A')+' '+s.unit+
    ' '+(latestPoint(s)?.year??'N/A')).join('; '):'Unavailable'),
  ...findings.map(s=>'Observed screening '+s.title+': '+s.detail),
  'Scenario is a hypothetical sensitivity, NOT measured savings: '+JSON.stringify(scenario),
  'Evidence gaps: '+gaps.join('; '),
  ...protocol,
 ].join('\n')
 return {
  module:country.domain==='water'?'water-intelligence':'energy-intelligence',
  scope:'qatar-national',generatedAt:country.generatedAt,digest:digest.slice(0,36000),
  headline:{domain:country.domain,sourceCount:country.sources.length,
   availableSources:country.sources.filter(s=>s.status==='available').length,
   metricCount:country.series.length,crossDomainAvailable:Boolean(peer)},
  country,peer,analysis:{findings,scenario,protocol},dataGaps:gaps,
 }
}
