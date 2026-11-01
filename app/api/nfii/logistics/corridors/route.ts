import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {requireCapability} from '@/lib/auth/require-capability'
import {validFoodUuid} from '@/lib/food-security/ingestion'
import {validateLaneInput,CARGO_SPECS,getExportHub} from '@/lib/nfii/logistics-lanes'
import {collectLogisticsEvidence} from '@/lib/nfii/logistics-providers'
import {fetchFreightEstimate} from '@/lib/nfii/logistics-freight-benchmark'
import {fetchGdacsRegionalEvents} from '@/lib/nfii/logistics-hazards'
import {collectSecurityIntelligence} from '@/lib/nfii/logistics-security'
import {makeRouteMapOverlays} from '@/lib/nfii/logistics-route-map'
import {buildScreenedRoutes,LOGISTICS_DATA_RULES,type RateInput} from '@/lib/nfii/logistics-screening'
import {countryName} from '@/lib/nfii/world-countries'
import {findLogisticsSupplierOrigins,hasSupplierInOrigin,type SupplierOriginScope} from '@/lib/nfii/logistics-supplier-origins'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const reply=(data:unknown,status=200)=>NextResponse.json(data,{
  status,headers:{'Cache-Control':'private, no-store, max-age=0'},
})

function parseRate(value:string|null):number|null|undefined{
  if(value===null||value.trim()==='')return null
  const n=Number(value)
  if(!Number.isFinite(n)||n<=0||n>=100000)return undefined
  return Math.round(n*100)/100
}

export async function GET(request:Request){
  const params=new URL(request.url).searchParams
  const parsed=validateLaneInput(params)
  if(!parsed.ok)return reply({error:parsed.error},400)
  const org=(params.get('organizationId')??'').trim()
  const supplierScope=params.get('supplierScope')??'documented'
  if(supplierScope!=='documented'&&supplierScope!=='approved')
    return reply({error:'Invalid supplier scope'},400)
  if(supplierScope==='approved'&&!org)
    return reply({error:'Organization is required for approved supplier sourcing'},400)
  if(org&&!validFoodUuid(org))return reply({error:'Invalid organization'},400)
  const rates:RateInput={
    sea:parseRate(params.get('seaRate'))??null,
    air:parseRate(params.get('airRate'))??null,
    road:parseRate(params.get('roadRate'))??null,
  }
  if(['seaRate','airRate','roadRate'].some(key=>
    parseRate(params.get(key))===undefined))
    return reply({error:'Freight rate must be a positive QAR/tonne value under 100000'},400)

  const supabase=await createClient()
  const {data:{user},error}=await supabase.auth.getUser()
  if(error||!user)return reply({error:'Sign in to compare transport corridors'},401)
  if(org){
    const gate=await requireCapability('supply.view',org)
    if(!gate.ok)return reply({error:gate.error},gate.status)
  }
  const eligible=await findLogisticsSupplierOrigins(parsed.commodity,org||null)
  if(supplierScope==='approved'&&eligible.sources.approvedLedger!=='available')
    return reply({error:'Approved supplier register unavailable or incomplete'},503)
  if(!hasSupplierInOrigin(eligible,supplierScope as SupplierOriginScope,parsed.country))
    return reply({error:'This country has no matched suppliers for the selected crop and supplier scope.'},422)
  const matching=eligible.countries.find(row=>row.countryCode===parsed.country)
  const [evidence,freight,hazards,security]=await Promise.all([
    collectLogisticsEvidence(parsed.country),
    fetchFreightEstimate(parsed.country,parsed.tonnes,CARGO_SPECS[parsed.commodity].coldChain),
    fetchGdacsRegionalEvents(parsed.country),
    collectSecurityIntelligence(),
  ])
  const screened=buildScreenedRoutes({
    ...parsed,rates,seaDistances:evidence.seaRoutes,
    lpi:evidence.lpi,lpiYear:evidence.lpiYear,
    waves:evidence.waves,weatherAgeHours:evidence.weatherAgeHours,
    roadDistanceKm:evidence.roadRoute?.distanceKm??null,
    roadDriveHours:evidence.roadRoute?.driveHours??null,
    hazards,security,
  })
  const spec=CARGO_SPECS[parsed.commodity]
  const hub=getExportHub(parsed.country)
  return reply({
    supplierSource:{scope:supplierScope,matchingCount:supplierScope==='approved'?
      matching?.approvedCount??0:matching?.documentedCount??0},
    context:{
      commodity:parsed.commodity,country:parsed.country,
      countryName:countryName(parsed.country),
      tonnes:parsed.tonnes,deliveryDeadlineDays:parsed.limitDays,
      product:spec.label,
      productClass:spec.productClass,
      coldChain:spec.coldChain,handling:spec.temperature,
      importDestination:'Doha, Qatar',
    },
    referenceHubs:hub?{
      sea:{name:hub.port,code:hub.unlocode,coordinates:hub.sea},
      air:{name:hub.airport,code:hub.iata,coordinates:hub.air},
    }:null,
    routes:screened,
    mapRoutes:makeRouteMapOverlays(screened,parsed.country,evidence.seaRoutes),
    regionalHazards:hazards,
    securityIntelligence:security,
    riskContext:{originLpi:evidence.lpi,lpiYear:evidence.lpiYear,
      waveHeightMaxMeters:evidence.waves,worldBankStatus:evidence.states.worldBank,
      weatherStatus:evidence.states.marineWeather},
    freightBenchmark:{...freight,sourceName:'Freightos marketplace estimates',
      quoteStatus:'non_binding_benchmark' as const},
    sourceStatus:evidence.states,
    sources:evidence.refs,
    dataWarnings:evidence.messages,
    riskDisclaimer:'The 0–100 security exposure index is weighted screening, NOT percentage probability of delay, incident or closure. EASA advisories are not NOTAMs; AIS may undercount during jamming. Missing provider evidence returns N/A.',
    pricesDisclaimer:'Freightos marketplace may supply non-binding dry-container reference ranges. Mode-specific route prices are calculated only from manually entered carrier rates; no reefer costs are inferred.',
    scheduleDisclaimer:'No confirmed port call, airline booking, border service or verified real shipment tracking without carrier systems.',
    modelLimitations:LOGISTICS_DATA_RULES,
    generatedAt:new Date().toISOString(),
    bookingAvailable:false,
    countryVerifiedSupplier:false,
  })
}
