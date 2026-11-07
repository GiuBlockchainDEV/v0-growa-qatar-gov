/**
 * Public USDA AMS Market News report metadata (no login and no API key).
 * Report PDFs cannot be mistaken for a machine-readable cash-price quote.
 * We expose verified issue dates and direct links, NOT parsed/invented prices.
 */
export type UsdaGrainReport={
 id:number
 title:string
 markets:readonly string[]
 reportDate:string|null
 sourceUrl:string
 status:'published'|'unavailable'
 frequency:'daily'
}
export const USDA_REPORTS:readonly {id:number;title:string;markets:readonly string[]}[]=[
 {id:3147,title:'Louisiana and Texas Export Bids',markets:['corn','soybeans','wheat']},
 {id:2850,title:'Iowa Daily Cash Grain Bids',markets:['corn','soybeans']},
 {id:2932,title:'Missouri Daily Grain Bids',markets:['corn','soybeans','wheat']},
 {id:3100,title:'Oklahoma Daily Grain Bids',markets:['corn','wheat','soybeans']},
]
export function parseUsdaLatestRelease(page:string,now=Date.now()):string|null{
 if(page.length>350000||!page.toLowerCase().includes('latest releases'))return null
 const text=page.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
  .replace(/\s+/g,' ')
 const start=text.search(/Latest Releases\s*:/i)
 if(start<0)return null
 const end=text.slice(start,start+500)
 const match=end.match(/\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(20\d{2})\b/)
 if(!match)return null
 const date=match[3]+'-'+match[1].padStart(2,'0')+'-'+match[2].padStart(2,'0')
 const stamp=Date.parse(date+'T00:00:00Z')
 return Number.isFinite(stamp)&&stamp<=now&&stamp>=now-75*86400000?date:null
}
async function getOneReport(report:typeof USDA_REPORTS[number]):Promise<UsdaGrainReport>{
 const sourceUrl='https://mymarketnews.ams.usda.gov/viewReport/'+report.id
 try{
  const response=await fetch(sourceUrl,{
   headers:{Accept:'text/html,application/xhtml+xml'},
   signal:AbortSignal.timeout(7000),next:{revalidate:14400},
  })
  if(!response.ok)throw Error('USDA report unavailable')
  if(Number(response.headers.get('content-length')??0)>350000)
   throw Error('USDA report too large')
  const html=await response.text()
  const reportDate=parseUsdaLatestRelease(html)
  return {...report,sourceUrl,reportDate,
   status:reportDate?'published':'unavailable',frequency:'daily'}
 }catch{return {...report,sourceUrl,reportDate:null,status:'unavailable',frequency:'daily'}}
}
let cache:{until:number;reports:UsdaGrainReport[]}|null=null
let pending:Promise<UsdaGrainReport[]>|null=null
export async function getUsdaPublicReports():Promise<UsdaGrainReport[]>{
 if(cache&&cache.until>Date.now())return cache.reports
 if(pending)return pending
 pending=(async()=>{
  const reports=await Promise.all(USDA_REPORTS.map(getOneReport))
  cache={until:Date.now()+(
   reports.some(item=>item.status==='published')?14400000:600000),reports}
  return reports
 })()
 try{return await pending}finally{pending=null}
}
