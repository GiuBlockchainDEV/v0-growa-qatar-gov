/**
 * Keyless, source-attributed global food security information.
 * FAO GIEWS is a periodic COUNTRY LIST, NOT an IPC country classification.
 * FEWS NET entries are publicly published REPORTS, NOT confirmed incidents.
 */
export type PublicFoodReport={
  id:string
  title:string
  publishedAt:string
  url:string
  source:'FEWS NET'
}
export type PublicFoodSnapshot={
  source:'FAO GIEWS + FEWS NET'
  checkedAt:string
  fao:{state:'available'|'unavailable';countryCount:number|null;edition:string|null;
    url:string;detail:string}
  fews:{state:'available'|'partial'|'unavailable';reports:PublicFoodReport[];
    checkedFeeds:number;detail:string;url:string}
}
const FAO_URL='https://www.fao.org/giews/country-analysis/external-assistance/en/'
const FEWS_URL='https://fews.net/feeds'
const FEWS_FEEDS=['https://fews.net/taxonomy/term/44/feed',
  'https://fews.net/taxonomy/term/5/feed'] as const
function clean(s:string,max=180){
  return s.replace(/<\/?[^>]+>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/gi,m=>
    ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[m.toLowerCase()]??''))
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff)))
    .replace(/\s+/g,' ').trim().slice(0,max)
}
function tag(item:string,name:string):string{
  const match=item.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'))
  return match?clean(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1'),220):''
}
export function parseFewsRss(xml:string,now=Date.now()):PublicFoodReport[]{
  if(!/<(?:rss|feed|rdf:RDF)\b/i.test(xml))throw Error('Invalid FEWS RSS document')
  const items=[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
  const out:PublicFoodReport[]=[]
  const seen=new Set<string>()
  for(const item of items.slice(0,100)){
    const section=item[1],title=tag(section,'title'),link=tag(section,'link')
    const at=tag(section,'pubDate')||tag(section,'dc:date')||tag(section,'updated')
    const ms=Date.parse(at)
    if(!title||!link||!Number.isFinite(ms)||ms>now+86400000||
      now-ms>210*86400000)continue
    try{
      const url=new URL(link)
      if(!['fews.net','www.fews.net'].includes(url.hostname)||url.protocol!=='https:')continue
      if(seen.has(url.pathname))continue
      seen.add(url.pathname)
      out.push({id:'fews:'+url.pathname,title,publishedAt:new Date(ms).toISOString(),
        url:url.toString(),source:'FEWS NET'})
    }catch{ /* skip unexpected links */ }
  }
  return out
}
export function parseFaoExternalAssistanceHtml(html:string):{
  count:number;edition:string|null
}{
  if(!/external assistance/i.test(html))throw Error('Invalid FAO GIEWS page')
  const plain=clean(html.replace(/<(?:script|style)[\s\S]*?<\/(?:script|style)>/gi,' '),2000000)
  const total=/(?:total\s*:\s*|\(\s*total\s*:\s*)(\d{1,3})\s*countries\b/i.exec(plain)
  if(!total)throw Error('FAO country count not present in live page')
  const count=Number(total[1])
  if(count<=0||count>195)throw Error('FAO country count invalid')
  const offset=total.index
  const prior=plain.slice(Math.max(0,offset-200),offset)
  const date=prior.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/gi)
  return {count,edition:date?.at(-1)??null}
}
async function getText(url:string,maxBytes:number,timeout:number):Promise<string>{
  const response=await fetch(url,{headers:{Accept:'text/html,application/rss+xml,application/xml'},
    signal:AbortSignal.timeout(timeout),next:{revalidate:1800}})
  if(!response.ok)throw Error('HTTP '+response.status)
  const length=Number(response.headers.get('content-length')??0)
  if(length>maxBytes)throw Error('Response too large')
  const body=await response.text()
  if(body.length>maxBytes)throw Error('Response too large')
  return body
}
let cached:{expires:number;value:PublicFoodSnapshot}|null=null
let pending:Promise<PublicFoodSnapshot>|null=null
export async function getPublicFoodSnapshot():Promise<PublicFoodSnapshot>{
  if(cached&&cached.expires>Date.now())return cached.value
  if(pending)return pending
  pending=(async()=>{
    const [fao,...fews]=await Promise.allSettled([
      getText(FAO_URL,1400000,11000),
      ...FEWS_FEEDS.map(url=>getText(url,1000000,9000)),
    ])
    let countryCount:number|null=null,edition:string|null=null
    let faoReason='Source temporarily unavailable'
    if(fao.status==='fulfilled'){
      try{
        const d=parseFaoExternalAssistanceHtml(fao.value)
        countryCount=d.count;edition=d.edition;faoReason='Published country list, not IPC assessments or real-time crises.'
      }catch(error){faoReason=error instanceof Error?error.message:faoReason}
    }else faoReason=fao.reason instanceof Error?fao.reason.message:faoReason
    const reports:PublicFoodReport[]=[],bad:string[]=[]
    let good=0
    fews.forEach((r,i)=>{
      if(r.status==='rejected'){bad.push('Feed '+(i+1)+' unavailable');return}
      try{reports.push(...parseFewsRss(r.value));good++}
      catch{bad.push('Feed '+(i+1)+' invalid')}
    })
    const dedup=[...new Map(reports.map(r=>[r.url,r])).values()]
      .sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,50)
    const state=good===0?'unavailable':dedup.length?'available':'partial'
    const value:PublicFoodSnapshot={
      source:'FAO GIEWS + FEWS NET',checkedAt:new Date().toISOString(),
      fao:{state:countryCount===null?'unavailable':'available',countryCount,
        edition,url:FAO_URL,detail:faoReason.slice(0,160)},
      fews:{state,reports:dedup,checkedFeeds:good,
        detail:good+' of '+FEWS_FEEDS.length+' official RSS feeds accessible. '+
          (bad.length?bad.join('; ')+'. ':'')+'Reports are publications, not verified incident counts.',
        url:FEWS_URL},
    }
    cached={expires:Date.now()+(countryCount!==null||good?30*60000:60000),value}
    return value
  })()
  try{return await pending}finally{pending=null}
}
