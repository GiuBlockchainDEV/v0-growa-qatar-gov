import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {validFoodUuid} from '@/lib/food-security/ingestion'
import {requireCapability} from '@/lib/auth/require-capability'
import {HS_CODES} from '@/lib/nfii/procurement-global'
import {findDocumentedCropOrganizations} from '@/lib/nfii/crop-producer-directory'
import {comtradeOriginUrl,parseImportOriginYear,
  rankQatarImportOrigins} from '@/lib/nfii/origin-price-model'
import {countryName} from '@/lib/nfii/world-countries'
import {getWits2024Snapshot} from '@/lib/nfii/wits-2024-prices'
import {resolveCommodity} from '@/lib/platform/commodity-catalog'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const reply=(data:unknown,status=200)=>NextResponse.json(data,{
  status,headers:{'Cache-Control':'private, no-store, max-age=0'},
})

async function loadTrade(commodity:string,year:number){
  const url=comtradeOriginUrl(commodity,year)
  const response=await fetch(url,{
    headers:{Accept:'application/json','User-Agent':'NFII-Growa-Procurement/1.0'},
    next:{revalidate:86400},signal:AbortSignal.timeout(9000),
  })
  if(!response.ok)throw Error('UN Comtrade '+response.status)
  const body=await response.text()
  if(body.length>2_000_000)throw Error('Comtrade response exceeded size limit')
  return parseImportOriginYear(JSON.parse(body) as unknown,commodity,year,url)
}

/**
 * Source-led country recommendations for Qatar import purchasing, not
 * ungrounded "best country" or fabricated price quotes.
 * Built from actual historical Qatar imports, weighted QAR/kg unit values
 * and an independent named-company coverage fallback.
 */
export async function GET(request:Request){
  const params=new URL(request.url).searchParams
  const selected=params.get('commodity')??''
  const crop=resolveCommodity(selected)
  if(!crop||crop.id!==selected||!HS_CODES[selected])
    return reply({error:'Select a supported commodity'},400)
  const year=Number(params.get('year')??'2025')
  if(!Number.isInteger(year)||year<2022||year>2025)
    return reply({error:'Select an available complete annual period (2022–2025)'},400)
  const org=(params.get('organizationId')??'').trim()
  if(org&&!validFoodUuid(org))return reply({error:'Invalid organizationId'},400)

  const supabase=await createClient()
  const {data:{user},error}=await supabase.auth.getUser()
  if(error||!user)return reply({error:'Sign in to compare import origins'},401)
  if(org){
    const gate=await requireCapability('supply.view',org)
    if(!gate.ok)return reply({error:gate.error},gate.status)
  }

  const dates=[year,year-1,year-2].filter(x=>x>=2020)
  const annual=await Promise.all(dates.map(async y=>{
    try{return {data:await loadTrade(selected,y),error:null}}
    catch(error){
      const reason=error instanceof Error?error.message:'Provider unavailable'
      console.warn('[nfii/procurement/origin-prices] trade source unavailable',
        y,reason.replace(/[^a-zA-Z0-9 .()-]/g,'').slice(0,100))
      return {data:null,error:'UN Comtrade did not return usable annual data'}
    }
  }))
  const years=annual.flatMap(item=>item.data?[item.data]:[])
  let report=rankQatarImportOrigins(selected,years)
  let publishedFallback:ReturnType<typeof getWits2024Snapshot>=null
  // HTTP 200 with no matching trade partners is not proof of zero imports.
  // WITS independently publishes a 2024 annual Qatar partner breakdown.
  if(report.origins.length===0){
    publishedFallback=getWits2024Snapshot(selected)
    if(publishedFallback){
      report=rankQatarImportOrigins(selected,[publishedFallback.observation])
      if(report.origins.length){
        report={
          ...report,
          sourceName:'World Bank WITS / UN Comtrade published 2024',
          sourceDataStatus:'published_wits_2024',
          hsCode:publishedFallback.hsCode,
          hsLabel:publishedFallback.productScope,
          productScope:publishedFallback.productScope,
          note:'Historical World Bank WITS 2024 Qatar import partner observations. '+
            'The published World-row value and weight determine the nationwide '+
            'weighted mean. These are not current prices or supplier quotations.',
        }
      }
    }
  }

  const documented=findDocumentedCropOrganizations(selected)
  const sources=new Map<string,{countryCode:string;name:string;documentedLeads:number}>()
  for(const row of documented){
    const prior=sources.get(row.countryCode)
    if(prior)prior.documentedLeads++
    else sources.set(row.countryCode,{
      countryCode:row.countryCode,name:countryName(row.countryCode),
      documentedLeads:1,
    })
  }
  const documentedCountries=[...sources.values()]
    .sort((a,b)=>b.documentedLeads-a.documentedLeads)
  const recommended=report.origins.map(p=>p.countryCode)
  // Qatar is local sourcing, NOT a foreign import partner.
  const relevantCodes=new Set([...recommended,...documentedCountries.map(c=>c.countryCode)])
  const shortlist=[...relevantCodes].filter(code=>code!=='QA').map(code=>{
    const observed=report.origins.find(o=>o.countryCode===code)
    const known=sources.get(code)
    return {
      countryCode:code,countryName:countryName(code),
      documentedLeads:known?.documentedLeads??0,
      observedQatarImports:Boolean(observed),
      historicalUnitValueQarKg:observed?.unitValueQarKg??null,
      importTonnes:observed?.importWeightTonnes??null,
      year:observed?.sourceYear??null,
      feasibility:observed?'observed_import_route':'documented_company_only',
    }
  }).sort((a,b)=>a.observedQatarImports===b.observedQatarImports?
    (a.historicalUnitValueQarKg??Infinity)-(b.historicalUnitValueQarKg??Infinity)||
      b.documentedLeads-a.documentedLeads:
    a.observedQatarImports?-1:1)

  return reply({
    commodity:selected,requestedYear:year,yearsWithRecords:years.map(x=>x.year),
    historicalFallbackUsed:report.sourceDataStatus==='published_wits_2024',
    provenance:publishedFallback?{
      publisher:publishedFallback.sourceName,hsCode:publishedFallback.hsCode,
      productScope:publishedFallback.productScope,
      sourceUrls:publishedFallback.sourceUrls,
    }:null,
    provider:'un-comtrade-public-preview',
    report,
    shortlist,
    localQatar:{
      countryCode:'QA',countryName:'Qatar',
      documentedLeads:sources.get('QA')?.documentedLeads??0,
      historicalUnitValueQarKg:null,
      feasibility:'local_supplier_research',
      note:'Local supplier option: no import customs price is assigned.',
    },
    dataStatus:years.length?'available':'unavailable',
    providerWarnings:annual.filter(row=>row.error).length,
    priceUnavailabilityReason:report.origins.length?null:
      'No usable prices from live Comtrade or attributable historical sources.',
    note:'Only countries with a documented supplier lead or measurable historic Qatar '+
      'imports above a minimum trade threshold are displayed. Countries without '+
      'a Comtrade import history remain unpriced, not necessarily infeasible. '+
      'Unit values are NOT vendor quotes or delivered offers.',
  })
}
