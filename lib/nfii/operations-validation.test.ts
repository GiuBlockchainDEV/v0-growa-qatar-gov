import { describe, expect, it } from 'vitest'
import { OPERATION_FIELDS, validActionNote, validateNfiiOperation } from './operations-validation'

const org='11111111-1111-4111-8111-111111111111'
const supplier='22222222-2222-4222-8222-222222222222'
const contract='33333333-3333-4333-8333-333333333333'
const order='44444444-4444-4444-8444-444444444444'
const warehouse='55555555-5555-4555-8555-555555555555'
const shipment='66666666-6666-4666-8666-666666666666'
const lot='77777777-7777-4777-8777-777777777777'
const valid:Record<string,Record<string,string|number>>={
  supplier: { code:'SUP-001',name:'Test Entity for Fixtures',countryCode:'QA' },
  contract: { supplierId:supplier,contractRef:'CTR-001',commodityCode:'rice',
    contractedTonnes:120,priceQarPerTonne:3100.25,validFrom:'2026-10-01',validTo:'2027-10-01'},
  purchase_order: { contractId:contract,orderRef:'PO-0001',orderedTonnes:50 },
  shipment: { purchaseOrderId:order,shipmentRef:'BL-001',shipmentTonnes:50,
    origin:'Port of Origin',destination:'Destination Port',etaDate:'2026-11-20'},
  warehouse: { code:'WH-001',name:'Main Reserve Warehouse',location:'Doha Warehouse Zone'},
  lot: { warehouseId:warehouse,shipmentId:shipment,lotRef:'LOT-001',
    receivedTonnes:40,expiryDate:'2027-12-01'},
  release: {lotId:lot,releaseRef:'REL-001',quantityTonnes:15,purpose:'Emergency replenishment review'},
}
function parse(kind:string,data:Record<string,unknown>){
  return validateNfiiOperation({organizationId:org,kind,data})
}
describe('NFII operational source validation',()=>{
  it.each(Object.entries(valid))('accepts a valid %s workflow record', (kind, data)=>{
    expect(parse(kind,data).ok).toBe(true)
  })
  it('rejects body privilege escalation, nested status and forged reviewer',()=>{
    expect(validateNfiiOperation({organizationId:org,kind:'supplier',data:valid.supplier,role:'owner'}).ok).toBe(false)
    expect(parse('supplier',{...valid.supplier,status:'approved'}).ok).toBe(false)
    expect(parse('contract',{...valid.contract,reviewed_by:org}).ok).toBe(false)
    expect(parse('release',{...valid.release,executed_at:'2026-01-01'}).ok).toBe(false)
  })
  it('rejects invalid external ids and dates',()=>{
    expect(parse('contract',{...valid.contract,supplierId:'not uuid'}).ok).toBe(false)
    expect(parse('shipment',{...valid.shipment,etaDate:'2026-02-30'}).ok).toBe(false)
    expect(parse('contract',{...valid.contract,validTo:'2025-12-30'}).ok).toBe(false)
  })
  it('rejects zero, negative, overflowing and overprecision quantities',()=>{
    for(const quantity of [0,-1,Infinity,1_000_000_001,'2.0001','nan']){
      expect(parse('purchase_order',{...valid.purchase_order,orderedTonnes:quantity}).ok).toBe(false)
    }
    expect(parse('contract',{...valid.contract,priceQarPerTonne:12.345}).ok).toBe(false)
  })
  it('rejects invalid supplier name and country code',()=>{
    expect(parse('supplier',{...valid.supplier,name:'ab'}).ok).toBe(false)
    expect(parse('supplier',{...valid.supplier,countryCode:'qq'}).ok).toBe(false)
    expect(parse('supplier',{...valid.supplier,name:'<script>alert(1)</script>'}).ok).toBe(false)
  })
  it('keeps every record kind explicitly typed and allowlisted',()=>{
    for(const [kind,fields] of Object.entries(OPERATION_FIELDS)){
      expect(fields.length).toBeGreaterThan(0)
      expect(fields.every(field=>field.key && field.type)).toBe(true)
      expect(parse(kind,{...valid[kind],adminOverride:true}).ok).toBe(false)
    }
  })
  it('requires documented independent approval or transition notes',()=>{
    expect(validActionNote('Delivery verified by signed manifest')).toBe(true)
    expect(validActionNote('short')).toBe(false)
    expect(validActionNote('a'.repeat(2001))).toBe(false)
  })
})
