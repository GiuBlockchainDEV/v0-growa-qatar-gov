import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {validFoodUuid} from '@/lib/food-security/ingestion'
import {requireCapability} from '@/lib/auth/require-capability'
import {CARGO_SPECS} from '@/lib/nfii/logistics-lanes'
import {findLogisticsSupplierOrigins} from '@/lib/nfii/logistics-supplier-origins'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const reply=(data:unknown,status=200)=>NextResponse.json(data,{
  status,headers:{'Cache-Control':'private, no-store, max-age=0'},
})

export async function GET(request:Request){
  const params=new URL(request.url).searchParams
  const commodity=params.get('commodity')??''
  if(!CARGO_SPECS[commodity])return reply({error:'Unsupported food commodity'},400)
  const organizationId=(params.get('organizationId')??'').trim()
  if(organizationId&&!validFoodUuid(organizationId))
    return reply({error:'Invalid organization'},400)
  const supabase=await createClient()
  const {data:{user},error}=await supabase.auth.getUser()
  if(error||!user)return reply({error:'Sign in to view supplier origins'},401)
  if(organizationId){
    const gate=await requireCapability('supply.view',organizationId)
    if(!gate.ok)return reply({error:gate.error},gate.status)
  }
  return reply(await findLogisticsSupplierOrigins(commodity,organizationId||null))
}
