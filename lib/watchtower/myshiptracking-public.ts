/**
 * Optional, HTML-only MyShipTracking GCC observation adapter.
 *
 * Replicates the public-page discovery technique of the user's Python script
 * WITHOUT browser fingerprint spoofing, anti-bot bypasses, proxy rotation,
 * unauthorized internal endpoints, or pretending to have an API subscription.
 *
 * Use only where the operator has permission to collect and display this data.
 * The provider's website terms restrict reproduction and redistribution.
 * If a site refuses automated requests, fail closed and show unavailable.
 */
import {coordinate,epoch,mergeAssets,type TrackingAsset} from './global-tracking'
import {knownPort,type RouteItinerary,type RouteEndpoint} from './itinerary-sources'
import {withModeledSeaLegs} from './itinerary-sea'
import {GCC_PORTS,GCC_RADAR_INTERVAL_MS,
  type GccHubId,type GccHubReport,type GccRadarSnapshot} from './myshiptracking-gcc-shared'

export const GCC_PUBLIC_PORTS=[
  {id:'AEJEA' as const,url:'https://www.myshiptracking.com/ports/port-of-jebel-ali-in-ae-uae-id-228'},
  {id:'QADOH' as const,url:'https://www.myshiptracking.com/ports/port-of-doha-in-qa-qatar-id-5833'},
  {id:'QARLF' as const,url:'https://www.myshiptracking.com/ports/port-of-ras-laffan-in-qa-qatar-id-5836'},
] as const
export type PublicVesselCandidate={
  hubId:GccHubId;name:string;url:string;event:'ARRIVAL'|'DEPARTURE'|'UNCONFIRMED'
}
const clean=(value:string)=>value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
  .replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ')
  .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/&#(\d+);/g,(_,n:string)=>String.fromCodePoint(Math.min(Number(n),0x10ffff)))
  .replace(/\s+/g,' ').trim()
const safe=(value:string,max=100)=>clean(value).slice(0,max)
const cap=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value))
const nm=(v:unknown):number|null=>{
  const n=typeof v==='number'?v:typeof v==='string'&&v.trim()?Number(v):NaN
  return Number.isFinite(n)?n:null
}
const port=(code:string)=>{
  const local=GCC_PORTS.find(p=>p.id===code)
  if(local)return {name:local.label,code:local.unloco,country:local.id.slice(0,2),
    lat:local.lat,lon:local.lon} as RouteEndpoint
  return knownPort(code)
}
type PublicPosition={lat:number;lon:number;received:string;timestampBasis:'position_report'|'webpage_capture'}
/**
 * The Python reference extracts latitude and longitude from JavaScript
 * variables independently. The previous web adapter required a date in the
 * SAME JSON object, silently rejecting real vessel-page coordinate pairs.
 *
 * When a page exposes coordinates but not their AIS fix time, expose the
 * position with UNVERIFIED freshness (never call it a live observation).
 * Do not use page load time as a claimed timestamp of the ship's transmission.
 */
