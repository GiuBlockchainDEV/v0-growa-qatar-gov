import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {requireCapability} from '@/lib/auth/require-capability'
import {validFoodUuid} from '@/lib/food-security/ingestion'
import {CARGO_SPECS} from '@/lib/nfii/logistics-lanes'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const reply=(value:unknown,status=200)=>NextResponse.json(value,{
  status,headers:{'Cache-Control':'private, no-store, max-age=0'},
})

/**
 * Real, organization-authorized supplier contracts ONLY. Unlike the generic
 * operations workspace this endpoint deliberately never supplies seed/demo
 * fallback rows. Public crop-directory leads are fetched separately and
 * explicitly marked unqualified by the UI.
 */
export async function GET(request:Request){
  const params=new URL(request.url).searchParams
  const org=params.get('organizationId')??''
  const commodity=params.get('commodity')??''
  if(!validFoodUuid(org))return reply({error:'Valid organization required'},400)
  if(!CARGO_SPECS[commodity])return reply({
    error:'Commodity has no supported logistics profile. A manual sourcing assessment is required.',
  },422)
  const gate=await requireCapability('supply.view',org)
  if(!gate.ok)return reply({error:gate.error},gate.status)

  const supabase=await createClient()
  const today=new Date().toISOString().slice(0,10)
  const [suppliers,contracts,orders]=await Promise.all([
    supabase.from('nfii_suppliers')
      .select('id,name,country_code,status')
      .eq('organization_id',org).eq('status','approved').limit(501),
    supabase.from('nfii_contracts')
      .select('id,supplier_id,contract_ref,commodity_code,contracted_tonnes,price_qar_per_tonne,valid_from,valid_to,status')
      .eq('organization_id',org).eq('status','approved').eq('commodity_code',commodity)
      .lte('valid_from',today).gte('valid_to',today).limit(501),
    supabase.from('nfii_purchase_orders')
      .select('id,contract_id,status,ordered_tonnes')
      .eq('organization_id',org).in('status',['pending','approved'])
      .limit(501),
  ])
  if(suppliers.error||contracts.error||orders.error){
    console.error('[watchtower/procurement-agent] ledger not available',
      suppliers.error?.code,contracts.error?.code,orders.error?.code)
    return reply({
      error:'Verified organization procurement ledger unavailable. No supplier approval inferred.',
      source:'approved_ledger',available:false,
    },503)
  }
  if([suppliers.data,contracts.data,orders.data].some(rows=>(rows?.length??0)>=501))
    return reply({error:'Procurement register truncated. Narrow supplier scope before submitting orders.'},409)

  const supplierIndex=new Map((suppliers.data??[]).map(row=>[row.id,row]))
  const positions=(contracts.data??[]).flatMap(contract=>{
    const supplier=supplierIndex.get(contract.supplier_id)
    if(!supplier||!supplier.country_code)return []
    const contracted=Number(contract.contracted_tonnes)
    const price=Number(contract.price_qar_per_tonne)
    if(!Number.isFinite(contracted)||contracted<=0||
      !Number.isFinite(price)||price<=0)return []
    const used=(orders.data??[]).filter(order=>order.contract_id===contract.id)
      .reduce((sum,order)=>sum+Number(order.ordered_tonnes||0),0)
    const availableTonnes=Math.max(0,Math.round((contracted-used)*1000)/1000)
    if(!availableTonnes)return []
    return [{
      id:contract.id,
      supplierId:supplier.id,
      supplierName:supplier.name,
      countryCode:supplier.country_code,
      contractRef:contract.contract_ref,
      contractedTonnes:contracted,
      availableTonnes,
      priceQarPerTonne:price,
      validTo:contract.valid_to,
      verification:'approved_supplier_and_current_contract' as const,
    }]
  }).sort((a,b)=>b.availableTonnes-a.availableTonnes||
    String(a.supplierName).localeCompare(String(b.supplierName)))

  return reply({
    organizationId:org,commodity,checkedAt:new Date().toISOString(),
    source:'organization_procurement_ledger',available:true,
    options:positions,orderApproval:'independent_reviewer_required',
    note:'Only approved suppliers with active approved contracts and remaining capacity. '+
      'Final purchase orders are submitted as PENDING and reviewed by independent authorized users.',
  })
}
