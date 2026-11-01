/**
 * Origins offered by Logistics must come from suppliers for the selected crop.
 * "documented": crop-specific published company records used by Find Suppliers.
 * "approved": organization-owned APPROVED suppliers with APPROVED crop contracts.
 * Neither a historical import lane nor a geographic hub creates a supplier.
 */
import {createClient} from '@/lib/supabase/server'
import {findDocumentedCropOrganizations} from './crop-producer-directory'
import {CARGO_SPECS,getExportHub} from './logistics-lanes'
import {countryName} from './world-countries'

export type SupplierOriginScope='documented'|'approved'
export type SupplierOrigin={
  countryCode:string;countryName:string
  documentedCount:number;approvedCount:number;logisticHubAvailable:boolean
}
export type SupplierOriginReport={
  commodity:string;countries:SupplierOrigin[];localQatar:SupplierOrigin|null
  sources:{documentedDirectory:'available';approvedLedger:'available'|'unavailable'|'not_requested'}
  note:string
}
type Supplier={id:string;country_code:string|null}
type Contract={supplier_id:string;commodity_code:string}

export function compileSupplierOrigins(
  commodity:string,
  documented:ReadonlyArray<{organizationName:string;countryCode:string}>,
  approvedSuppliers:readonly Supplier[],
  approvedContracts:readonly Contract[],
  ledger:SupplierOriginReport['sources']['approvedLedger'],
):SupplierOriginReport{
  if(!CARGO_SPECS[commodity])throw Error('Unsupported food commodity')
  const names=new Map<string,Set<string>>()
  for(const row of documented){
    const code=row.countryCode.trim().toUpperCase()
    const name=row.organizationName.trim().toLocaleLowerCase('en')
    if(!/^[A-Z]{2}$/.test(code)||!name)continue
    if(!names.has(code))names.set(code,new Set())
    names.get(code)!.add(name)
  }
  const legal=new Map<string,Set<string>>()
  const validSuppliers=new Map(approvedSuppliers.map(row=>[row.id,row]))
  for(const contract of approvedContracts){
    if(contract.commodity_code!==commodity)continue
    const supplier=validSuppliers.get(contract.supplier_id)
    const code=supplier?.country_code?.trim().toUpperCase()??''
    if(!/^[A-Z]{2}$/.test(code)||!supplier)continue
    if(!legal.has(code))legal.set(code,new Set())
    legal.get(code)!.add(supplier.id)
  }
  const codes=new Set([...names.keys(),...legal.keys()])
  const countries=[...codes].map(countryCode=>({
    countryCode,countryName:countryName(countryCode),
    documentedCount:names.get(countryCode)?.size??0,
    approvedCount:legal.get(countryCode)?.size??0,
    logisticHubAvailable:countryCode!=='QA'&&Boolean(getExportHub(countryCode)),
  })).sort((a,b)=>b.approvedCount-a.approvedCount||
    b.documentedCount-a.documentedCount||a.countryName.localeCompare(b.countryName))
  return {
    commodity,countries,
    localQatar:countries.find(row=>row.countryCode==='QA')??null,
    sources:{documentedDirectory:'available',approvedLedger:ledger},
    note:'Origins with named crop-specific published supplier leads, or approved '+
      'organization supplier plus approved active crop contract. Published leads '+
      'are not approved suppliers. Qatar local supply is not an international corridor.',
  }
}

export async function findLogisticsSupplierOrigins(
  commodity:string,organizationId:string|null,
):Promise<SupplierOriginReport>{
  if(!CARGO_SPECS[commodity])throw Error('Unsupported food commodity')
  const documented=findDocumentedCropOrganizations(commodity)
  if(!organizationId)
    return compileSupplierOrigins(commodity,documented,[],[],'not_requested')
  const supabase=await createClient()
  const today=new Date().toISOString().slice(0,10)
  const [suppliers,contracts]=await Promise.all([
    supabase.from('nfii_suppliers').select('id,country_code')
      .eq('organization_id',organizationId).eq('status','approved').limit(1000),
    supabase.from('nfii_contracts').select('supplier_id,commodity_code')
      .eq('organization_id',organizationId).eq('status','approved')
      .eq('commodity_code',commodity).lte('valid_from',today).gte('valid_to',today)
      .limit(1000),
  ])
  if(suppliers.error||contracts.error||
    (suppliers.data?.length??0)===1000||(contracts.data?.length??0)===1000){
    console.warn('[nfii/logistics] supplier register unavailable or truncated',{
      supplierCode:suppliers.error?.code,contractCode:contracts.error?.code,
    })
    return compileSupplierOrigins(commodity,documented,[],[],'unavailable')
  }
  return compileSupplierOrigins(commodity,documented,
    (suppliers.data??[]) as Supplier[],
    (contracts.data??[]) as Contract[],'available')
}

export function hasSupplierInOrigin(report:SupplierOriginReport,scope:SupplierOriginScope,country:string){
  const row=report.countries.find(item=>item.countryCode===country.toUpperCase())
  return Boolean(row&&row.countryCode!=='QA'&&row.logisticHubAvailable&&
    (scope==='approved'?row.approvedCount>0:row.documentedCount>0))
}
