import {NextResponse} from 'next/server'
import {buildSessionContext} from '@/lib/auth/authorization-service'
import {canViewGlobalMaritimeRadar} from '@/lib/watchtower/global-maritime-access'
import {getPublicGccRadarSnapshot} from '@/lib/watchtower/myshiptracking-public'

export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=60
const headers={'Cache-Control':'private, no-store, max-age=0'}
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers})

/**
 * Global public-source feed, not an organization ledger.
 * Resolve login, account status and intelligence permissions on the server.
 * There is no browser-supplied organization ID and no blanket auth bypass.
 */
export async function GET(){
  try{
    const session=await buildSessionContext({})
    if(!session.payload){
      return reply({
        error:session.status===401?'Authentication required':'Account is not active',
        code:session.status===401?'not_authenticated':'account_inactive',
      },session.status===401?401:403)
    }
    if(!canViewGlobalMaritimeRadar(session.payload))
      return reply({error:'Active intelligence access required',code:'no_intelligence_membership'},403)
    return reply(await getPublicGccRadarSnapshot())
  }catch{
    return reply({error:'Public GCC radar unavailable; no traffic simulated.',code:'provider_unavailable'},503)
  }
}
