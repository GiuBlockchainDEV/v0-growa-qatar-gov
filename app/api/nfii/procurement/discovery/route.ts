import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {requireCapability} from '@/lib/auth/require-capability'
import {validFoodUuid} from '@/lib/food-security/ingestion'
import {
  comtradeUrl,gleifUrl,parseComtradeTrade,parseGleifCandidates,
  parseGooglePlacesCandidates,validateProcurementQuery,
} from '@/lib/nfii/procurement-global'

export const dynamic='force-dynamic'
export const runtime='nodejs'

const reply=(body:unknown,status=200)=>NextResponse.json(body,{
  status,headers:{'Cache-Control':'private, no-store, max-age=0'},
})

/** A deliberately bounded external request. No caller-controlled host, API
 * token, URL, HTTP method, headers, path or subscription key is accepted. */
async function getExternalJson(url:string,ttl:number):Promise<unknown>{
  const response=await fetch(url,{
    headers:{Accept:'application/json','User-Agent':'NFII-Growa-Procurement/1.0'},
    next:{revalidate:ttl},signal:AbortSignal.timeout(12000),
  })
  if(!response.ok)throw Error('External provider HTTP '+response.status)
  const text=await response.text()
  if(text.length>2_000_000)throw Error('Provider response exceeds safety limit')
  return JSON.parse(text) as unknown
}

async function searchGooglePlaces(q:string,country:string):Promise<unknown>{
  const key=process.env.GOOGLE_PLACES_API_KEY
  if(!key)throw Error('Google Places is not configured')
  const response=await fetch('https://places.googleapis.com/v1/places:searchText',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'X-Goog-Api-Key':key,
      // Websites/phones are enterprise-priced Google Places fields.
      'X-Goog-FieldMask':[
        'places.id','places.displayName','places.formattedAddress',
        'places.addressComponents','places.businessStatus',
        'places.googleMapsUri','places.websiteUri',
        'places.internationalPhoneNumber',
      ].join(','),
    },
    body:JSON.stringify({
      textQuery:q,
      pageSize:12,
      languageCode:'en',
      ...(country?{regionCode:country.toLowerCase()}:{}),
    }),
    cache:'no-store',signal:AbortSignal.timeout(12000),
  })
  if(!response.ok)throw Error('Places search failed (HTTP '+response.status+')')
  const text=await response.text()
  if(text.length>2_000_000)throw Error('Places response exceeds safety limit')
  return JSON.parse(text) as unknown
}

/**
 * Signed-in user search across real external sources.
 * No organization rows or tenant documents are sent to a provider.
 *
 * GLEIF identifies corporate legal entities, NOT their product range.
 * Comtrade returns country-level import statistics, NOT a supplier directory.
 * Google Places is optional, priced and requires an authorized organization.
 */
export async function GET(request:Request){
  const params=new URL(request.url).searchParams
  const parsed=validateProcurementQuery(params)
  if(!parsed.ok)return reply({error:parsed.message},400)
  const {provider,query,country,commodity,year}=parsed.value
  const org=params.get('organizationId')?.trim()??''
  if(org&&!validFoodUuid(org))return reply({error:'Invalid organizationId'},400)
  const supabase=await createClient()
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user)return reply({error:'Sign in to use global procurement research'},401)
  // When an organization is supplied, enforce its supply.view capability.
  if(org){
    const gate=await requireCapability('supply.view',org)
    if(!gate.ok)return reply({error:gate.error},gate.status)
  }
  // Paid Google queries are not available to all signed-in users: require
  // an explicitly authorized tenant and a server-side account/API key.
  if(provider==='places'){
    if(!org)return reply({error:'Choose an authorized organization for paid business search'},403)
    if(!process.env.GOOGLE_PLACES_API_KEY)return reply({
      error:'Google Places not configured. Set GOOGLE_PLACES_API_KEY server-side and enable Places API billing.',
      provider:'places',configured:false,
    },503)
  }
  try{
    if(provider==='gleif'){
      const url=gleifUrl(query,country)
      const records=parseGleifCandidates(await getExternalJson(url,3600))
      return reply({
        provider:'gleif',source:'GLEIF Global LEI Index',query,country,
        retrievedAt:new Date().toISOString(),results:records,
        qualification:'unassessed',
        note:'Legal-entity registration and LEI validity do NOT verify that a company '+
          'supplies the chosen commodity, holds Qatar import permits or is approved by NFII.',
        sourceUrl:url,
      })
    }
    if(provider==='places'){
      const raw=await searchGooglePlaces(query,country)
      return reply({
        provider:'places',source:'Google Places (New)',query,country,
        retrievedAt:new Date().toISOString(),
        results:parseGooglePlacesCandidates(raw),
        qualification:'unassessed',
        note:'Business listings and contact details are leads only: not proof of a legal entity, '+
          'export capability, product availability, halal/food compliance, quality, prices or contracts. '+
          'Google Maps attribution and Places terms apply.',
        sourceUrl:'https://www.google.com/maps',
      })
    }
    const url=comtradeUrl(commodity,year)
    const trade=parseComtradeTrade(await getExternalJson(url,86400),commodity,year,url)
    return reply({
      provider:'comtrade',source:'UN Comtrade preview',
      retrievedAt:new Date().toISOString(),trade,
    })
  }catch(err){
    const text=err instanceof Error?err.message:'Provider request failed'
    console.warn('[nfii/procurement/discovery] provider unavailable',provider,
      text.replace(/[^a-zA-Z0-9 ().-]/g,'').slice(0,130))
    const limited=/429|rate|quota/i.test(text)
    return reply({
      error:limited?'Global data provider is rate-limited; try again later.':
        'Global data source is unavailable or returned an unexpected response. No results were fabricated.',
      provider,retryable:true,
    },limited?429:502)
  }
}
