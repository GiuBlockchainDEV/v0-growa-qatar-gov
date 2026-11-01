import {describe,expect,it} from 'vitest'
import {
  buildReservePortfolio,runReserveAgent,type VerifiedReserveDemand,
} from './reserves-intelligence'
import {EMPTY_OPERATIONS,type OperationsSnapshot} from './operations-types'

const org='11111111-1111-4111-8111-111111111111'
const today='2026-11-01'
const stock:OperationsSnapshot={
  ...EMPTY_OPERATIONS,
  warehouses:[
    {id:'wh-a',organization_id:org,code:'DOHA-01',name:'Doha storage',
      location:'Doha',status:'approved'},
  ],
  contracts:[
    {id:'ctr-a',organization_id:org,commodity_code:'rice',status:'approved'},
  ],
  purchaseOrders:[
    {id:'po-a',organization_id:org,contract_id:'ctr-a',status:'approved'},
  ],
  shipments:[
    {id:'sh-a',organization_id:org,purchase_order_id:'po-a',status:'delivered',
      shipment_ref:'BL-ABC'},
  ],
  lots:[
    {id:'lot-1',organization_id:org,lot_ref:'LOT-RICE-01',
      warehouse_id:'wh-a',shipment_id:'sh-a',commodity_code:'rice',
      received_tonnes:'100',released_tonnes:'20',expiry_date:'2026-11-07',
      status:'approved'},
    {id:'lot-2',organization_id:org,lot_ref:'LOT-RICE-EXPIRED',
      warehouse_id:'wh-a',shipment_id:'sh-a',commodity_code:'rice',
      received_tonnes:'40',released_tonnes:'0',expiry_date:'2026-10-20',
      status:'approved'},
    {id:'lot-3',organization_id:org,lot_ref:'LOT-PENDING',
      warehouse_id:'wh-a',shipment_id:'sh-a',commodity_code:'rice',
      received_tonnes:'700',released_tonnes:'0',expiry_date:'2027-07-01',
      status:'pending'},
    {id:'lot-4',organization_id:org,lot_ref:'LOT-UNKNOWN',
      warehouse_id:'missing-warehouse',shipment_id:'sh-a',commodity_code:'rice',
      received_tonnes:'5',released_tonnes:'0',expiry_date:'2026-12-10',
      status:'approved'},
  ],
  releases:[
    {id:'rel-approved',organization_id:org,lot_id:'lot-1',status:'approved',quantity_tonnes:'30'},
    {id:'rel-executed',organization_id:org,lot_id:'lot-1',status:'executed',quantity_tonnes:'20'},
    {id:'rel-pending',organization_id:org,lot_id:'lot-1',status:'pending',quantity_tonnes:'60'},
  ],
  approvals:[
    {id:'approval-1',organization_id:org,target_type:'release',target_id:'rel-pending',status:'pending'},
  ],
}
const demand:VerifiedReserveDemand={
  commodityCode:'rice',consumptionTonnes:150,days:30,
  sourceRefs:['reviewed-coverage-1','verified-flow-2'],
  periodStart:'2026-11-01',periodEnd:'2026-11-30',
}
describe('Strategic reserve traceable inventory',()=>{
  it('subtracts executed releases only via lot released_tonnes, then approved outstanding commitments',()=>{
    const p=buildReservePortfolio(stock,today)
    expect(p.onHandTonnes).toBe(80)
    expect(p.committedTonnes).toBe(30)
    expect(p.uncommittedTonnes).toBe(50)
    expect(p.eligibleLots).toBe(1)
    expect(p.pendingReleaseTonnes).toBe(60)
    expect(p.expiring30Tonnes).toBe(80)
    expect(p.expiryBuckets[0].onHandTonnes).toBe(80)
    expect(p.commodities[0].id).toBe('rice')
    expect(p.warehouseGroups[0].id).toBe('wh-a')
  })
  it('excludes expired, pending and missing-warehouse lots instead of guessing inventory',()=>{
    const p=buildReservePortfolio(stock,today)
    expect(p.unverifiedLots).toBe(3)
    expect(p.expiredRecordedTonnes).toBe(40)
    expect(p.excludedRecordedTonnes).toBe(45)
    expect(p.lots.find(l=>l.id==='lot-3')?.eligible).toBe(false)
    expect(p.lots.find(l=>l.id==='lot-4')?.issues).toContain('Approved warehouse evidence missing')
  })
  it('excludes inconsistent release quantities and never makes negative available inventory',()=>{
    const s:OperationsSnapshot={...stock,releases:[
      {...stock.releases[0],quantity_tonnes:'90'},
      ...stock.releases.slice(1),
    ]}
    const p=buildReservePortfolio(s,today)
    expect(p.onHandTonnes).toBe(0)
    expect(p.uncommittedTonnes).toBe(0)
    expect(p.overcommittedLots).toBe(1)
    expect(p.lots.find(l=>l.id==='lot-1')?.issues).toContain('Approved release commitments exceed on-hand quantity')
  })
  it('does not count a lot without delivered shipment proof',()=>{
    const s:OperationsSnapshot={...stock,shipments:[{...stock.shipments[0],status:'delayed'}]}
    const p=buildReservePortfolio(s,today)
    expect(p.eligibleLots).toBe(0)
    expect(p.onHandTonnes).toBe(0)
    expect(p.lots.find(l=>l.id==='lot-1')?.issues).toContain('Delivered shipment evidence missing')
  })
  it('returns no physically proven stock when no record exists',()=>{
    const p=buildReservePortfolio(EMPTY_OPERATIONS,today)
    expect(p.totalLotRecords).toBe(0)
    expect(p.commodities).toEqual([])
    expect(p.expiryBuckets.every(row=>row.onHandTonnes===0)).toBe(true)
  })
  it('marks truncated source data as a partial, not a national total',()=>{
    const p=buildReservePortfolio(stock,today,['lots','releases'])
    expect(p.partial).toBe(true)
    expect(p.truncated).toEqual(['lots','releases'])
  })
  it('validates calendar dates before computing quantities',()=>{
    expect(()=>buildReservePortfolio(stock,'2026-02-30')).toThrow('Invalid as-of date')
  })
})
describe('Reserve Intelligence Agent is a read-only, evidence-bound decision engine',()=>{
  it('does not require an AI key, write or invent events',()=>{
    const p=buildReservePortfolio(stock,today)
    const result=runReserveAgent(p,[],'2026-11-01T12:00:00.000Z')
    expect(result.coverage[0].days).toBeNull()
    expect(result.coverage[0].dailyDemand).toBeNull()
    expect(result.findings.some(f=>f.id==='demand:rice')).toBe(true)
    expect(result.findings.some(f=>f.id==='fefo:lot-1')).toBe(true)
    expect(result.findings.some(f=>f.id==='release:lot-1')).toBe(true)
    expect(result.findings.some(f=>f.id==='integrity:lot-2')).toBe(true)
    expect(result.findings[0].severity).toBe('critical')
    expect(result.decision).toContain('Reconcile')
  })
  it('uses reviewed consumption from the exact commodity to compute reserve cover',()=>{
    const p=buildReservePortfolio(stock,today)
    const result=runReserveAgent(p,[demand],'2026-11-01T12:00:00.000Z')
    expect(result.coverage[0].dailyDemand).toBe(5)
    expect(result.coverage[0].days).toBe(10)
    expect(result.coveredCommodities).toBe(1)
    expect(result.findings.find(f=>f.id==='coverage:rice')?.severity).toBe('high')
    expect(result.findings.find(f=>f.id==='coverage:rice')?.action).toBe('procurement')
  })
  it('rejects zero-consumption as a days-of-cover denominator',()=>{
    const p=buildReservePortfolio(stock,today)
    const result=runReserveAgent(p,[{...demand,consumptionTonnes:0}],
      '2026-11-01T12:00:00.000Z')
    expect(result.coverage[0].days).toBeNull()
  })
  it('shows absent records as an evidence gap rather than a safe assessment',()=>{
    const p=buildReservePortfolio(EMPTY_OPERATIONS,today)
    const result=runReserveAgent(p,[],'2026-11-01T12:00:00.000Z')
    expect(result.decision).toContain('Verify')
    expect(result.findings.some(f=>f.id==='missing-lots')).toBe(true)
    expect(result.coverage).toEqual([])
  })
  it('includes incomplete list evidence in the agent decision',()=>{
    const p=buildReservePortfolio(stock,today,['lots'])
    const result=runReserveAgent(p,[demand],'2026-11-01T12:00:00.000Z')
    expect(result.partial).toBe(true)
    expect(result.findings.some(f=>f.id==='partial-ledger')).toBe(true)
  })
})
