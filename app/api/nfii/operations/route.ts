import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin'
import { requireCapability } from '@/lib/auth/require-capability'
import { validFoodUuid } from '@/lib/food-security/ingestion'
import { validateNfiiOperation } from '@/lib/nfii/operations-validation'

export const dynamic = 'force-dynamic'

function reply(data: unknown, status = 200) {
  return NextResponse.json(data,{
    status,headers:{'Cache-Control':'private, no-store, max-age=0'},
  })
}

const SOURCES = {
  suppliers:'nfii_suppliers',
  contracts:'nfii_contracts',
  purchaseOrders:'nfii_purchase_orders',
  shipments:'nfii_shipments',
  warehouses:'nfii_warehouses',
  lots:'nfii_reserve_lots',
  releases:'nfii_reserve_releases',
  approvals:'nfii_operation_approvals',
  events:'nfii_operation_events',
} as const

const LIMIT=151

/**
 * All operational records are tenant-scoped, RLS readable, and real persisted
 * rows. This does NOT include synthetic ICPS demo fixtures or national data.
 */
export async function GET(request: Request) {
  const organizationId=new URL(request.url).searchParams.get('organizationId')
  if (!validFoodUuid(organizationId)) return reply({error:'Valid organizationId required'},400)
  const gate=await requireCapability('supply.view',organizationId)
  if (!gate.ok) return reply({error:gate.error},gate.status)

  const supabase=await createClient()
  const keys=Object.keys(SOURCES) as Array<keyof typeof SOURCES>
  const queries=await Promise.all(keys.map(async key=>{
    const source=SOURCES[key]
    const response=await supabase.from(source).select('*')
      .eq('organization_id',organizationId)
      .order('created_at',{ascending:false}).limit(LIMIT)
    return {key,rows:response.data,error:response.error}
  }))

  const problems=queries.filter(entry=>entry.error)
  if (problems.length) {
    console.error('[nfii/operations] read unavailable',problems.map(p=>({key:p.key,code:p.error?.code})))
    return reply({
      error:'NFII operational ledger unavailable. Apply migration 00041 in Supabase and verify your organization permissions.',
      migrationRequired:'00041_nfii_operational_supply_chain.sql',
    },503)
  }

  const snapshot:Record<string,unknown>={}
  const truncated:string[]=[]
  for(const item of queries){
    const rows=item.rows ?? []
    if (rows.length>=LIMIT)truncated.push(item.key)
    snapshot[item.key]=rows.slice(0,LIMIT-1)
  }
  return reply({
    organizationId,
    scope:'organization',
    dataSource:'database',
    generatedAt:new Date().toISOString(),
    snapshot,
    limits:{maxPerTable:LIMIT-1,truncated},
    note:'Operational records are not automatically counted in the independently reviewed food balance.',
  })
}

/** Only server-verified, capability-authorized users may create records. */
export async function POST(request:Request){
  let raw:unknown
  try {
    const body=await request.text()
    if(body.length>8_000)return reply({error:'Operation payload too large'},413)
    raw=JSON.parse(body)
  }catch{return reply({error:'Invalid JSON payload'},400)}

  const parsed=validateNfiiOperation(raw)
  if (!parsed.ok) return reply({error:parsed.error},400)

  const input=parsed.value
  const permission=input.kind==='release'?'decisions.propose':'supply.edit'
  const gate=await requireCapability(permission,input.organizationId)
  if(!gate.ok)return reply({error:gate.error},gate.status)
  if(!isAdminClientConfigured())return reply({error:'Privileged operation service not configured'},503)

  const admin=createAdminClient()
  const {data,error}=await admin.rpc('nfii_create_operation',{
    p_org:input.organizationId,
    p_actor:gate.context.userId,
    p_kind:input.kind,
    p_payload:input.data,
  })
  if(error){
    console.error('[nfii/operations] create failed',error.code,error.message)
    if(error.code==='23505')return reply({error:'Record reference already exists in this organization'},409)
    if(error.code==='23503')return reply({error:'Selected parent record is unavailable'},422)
    return reply({error:'Creation blocked by workflow, record constraints or missing migration. Verify parent approval and quantities.'},422)
  }
  return reply({operation:data,notice:'Persisted with an immutable event and independent approval if required.'},201)
}
