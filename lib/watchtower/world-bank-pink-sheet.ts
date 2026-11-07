/**
 * World Bank Pink Sheet: downloadable monthly price workbook (no API key).
 * XLSX is a ZIP archive of XML. We read only 3 bounded XML members using
 * Node zlib, avoiding any paid service or dependency on spreadsheet binaries.
 * This reader is server-only; do not import it from a client component.
 */
import {inflateRawSync} from 'node:zlib'
import type {MarketDefinition,MarketInstrument} from './commodity-markets'
import {COMMODITY_CATALOG,toMarketInstrument} from './commodity-markets'

export const WORLD_BANK_MONTHLY_URL=
 'https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx'
export const WORLD_BANK_LANDING_URL='https://www.worldbank.org/en/research/commodity-markets'
const MAX_ZIP_BYTES=7_000_000
const MAX_ENTRY_BYTES=18_000_000
const MAX_ROWS=1200
type Entry={name:string;method:number;compressed:number;uncompressed:number;offset:number}

function getZipDirectory(zip:Buffer):Map<string,Entry>{
 if(zip.length<100||zip.length>MAX_ZIP_BYTES)throw Error('World Bank ZIP size invalid')
 let eocd=-1
 for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--){
  if(zip.readUInt32LE(i)===0x06054b50){eocd=i;break}
 }
 if(eocd<0)throw Error('XLSX central directory missing')
 const count=zip.readUInt16LE(eocd+10),offset=zip.readUInt32LE(eocd+16)
 if(count>500||offset>=zip.length)throw Error('XLSX directory invalid')
 const out=new Map<string,Entry>()
 let cursor=offset
 for(let i=0;i<count;i++){
  if(cursor+46>zip.length||zip.readUInt32LE(cursor)!==0x02014b50)throw Error('XLSX entry invalid')
  const nameLength=zip.readUInt16LE(cursor+28)
  const extra=zip.readUInt16LE(cursor+30)
  const comment=zip.readUInt16LE(cursor+32)
  const end=cursor+46+nameLength+extra+comment
  if(end>zip.length)throw Error('XLSX truncated')
  const name=zip.subarray(cursor+46,cursor+46+nameLength).toString('utf8')
  out.set(name,{name,method:zip.readUInt16LE(cursor+10),
   compressed:zip.readUInt32LE(cursor+20),uncompressed:zip.readUInt32LE(cursor+24),
   offset:zip.readUInt32LE(cursor+42)})
  cursor=end
 }
 return out
}
function getEntry(zip:Buffer,entries:Map<string,Entry>,name:string):string{
 const e=entries.get(name)
 if(!e||e.uncompressed>MAX_ENTRY_BYTES||e.compressed>MAX_ZIP_BYTES||
  e.offset+30>zip.length)throw Error('XLSX member unavailable')
 const start=e.offset
 if(zip.readUInt32LE(start)!==0x04034b50)throw Error('Invalid XLSX local header')
 const dataStart=start+30+zip.readUInt16LE(start+26)+zip.readUInt16LE(start+28)
 const end=dataStart+e.compressed
 if(end>zip.length)throw Error('Truncated XLSX member')
 const compressed=zip.subarray(dataStart,end)
 const bytes=e.method===0?compressed:e.method===8?
  inflateRawSync(compressed,{maxOutputLength:MAX_ENTRY_BYTES}):null
 if(!bytes||bytes.length>MAX_ENTRY_BYTES||bytes.length!==e.uncompressed)
  throw Error('XLSX decompression failed')
 return bytes.toString('utf8')
}
const decodeXml=(s:string)=>s.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi,
 (full,number:string|undefined,named:string|undefined)=>{
  if(number){const n=number[0]?.toLowerCase()==='x'?parseInt(number.slice(1),16):Number(number)
   return Number.isFinite(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):''}
  return named==='amp'?'&':named==='lt'?'<':named==='gt'?'>':named==='quot'?'"':named==='apos'?"'":full
 })
