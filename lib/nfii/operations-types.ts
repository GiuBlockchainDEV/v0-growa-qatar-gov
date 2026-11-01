import qatarExample from '@/supabase/seeds/qatar-2026-sandbox/03_dataset_preview.json'

export type OperationsArea='procurement'|'logistics'|'reserves'
export type RecordStatus='pending'|'approved'|'rejected'|'planned'|'in_transit'|
  'delayed'|'delivered'|'cancelled'|'executed'

export interface OperationsRow {
  id: string
  organization_id: string
  status?: RecordStatus
  created_at?: string
  created_by?: string
  code?: string
  name?: string
  supplier_id?: string
  contract_id?: string
  purchase_order_id?: string
  shipment_id?: string
  warehouse_id?: string
  lot_id?: string
  target_type?: string
  target_id?: string
  submitted_by?: string
  reviewed_by?: string
  action?: string
  event_type?: string
  entity_type?: string
  review_note?: string
  country_code?: string
  commodity_code?: string
  contract_ref?: string
  order_ref?: string
  shipment_ref?: string
  lot_ref?: string
  release_ref?: string
  contracted_tonnes?: string | number
  ordered_tonnes?: string | number
  shipment_tonnes?: string | number
  received_tonnes?: string | number
  released_tonnes?: string | number
  quantity_tonnes?: string | number
  price_qar_per_tonne?: string | number
  valid_from?: string
  valid_to?: string
  eta_date?: string
  expiry_date?: string
  origin?: string
  destination?: string
  location?: string
  purpose?: string
  details?: Record<string,unknown>
}

export interface OperationsSnapshot {
  suppliers:OperationsRow[]
  contracts:OperationsRow[]
  purchaseOrders:OperationsRow[]
  shipments:OperationsRow[]
  warehouses:OperationsRow[]
  lots:OperationsRow[]
  releases:OperationsRow[]
  approvals:OperationsRow[]
  events:OperationsRow[]
}

export interface OperationsResponse {
  organizationId:string
  scope:'organization'
  dataSource:'database'
  generatedAt:string
  snapshot:OperationsSnapshot
  limits:{maxPerTable:number;truncated:string[]}
  note:string
}

export const EMPTY_OPERATIONS:OperationsSnapshot={
  suppliers:[],contracts:[],purchaseOrders:[],shipments:[],
  warehouses:[],lots:[],releases:[],approvals:[],events:[],
}

export function operationalVolume(value:unknown):number{
  const n=Number(value)
  return Number.isFinite(n)&&n>=0?n:0
}

/** Physical reserve inventory is separate from the reviewed food balance. */
export function reservePosition(snapshot:OperationsSnapshot,asOfDate:string){
  const usableLots=snapshot.lots.filter(row=>
    row.status==='approved' && Boolean(row.expiry_date) &&
    String(row.expiry_date)>=asOfDate
  )
  const physical=usableLots.reduce((sum,row)=>
    sum+Math.max(0,operationalVolume(row.received_tonnes)-
      operationalVolume(row.released_tonnes)),0)
  const reserved=snapshot.releases
    .filter(row=>row.status==='approved' &&
      usableLots.some(lot=>lot.id===row.lot_id))
    .reduce((sum,row)=>sum+operationalVolume(row.quantity_tonnes),0)
  return {
    availablePhysicalTonnes:Math.round(physical*1000)/1000,
    approvedReservedTonnes:Math.round(reserved*1000)/1000,
    uncommittedTonnes:Math.round(Math.max(0,physical-reserved)*1000)/1000,
    usableLotCount:usableLots.length,
  }
}


/**
 * Read-only illustrative view of the EXISTING Qatar seed preview.
 * It does not write to Supabase, attest sources, or impersonate a tenant.
 * Accessible within the signed-in dashboard while operational migration or
 * verified data are unavailable; all affected screens must disclose DEMO.
 */
