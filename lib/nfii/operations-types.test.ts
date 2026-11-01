import {describe,expect,it} from 'vitest'
import {EMPTY_OPERATIONS,reservePosition,previewOperationsSnapshot,type OperationsSnapshot} from './operations-types'

const org='11111111-1111-4111-8111-111111111111'
const sample:OperationsSnapshot={
  ...EMPTY_OPERATIONS,
  lots:[
    {id:'1',organization_id:org,status:'approved',received_tonnes:'100.000',
      released_tonnes:'25.000',expiry_date:'2027-12-01'},
    {id:'2',organization_id:org,status:'pending',received_tonnes:'500.000',
      released_tonnes:'0',expiry_date:'2027-12-01'},
    {id:'3',organization_id:org,status:'approved',received_tonnes:'80.000',
      released_tonnes:'0',expiry_date:'2025-10-01'},
  ],
  releases:[
    {id:'rel-a',organization_id:org,status:'approved',
      lot_id:'1',quantity_tonnes:'20.000'},
    {id:'rel-b',organization_id:org,status:'executed',
      lot_id:'1',quantity_tonnes:'25.000'},
    {id:'rel-c',organization_id:org,status:'pending',
      lot_id:'1',quantity_tonnes:'35.000'},
  ],
}

describe('NFII reserve availability logic',()=>{
  it('counts approved non-expired lots and deducts executed releases only once',()=>{
    const p=reservePosition(sample,'2026-10-31')
    expect(p.usableLotCount).toBe(1)
    expect(p.availablePhysicalTonnes).toBe(75)
    expect(p.approvedReservedTonnes).toBe(20)
    expect(p.uncommittedTonnes).toBe(55)
  })
  it('does not count unreviewed or expired quantities',()=>{
    const p=reservePosition(sample,'2028-01-01')
    expect(p.usableLotCount).toBe(0)
    expect(p.availablePhysicalTonnes).toBe(0)
    expect(p.uncommittedTonnes).toBe(0)
  })
  it('keeps physical inventory separate from approved but unexecuted commitments',()=>{
    const p=reservePosition(sample,'2026-10-31')
    expect(p.availablePhysicalTonnes).toBeGreaterThan(p.uncommittedTonnes)
    expect(p.approvedReservedTonnes).toBe(20)
  })
})


describe('Existing Qatar preview is connected and non-operational',()=>{
  it('reuses the bundled 53 sample rows with consistent foreign links',()=>{
    const p=previewOperationsSnapshot('2026-10-31')
    expect(p.suppliers).toHaveLength(10)
    expect(p.contracts).toHaveLength(11)
    expect(p.purchaseOrders).toHaveLength(10)
    expect(p.shipments).toHaveLength(10)
    expect(p.warehouses).toHaveLength(3)
    expect(p.lots).toHaveLength(5)
    expect(p.releases).toHaveLength(4)
    expect(p.contracts.every(c=>p.suppliers.some(s=>s.id===c.supplier_id))).toBe(true)
    expect(p.purchaseOrders.every(po=>p.contracts.some(c=>c.id===po.contract_id))).toBe(true)
    expect(p.shipments.every(sh=>p.purchaseOrders.some(po=>po.id===sh.purchase_order_id))).toBe(true)
    expect(p.lots.every(lot=>p.shipments.some(sh=>sh.id===lot.shipment_id))).toBe(true)
    expect(p.lots.every(lot=>p.warehouses.some(w=>w.id===lot.warehouse_id))).toBe(true)
  })
  it('does not turn examples into approved audit events or real tenant IDs',()=>{
    const p=previewOperationsSnapshot('2026-10-31')
    expect(p.events).toEqual([])
    expect(p.suppliers.every(s=>s.id.startsWith('demo-') && s.organization_id==='illustrative-only')).toBe(true)
    expect(p.suppliers.some(s=>s.name?.startsWith('SIMULATED |'))).toBe(false)
    const position=reservePosition(p,'2026-10-31')
    expect(position.uncommittedTonnes).toBeGreaterThan(0)
    expect(position.uncommittedTonnes).toBeLessThan(position.availablePhysicalTonnes)
  })
})