function xmlAttr(tag:string,key:string):string|null{
 const escaped=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
 const m=tag.match(new RegExp('(?:\\s|^)'+escaped+'\\s*=\\s*([\\x22\\x27])([^\\x22\\x27]*)\\1'))
 return m?decodeXml(m[2]):null
}
function sharedStrings(xml:string):string[]{
 const result:string[]=[]
 for(const m of xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)){
  let text=''
  for(const t of m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))text+=decodeXml(t[1])
  result.push(text)
 }
 return result
}
function rowCells(row:string,shared:readonly string[]):Map<string,string>{
 const cells=new Map<string,string>()
 for(const m of row.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
  const name=xmlAttr(m[1],'r')?.match(/^[A-Z]+/)?.[0]
  if(!name)continue
  const body=m[2]??''
  const value=body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1]
  const type=xmlAttr(m[1],'t')
  if(type==='s'&&value!==undefined){const idx=Number(value);cells.set(name,shared[idx]??'')}
  else if(type==='inlineStr'){
   const strs=[...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
   cells.set(name,strs.map(s=>decodeXml(s[1])).join(''))
  }else if(value!==undefined)cells.set(name,decodeXml(value))
 }
 return cells
}
function parseXmlRows(sheet:string,shared:readonly string[]):Map<number,Map<string,string>>{
 const output=new Map<number,Map<string,string>>()
 for(const match of sheet.matchAll(/<row\b([^>]*?)>([\s\S]*?)<\/row>/g)){
  const r=Number(xmlAttr(match[1],'r'))
  if(Number.isInteger(r)&&r>=1&&r<=100000){
   output.set(r,rowCells(match[2],shared))
   if(output.size>MAX_ROWS)break
  }
 }
 return output
}
function monthlyWorksheetPath(zip:Buffer,entries:Map<string,Entry>):string{
 const wb=getEntry(zip,entries,'xl/workbook.xml')
 const rels=getEntry(zip,entries,'xl/_rels/workbook.xml.rels')
 let id:string|null=null
 for(const m of wb.matchAll(/<sheet\b[^>]*\/?\s*>/g))
  if(xmlAttr(m[0],'name')==='Monthly Prices'){id=xmlAttr(m[0],'r:id');break}
 if(!id)throw Error('World Bank monthly sheet absent')
 for(const m of rels.matchAll(/<Relationship\b[^>]*\/?\s*>/g)){
  if(xmlAttr(m[0],'Id')!==id)continue
  const target=xmlAttr(m[0],'Target')
  if(!target)break
  const normalised=target.startsWith('/')?target.slice(1):
   'xl/'+target.replace(/^\.\//,'')
  // The target is provider XML, never a filesystem path.
  if(!/^xl\/worksheets\/[a-zA-Z0-9_.-]+\.xml$/.test(normalised))break
  return normalised
 }
 throw Error('World Bank sheet relation invalid')
}
function periodDate(raw:string):string|null{
 const match=raw.trim().match(/^(19\d{2}|20\d{2})M(0[1-9]|1[0-2])$/)
 return match?match[1]+'-'+match[2]+'-01':null
}
const WB_SERIES:Record<string,{codes:readonly string[];benchmark:string}>={
 wheat:{codes:['WHEAT_US_HRW','WHEAT_US_SRW'],benchmark:'US HRW wheat · World Bank'},
 corn:{codes:['MAIZE'],benchmark:'Maize · World Bank'},
 rice:{codes:['RICE_5'],benchmark:'Thai rice 5% broken · World Bank'},
 soybeans:{codes:['SOYBEANS'],benchmark:'Soybeans · World Bank'},
 barley:{codes:['BARLEY'],benchmark:'Barley · World Bank'},
 'palm-oil':{codes:['PALM_OIL'],benchmark:'Palm oil · World Bank'},
 'sunflower-oil':{codes:['SUNFLOWER_OIL'],benchmark:'Sunflower oil · World Bank'},
 beef:{codes:['BEEF'],benchmark:'Beef · World Bank'},
 poultry:{codes:['CHICKEN'],benchmark:'Chicken · World Bank'},
 coffee:{codes:['COFFEE_ARABIC'],benchmark:'Arabica coffee · World Bank'},
 cocoa:{codes:['COCOA'],benchmark:'Cocoa · World Bank'},
 sugar:{codes:['SUGAR_WLD'],benchmark:'Sugar, world · World Bank'},
 cotton:{codes:['COTTON_A_INDX'],benchmark:'Cotton A Index · World Bank'},
 bananas:{codes:['BANANA_US'],benchmark:'Banana US · World Bank'},
}
function unitFactor(unit:string):number|null{
 const normalized=unit.replace(/\s/g,'').toLowerCase()
 if(/^\(?\$\/mt\)?$/.test(normalized)||/^\(?us\$\/mt\)?$/.test(normalized)||
   normalized==='usd/mt'||normalized==='$/tonne'||normalized==='usd/tonne')return 1
 if(normalized==='($/kg)'||normalized==='$/kg'||normalized==='usd/kg')return 1000
 return null
}
export function parseWorldBankMonthlySheet(xml:string,shared:readonly string[],now=Date.now()):
 MarketInstrument[]{
 const rows=parseXmlRows(xml,shared)
 // Official workbook: row 5 contains provider codes; row 6 contains units.
 const names=rows.get(5),units=rows.get(6)
 if(!names||!units)throw Error('Pink Sheet header or units missing')
 const headers=new Map<string,string>()
 for(const [column,value] of names)headers.set(value.trim().toUpperCase(),column)
 const result:MarketInstrument[]=[]
 for(const def of COMMODITY_CATALOG){
  const mapping=WB_SERIES[def.id]
  if(!mapping)continue
  const code=mapping.codes.find(item=>headers.has(item))
  if(!code)continue
  const column=headers.get(code)!
  const factor=unitFactor(units.get(column)??'')
  if(factor===null)continue // Never guess the conversion unit.
  const points:Array<{date:string;nativePrice:number}>=[]
  for(const [row,cells] of rows){
   if(row<=6)continue
   const date=periodDate(cells.get('A')??'')
   if(!date||Date.parse(date+'T00:00:00Z')>now)continue
   const raw=cells.get(column)
   if(raw===undefined||raw.trim()==='')continue
   const value=Number(raw)
   if(!Number.isFinite(value)||value<=0||value>1000000)continue
   points.push({date,nativePrice:value*factor})
  }
  points.sort((a,b)=>a.date.localeCompare(b.date))
  const wbDefinition:MarketDefinition={...def,seriesId:'WB:'+code,
    benchmark:mapping.benchmark,unit:'usd_per_tonne'}
  const converted=toMarketInstrument(wbDefinition,points.slice(-73),now)
  if(converted)result.push({...converted,
    sourceUrl:WORLD_BANK_MONTHLY_URL,
    sourceName:'World Bank Pink Sheet',
  })
 }
 return result
}
export function parseWorldBankXlsx(bytes:Buffer,now=Date.now()):MarketInstrument[]{
 const entries=getZipDirectory(bytes)
 const path=monthlyWorksheetPath(bytes,entries)
 const strings=entries.has('xl/sharedStrings.xml')?
  sharedStrings(getEntry(bytes,entries,'xl/sharedStrings.xml')):[]
 return parseWorldBankMonthlySheet(getEntry(bytes,entries,path),strings,now)
}
let cache:{until:number;instruments:MarketInstrument[]}|null=null
let pending:Promise<MarketInstrument[]>|null=null
export async function getWorldBankMonthly():Promise<MarketInstrument[]>{
 if(cache&&Date.now()<cache.until)return cache.instruments
 if(pending)return pending
 pending=(async()=>{
  try{
   const response=await fetch(WORLD_BANK_MONTHLY_URL,{
    headers:{Accept:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},
    signal:AbortSignal.timeout(14500),next:{revalidate:21600},
   })
   if(!response.ok)throw Error('World Bank unavailable')
   const size=Number(response.headers.get('content-length')??0)
   if(size>MAX_ZIP_BYTES)throw Error('World Bank workbook too large')
   const bytes=Buffer.from(await response.arrayBuffer())
   const instruments=parseWorldBankXlsx(bytes)
   cache={until:Date.now()+(instruments.length?21600000:600000),instruments}
   return instruments
  }catch{
   cache={until:Date.now()+600000,instruments:[]}
   return []
  }
 })()
 try{return await pending}finally{pending=null}
}
