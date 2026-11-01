'use client'

import {ArrowRight,CheckCircle2,ClipboardCheck,FileText,PackageCheck,ShieldAlert,Truck,Users,X} from 'lucide-react'
import type {OperationsRow,OperationsSnapshot} from '@/lib/nfii/operations-types'
import {
  approvalReadiness,approvalTarget,contractPosition,getRecordApproval,
  orderPosition,procurementRecordLabel,supplierPosition,
  type ProcurementRecordView,
} from '@/lib/nfii/procurement-workflow'
import {useI18n} from '@/lib/i18n'

type Props={
  view:ProcurementRecordView
  record:OperationsRow
  snapshot:OperationsSnapshot
  today:string
  isPreview:boolean
  canEdit:boolean
  canApprove:boolean
  busy:boolean
  currentUserId:string|null
  onClose:()=>void
  onOpen:(view:ProcurementRecordView,id:string)=>void
  onCreateContract:(supplier:OperationsRow)=>void
  onCreateOrder:(contract:OperationsRow)=>void
  onOpenApproval:(approval:OperationsRow,decision:'approve'|'reject')=>void
  onGoToLogistics:()=>void
}
const amount=(n:number,digits=2)=>n.toLocaleString('en-US',{
  maximumFractionDigits:digits,minimumFractionDigits:digits,
})
const date=(date:unknown)=>typeof date==='string'?date.slice(0,10):'—'

