import {describe,expect,it} from 'vitest'
import {EMPTY_OPERATIONS,previewOperationsSnapshot} from './operations-types'
import {
  procurementCounts,procurementTabCollection,procurementTabKind,
} from '@/components/dashboard/nfii-ops/procurement-journey'

describe('Procurement stages reuse the same NFII operational ledger',()=>{
  it('counts separately approved vs pending supplier and contract records',()=>{
    const s=previewOperationsSnapshot('2026-11-01')
    const counts=procurementCounts(s)
    expect(counts.approvedSuppliers).toBe(9)
    expect(counts.pendingSuppliers).toBe(1)
    expect(counts.approvedContracts).toBe(10)
    expect(counts.pendingContracts).toBe(1)
    expect(counts.approvedOrders).toBe(10)
    expect(counts.pendingOrders).toBe(0)
    expect(counts.pendingApprovals).toBeGreaterThan(0)
  })
  it('does not invent approvals when the live ledger has no rows',()=>{
    const counts=procurementCounts(EMPTY_OPERATIONS)
    expect(Object.values(counts).every(n=>n===0)).toBe(true)
  })
  it('each task route selects exactly one ledger and its create form',()=>{
    expect(procurementTabCollection('overview')).toBeNull()
    expect(procurementTabCollection('discover')).toBeNull()
    expect(procurementTabCollection('suppliers')).toBe('suppliers')
    expect(procurementTabCollection('contracts')).toBe('contracts')
    expect(procurementTabCollection('orders')).toBe('purchaseOrders')
    expect(procurementTabCollection('approvals')).toBe('approvals')
    expect(procurementTabKind('suppliers')).toBe('supplier')
    expect(procurementTabKind('contracts')).toBe('contract')
    expect(procurementTabKind('orders')).toBe('purchase_order')
    expect(procurementTabKind('approvals')).toBeNull()
  })
})
