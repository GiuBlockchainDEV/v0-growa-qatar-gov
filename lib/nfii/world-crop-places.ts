/**
 * Optional Google Places discovery of business names by crop and country.
 * GOOGLE_PLACES_API_KEY is server-side and paid. NEVER treat keyword matches
 * as proof of crop production, supplier qualification or a current offer.
 */
import {resolveCommodity} from '@/lib/platform/commodity-catalog'
import {isWorldCountryCode,countryName} from './world-countries'
import {parseGooglePlacesCandidates} from './procurement-global'
import type {CropProducerEvidence} from './crop-producer-directory'

const CROP_TERMS:Record<string,string>={
  tomato:'tomato',cucumber:'cucumber',pepper:'bell pepper',
  lettuce:'lettuce',date:'dates',barley:'barley',
  milk:'fresh milk dairy',rice:'rice',wheat:'wheat grain',
}
export function globalCropPlacesQueries(commodity:string,country:string):string[]{
  const crop=resolveCommodity(commodity)
  if(!crop||!isWorldCountryCode(country))throw Error('Invalid global crop query')
  const location=countryName(country)
  const product=CROP_TERMS[crop.id]??crop.name.toLowerCase()
  return [
    product+' farms growers producers in '+location,
    product+' wholesale exporters suppliers in '+location,
  ]
}

function toCropEvidence(candidate:ReturnType<typeof parseGooglePlacesCandidates>[number],
  commodity:string,query:string,country:string):CropProducerEvidence{
  return {
    recordId:'GOOGLE-'+candidate.sourceId,
    organizationName:candidate.name,
    countryCode:country,countryName:countryName(country),
    certifier:'Not established by source',
    listedProducts:['Business keyword search: '+query],
    matchedProduct:'Business keyword: '+commodity+' (NOT a confirmed product)',
    commodityId:commodity,
    sourceName:'Google Places (New) – keyword-based business discovery',
    sourceUrl:candidate.sourceUrl,
    registryCheckedOn:new Date().toISOString().slice(0,10),
    evidenceType:'keyword_business_listing',
    cropGrowerConfirmed:false,currentCertificateConfirmed:false,
    exportCapabilityConfirmed:false,capacityTonnes:null,supplierApproved:false,
    evidenceSummary:'Search-keyword business lead only. Business category, presence in country, '+
      'cultivation, listed products, legal identity and stock have NOT been verified.',
  }
}

export async function searchGlobalCropBusinesses(commodity:string,country:string):
  Promise<CropProducerEvidence[]>{
  const key=process.env.GOOGLE_PLACES_API_KEY
  if(!key)throw Error('Google Places billing/key is not configured')
  const queries=globalCropPlacesQueries(commodity,country)
  const leads:CropProducerEvidence[]=[]
  for(const query of queries){
    const response=await fetch('https://places.googleapis.com/v1/places:searchText',{
      method:'POST',
      headers:{
        'Content-Type':'application/json','X-Goog-Api-Key':key,
        'X-Goog-FieldMask':[
          'places.id','places.displayName','places.formattedAddress',
          'places.addressComponents','places.businessStatus','places.googleMapsUri',
        ].join(','),
      },
      body:JSON.stringify({
        textQuery:query,pageSize:20,languageCode:'en',regionCode:country.toLowerCase(),
      }),
      signal:AbortSignal.timeout(10000),cache:'no-store',
    })
    if(!response.ok)throw Error('Google Places HTTP '+response.status)
    const data=await response.text()
    if(data.length>600_000)throw Error('Google Places response too large')
    const payload=JSON.parse(data) as {places?:unknown}
    const entries=parseGooglePlacesCandidates({
      places:Array.isArray(payload.places)?payload.places:[],
    })
    for(const item of entries){
      // regionCode only biases results: never show foreign or unknown country
      // businesses under the selected country.
      if(item.countryCode!==country.toUpperCase())continue
      leads.push(toCropEvidence(item,commodity,query,country.toUpperCase()))
    }
  }
  return leads
}