function htmlPosition(html:string,now=Date.now()):PublicPosition|null{
  const text=clean(html)
  const narrative=text.match(
    /\bcoordinates\s+(-?\d{1,2}\.\d{3,8})\s*°?\s*\/\s*(-?\d{1,3}\.\d{3,8})\s*°?\s+as\s+reported\s+on\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/i)
  if(narrative){
    const point=coordinate(narrative[1],narrative[2])
    const stamp=epoch(narrative[3].replace(' ','T')+'Z')
    if(point&&stamp!==null&&stamp<=now+60000)
      return {...point,received:new Date(stamp).toISOString(),timestampBasis:'position_report'}
  }
  // Look first for dated JSON-style fix records. Nearby lat/lon pairs may
  // come from a map centre, so ignore isolated single coordinate values.
  for(const match of html.matchAll(/["']?(?:lat|latitude)["']?\s*[:=]\s*["']?(-?\d{1,2}\.\d{3,8})/gi)){
    const index=match.index??0
    const window=html.slice(index,Math.min(html.length,index+900))
    const lon=window.match(/["']?(?:lng|lon|long|longitude)["']?\s*[:=]\s*["']?(-?\d{1,3}\.\d{3,8})/i)
    if(!lon)continue
    const point=coordinate(match[1],lon[1])
    if(!point)continue
    const t=window.match(/["']?(?:last_seen|timestamp|received|position_time)["']?\s*[:=]\s*["']([^"']{10,40})["']/i)
    const ts=t?epoch(t[1]):null
    if(ts!==null&&ts<=now+60000&&now-ts<=30*86400000)
      return {...point,received:new Date(ts).toISOString(),timestampBasis:'position_report'}
    // Current PHP/JS pages can publish the same position without a
    // timestamp key. This is a captured page position, freshness unknown.
    return {...point,received:new Date(now).toISOString(),timestampBasis:'webpage_capture'}
  }
  return null
}

function shipType(html:string):string{
  const pageTitle=html.match(/<title[^>]*>([\s\S]{0,250}?)<\/title>/i)?.[1]??''
  const heading=html.match(/<h2\b[^>]*>([\s\S]{0,200}?)<\/h2>/i)?.[1]??''
  const title=safe(pageTitle)
  const dash=title.match(/\s-\s([^()]+?)\s*\(IMO\s*:/i)?.[1]
  // Heading may only contain a vessel name, not its AIS ship class.
  const body=clean(html)
  const reported=body.match(/(?:Ship Type|Vessel Type|Type)\s*:?\s*(Bulk Carrier|Container Ship|General Cargo|Cargo Ship|Reefer|Ro-Ro|Oil Tanker|LNG Tanker)/i)
  return safe(dash||reported?.[1]||heading,70)
}
export function isPublicCargoType(value:string):boolean{
  const v=value.toLowerCase()
  if(/tanker|chemical|oil|lng|lpg|gas carrier|passenger|tug|fishing|patrol|yacht|dredg|pilot|offshore/.test(v))return false
  return /bulk carrier|bulker|container|general cargo|cargo|reefer|refrigerated|ro.ro|vehicle carrier|freight|multipurpose/.test(v)
}
export function parsePublicPortCandidates(html:string,hubId:GccHubId,limit=12):PublicVesselCandidate[]{
  const out:PublicVesselCandidate[]=[]
  const seen=new Set<string>()
  // Public port pages often contain OTHER tables before the vessel list.
  // Inspect links directly, not only <tr> elements or the first table.
  const links=html.matchAll(
    /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
  for(const link of links){
    const href=link[1]
    let url:URL
    try{url=new URL(href,'https://www.myshiptracking.com')}catch{continue}
    if(url.protocol!=='https:'||url.hostname!=='www.myshiptracking.com'||
      !/^\/vessels\/[a-z0-9_-]+$/i.test(url.pathname))continue
    if(seen.has(url.pathname))continue
    const name=safe(link[2],90)
    if(name.length<2)continue
    seen.add(url.pathname)
    // Use the surrounding row ONLY to identify explicit arrival/departure
    // events. "Expected Arrivals" as a section does not prove an arrival.
    const position=link.index??0
    const rowOpen=html.lastIndexOf('<tr',position)
    const rowEnd=html.indexOf('</tr>',position)
    const row=rowOpen>=0&&rowEnd>=0&&position-rowOpen<3000&&
      rowEnd-position<3000?clean(html.slice(rowOpen,rowEnd+5)).toUpperCase():''
    const event:PublicVesselCandidate['event']=/\b(DEPARTURE|DEPARTED)\b/.test(row)?
      'DEPARTURE':/\b(ARRIVAL|ARRIVED)\b/.test(row)?'ARRIVAL':'UNCONFIRMED'
    out.push({hubId,name,url:url.origin+url.pathname,event})
    if(out.length>=cap(limit,1,48))break
  }
  return out
}
function portName(raw:string):RouteEndpoint|null{
  const name=safe(raw,85)
  if(!name||/^(?:UNKNOWN PORT|---|N\/A|HIGH SEAS|NOT AVAILABLE)$/i.test(name))return null
  const resolved=knownPort(name)||port(name.replace(/\s+/g,'').toUpperCase())
  return resolved??{name,code:null,country:null,lat:null,lon:null}
}
function annotatedPort(html:string,field:'origin'|'destination'):RouteEndpoint|null{
  const keys=field==='origin'?
    ['last_port','departure_port','origin']:
    ['next_port','destination','dest']
  for(const key of keys){
    const match=html.match(new RegExp('["\\\']?'+key+'["\\\']?\\s*[:=]\\s*["\\\']([^"\\\']{2,90})["\\\']','i'))
    if(match)return portName(match[1])
  }
  // In the displayed Current Trip the first linked port is the previous stop
  // and the second may be the reported destination; if missing leave null.
  const section=html.split(/Current Trip/i)[1]?.split(/Current Position|Last Port Calls/i)[0]
  if(section){
    const found=[...section.matchAll(/<a\b[^>]*href=["'][^"']*\/ports\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(x=>portName(x[1])).filter((x):x is RouteEndpoint=>Boolean(x))
    if(field==='origin'&&found.length>=1)return found[0]
    if(field==='destination'&&found.length>=2)return found[1]
  }
  return null
}
export function parsePublicVessel(html:string,candidate:PublicVesselCandidate,now=Date.now()):
  TrackingAsset|null{
  if(html.length>1000000||html.length<50)return null
  const m=candidate.url.match(/-mmsi-(\d{9})(?:-|$)/i)
  const mmsi=m?.[1]??clean(html).match(/\bMMSI\s*:?\s*(\d{9})\b/i)?.[1]
  if(!mmsi||!(/^[1-9]\d{8}$/.test(mmsi)))return null
  const kind=shipType(html)
  if(!isPublicCargoType(kind))return null
  const point=htmlPosition(html,now)
  if(!point)return null
  const age=now-Date.parse(point.received)
  if(age< -60000||age>30*86400000)return null
  const text=clean(html)
  // Public pages place navigational values in different sections.
  // Missing speed must NOT erase an otherwise source-observed cargo ship.
  // Avoid AVG Speed / MAX Speed from the trip summary: those aren't SOG.
  const positionText=text.split(/Current Position/i)[1]?.split(/\b(?:Information|Weather|Last Port Calls|Info)\b/i)[0]??''
  const speedMatch=html.match(/\b["']?speed["']?\s*[:=]\s*["']?(\d{1,2}(?:\.\d+)?)/i)
    ??text.match(/\bcurrent speed (?:is|:)\s*(\d{1,2}(?:\.\d+)?)\s*(?:knots|kn)\b/i)
    ??text.match(/\bSOG\s*:?\s*(\d{1,2}(?:\.\d+)?)\s*(?:knots|kn)\b/i)
    ??positionText.match(/\bSpeed\s*:?\s*(\d{1,2}(?:\.\d+)?)\s*(?:knots|kn|kts)\b/i)
  const rawSpeed=speedMatch?nm(speedMatch[1]):null
  const speed=rawSpeed!==null&&rawSpeed>=0&&rawSpeed<=55?rawSpeed:null
  const course=text.match(/\b(?:Course|COG)\s*:?\s*(\d{1,3}(?:\.\d+)?)\s*°?/i)
  const heading=course?nm(course[1]):null
  const call=candidate.event
  const reportedOrigin=annotatedPort(html,'origin')
  const reportedDestination=annotatedPort(html,'destination')
  const local=port(candidate.hubId)
  const origin=reportedOrigin??(call==='DEPARTURE'?local:null)
  const destination=reportedDestination??(call==='ARRIVAL'?local:null)
  // A vessel may call at the same port more than once; suppress the
  // nonsensical loop line, but retain its observed position marker.
  const samePort=Boolean(origin?.code&&destination?.code&&origin.code===destination.code)
  const itinerary:RouteItinerary|null=!samePort&&(origin||destination)?{
    origin,destination,
    departureAt:null,etaAt:null,source:'myshiptracking_public',
    sourceUrl:candidate.url,confidence:'crew_reported',
    description:'Public vessel-page last-port and declared destination. '+
      'Unverified free-text origin/destination may lack coordinates; '+
      'previous port is not proof of cargo loading. Any modeled ocean path '+
      'is a reference and not a measured AIS trajectory.',
  }:null
  return {
    id:'sea:'+mmsi,kind:'vessel',label:candidate.name,
    lat:point.lat,lon:point.lon,
    heading:heading!==null&&heading>=0&&heading<360?heading:null,
    speedKnots:speed,altitudeFt:null,observedAt:point.received,
    source:'MyShipTracking public website',sourceUrl:candidate.url,
    type:kind,cargo:'ais_cargo_class',destination:destination?.name??null,
    foodCargoVerified:false,hubId:candidate.hubId,
    observationBasis:point.timestampBasis,itinerary,
  }
}
export const publicScrapeEnabled=()=>process.env.WATCHTOWER_MST_SCRAPE_ENABLED==='true'
export function isPublicScrapeAllowed(orgId:string){
  const allow=(process.env.WATCHTOWER_MST_ALLOWED_ORG_IDS??'').split(',')
    .map(x=>x.trim().toLowerCase()).filter(Boolean)
  return allow.includes(orgId.toLowerCase())
}
const limit=()=>{
  const v=Number(process.env.WATCHTOWER_MST_MAX_SHIPS_PER_HUB??'4')
  return Number.isInteger(v)?cap(v,1,12):4
}
const baseHeaders={Accept:'text/html,application/xhtml+xml',
  // Identify our client; we deliberately do not spoof human browsers.
  'User-Agent':'Growa-NFII-Research/1.0 (+https://growa.ai)'}
async function getHtml(url:string,timeout=9000):Promise<string>{
  const u=new URL(url)
  if(u.protocol!=='https:'||u.hostname!=='www.myshiptracking.com')throw Error('Invalid source URL')
  const controller=AbortSignal.timeout(timeout)
  const response=await fetch(url,{
    headers:baseHeaders,signal:controller,redirect:'error',cache:'no-store',
  })
  if(response.status===403||response.status===429)
    throw Error('MyShipTracking does not permit this automated request')
  if(!response.ok)throw Error('MyShipTracking public website returned '+response.status)
  const length=Number(response.headers.get('content-length')??0)
  if(length>1000000)throw Error('Page too large')
  const html=await response.text()
  if(html.length>1000000)throw Error('Page too large')
  if(/captcha|access denied|checking your browser|cloudflare challenge/i.test(html.slice(0,3000)))
    throw Error('Website access challenge: automated collection stopped')
  return html
}
const cachedPages=new Map<string,{until:number;html:string}>()
async function page(url:string,ttlMs:number):Promise<string>{
  const saved=cachedPages.get(url)
  if(saved&&saved.until>Date.now())return saved.html
  const html=await getHtml(url)
  cachedPages.set(url,{html,until:Date.now()+ttlMs})
  while(cachedPages.size>120)cachedPages.delete(cachedPages.keys().next().value!)
  return html
}
function empty(status:'not_configured'|'unavailable',detail:string):GccRadarSnapshot{
  const max=limit()
  return {
    source:'MyShipTracking public pages',generatedAt:new Date().toISOString(),
    refreshSeconds:300,status,configured:status!=='not_configured',
    hubs:GCC_PORTS.map(h=>({id:h.id,label:h.label,status,
      candidates:0,observed:0,withRoutes:0,sourceUrl:'https://www.myshiptracking.com/',
      detail})),assets:[],sourceUrl:'https://www.myshiptracking.com/',
    checked:0,moving:0,withRoutes:0,maxShipsPerHub:max,creditsCharged:null,
    sourceNote:detail,
  }
}
let cached:{until:number;result:GccRadarSnapshot}|null=null
let pending:Promise<GccRadarSnapshot>|null=null
/**
 * Five-minute on-demand scanner, with small per-website resource limits.
 * No scheduled crawler, automatic retries after 403, or browser bot evasion.
 */
export async function getPublicGccRadarSnapshot():Promise<GccRadarSnapshot>{
  if(!publicScrapeEnabled())return empty('not_configured',
    'Website collection requires explicit opt-in and permission to reuse source data.')
  if(cached&&cached.until>Date.now())return cached.result
  if(pending)return pending
  pending=(async()=>{
    const max=limit(),checkedAt=new Date().toISOString()
    const hubCalls=await Promise.allSettled(GCC_PUBLIC_PORTS.map(async p=>{
      const candidates=parsePublicPortCandidates(await page(p.url,300000),p.id,max)
      return {hub:p,candidates}
    }))
    const all=hubCalls.flatMap(r=>r.status==='fulfilled'?r.value.candidates:[])
    const unique=new Map<string,PublicVesselCandidate>()
    for(const candidate of all)if(!unique.has(candidate.url))unique.set(candidate.url,candidate)
    // Distribute candidates among ports; the old first-12 slice exhausted
    // its budget in Jebel Ali and never inspected Qatar.
    const byHub=GCC_PUBLIC_PORTS.map(h=>
      [...unique.values()].filter(candidate=>candidate.hubId===h.id))
    const toInspect:PublicVesselCandidate[]=[]
    const perHub=Math.min(max,8)
    for(let index=0;index<perHub;index++){
      for(const candidates of byHub){
        const candidate=candidates[index]
        if(candidate&&toInspect.length<24)toInspect.push(candidate)
      }
    }
    const found:TrackingAsset[]=[]
    let rejected=0,blocked=0,failed=0
    // bounded concurrency; this is an ordinary public HTML fetch, not Selenium.
    for(let i=0;i<toInspect.length;i+=8){
      const chunk=toInspect.slice(i,i+8)
      const response=await Promise.allSettled(chunk.map(async c=>
        parsePublicVessel(await page(c.url,300000),c)))
      for(const entry of response){
        if(entry.status==='fulfilled'&&entry.value)found.push(entry.value)
        else if(entry.status==='fulfilled')rejected++
        else{
          failed++
          if(/403|429|challenge|not permit|denied/i.test(String(entry.reason)))blocked++
        }
      }
    }
    let assets=mergeAssets(found).slice(0,48)
    // Strictly server-side Node.js ocean-network geometry, never a
    // historical AIS trail. Unresolved port names yield no future path.
    let routes=0
    assets=assets.map(asset=>{
      const i=asset.itinerary
      if(!i||i.origin?.lat==null||i.origin.lon==null||
        i.destination?.lat==null||i.destination.lon==null||routes>=12)return asset
      routes++
      return {...asset,itinerary:withModeledSeaLegs(i,asset)}
    })
    const reports:GccHubReport[]=GCC_PORTS.map(h=>{
      const response=hubCalls.find(r=>r.status==='fulfilled'&&r.value.hub.id===h.id)
      const defined=GCC_PUBLIC_PORTS.some(x=>x.id===h.id)
      const candidateCount=response?.status==='fulfilled'?response.value.candidates.length:0
      const here=assets.filter(a=>a.hubId===h.id)
      return {id:h.id,label:h.label,status:!defined?'not_configured':
        response?'partial':'unavailable',
        candidates:candidateCount,observed:here.length,
        withRoutes:here.filter(a=>a.itinerary?.modelSeaLegs).length,
        sourceUrl:response?.status==='fulfilled'?response.value.hub.url:
          'https://www.myshiptracking.com/',
        detail:!defined?'No verified public port page for this hub.':
          response?'HTML links found: '+candidateCount+
            '; observed cargo positions: '+here.length+
            '. Missing speed does not exclude a ship; missing coordinates, dated fixes, or recognized cargo type still do.':
          'Port HTML could not be retrieved; check website permissions, URL, and server access.',
      }
    })
    const successes=hubCalls.filter(r=>r.status==='fulfilled').length
    const reasons=hubCalls.filter(r=>r.status==='rejected')
      .map((r,i)=>'port fetch failed '+i+': '+
        (/403|429|challenge|denied/i.test(String((r as PromiseRejectedResult).reason))
          ?'provider refused automated access':'network or HTML unavailable'))
    const result:GccRadarSnapshot={
      generatedAt:checkedAt,refreshSeconds:300,source:'MyShipTracking public pages',
      status:successes===0?'unavailable':'partial',configured:true,
      hubs:reports,assets,sourceUrl:'https://www.myshiptracking.com/',
      checked:toInspect.length,moving:assets.length,
      withRoutes:assets.filter(a=>a.itinerary?.modelSeaLegs).length,
      maxShipsPerHub:max,creditsCharged:null,
      sourceNote:'Public pages: '+successes+'/'+GCC_PUBLIC_PORTS.length+
        ' fetched; '+all.length+' candidate links; '+toInspect.length+
        ' vessel pages requested; '+found.length+' valid cargo fixes; '+
        rejected+' incomplete/non-cargo; '+failed+' page failures ('+blocked+
        ' blocked). '+reasons.join('; ')+'. '+
        '5-minute refresh means polling cadence only. Actual last-position timestamp is preserved. '+
        'Website data rights and permitted use must be confirmed before enabling. '+
        'Routes are model references, not actual AIS sailed tracks.',
    }
    cached={result,until:Date.now()+(successes?GCC_RADAR_INTERVAL_MS:60000)}
    return result
  })()
  try{return await pending}finally{pending=null}
}
