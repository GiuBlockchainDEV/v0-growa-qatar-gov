import { NextResponse } from 'next/server'
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin'
import { requireCapability } from '@/lib/auth/require-capability'
import { validFoodUuid } from '@/lib/food-security/ingestion'
import { validActionNote } from '@/lib/nfii/operations-validation'

export const dynamic='force-dynamic'

function reply(data:unknown,status=200){
  return NextResponse.json(data,{
    status,headers:{'Cache-Control':'private, no-store, max-age=0'},
  })
}

/** Approval, shipping state change or reserve execution, backed by atomic SQL RPCs. */
export async function POST(request:Request){
  let body:Record<string,unknown>
  try{
    const raw=await request.text()
    if(raw.length>4_000)return reply({error:'Action payload too large'},413)
    const parsed:unknown=JSON.parse(raw)
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Invalid')
    body=parsed as Record<string,unknown>
  }catch{return reply({error:'Invalid JSON'},400)}

  if(Object.keys(body).some(k=>!['organizationId','kind','id','action','note'].includes(k))){
    return reply({error:'Unexpected or privileged action field'},400)
  }
  const {organizationId,kind,id,action,note}=body
  if(!validFoodUuid(organizationId)||!validFoodUuid(id)){
    return reply({error:'Valid organizationId and record ID required'},400)
  }
  if(!validActionNote(note))return reply({error:'A documented note of 8 to 2000 characters is required'},400)

  const approve=kind==='approval'&&(action==='approve'||action==='reject')
  const shipment=kind==='shipment'&&
    (action==='in_transit'||action==='delivered'||action==='delayed'||action==='cancelled')
  const release=kind==='release'&&action==='execute'
  if(!approve&&!shipment&&!release)return reply({error:'Unsupported workflow transition'},400)

  const permission=approve?'decisions.approve':'decisions.execute'
  const gate=await requireCapability(permission,organizationId)
  if(!gate.ok)return reply({error:gate.error},gate.status)
  if(!isAdminClientConfigured())return reply({error:'Operation service not configured'},503)

  const admin=createAdminClient()
  const params=approve
    ? {p_org:organizationId,p_actor:gate.context.userId,p_approval_id:id,
        p_decision:action,p_reason:note.trim()}
    : shipment
      ? {p_org:organizationId,p_actor:gate.context.userId,p_shipment_id:id,
          p_next:action,p_note:note.trim()}
      : {p_org:organizationId,p_actor:gate.context.userId,p_release_id:id,p_note:note.trim()}
  const rpc=approve?'nfii_review_operation'
    :shipment?'nfii_transition_shipment':'nfii_execute_reserve_release'

  const {data,error}=await admin.rpc(rpc,params)
  if(error){
    console.error('[nfii/operations] transition rejected',rpc,error.code,error.message)
    return reply({
      error:'Transition rejected. Check independent approval, record status, parent validity and available quantities.',
    },409)
  }
  return reply({
    operation:data,
    notice:'State change committed atomically and recorded in the operational audit ledger.',
  })
}