export function ProcurementRecordPanel(props:Props){
  const {view,record,snapshot:s,today,isPreview,canEdit,canApprove,busy,
    currentUserId,onClose,onOpen,onCreateContract,onCreateOrder,onOpenApproval,
    onGoToLogistics}=props
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const supplier=view==='suppliers'?record:
    view==='contracts'?s.suppliers.find(row=>row.id===record.supplier_id):
    view==='purchaseOrders'?
      s.suppliers.find(row=>row.id===s.contracts.find(c=>c.id===record.contract_id)?.supplier_id):
      undefined
  const contract=view==='contracts'?record:view==='purchaseOrders'?
    s.contracts.find(row=>row.id===record.contract_id):undefined
  const orderInfo=view==='purchaseOrders'?orderPosition(s,record):null
  const position=contract?contractPosition(s,contract,today):null
  const supplierInfo=supplier?supplierPosition(s,supplier.id,today):null
  const target=view==='approvals'?approvalTarget(s,record):null
  const readiness=view==='approvals'?approvalReadiness(s,record,today):null
  const approvalType=view==='suppliers'?'supplier':
    view==='contracts'?'contract':view==='purchaseOrders'?'purchase_order':null
  const pendingApproval=approvalType?getRecordApproval(s,approvalType,record.id):undefined
  const isReviewer=view==='approvals'&&canApprove&&!isPreview&&!busy&&
    currentUserId!==record.submitted_by&&record.status==='pending'
  const links=view==='suppliers'
    ?s.contracts.filter(x=>x.supplier_id===record.id)
    :view==='contracts'?s.purchaseOrders.filter(x=>x.contract_id===record.id)
      :view==='purchaseOrders'?s.shipments.filter(x=>x.purchase_order_id===record.id):[]
  const total=orderInfo?orderInfo.totalValueQar:position?position.faceValueQar:null
  const tiles:Array<[string,string]>=[
    ...(supplierInfo?[
      [tx('Approved contracts','عقود معتمدة'),String(supplierInfo.approvedContractCount)],
      [tx('Active contracts','عقود سارية'),String(supplierInfo.activeContractCount)],
      [tx('Approved orders','طلبات معتمدة'),String(supplierInfo.approvedOrderCount)],
    ] as Array<[string,string]>:[]),
    ...(position?[
      [tx('Contract quantity','كمية العقد'),amount(position.quantity,3)+' t'],
      [tx('Unit price','سعر الوحدة'),amount(position.unitQarKg,3)+' QAR/kg'],
      [tx('Approved orders','طلبات معتمدة'),amount(position.approvedTonnes,3)+' t'],
      [tx('Remaining capacity','الكمية المتبقية'),amount(position.remainingTonnes,3)+' t'],
    ] as Array<[string,string]>:[]),
    ...(orderInfo?[
      [tx('Ordered quantity','كمية الطلب'),amount(orderInfo.quantity,3)+' t'],
      [tx('Contract price','سعر العقد'),amount(orderInfo.price/1000,3)+' QAR/kg'],
      [tx('Allocated shipments','شحنات مخصصة'),amount(orderInfo.allocatedTonnes,3)+' t'],
      [tx('Unshipped','غير مشحون'),amount(orderInfo.unshippedTonnes,3)+' t'],
    ] as Array<[string,string]>:[]),
  ]
  return <section aria-label={tx('Selected procurement record','السجل المختار')}
    className="nfii-panel overflow-hidden">
    <div className="flex items-start justify-between gap-2 border-b border-line p-4">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase text-sage-700">
          {tx('RECORD DETAILS · '+(isPreview?'READ ONLY':'LIVE'),'تفاصيل السجل')}
        </p>
        <h3 className="mt-1 break-words text-[16px] font-semibold text-content">
          {procurementRecordLabel(record)}
        </h3>
        <p className="mt-1 text-[11px] text-content-soft">
          {tx('Status','الحالة')}: <strong className="text-content">
            {String(record.status??'unknown').replaceAll('_',' ')}
          </strong>
        </p>
      </div>
      <button type="button" onClick={onClose}
        aria-label={tx('Close record details','إغلاق تفاصيل السجل')}
        className="rounded-md border border-line p-2 text-content-soft hover:text-content">
        <X className="h-4 w-4"/>
      </button>
    </div>
    <div className="space-y-4 p-4 text-[12px]">
      {target&&<div className="rounded-lg border border-line bg-muted/20 p-3">
        <p className="text-[10px] text-content-soft">{tx('Approval target','سجل الموافقة')}</p>
        <button type="button" onClick={()=>onOpen(target.view,target.record.id)}
          className="mt-1 flex w-full items-center justify-between gap-2 text-left font-semibold text-sage-700 underline">
          {procurementRecordLabel(target.record)}<ArrowRight className="h-4 w-4"/>
        </button>
        <p className="mt-1 text-[11px] text-content-soft">{target.view} · {target.record.status}</p>
      </div>}
      {view==='approvals'&&!target&&<p role="status" className="rounded-lg border border-warning-line bg-warning-soft p-3">
        {tx('Approval target is not available in the loaded register. Check the data limit or refresh before deciding.',
          'سجل الموافقة غير متاح في القائمة المحملة.')}
      </p>}
      {supplier&&view!=='suppliers'&&<button type="button"
        onClick={()=>onOpen('suppliers',supplier.id)}
        className="flex w-full items-center justify-between rounded-lg border border-line bg-background p-3 text-left hover:border-line-accent">
        <span><span className="block text-[10px] text-content-soft">{tx('Supplier','المورد')}</span>
          <strong className="text-content">{procurementRecordLabel(supplier)}</strong></span>
        <ArrowRight className="h-4 w-4 text-sage-700"/>
      </button>}
      {contract&&view==='purchaseOrders'&&<button type="button"
        onClick={()=>onOpen('contracts',contract.id)}
        className="flex w-full items-center justify-between rounded-lg border border-line bg-background p-3 text-left hover:border-line-accent">
        <span><span className="block text-[10px] text-content-soft">{tx('Parent contract','العقد الرئيسي')}</span>
          <strong className="text-content">{procurementRecordLabel(contract)}</strong></span>
        <ArrowRight className="h-4 w-4 text-sage-700"/>
      </button>}
      {view==='suppliers'&&<div className="rounded-lg border border-line p-3">
        <p><span className="text-content-soft">{tx('Country','الدولة')}: </span>{record.country_code??'—'}</p>
        <p className="mt-1 text-[11px] text-content-soft">{tx(
          'NFII approval confirms an internal review, not current export licences, food safety or product availability.',
          'موافقة NFII مراجعة داخلية ولا تثبت تراخيص التصدير أو توفر المنتجات.')}</p>
      </div>}
      {tiles.length>0&&<div className="grid grid-cols-2 gap-2">
        {tiles.map(([label,value])=><div key={label}
          className="rounded-lg border border-line bg-muted/20 p-3">
          <p className="text-[10px] text-content-soft">{label}</p>
          <p className="mt-1 font-semibold tabular-nums text-content">{value}</p>
        </div>)}
      </div>}
      {position&&<div className="rounded-lg border border-line p-3">
        <p className="text-[11px] text-content-soft">{tx('Contract value','قيمة العقد')}: <strong className="text-content">
          {amount(position.faceValueQar)} QAR</strong></p>
        <p className="mt-1 text-[11px] text-content-soft">{tx('Validity','الصلاحية')}: {date(contract?.valid_from)} → {date(contract?.valid_to)}</p>
        <p className="mt-1 text-[11px] text-content-soft">{tx('Commodity','السلعة')}: {contract?.commodity_code??'—'}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-sage-600" style={{width:position.utilizationPct+'%'}}/>
        </div>
        <p className="mt-1 text-[10px] text-content-soft">
          {amount(position.utilizationPct,1)}% {tx('approved quantity committed','من الكمية معتمدة وملتزم بها')}.
          {' '}{amount(position.pendingTonnes,3)} t {tx('pending review','قيد المراجعة')}.
        </p>
        {!position.current&&<p className="mt-2 text-[11px] text-warning-strong">
          {tx('Contract is outside its current validity period. New orders are blocked.',
            'العقد خارج فترة الصلاحية الحالية.')}
        </p>}
      </div>}
      {total!==null&&<p className="rounded-lg border border-line-accent bg-cream-100/30 p-3 font-semibold tabular-nums text-content">
        {tx('Calculated value','القيمة المحسوبة')}: {amount(total)} QAR
        <span className="mt-1 block text-[10px] font-normal text-content-soft">
          {tx('Quantity × approved contract QAR/tonne; excludes freight, tax and unforeseen charges.',
            'الكمية في السعر التعاقدي دون الشحن والضرائب.')}
        </span>
      </p>}
      {view==='approvals'&&readiness&&<div className={'rounded-lg border p-3 '+
        (readiness.ready?'border-line-accent bg-cream-100/25':'border-warning-line bg-warning-soft')}>
        <p className="flex items-center gap-2 font-semibold">
          {readiness.ready?<CheckCircle2 className="h-4 w-4 text-sage-700"/>:
            <ShieldAlert className="h-4 w-4 text-warning-strong"/>}
          {readiness.reason}
        </p>
        <p className="mt-1 text-[11px] text-content-soft">{readiness.details}</p>
        {record.submitted_by&&<p className="mt-2 text-[10px] text-content-soft">
          {tx('Submitted by','مقدم من')}: {record.submitted_by===currentUserId?'You':record.submitted_by.slice(0,8)}
        </p>}
      </div>}
      {pendingApproval&&<button type="button"
        onClick={()=>onOpen('approvals',pendingApproval.id)}
        className="flex w-full items-center justify-between rounded-lg border border-line-accent bg-cream-100/25 p-3 font-medium text-sage-700">
        <span className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4"/>
          {tx('View pending independent approval','عرض الموافقة المستقلة المعلقة')}</span>
        <ArrowRight className="h-4 w-4"/>
      </button>}
      {view!=='approvals'&&<div>
        <h4 className="text-[12px] font-semibold text-content">{tx(
          view==='suppliers'?'Linked contracts':view==='contracts'?'Linked purchase orders':'Related shipments',
          view==='suppliers'?'العقود المرتبطة':view==='contracts'?'أوامر الشراء المرتبطة':'الشحنات المرتبطة')}
          {' '}({links.length})
        </h4>
        <div className="mt-2 space-y-1.5">
          {links.slice(0,30).map(link=><button type="button" key={link.id}
            onClick={()=>view==='suppliers'?onOpen('contracts',link.id):
              view==='contracts'?onOpen('purchaseOrders',link.id):onGoToLogistics()}
            className="flex w-full items-center justify-between gap-2 rounded-md border border-line p-2.5 text-left hover:border-line-accent">
            <span className="min-w-0 truncate">{procurementRecordLabel(link)}
              <span className="ms-2 text-[10px] text-content-soft">{link.status}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-sage-700"/>
          </button>)}
          {links.length>30&&<p className="text-[10px] text-content-soft">{tx('Additional records not displayed.','توجد سجلات إضافية.')}</p>}
          {links.length===0&&<p className="rounded-md bg-muted/20 p-3 text-[11px] text-content-soft">
            {tx('No linked records yet.','لا توجد سجلات مرتبطة بعد.')}
          </p>}
        </div>
      </div>}
      {view==='suppliers'&&record.status==='approved'&&
        <button type="button" disabled={!canEdit||isPreview}
          onClick={()=>onCreateContract(record)} className="nfii-button w-full disabled:opacity-50">
          <FileText className="h-4 w-4"/>{tx('Create contract with this supplier','إنشاء عقد مع هذا المورد')}
        </button>}
      {view==='contracts'&&position?.canOrder&&
        <button type="button" disabled={!canEdit||isPreview}
          onClick={()=>onCreateOrder(record)} className="nfii-button w-full disabled:opacity-50">
          <PackageCheck className="h-4 w-4"/>{tx('Create order from this contract','إنشاء طلب شراء من هذا العقد')}
        </button>}
      {view==='purchaseOrders'&&record.status==='approved'&&
        <button type="button" onClick={onGoToLogistics}
          className="nfii-button w-full">
          <Truck className="h-4 w-4"/>{tx('Open Logistics to plan shipment','فتح الشحن والتوريد')}
        </button>}
      {view==='approvals'&&isReviewer&&<div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={!readiness?.ready}
          onClick={()=>onOpenApproval(record,'approve')}
          className="nfii-button w-full disabled:opacity-50">
          <CheckCircle2 className="h-4 w-4"/>{tx('Approve','اعتماد')}
        </button>
        <button type="button"
          onClick={()=>onOpenApproval(record,'reject')}
          className="nfii-button nfii-button-secondary w-full">
          <ShieldAlert className="h-4 w-4"/>{tx('Reject','رفض')}
        </button>
        <p className="col-span-2 text-[10px] text-content-soft">
          {tx('Either decision requires an independently documented note and a second confirmation.',
            'يتطلب كلا القرارين ملاحظة موثقة وتأكيداً مستقلاً.')}
        </p>
      </div>}
      {isPreview&&<p className="text-[11px] text-content-soft">
        <Users className="me-1 inline h-3.5 w-3.5"/>
        {tx('Read-only: an accessible organization register is required before changes can be approved.',
          'للقراءة فقط: يلزم سجل مؤسسة فعلي متاح لاعتماد التغييرات.')}
      </p>}
    </div>
  </section>
}
