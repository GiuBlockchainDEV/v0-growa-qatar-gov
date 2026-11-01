import type {OperationsRow,OperationsSnapshot} from './operations-types'
import {operationalVolume} from './operations-types'

export type ProcurementRecordView='suppliers'|'contracts'|'purchaseOrders'|'approvals'
export type ProcurementRecordLink={view:ProcurementRecordView;id:string;label:string}

/** All relationships use IDs loaded from the user's organization-scoped ledger. */
export function approvalTarget(snapshot:OperationsSnapshot,approval:OperationsRow):
  {view:Exclude<ProcurementRecordView,'approvals'>;record:OperationsRow}|null{
  const map:Record<string,Exclude<ProcurementRecordView,'approvals'>>={
    supplier:'suppliers',contract:'contracts',purchase_order:'purchaseOrders',
  }
  const view=map[approval.target_type??'']
  if(!view)return null
  const record=snapshot[view].find(row=>row.id===approval.target_id)
  return record?{view,record}:null
}

export function getRecordApproval(snapshot:OperationsSnapshot,
  type:'supplier'|'contract'|'purchase_order',recordId:string){
  return snapshot.approvals.find(a=>a.target_type===type&&
    a.target_id===recordId&&a.status==='pending')
}

export function contractPosition(snapshot:OperationsSnapshot,contract:OperationsRow,asOf:string){
  const quantity=operationalVolume(contract.contracted_tonnes)
  const price=operationalVolume(contract.price_qar_per_tonne)
  const orders=snapshot.purchaseOrders.filter(r=>r.contract_id===contract.id)
  const approvedTonnes=orders.filter(r=>r.status==='approved').reduce(
    (sum,r)=>sum+operationalVolume(r.ordered_tonnes),0)
  const pendingTonnes=orders.filter(r=>r.status==='pending').reduce(
    (sum,r)=>sum+operationalVolume(r.ordered_tonnes),0)
  const remainingTonnes=Math.max(0,quantity-approvedTonnes)
  const current=Boolean(contract.valid_from&&contract.valid_to&&
    String(contract.valid_from)<=asOf&&String(contract.valid_to)>=asOf)
  return {
    quantity,price,unitQarKg:price/1000,
    faceValueQar:quantity*price,
    approvedTonnes,pendingTonnes,remainingTonnes,
    approvedValueQar:approvedTonnes*price,
    pendingValueQar:pendingTonnes*price,
    availableAfterPendingTonnes:Math.max(0,remainingTonnes-pendingTonnes),
    current,canOrder:contract.status==='approved'&&current&&remainingTonnes>0,
    utilizationPct:quantity>0?Math.min(100,approvedTonnes/quantity*100):0,
    approvedOrderCount:orders.filter(r=>r.status==='approved').length,
    pendingOrderCount:orders.filter(r=>r.status==='pending').length,
  }
}

export function supplierPosition(snapshot:OperationsSnapshot,supplierId:string,asOf:string){
  const contracts=snapshot.contracts.filter(r=>r.supplier_id===supplierId)
  const approved=contracts.filter(r=>r.status==='approved')
  const current=approved.filter(r=>contractPosition(snapshot,r,asOf).current)
  return {
    contractCount:contracts.length,
    approvedContractCount:approved.length,
    pendingContractCount:contracts.filter(r=>r.status==='pending').length,
    activeContractCount:current.length,
    activeFaceValueQar:current.reduce((sum,r)=>sum+contractPosition(snapshot,r,asOf).faceValueQar,0),
    approvedOrderCount:approved.reduce((sum,r)=>sum+contractPosition(snapshot,r,asOf).approvedOrderCount,0),
  }
}

export function orderPosition(snapshot:OperationsSnapshot,order:OperationsRow){
  const contract=snapshot.contracts.find(r=>r.id===order.contract_id)
  const supplier=contract?snapshot.suppliers.find(r=>r.id===contract.supplier_id):undefined
  const quantity=operationalVolume(order.ordered_tonnes)
  const price=operationalVolume(contract?.price_qar_per_tonne)
  const shipments=snapshot.shipments.filter(r=>r.purchase_order_id===order.id)
  const allocatedTonnes=shipments.filter(r=>r.status!=='cancelled')
    .reduce((sum,r)=>sum+operationalVolume(r.shipment_tonnes),0)
  const deliveredTonnes=shipments.filter(r=>r.status==='delivered')
    .reduce((sum,r)=>sum+operationalVolume(r.shipment_tonnes),0)
  return {
    contract,supplier,quantity,price,totalValueQar:quantity*price,
    allocatedTonnes,deliveredTonnes,
    unshippedTonnes:Math.max(0,quantity-allocatedTonnes),
    shipmentCount:shipments.filter(r=>r.status!=='cancelled').length,
  }
}

export type ProcurementReadiness={ready:boolean;reason:string;details:string}
/** Eligibility hint, NOT a permission grant. SQL RPC remains authoritative. */
export function approvalReadiness(snapshot:OperationsSnapshot,
  approval:OperationsRow,asOf:string):ProcurementReadiness{
  if(approval.status!=='pending')return {
    ready:false,reason:'Decision already recorded',
    details:'Only pending approval requests can be reviewed.',
  }
  const target=approvalTarget(snapshot,approval)
  if(!target)return {
    ready:false,reason:'Record not available in loaded register',
    details:'Refresh the ledger or check whether the 150-row list is truncated.',
  }
  const {record,view}=target
  if(record.status!=='pending')return {
    ready:false,reason:'Record is no longer pending',
    details:'Refresh before making an independent approval decision.',
  }
  if(view==='suppliers')return {
    ready:true,reason:'Legal supplier record pending qualification',
    details:'Check registration, actual food activities, sanctions/compliance and evidence. Internal approval does not validate external certificates.',
  }
  if(view==='contracts'){
    const supplier=snapshot.suppliers.find(s=>s.id===record.supplier_id)
    if(!supplier||supplier.status!=='approved')return {
      ready:false,reason:'Linked supplier is not approved',
      details:'Supplier approval is required before approving this contract.',
    }
    return {
      ready:true,reason:'Contract ready for documentary review',
      details:'Verify signed agreement, commodity, quantity, QAR/tonne, delivery terms and validity dates.',
    }
  }
  const parent=snapshot.contracts.find(c=>c.id===record.contract_id)
  if(!parent||parent.status!=='approved')return {
    ready:false,reason:'Linked contract is not approved',
    details:'Only orders against an approved contract can be approved.',
  }
  const capacity=contractPosition(snapshot,parent,asOf)
  if(!capacity.current)return {
    ready:false,reason:'Contract is not currently valid',
    details:'The contract must be in its validity period on the approval date.',
  }
  if(operationalVolume(record.ordered_tonnes)>capacity.remainingTonnes)return {
    ready:false,reason:'Order exceeds the remaining approved contract quantity',
    details:'Review other approved orders and remaining contracted tonnes.',
  }
  return {
    ready:true,reason:'Order ready for documentary review',
    details:'Verify PO reference, committed tonnage, implied QAR value, terms, and independent authorization.',
  }
}

export function procurementRecordLabel(row:OperationsRow){
  return row.name||row.contract_ref||row.order_ref||row.code||row.id.slice(0,8)
}
