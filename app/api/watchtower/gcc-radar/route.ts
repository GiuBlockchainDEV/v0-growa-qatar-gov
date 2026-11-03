import {NextResponse} from 'next/server'
import {requireCapability} from '@/lib/auth/require-capability'
import {validFoodUuid} from '@/lib/food-security/ingestion'
import {getGccRadarSnapshot,isGccRadarAllowed,GCC_PORTS} from '@/lib/watchtower/myshiptracking-gcc'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=30
const headers={'Cache-Control':'private, no-store, max-age=0'}
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers})
/** Explicit tenant authorization BEFORE any billable provider request. */
export async function GET(request:Request){
  const org=new URL(request.url).searchParams.get('organizationId')
  if(!validFoodUuid(org))return reply({error:'Valid organizationId required'},400)
  const auth=await requireCapability('supply.view',org)
  if(!auth.ok)return reply({error:auth.error},auth.status)
  if(!isGccRadarAllowed(org))return reply({
    status:'not_configured',configured:false,generatedAt:new Date().toISOString(),
    source:'MyShipTracking API',sourceUrl:'https://api.myshiptracking.com/docs/getting-started',
    refreshSeconds:300,hubs:GCC_PORTS.map(h=>({...h,status:'not_configured',
      candidates:0,observed:0,withRoutes:0,detail:'Not enabled for this organization',
      sourceUrl:'https://api.myshiptracking.com/docs/port-calls'})),
    assets:[],checked:0,moving:0,withRoutes:0,creditsCharged:null,maxShipsPerHub:4,
    sourceNote:'MyShipTracking monitoring is disabled for this organization.',
  })
  try{return reply(await getGccRadarSnapshot())}
  catch{return reply({error:'Licensed GCC marine radar unavailable. No traffic simulated.'},503)}
}
