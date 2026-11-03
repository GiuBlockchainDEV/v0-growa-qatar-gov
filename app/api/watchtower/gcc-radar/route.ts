import {NextResponse} from 'next/server'
import {requireCapability} from '@/lib/auth/require-capability'
import {getPublicGccRadarSnapshot} from '@/lib/watchtower/myshiptracking-public'

export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=30
const headers={'Cache-Control':'private, no-store, max-age=0'}
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers})

/**
 * Global Watchtower maritime observations. The caller does not supply an
 * organization identifier. Resolve authorization from the authenticated
 * server-side session; a server-side opt-in still guards external collection.
 * This route deliberately does not fall back to the paid AIS API.
 */
export async function GET(){
  const auth=await requireCapability('supply.view',null)
  if(!auth.ok)return reply({error:auth.error},auth.status)
  try{return reply(await getPublicGccRadarSnapshot())}
  catch{return reply({error:'Public maritime observations unavailable; no synthetic vessels.'},503)}
}