export function previewOperationsSnapshot(asOfDate: string): OperationsSnapshot {
  const org = 'illustrative-only'
  const datePlus = (days: number): string => {
    const d = new Date(asOfDate + 'T00:00:00.000Z')
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }
  const id = (kind: string, key: string) => 'demo-' + kind + '-' + key
  const strip = (name: string) => name.replace(/^SIMULATED \| /, '')
  const fixture = qatarExample

  const suppliers: OperationsRow[] = fixture.suppliers.map(row => ({
    id: id('supplier', row.code), organization_id: org,
    code: row.code, name: strip(row.name), country_code: row.country,
    status: row.review as RecordStatus,
  }))
  const contracts: OperationsRow[] = fixture.contracts.map(row => ({
    id: id('contract', row.ref), organization_id: org,
    contract_ref: 'QA-EXAMPLE-CTR-' + row.ref,
    supplier_id: id('supplier', row.supplier),
    commodity_code: row.commodity,
    contracted_tonnes: row.quantity,
    price_qar_per_tonne: row.price,
    valid_from: datePlus(-30), valid_to: datePlus(360),
    status: row.review as RecordStatus,
  }))
  const purchaseOrders: OperationsRow[] = fixture.orders.map(row => ({
    id: id('order', row.ref), organization_id: org,
    order_ref: 'QA-EXAMPLE-PO-' + row.ref,
    contract_id: id('contract', row.contract),
    ordered_tonnes: row.quantity,
    status: row.review as RecordStatus,
  }))
  const shipments: OperationsRow[] = fixture.shipments.map(row => ({
    id: id('shipment', row.ref), organization_id: org,
    shipment_ref: 'QA-EXAMPLE-BL-' + row.ref,
    purchase_order_id: id('order', row.order),
    shipment_tonnes: row.quantity,
    origin: row.origin, destination: row.destination,
    eta_date: datePlus(row.eta),
    status: row.status as RecordStatus,
  }))
  const warehouses: OperationsRow[] = fixture.warehouses.map(row => ({
    id: id('warehouse', row.code), organization_id: org,
    code: row.code, name: strip(row.name), location: row.location,
    status: 'approved',
  }))
  const releases: OperationsRow[] = fixture.releases.map(row => ({
    id: id('release', row.ref), organization_id: org,
    release_ref: 'QA-EXAMPLE-REL-' + row.ref,
    lot_id: id('lot', row.lot), quantity_tonnes: row.quantity,
    purpose: row.purpose.replace(/^SIMULATION ONLY: /, ''),
    status: row.review as RecordStatus,
  }))
  const lots: OperationsRow[] = fixture.lots.map(row => ({
    id: id('lot', row.ref), organization_id: org,
    lot_ref: 'QA-EXAMPLE-LOT-' + row.ref,
    warehouse_id: id('warehouse', row.warehouse),
    shipment_id: id('shipment', row.shipment),
    received_tonnes: row.quantity,
    released_tonnes: releases
      .filter(release => release.lot_id === id('lot', row.ref) && release.status === 'executed')
      .reduce((n, release) => n + operationalVolume(release.quantity_tonnes), 0),
    expiry_date: datePlus(row.expiryDays),
    commodity_code: contracts.find(contract => {
      const shipment = shipments.find(sh => sh.id === id('shipment', row.shipment))
      const order = purchaseOrders.find(po => po.id === shipment?.purchase_order_id)
      return contract.id === order?.contract_id
    })?.commodity_code,
    status: 'approved',
  }))

  const approvals: OperationsRow[] = []
  for (const [targetType, items] of [
    ['supplier', suppliers], ['contract', contracts],
    ['purchase_order', purchaseOrders], ['warehouse', warehouses],
    ['lot', lots], ['release', releases],
  ] as const) {
    for (const entry of items) {
      if (entry.status === 'pending') approvals.push({
        id: id('approval', entry.id), organization_id: org,
        target_type: targetType, target_id: entry.id,
        status: 'pending', submitted_by: 'illustrative-author',
      })
    }
  }
  return {
    suppliers, contracts, purchaseOrders, shipments, warehouses,
    lots, releases, approvals, events: [],
  }
}
