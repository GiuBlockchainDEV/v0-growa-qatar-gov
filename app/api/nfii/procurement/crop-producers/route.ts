import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {requireCapability} from '@/lib/auth/require-capability'
import {validFoodUuid} from '@/lib/food-security/ingestion'
import {
  cropProducerCoverage,FAIRTSA_EXCERPT_CHECKED,FAIRTSA_REGISTRY_URL,
  findDocumentedCropOrganizations,GLOBALGAP_REGISTRY_URL,
  USDA_ORGANIC_REGISTRY_URL,validateCropProducerSearch,
} from '@/lib/nfii/crop-producer-directory'
import {fetchMappedCropLeads} from '@/lib/nfii/world-crop-mapping'
import {fetchExpandedFarmResults} from '@/lib/nfii/world-agricultural-leads'
import {searchGlobalCropBusinesses} from '@/lib/nfii/world-crop-places'
import {countryName} from '@/lib/nfii/world-countries'
import type {CropProducerEvidence} from '@/lib/nfii/crop-producer-directory'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const reply=(body:unknown,status=200)=>NextResponse.json(body,{
  status,headers:{'Cache-Control':'private, no-store, max-age=0'},
})

/**
 * Returns a curated, bounded multi-publisher directory with exact crop or
 * crop-sector evidence. Historical listings, not a live certification API.
 */
export async function GET(request:Request){
  const params=new URL(request.url).searchParams
  const parsed=validateCropProducerSearch(params)
  if(!parsed.ok)return reply({error:parsed.error},400)
  const research=params.get('research')??'expanded'
  if(!['curated','mapped','expanded','places'].includes(research))
    return reply({error:'Invalid crop research source'},400)
  if(research==='places'&&!parsed.country)
    return reply({error:'Select a country before using paid business discovery'},400)
  const organizationId=(params.get('organizationId')??'').trim()
  if(organizationId&&!validFoodUuid(organizationId))
    return reply({error:'Invalid organizationId'},400)

  const supabase=await createClient()
  const {data:{user},error}=await supabase.auth.getUser()
  if(error||!user)return reply({error:'Sign in to research certified products'},401)
  if(organizationId){
    const access=await requireCapability('supply.view',organizationId)
    if(!access.ok)return reply({error:access.error},access.status)
  }

  if(research==='places'&&!organizationId)
    return reply({error:'Paid business discovery requires an authorized organization'},403)

  const documented=findDocumentedCropOrganizations(parsed.commodity,parsed.country)
  let additional:CropProducerEvidence[]=[]
  let cropTaggedCount=0
  let agriculturalCandidateCount=0
  let researchStatus:'not_requested'|'available'|'no_matches'|'not_configured'|'unavailable'=
    'not_requested'
  let researchMessage=''
  if(parsed.country&&research!=='curated'){
    if(research==='places'&&!process.env.GOOGLE_PLACES_API_KEY){
      researchStatus='not_configured'
      researchMessage='Google Places requires a configured server-side API key and billing.'
    }else{
      try{
        if(research==='expanded'){
          const expanded=await fetchExpandedFarmResults(parsed.commodity,parsed.country)
          cropTaggedCount=expanded.cropTagged.length
          agriculturalCandidateCount=expanded.agriculturalCandidates.length
          additional=[...expanded.cropTagged,...expanded.agriculturalCandidates]
        }else{
          additional=research==='places'?
            await searchGlobalCropBusinesses(parsed.commodity,parsed.country):
            await fetchMappedCropLeads(parsed.commodity,parsed.country)
          if(research==='mapped')cropTaggedCount=additional.length
        }
        researchStatus=additional.length?'available':'no_matches'
      }catch(error){
        researchStatus='unavailable'
        const message=error instanceof Error?error.message:'Source unavailable'
        console.warn('[procurement/crop-producers] external lookup unavailable',
          research,message.replace(/[^a-zA-Z0-9 ()-]/g,'').slice(0,100))
        researchMessage='The selected global source is unavailable. Curated matches remain '+
          'visible; do not treat this as zero suppliers in the country.'
      }
    }
  }
  // Dynamic open-data sites and business keywords never override stronger,
  // product-specific sourced records from curated provider lists.
  const results=[...documented]
  const signature=(r:CropProducerEvidence)=>r.countryCode+'|'+
    r.organizationName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'')
  const seen=new Set(documented.map(signature))
  for(const candidate of additional){
    const key=signature(candidate)
    if(seen.has(key))continue
    seen.add(key)
    results.push({...candidate,countryName:countryName(candidate.countryCode)})
  }
  return reply({
    research,researchStatus,researchMessage,
    cropTaggedCount,agriculturalCandidateCount,
    documentedCount:documented.length,
    countryHasDocumentedCropMatches:documented.length>0,
    exploratoryCount:results.length-documented.length,
    provider:'crop-sector-directory',
    commodity:parsed.commodity,
    country:parsed.country,
    retrievedAt:new Date().toISOString(),
    excerptCheckedOn:FAIRTSA_EXCERPT_CHECKED,
    source:'Attributed published crop-sector registries',
    sourceUrl:FAIRTSA_REGISTRY_URL,
    sourceCount:new Set(results.map(row=>row.sourceUrl)).size,
    countryCount:new Set(results.map(row=>row.countryCode)).size,
    evidenceBreakdown:Object.fromEntries([...new Set(results.map(row=>row.evidenceType))].map(type=>[
      type,results.filter(row=>row.evidenceType===type).length])),
    results,
    sourceCoverage:cropProducerCoverage(),
    completeGlobalCoverage:false,
    liveCertificateVerified:false,
    note:'Curated documented sourcing leads plus community mapped locations explicitly labelled ' +
      'as crop-verified or crop-UNVERIFIED. NOT a live ' +
      'global supplier census or current independent verification. Association membership, ' +
      'market listings, product certificates and national marks have DIFFERENT evidentiary strength. ' +
      'They do not prove own-farm production, current certification, export eligibility, ' +
      'capacity, stock or contract availability. Verify each individual original source.',
    independentSources:[
      {label:'USDA Organic INTEGRITY - certified operations and products',
        url:USDA_ORGANIC_REGISTRY_URL,
        description:'Use certified product and CROPS scope; USDA-NOP operators only.'},
      {label:'GLOBALG.A.P. IT platform - product and producer certification',
        url:GLOBALGAP_REGISTRY_URL,
        description:'Public records vary by producer access rules; API requires a subscription.'},
    ],
  })
}
