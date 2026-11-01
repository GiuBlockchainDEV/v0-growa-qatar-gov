import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8')
const model=read('lib/nfii/logistics-supplier-origins.ts')
const originsApi=read('app/api/nfii/logistics/supplier-origins/route.ts')
const corridorsApi=read('app/api/nfii/logistics/corridors/route.ts')
const ui=read('components/dashboard/nfii-ops/logistics-corridor-intelligence.tsx')
const workspace=read('components/dashboard/nfii-ops/operations-workspace.tsx')
describe('Only countries with crop-matched suppliers are eligible for international Logistics',()=>{
  it('sources named candidates from the same crop directory as Find Suppliers',()=>{
    expect(model).toContain('findDocumentedCropOrganizations(commodity)')
    expect(model).toContain('new Set()')
    expect(model).toContain('row.organizationName.trim()')
    expect(model).toContain("countryCode!=='QA'")
    expect(model).toContain('getExportHub(countryCode)')
  })
  it('sources approved suppliers only through authorized approved current crop contracts',()=>{
    expect(model).toContain(".from('nfii_suppliers')")
    expect(model).toContain(".from('nfii_contracts')")
    expect(model).toContain(".eq('status','approved')")
    expect(model).toContain(".eq('commodity_code',commodity)")
    expect(model).toContain(".lte('valid_from',today)")
    expect(model).toContain(".gte('valid_to',today)")
    expect(model).toContain('new Map(approvedSuppliers.map')
  })
  it('requires sign in and tenant supply.view and never mutates a supplier',()=>{
    expect(originsApi).toContain('supabase.auth.getUser()')
    expect(originsApi).toContain("requireCapability('supply.view',organizationId)")
    expect(corridorsApi).toContain("requireCapability('supply.view',org)")
    expect(corridorsApi).toContain('hasSupplierInOrigin')
    expect(corridorsApi).toContain("supplierScope==='approved'")
    expect(corridorsApi).toContain('422')
    expect(model).not.toMatch(/\.upsert\(|\.insert\(|\.delete\(/)
  })
  it('presents only eligible supplier origins in dropdown, not global transport hubs',()=>{
    expect(ui).toContain('eligible.map(row=>')
    expect(ui).not.toContain('HUB_COUNTRIES.map')
    expect(ui).toContain("supplierScope:scope")
    expect(ui).toContain('originsLoading||eligible.length===0')
    expect(ui).toContain('Find Suppliers · crop-specific published candidates')
    expect(ui).toContain('Approved suppliers · approved current crop contracts')
    expect(ui).toContain('supplier-origins?')
    expect(ui).toContain('Supplier origins without configured logistics gateways')
    expect(workspace).toContain('isPreview={isPreview}')
  })
})
