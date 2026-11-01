import {describe,expect,it} from 'vitest'
import {EMPTY_OPERATIONS,previewOperationsSnapshot,
  type OperationsRow,type OperationsSnapshot} from './operations-types'
import {approvalReadiness,approvalTarget,contractPosition,
  getRecordApproval,orderPosition,supplierPosition} from './procurement-workflow'

const asOf='2026-11-01'
const fake=(id:string,other:Partial<OperationsRow>={}):OperationsRow=>({
  id,organization_id:'fixture-only',status:'approved',...other,
})
const snapshot=(rows:Partial<OperationsSnapshot>={}):OperationsSnapshot=>({
  ...EMPTY_OPERATIONS,...rows,
})
describe('Procurement relationship and decision guidance (read-only)',()=>{
  it('calculates contract cost, QAR/kg and actual remaining approved quantity',()=>{
    const supplier=fake('s', {name:'Real partner placeholder'})
    const contract=fake('c',{supplier_id:'s',contracted_tonnes:100,
      price_qar_per_tonne:3500,valid_from:'2026-01-01',
      valid_to:'2027-02-01'})
    const orders=[
      fake('o1',{contract_id:'c',ordered_tonnes:25}),
      fake('o2',{contract_id:'c',ordered_tonnes:20,status:'pending'}),
      fake('o3',{contract_id:'c',ordered_tonnes:5,status:'rejected'}),
    ]
    const s=snapshot({suppliers:[supplier],contracts:[contract],
      purchaseOrders:orders})
    const p=contractPosition(s,contract,asOf)
    expect(p.price).toBe(3500)
    expect(p.unitQarKg).toBe(3.5)
    expect(p.faceValueQar).toBe(350000)
    expect(p.approvedTonnes).toBe(25)
    expect(p.pendingTonnes).toBe(20)
    expect(p.remainingTonnes).toBe(75)
    expect(p.availableAfterPendingTonnes).toBe(55)
    expect(p.utilizationPct).toBe(25)
    expect(p.canOrder).toBe(true)
    expect(supplierPosition(s,'s',asOf).activeContractCount).toBe(1)
    expect(orderPosition(s,orders[0]).totalValueQar).toBe(87500)
  })
  it('blocks next-step guidance for expired or unapproved contracts',()=>{
    const expired=fake('c',{contracted_tonnes:10,
      price_qar_per_tonne:1000,valid_from:'2020-01-01',valid_to:'2021-01-01'})
    expect(contractPosition(snapshot(),expired,asOf).canOrder).toBe(false)
    expect(contractPosition(snapshot(),{...expired,status:'pending',
      valid_to:'2027-01-01'},asOf).canOrder).toBe(false)
  })
  it('shows approval target and refuses readiness when parent missing',()=>{
    const a=fake('a',{target_type:'purchase_order',target_id:'po',
      status:'pending',submitted_by:'other-user'})
    const s=snapshot({purchaseOrders:[fake('po',{contract_id:'c',
      status:'pending',ordered_tonnes:10})],approvals:[a]})
    expect(approvalTarget(s,a)?.view).toBe('purchaseOrders')
    expect(getRecordApproval(s,'purchase_order','po')?.id).toBe('a')
    expect(approvalReadiness(s,a,asOf).ready).toBe(false)
  })
  it('order approval requires current approved contract with capacity',()=>{
    const contract=fake('c',{contracted_tonnes:50,valid_from:'2026-01-01',
      valid_to:'2027-01-01',price_qar_per_tonne:2400})
    const a=fake('a',{target_type:'purchase_order',target_id:'pending',
      status:'pending'})
    const pending=fake('pending',{status:'pending',contract_id:'c',
      ordered_tonnes:30})
    const approved=fake('approved',{contract_id:'c',ordered_tonnes:25})
    const s=snapshot({contracts:[contract],
      purchaseOrders:[approved,pending],approvals:[a]})
    expect(approvalReadiness(s,a,asOf).ready).toBe(false)
    s.purchaseOrders[0]={...approved,ordered_tonnes:10}
    expect(approvalReadiness(s,a,asOf).ready).toBe(true)
  })
  it('preserves independent review and no data mutation in UI',()=>{
    const s=previewOperationsSnapshot(asOf)
    expect(s.suppliers.length).toBeGreaterThan(0)
    expect(s.contracts.every(x=>!x.supplier_id||
      s.suppliers.some(y=>y.id===x.supplier_id))).toBe(true)
    expect(s.purchaseOrders.every(x=>!x.contract_id||
      s.contracts.some(y=>y.id===x.contract_id))).toBe(true)
    expect(approvalReadiness(s,s.approvals[0],asOf).reason.length).toBeGreaterThan(8)
  })
})
