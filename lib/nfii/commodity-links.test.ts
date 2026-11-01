import {describe,expect,it} from 'vitest'
import {previewOperationsSnapshot} from './operations-types'
import {linkCommodityOperations} from './commodity-links'

const example=previewOperationsSnapshot('2026-11-01')
describe('Commodity-specific operational joins',()=>{
  it('links rice contracts, suppliers, POs, shipping, lots and releases',()=>{
    const r=linkCommodityOperations('rice',example,'2026-11-01')
    expect(r.contracts).toHaveLength(3)
    expect(r.suppliers).toHaveLength(3)
    expect(r.orders).toHaveLength(2)
    expect(r.shipments).toHaveLength(2)
    expect(r.lots).toHaveLength(2)
    expect(r.releases).toHaveLength(2)
    expect(r.approvedOrderTonnes).toBe(430)
    expect(r.availableReserveTonnes).toBe(170)
    expect(r.committedReleaseTonnes).toBe(20)
  })
  it('does not mix rice lot quantities with unrelated commodities',()=>{
    const r=linkCommodityOperations('lettuce',example,'2026-11-01')
    expect(r.lots).toHaveLength(1)
    expect(r.lots[0].commodity_code).toBe('lettuce')
    expect(r.contracts.every(c=>c.commodity_code==='lettuce')).toBe(true)
    expect(r.shipments.some(s=>s.shipment_ref?.includes('RICE'))).toBe(false)
  })
  it('excludes expired lots and their reservations from available stock',()=>{
    const a=linkCommodityOperations('lettuce',example,'2026-11-01')
    const b=linkCommodityOperations('lettuce',example,'2026-12-01')
    expect(a.availableReserveTonnes).toBeGreaterThan(0)
    expect(b.availableReserveTonnes).toBe(0)
    expect(b.committedReleaseTonnes).toBe(0)
  })
  it('missing commodity has no fabricated operational records',()=>{
    const r=linkCommodityOperations('nonexistent',example,'2026-11-01')
    expect(r.contracts).toEqual([])
    expect(r.availableReserveTonnes).toBe(0)
    expect(r.deliveredTonnes).toBe(0)
  })
})
