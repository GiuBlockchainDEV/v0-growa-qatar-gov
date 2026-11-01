import {
  operationalVolume, type OperationsRow, type OperationsSnapshot,
} from '@/lib/nfii/operations-types'

export interface CommoditySupplyLinks {
  suppliers: OperationsRow[]
  contracts: OperationsRow[]
  orders: OperationsRow[]
  shipments: OperationsRow[]
  lots: OperationsRow[]
  releases: OperationsRow[]
  approvedContractTonnes: number
  approvedOrderTonnes: number
  activeShipments: number
  delayedShipments: number
  deliveredTonnes: number
  usableReserveTonnes: number
  committedReleaseTonnes: number
  availableReserveTonnes: number
  pendingApprovals: number
}

const round=(n:number)=>Math.round((n+Number.EPSILON)*1000)/1000

/**
 * Relational joins for ONE commodity. Never add these administrative records
 * to the reviewed Food Balance; shipments and lots can reflect the same goods.
 */
export function linkCommodityOperations(
  commodityId: string, snapshot: OperationsSnapshot, today: string,
): CommoditySupplyLinks {
  const contracts = snapshot.contracts.filter(r=>r.commodity_code===commodityId)
  const contractIds = new Set(contracts.map(r=>r.id))
  const supplierIds = new Set(contracts.map(r=>r.supplier_id))
  const suppliers = snapshot.suppliers.filter(r=>supplierIds.has(r.id))
  const orders = snapshot.purchaseOrders.filter(r=>r.contract_id&&contractIds.has(r.contract_id))
  const orderIds = new Set(orders.map(r=>r.id))
  const shipments = snapshot.shipments.filter(r=>r.purchase_order_id&&orderIds.has(r.purchase_order_id))
  const shipmentIds = new Set(shipments.map(r=>r.id))
  const lots = snapshot.lots.filter(r=>r.shipment_id&&shipmentIds.has(r.shipment_id))
  const lotIds = new Set(lots.map(r=>r.id))
  const releases = snapshot.releases.filter(r=>r.lot_id&&lotIds.has(r.lot_id))
  const usableLots = lots.filter(r=>r.status==='approved'&&Boolean(r.expiry_date)&&
    String(r.expiry_date)>=today)
  const usableLotIds = new Set(usableLots.map(r=>r.id))
  const physical = usableLots.reduce((n,r)=>n+Math.max(0,
    operationalVolume(r.received_tonnes)-operationalVolume(r.released_tonnes)),0)
  const committed = releases.filter(r=>r.status==='approved'&&r.lot_id&&
    usableLotIds.has(r.lot_id)).reduce((n,r)=>n+operationalVolume(r.quantity_tonnes),0)
  const pendingTypes = new Set(['supplier','contract','purchase_order','warehouse','lot','release'])
  const targetIds = new Set([...suppliers,...contracts,...orders,...lots,...releases].map(r=>r.id))
  const warehouses = new Set(lots.map(r=>r.warehouse_id))
  for(const r of snapshot.warehouses)if(warehouses.has(r.id))targetIds.add(r.id)

  return {
    suppliers,contracts,orders,shipments,lots,releases,
    approvedContractTonnes:round(contracts.filter(r=>r.status==='approved')
      .reduce((n,r)=>n+operationalVolume(r.contracted_tonnes),0)),
    approvedOrderTonnes:round(orders.filter(r=>r.status==='approved')
      .reduce((n,r)=>n+operationalVolume(r.ordered_tonnes),0)),
    activeShipments:shipments.filter(r=>['planned','in_transit','delayed'].includes(r.status??'')).length,
    delayedShipments:shipments.filter(r=>r.status==='delayed').length,
    deliveredTonnes:round(shipments.filter(r=>r.status==='delivered')
      .reduce((n,r)=>n+operationalVolume(r.shipment_tonnes),0)),
    usableReserveTonnes:round(physical),
    committedReleaseTonnes:round(committed),
    availableReserveTonnes:round(Math.max(0,physical-committed)),
    pendingApprovals:snapshot.approvals.filter(a=>a.status==='pending'&&
      pendingTypes.has(a.target_type??'')&&a.target_id&&targetIds.has(a.target_id)).length,
  }
}
