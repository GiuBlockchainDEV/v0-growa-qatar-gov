'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowUpRight, Check, ClipboardCheck, FileCheck2,
  Layers, Plus, RefreshCw, Ship, ShoppingCart, Warehouse, X,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useOrganization } from '@/hooks/use-organization'
import { useActiveOrganizationOptional } from '@/contexts/active-organization-context'
import { useI18n } from '@/lib/i18n'
import { COMMODITY_CATALOG } from '@/lib/platform/commodity-catalog'
import { PageHeader } from '@/components/brand/layout'
import { GlobalSupplierResearch } from '@/components/dashboard/nfii-ops/global-supplier-research'
import { CropProducerDiscovery } from '@/components/dashboard/nfii-ops/crop-producer-discovery'
import { ProcurementRecordPanel } from '@/components/dashboard/nfii-ops/procurement-record-panel'
import { LogisticsCorridorIntelligence } from '@/components/dashboard/nfii-ops/logistics-corridor-intelligence'
import { StrategicReservesCommand } from '@/components/dashboard/nfii-ops/strategic-reserves-command'
import {approvalReadiness,approvalTarget,contractPosition,
  procurementRecordLabel,type ProcurementRecordView} from '@/lib/nfii/procurement-workflow'
import {
  ProcurementHome, ProcurementJourney, ProcurementStageHeading,
  procurementTabCollection, procurementTabKind, type ProcurementTab,
} from '@/components/dashboard/nfii-ops/procurement-journey'
import { supplierDraftCode, type SupplierCandidate } from '@/lib/nfii/procurement-global'
import {
  OPERATION_FIELDS, type NfiiOperationKind, type OperationField,
} from '@/lib/nfii/operations-validation'
import {
  EMPTY_OPERATIONS, operationalVolume, reservePosition,
  type OperationsArea, type OperationsRow, type OperationsResponse,
  type OperationsSnapshot,
} from '@/lib/nfii/operations-types'

type Collection = keyof OperationsSnapshot
type OperationAction = {
  kind: 'approval' | 'shipment' | 'release'
  id: string
  action: string
  title: string
}

const COLLECTION: Record<NfiiOperationKind, Collection> = {
  supplier: 'suppliers',
  contract: 'contracts',
  purchase_order: 'purchaseOrders',
  shipment: 'shipments',
  warehouse: 'warehouses',
  lot: 'lots',
  release: 'releases',
}

const COLLECTION_LABEL: Record<Collection, [string,string]> = {
  suppliers: ['Suppliers','الموردون'],
  contracts: ['Contracts','العقود'],
  purchaseOrders: ['Purchase orders','أوامر الشراء'],
  shipments: ['Shipments','الشحنات'],
  warehouses: ['Warehouses','المستودعات'],
  lots: ['Reserve lots','دفعات المخزون'],
  releases: ['Reserve releases','طلبات الصرف'],
  approvals: ['Approvals','الموافقات'],
  events: ['Audit events','أحداث التدقيق'],
}
const AREA: Record<OperationsArea, {
  en:string; ar:string; subtitleEn:string; subtitleAr:string;
  collections:Collection[]; kinds:NfiiOperationKind[];
}> = {
  procurement: {
    en:'Procurement',ar:'المشتريات',
    subtitleEn:'Find suppliers, qualify them, manage contracts and purchase orders in one guided workflow.',
    subtitleAr:'ابحث عن موردين وأهّلهم وأدر العقود وأوامر الشراء ضمن مسار واضح.',
    collections:['suppliers','contracts','purchaseOrders','approvals'],
    kinds:['supplier','contract','purchase_order'],
  },
  logistics:{
    en:'Logistics command',ar:'قيادة الخدمات اللوجستية',
    subtitleEn:'Shipment registry, documented dispatch and delivery status against approved orders.',
    subtitleAr:'سجل الشحنات والإرسال والتسليم الموثق المرتبط بأوامر شراء معتمدة.',
    collections:['shipments','purchaseOrders','events'],
    kinds:['shipment'],
  },
  reserves:{
    en:'Strategic reserves',ar:'الاحتياطيات الاستراتيجية',
    subtitleEn:'Verified warehouses, shipment-linked batches and controlled reserve release.',
    subtitleAr:'مستودعات معتمدة ودفعات مرتبطة بالشحنات وصرف مخزون خاضع للموافقة.',
    collections:['warehouses','lots','releases','approvals'],
    kinds:['warehouse','lot','release'],
  },
}

function qatarDate(): string {
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Qatar',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(new Date())
  const part=(type:string)=>parts.find(p=>p.type===type)?.value??''
  return part('year')+'-'+part('month')+'-'+part('day')
}

function number(value:unknown,decimals=1):string {
  const n=Number(value)
  return (value===null||value===undefined||!Number.isFinite(n))
    ? '—' : n.toLocaleString('en-US',{maximumFractionDigits:decimals})
}
function date(value:unknown):string {
  return value ? String(value).slice(0,10) : '—'
}
function statusClass(status:string):string {
  if(status==='approved'||status==='delivered'||status==='executed'){
    return 'border-line-accent bg-cream-100 text-sage-700'
  }
  if(status==='rejected'||status==='cancelled'){
    return 'border-warning-line bg-warning-soft text-critical'
  }
  if(status==='delayed'){
    return 'border-warning-line bg-warning-soft text-warning-strong'
  }
  return 'border-line bg-muted text-content-soft'
}
function Status({status}:{status:string|undefined}){
  return <span className={'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide '+
    statusClass(status??'unknown')}>{String(status??'—').replaceAll('_',' ')}</span>
}

function getLabel(row:Partial<OperationsRow> & {id:string}):string {
  return row.name||row.contract_ref||row.order_ref||row.shipment_ref||
    row.lot_ref||row.release_ref||row.code||row.id.slice(0,8)
}
function lookup(s:OperationsSnapshot,kind:Collection,id?:string){
  return s[kind].find(row=>row.id===id)
}
function getOptions(field:OperationField,snapshot:OperationsSnapshot,orgDate:string) {
  const key=field.key
  if(key==='supplierId')return snapshot.suppliers.filter(r=>r.status==='approved')
  if(key==='contractId')return snapshot.contracts.filter(r=>r.status==='approved'&&
    String(r.valid_from)<=orgDate&&String(r.valid_to)>=orgDate)
  if(key==='purchaseOrderId')return snapshot.purchaseOrders.filter(r=>r.status==='approved')
  if(key==='warehouseId')return snapshot.warehouses.filter(r=>r.status==='approved')
  if(key==='shipmentId')return snapshot.shipments.filter(r=>r.status==='delivered')
  if(key==='lotId')return snapshot.lots.filter(r=>r.status==='approved'&&
    String(r.expiry_date)>=orgDate&&
    operationalVolume(r.received_tonnes)>operationalVolume(r.released_tonnes))
  return []
}

function RecordDetails({row,view,snapshot,ar}:{
  row:OperationsRow;view:Collection;snapshot:OperationsSnapshot;ar:boolean
}){
  const pair=(key:string,val:unknown)=> (
    <span className="whitespace-nowrap" key={key}>
      <span className="text-content-soft">{key}: </span>{String(val??'—')}
    </span>
  )
  let detail:ReturnType<typeof pair>[]=[]
  switch(view){
    case 'suppliers':
      detail=[pair('ISO',row.country_code)];break
    case 'contracts':
      detail=[
        pair(ar?'المورد':'Supplier',getLabel(lookup(snapshot,'suppliers',row.supplier_id)??{id:'—'})),
        pair(ar?'السلعة':'Commodity',row.commodity_code),
        pair('t',number(row.contracted_tonnes)),pair('QAR/t',number(row.price_qar_per_tonne,2)),
        pair(ar?'حتى':'Until',date(row.valid_to)),
      ];break
    case 'purchaseOrders':
      detail=[
        pair(ar?'العقد':'Contract',getLabel(lookup(snapshot,'contracts',row.contract_id)??{id:'—'})),
        pair('t',number(row.ordered_tonnes)),
      ];break
    case 'shipments':
      detail=[
        pair(ar?'أمر الشراء':'Order',getLabel(lookup(snapshot,'purchaseOrders',row.purchase_order_id)??{id:'—'})),
        pair('t',number(row.shipment_tonnes)),pair('ETA',date(row.eta_date)),
        pair(ar?'الوجهة':'Destination',row.destination),
      ];break
    case 'warehouses':
      detail=[pair(ar?'المنطقة':'Location',row.location)];break
    case 'lots':
      detail=[
        pair(ar?'المستودع':'Warehouse',getLabel(lookup(snapshot,'warehouses',row.warehouse_id)??{id:'—'})),
        pair(ar?'الشحنة':'Shipment',getLabel(lookup(snapshot,'shipments',row.shipment_id)??{id:'—'})),
        pair(ar?'السلعة':'Commodity',row.commodity_code),
        pair('t',number(row.received_tonnes)),
        pair(ar?'متبقي':'Remaining',number(
          Math.max(0,operationalVolume(row.received_tonnes)-operationalVolume(row.released_tonnes))
        )),
        pair(ar?'الصلاحية':'Expiry',date(row.expiry_date)),
      ];break
    case 'releases':
      detail=[
        pair(ar?'الدفعة':'Lot',getLabel(lookup(snapshot,'lots',row.lot_id)??{id:'—'})),
        pair('t',number(row.quantity_tonnes)),
        pair(ar?'الغرض':'Purpose',row.purpose),
      ];break
    case 'approvals':
      detail=[
        pair(ar?'النوع':'Type',row.target_type),
        pair(ar?'السجل':'Record',getLabel(
          snapshot[row.target_type==='purchase_order'?'purchaseOrders':
            row.target_type==='supplier'?'suppliers':
            row.target_type==='contract'?'contracts':
            row.target_type==='warehouse'?'warehouses':
            row.target_type==='lot'?'lots':'releases'
          ].find(r=>r.id===row.target_id)??{id:'—'}
        )),
      ];break
    case 'events':
      detail=[pair(ar?'النوع':'Type',row.entity_type),
        pair(ar?'الحدث':'Event',row.action),
        pair(ar?'التاريخ':'Time',row.created_at?.slice(0,19).replace('T',' '))];break
  }
  return <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-content-soft">{detail}</div>
}

function OperationsHeader({focus,organizationName}:{
  focus:OperationsArea;organizationName:string|null
}){
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const links=[
    {href:'/dashboard?module=watchtower',en:'Watchtower',ar:'برج المراقبة',icon:Layers,active:false},
    {href:'/dashboard/procurement',en:'Procurement',ar:'المشتريات',icon:ShoppingCart,active:focus==='procurement'},
    {href:'/dashboard/logistics',en:'Logistics',ar:'الخدمات اللوجستية',icon:Ship,active:focus==='logistics'},
    {href:'/dashboard/reserves',en:'Strategic reserves',ar:'الاحتياطيات',icon:Warehouse,active:focus==='reserves'},
  ]
  const config=AREA[focus]
  return <header className="space-y-3">
    <PageHeader
      eyebrow={tx('Food security / Supply operations', 'الأمن الغذائي / عمليات الإمداد')}
      title={tx(config.en,config.ar)}
      subtitle={tx(config.subtitleEn,config.subtitleAr)}
      actions={
        <div className="text-[12px] text-content-soft">
          <span className="font-medium text-content">{organizationName??tx('Select organization','اختر المؤسسة')}</span>
          <p className="mt-1">{tx('Organization records · Independent review', 'سجلات المؤسسة · مراجعة مستقلة')}</p>
        </div>
      }
      className="!mb-1"
    />
    <nav aria-label={tx('Supply operations navigation','التنقل في عمليات الإمداد')}
      className="nfii-panel flex flex-wrap items-center gap-2 px-3 py-3">
      {links.map(link=>{
        const Icon=link.icon
        return <Link key={link.href} href={link.href}
          data-active={link.active}
          aria-current={link.active?'page':undefined}
          className="nfii-rail-link inline-flex items-center gap-2">
          <Icon className="h-4 w-4" aria-hidden="true"/>
          {tx(link.en,link.ar)}
        </Link>
      })}
    </nav>
  </header>
}

export function NfiiOperationsWorkspace({focus}:{focus:OperationsArea}){
  const router=useRouter()
  const {organization,loading:orgLoading}=useOrganization()
  const ctx=useActiveOrganizationOptional()
  const {user}=useAuth()
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const orgId=organization?.id??null
  const conf=AREA[focus]
  const [snapshot,setSnapshot]=useState<OperationsSnapshot|null>(null)
  const [activeView,setActiveView]=useState<Collection>(conf.collections[0])
  const [formKind,setFormKind]=useState<NfiiOperationKind>(conf.kinds[0])
  const [formValues,setFormValues]=useState<Record<string,string>>({})
  const [formOpen,setFormOpen]=useState(false)
  const [pendingAction,setPendingAction]=useState<OperationAction|null>(null)
  const [actionNote,setActionNote]=useState('')
  const [reload,setReload]=useState(0)
  const [loading,setLoading]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [truncated,setTruncated]=useState<string[]>([])
  const [procurementTab,setProcurementTab]=useState<ProcurementTab>('overview')
  const [reserveView,setReserveView]=useState<'command'|'register'>('command')
  const [recordSearch,setRecordSearch]=useState('')
  const [recordStatus,setRecordStatus]=useState('all')
  const [selectedProcurementRecord,setSelectedProcurementRecord]=useState<{
    view:ProcurementRecordView;id:string
  }|null>(null)

  useEffect(()=>{
    setSnapshot(null)
    setError('')
    setNotice('')
    setPendingAction(null)
    setSelectedProcurementRecord(null)
    if(!orgId||orgLoading){setLoading(false);return}
    const controller=new AbortController()
    const load=async()=>{
      setLoading(true)
      try {
        const res=await fetch('/api/nfii/operations?'+new URLSearchParams({organizationId:orgId}),{
          cache:'no-store',signal:controller.signal,
        })
        const body:(Partial<OperationsResponse>&{error?:string})=await res.json()
        if(!res.ok)throw Error(body.error??'Operations ledger unavailable')
        if(body.organizationId!==orgId||body.scope!=='organization'||body.dataSource!=='database'){
          throw Error('Unexpected operational data scope')
        }
        if(!body.snapshot)throw Error('Operational snapshot missing')
        if(!controller.signal.aborted){
          setSnapshot(body.snapshot)
          setTruncated(body.limits?.truncated??[])
        }
      }catch(err){
        if(!controller.signal.aborted){
          setSnapshot(null)
          setError(err instanceof Error?err.message:'Unable to load ledger')
        }
      }finally{if(!controller.signal.aborted)setLoading(false)}
    }
    void load()
    return()=>controller.abort()
  },[orgId,orgLoading,reload])

  const today=qatarDate()
  const liveHasRecords=snapshot!==null&&Object.values(snapshot).some(rows=>rows.length>0)
  // Never show synthetic contracts, shipments or reserves in live operations.
  const isPreview=!orgId||snapshot===null
  const s=snapshot??EMPTY_OPERATIONS
  const canEdit=!isPreview && (ctx?.hasPermission('supply.edit')??false)
  const canPropose=!isPreview && (ctx?.hasPermission('decisions.propose')??false)
  const canApprove=!isPreview && (ctx?.hasPermission('decisions.approve')??false)
  const canExecute=!isPreview && (ctx?.hasPermission('decisions.execute')??false)
  const canCreate=formKind==='release'?canPropose:canEdit
  const reserves=useMemo(()=>reservePosition(s,today),[s,today])
  const approvedSuppliers=s.suppliers.filter(row=>row.status==='approved')
  const approvedCurrentContracts=s.contracts.filter(row=>
    row.status==='approved'&&String(row.valid_from)<=today&&String(row.valid_to)>=today)
  const missingProcurementParent=focus==='procurement'&&(
    (formKind==='contract'&&approvedSuppliers.length===0) ||
    (formKind==='purchase_order'&&approvedCurrentContracts.length===0)
  )

  function selectProcurementTab(tab:ProcurementTab){
    setProcurementTab(tab)
    setSelectedProcurementRecord(null)
    const collection=procurementTabCollection(tab)
    const kind=procurementTabKind(tab)
    if(collection)setActiveView(collection)
    if(kind)setFormKind(kind)
    setRecordSearch('')
    setRecordStatus('all')
    setFormOpen(false)
    setFormValues({})
    setPendingAction(null)
    setNotice('')
  }

  function openProcurementRecord(view:ProcurementRecordView,id:string){
    const collection=view==='purchaseOrders'?'purchaseOrders':view
    if(!s[collection].some(row=>row.id===id)){
      setError(tx('Record unavailable in the loaded register. Refresh to inspect it.',
        'السجل غير متاح في القائمة المحملة.'))
      return
    }
    const next:ProcurementTab=view==='purchaseOrders'?'orders':view
    if(procurementTab!==next)selectProcurementTab(next)
    setActiveView(collection)
    setSelectedProcurementRecord({view,id})
    setRecordSearch('')
    setRecordStatus('all')
    setError('')
  }

  function startLinkedRecord(kind:'contract'|'purchase_order',parent:OperationsRow){
    if(isPreview||!canEdit||!orgId)return
    selectProcurementTab(kind==='contract'?'contracts':'orders')
    setFormKind(kind)
    setFormValues(kind==='contract'?{
      supplierId:parent.id,
    }:{
      contractId:parent.id,
      orderedTonnes:String(Math.min(
        contractPosition(s,parent,today).availableAfterPendingTonnes,
        contractPosition(s,parent,today).remainingTonnes,
      ).toFixed(3)),
    })
    setFormOpen(true)
    setNotice(tx('Linked draft prepared. Complete the required fields and submit for independent review.',
      'تم إعداد مسودة مرتبطة. أكمل الحقول وقدمها للمراجعة.'))
    window.requestAnimationFrame(()=>document.getElementById('nfii-create-record')?.
      scrollIntoView({behavior:'smooth',block:'start'}))
  }

  const selectedRow=selectedProcurementRecord?
    s[selectedProcurementRecord.view].find(row=>row.id===selectedProcurementRecord.id)??null:null

  const visibleRows=focus==='procurement'
    ?s[activeView].filter(row=>{
        const term=recordSearch.trim().toLowerCase()
        if(recordStatus!=='all' && String(row.status)!==recordStatus)return false
        if(!term)return true
        const supplier=row.supplier_id
          ?s.suppliers.find(x=>x.id===row.supplier_id)?.name??''
          :''
        return [
          getLabel(row),row.country_code,row.commodity_code,row.contract_ref,
          row.order_ref,row.target_type,supplier,row.status,
        ].some(value=>String(value??'').toLowerCase().includes(term))
      })
    :s[activeView]

  function prepareSupplier(candidate:SupplierCandidate){
    if(!orgId||isPreview||!canEdit||candidate.source!=='GLEIF'||
      !candidate.countryCode||candidate.name.length>200)return
    selectProcurementTab('suppliers')
    setFormKind('supplier')
    setFormValues({
      code:supplierDraftCode(candidate),
      name:candidate.name,
      countryCode:candidate.countryCode,
    })
    setFormOpen(true)
    setError('')
    setNotice(tx('Supplier draft prepared from global research. Verify its legal name, food activity and country before saving for independent review.',
      'أُعدت مسودة مورد من البحث العالمي. تحقق من الاسم القانوني والنشاط الغذائي والدولة قبل الحفظ للمراجعة المستقلة.'))
    document.getElementById('nfii-create-record')?.scrollIntoView({behavior:'smooth',block:'start'})
  }

  const recentApprovals=s.approvals.filter(row=>row.status==='pending')
  const scopedApprovals=focus==='procurement'
    ? recentApprovals.filter(row=>['supplier','contract','purchase_order'].includes(String(row.target_type)))
    :focus==='reserves'
      ?recentApprovals.filter(row=>['warehouse','lot','release'].includes(String(row.target_type)))
      :recentApprovals

  const kpis=focus==='procurement'?[
    {title:tx('Approved suppliers','الموردون المعتمدون'),
      value:s.suppliers.filter(r=>r.status==='approved').length.toString(),unit:''},
    {title:tx('Approved contracts','العقود المعتمدة'),
      value:s.contracts.filter(r=>r.status==='approved').length.toString(),unit:''},
    {title:tx('Approved order volume','حجم الطلبات المعتمدة'),
      value:number(s.purchaseOrders.filter(r=>r.status==='approved')
        .reduce((n,r)=>n+operationalVolume(r.ordered_tonnes),0)),unit:'t'},
    {title:tx('Awaiting sign-off','بانتظار الموافقة'),
      value:scopedApprovals.length.toString(),unit:''},
  ]:focus==='logistics'?[
    {title:tx('Planned','المخططة'),value:s.shipments.filter(r=>r.status==='planned').length.toString(),unit:''},
    {title:tx('In transit','قيد النقل'),value:s.shipments.filter(r=>r.status==='in_transit').length.toString(),unit:''},
    {title:tx('Delayed','المتأخرة'),value:s.shipments.filter(r=>r.status==='delayed').length.toString(),unit:''},
    {title:tx('Delivered volume','حجم الشحنات المستلمة'),
      value:number(s.shipments.filter(r=>r.status==='delivered')
        .reduce((n,r)=>n+operationalVolume(r.shipment_tonnes),0)),unit:'t'},
  ]:[
    {title:tx('Approved warehouses','المستودعات المعتمدة'),
      value:s.warehouses.filter(r=>r.status==='approved').length.toString(),unit:''},
    {title:tx('Available approved lots','الدفعات المعتمدة المتاحة'),
      value:reserves.usableLotCount.toString(),unit:''},
    {title:tx('Uncommitted reserves','احتياطي غير مخصص'),
      value:number(reserves.uncommittedTonnes),unit:'t'},
    {title:tx('Pending releases','طلبات الصرف المعلقة'),
      value:s.releases.filter(r=>r.status==='pending').length.toString(),unit:''},
  ]

  const submitCreate=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault()
    if(!orgId||busy||!canCreate||isPreview)return
    setBusy(true);setError('');setNotice('')
    try{
      const data=Object.fromEntries(OPERATION_FIELDS[formKind].map(field=>[
        field.key,formValues[field.key]??'',
      ]))
      const res=await fetch('/api/nfii/operations',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({organizationId:orgId,kind:formKind,data}),
      })
      const body:{error?:string;operation?:{status?:string}}=await res.json()
      if(!res.ok)throw Error(body.error??'Creation rejected')
      setNotice(tx(
        'Record saved. Pending entries need independent approval before use.',
        'تم حفظ السجل. السجلات المعلقة تتطلب موافقة مستقلة قبل استخدامها.'
      ))
      setFormValues({})
      setFormOpen(false)
      setActiveView(COLLECTION[formKind])
      if(focus==='procurement')setProcurementTab(
        formKind==='supplier'?'suppliers':
        formKind==='contract'?'contracts':'orders'
      )
      setReload(v=>v+1)
    }catch(err){
      setError(err instanceof Error?err.message:'Creation failed')
    }finally{setBusy(false)}
  }

  const submitAction=async()=>{
    if(!orgId||!pendingAction||busy||isPreview||actionNote.trim().length<8)return
    setBusy(true);setError('');setNotice('')
    try{
      const res=await fetch('/api/nfii/operations/action',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          organizationId:orgId,kind:pendingAction.kind,id:pendingAction.id,
          action:pendingAction.action,note:actionNote.trim(),
        }),
      })
      const body:{error?:string;operation?:unknown}=await res.json()
      if(!res.ok)throw Error(body.error??'Transition rejected')
      setNotice(tx(
        'Decision committed and added to the immutable audit ledger.',
        'تم اعتماد القرار وتسجيله في سجل التدقيق غير القابل للتغيير.'
      ))
      setPendingAction(null)
      setActionNote('')
      setReload(v=>v+1)
    }catch(err){
      setError(err instanceof Error?err.message:'Action failed')
    }finally{setBusy(false)}
  }

  function openAction(kind:OperationAction['kind'],row:OperationsRow,action:string){
    setPendingAction({kind,id:row.id,action,title:getLabel(row)})
    setActionNote('')
    setError('')
    setNotice('')
  }

  function actionsFor(view:Collection,row:OperationsRow){
    const choices:Array<{action:string;label:string}>=[]
    if(view==='approvals'&&row.status==='pending'&&canApprove&&
      user?.id!==row.submitted_by){
      if(approvalReadiness(s,row,today).ready)
        choices.push({action:'approve',label:tx('Approve','موافقة')})
      choices.push({action:'reject',label:tx('Reject','رفض')})
    }
    if(view==='shipments'&&canExecute){
      if(row.status==='planned'||row.status==='delayed')
        choices.push({action:'in_transit',label:tx('Mark dispatched','تأكيد الإرسال')})
      if(row.status==='in_transit'||row.status==='delayed')
        choices.push({action:'delivered',label:tx('Confirm delivery','تأكيد الاستلام')})
      if(row.status==='planned'||row.status==='in_transit')
        choices.push({action:'delayed',label:tx('Report delay','تسجيل تأخير')})
      if(['planned','in_transit','delayed'].includes(String(row.status)))
        choices.push({action:'cancelled',label:tx('Cancel','إلغاء')})
    }
    if(view==='releases'&&row.status==='approved'&&canExecute&&
       user?.id!==row.created_by){
      choices.push({action:'execute',label:tx('Record release','تسجيل الصرف')})
    }
    const kind=view==='approvals'?'approval':view==='shipments'?'shipment':'release'
    return choices.map(choice=><button key={choice.action} type="button"
      onClick={()=>openAction(kind,row,choice.action)}
      className="rounded-full border border-line px-2.5 py-1 text-[10px] font-medium text-content-accent hover:border-line-accent">
      {choice.label}
    </button>)
  }

  function fieldInput(field:OperationField){
    const value=formValues[field.key]??''
    const update=(v:string)=>setFormValues(prev=>({...prev,[field.key]:v}))
    if(field.key==='commodityCode'){
      return <select className="nfii-input" required value={value}
        onChange={e=>update(e.target.value)}>
        <option value="">{tx('Choose commodity','اختر السلعة')}</option>
        {COMMODITY_CATALOG.map(c=><option key={c.id} value={c.id}>
          {ar?c.nameAr:c.name}
        </option>)}
      </select>
    }
    if(field.type==='uuid'){
      const options=getOptions(field,s,today)
      return <select className="nfii-input" required value={value}
        onChange={e=>update(e.target.value)}>
        <option value="">{options.length
          ?tx('Choose approved record','اختر سجلاً معتمداً')
          :tx('No eligible parent record yet','لا يوجد سجل مؤهل بعد')}
        </option>
        {options.map(option=><option key={option.id} value={option.id}>
          {getLabel(option)} {option.commodity_code?'· '+option.commodity_code:''}
        </option>)}
      </select>
    }
    if(field.type==='text'){
      return <textarea className="nfii-input min-h-[75px]" required rows={3}
        maxLength={field.max??1000} value={value}
        onChange={e=>update(e.target.value)}/>
    }
    const type=field.type==='date'?'date':field.type==='quantity'?'number':'text'
    return <input className="nfii-input" required type={type} value={value}
      min={field.type==='quantity'?'0.001':undefined}
      step={field.type==='quantity'?(field.key==='priceQarPerTonne'?'0.01':'0.001'):undefined}
      maxLength={field.max} onChange={e=>update(e.target.value)}
      placeholder={field.key==='countryCode'?'QA':field.type==='code'?'REF-001':undefined}/>
  }

  return <main className="growa nfii-command-scope h-full overflow-y-auto px-4 py-5 md:px-6">
    <div className="mx-auto max-w-[1500px] space-y-4 pb-12">
      <OperationsHeader focus={focus} organizationName={organization?.name??null}/>

      {!orgLoading && !loading && (
        <div className="nfii-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[12px] font-medium text-content">
              {isPreview?tx('Organization register unavailable','سجل المؤسسة غير متاح'):
                tx('Authorized organization records','سجلات المؤسسة المخولة')}
            </p>
            <p className="mt-1 text-[11px] text-content-soft">
              {!orgId
                ?tx('Choose an authorized organization to see actual contracts, shipments and reserves.',
                    'اختر مؤسسة مصرحاً لها لعرض العقود والشحنات والاحتياطيات الفعلية.')
                :snapshot===null
                  ?tx('No accessible live register. Synthetic sample records are not used.',
                      'لا يمكن الوصول إلى السجل الفعلي، ولا تُستخدم بيانات تجريبية بدلاً منه.')
                  :liveHasRecords
                    ?tx('Data loaded from your organization in Supabase.',
                        'تم تحميل البيانات من مؤسستك في Supabase.')
                    :tx('Organization register is empty. Add an actual supplier to begin.',
                        'سجل المؤسسة فارغ. أضف مورداً فعلياً للبدء.')}
            </p>
          </div>
          <button type="button" className="nfii-button nfii-button-secondary"
            disabled={!orgId||loading} onClick={()=>setReload(n=>n+1)}>
            <RefreshCw className="h-3.5 w-3.5"/>
            {tx('Refresh actual records','تحديث السجلات الفعلية')}
          </button>
        </div>
      )}

      {error&&<div role="alert" className="rounded-lg border border-warning-line bg-warning-soft p-3 text-[12px] text-critical">
        {error}
      </div>}
      {notice&&<div role="status" className="rounded-lg border border-line-accent bg-cream-100 p-3 text-[12px] text-content-accent">
        {notice}
      </div>}
      {truncated.length>0&&<div role="status" className="rounded-lg border border-warning-line bg-warning-soft p-3 text-[12px] text-warning-strong">
        {tx('Some lists are limited to 150 records. This is not a complete total:',
          'بعض القوائم محدودة بـ 150 سجلاً. هذه ليست الإجماليات الكاملة:')} {' '}
        {truncated.join(', ')}
      </div>}

      {focus==='logistics'&&!orgLoading&&!loading&&
        <LogisticsCorridorIntelligence
          organizationId={orgId}
          operations={s}
          isPreview={isPreview}
        />}

      {focus==='reserves'&&!orgLoading&&!loading&&(
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-card p-2"
          aria-label={tx('Strategic reserves sections','أقسام الاحتياطي الاستراتيجي')}>
          <button type="button" aria-pressed={reserveView==='command'}
            className={'rounded-full border px-4 py-2 text-[12px] font-medium '+
              (reserveView==='command'?'border-ink bg-ink text-white':
                'border-line bg-card text-content hover:border-line-accent')}
            onClick={()=>setReserveView('command')}>
            {tx('Reserve command & agent','إدارة الاحتياطي والوكيل')}
          </button>
          <button type="button" aria-pressed={reserveView==='register'}
            className={'rounded-full border px-4 py-2 text-[12px] font-medium '+
              (reserveView==='register'?'border-ink bg-ink text-white':
                'border-line bg-card text-content hover:border-line-accent')}
            onClick={()=>setReserveView('register')}>
            {tx('Operational register & approvals','السجل التشغيلي والموافقات')}
          </button>
        </div>
      )}
      {focus==='reserves'&&reserveView==='command'&&!orgLoading&&!loading&&
        <StrategicReservesCommand
          organizationId={orgId} snapshot={snapshot} today={today}
          truncated={truncated} canEdit={canEdit}
          onRefresh={()=>setReload(n=>n+1)}
          onOpenRegister={view=>{
            setReserveView('register')
            setActiveView(view)
            if(view==='warehouses')setFormKind('warehouse')
            if(view==='lots')setFormKind('lot')
            if(view==='releases')setFormKind('release')
            setFormOpen(false)
          }}
        />}
      {focus==='procurement' && !orgLoading && !loading && (
        <ProcurementJourney
          tab={procurementTab}
          onTabChange={selectProcurementTab}
          snapshot={s}
        />
      )}

      {focus==='procurement'&&procurementTab==='discover'&&(
        <div className="space-y-4">
          <CropProducerDiscovery organizationId={orgId}/>
          <details className="nfii-panel group p-4 md:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-medium text-content">
              <span>
                {tx('Additional research: legal entities, import markets and business leads',
                  'بحث إضافي: الكيانات القانونية وأسواق الاستيراد والأنشطة التجارية')}
              </span>
              <span className="text-[11px] text-sage-700 group-open:hidden">
                {tx('Expand','توسيع')}
              </span>
              <span className="hidden text-[11px] text-sage-700 group-open:inline">
                {tx('Collapse','طي')}
              </span>
            </summary>
            <p className="mt-2 text-[11px] leading-relaxed text-content-soft">
              {tx('These supplementary tools are not a crop-to-grower directory: GLEIF checks legal identity, UN Comtrade shows countries, and Google Places lists businesses.',
                'هذه أدوات مساندة وليست دليلاً للمنتجين حسب المحصول: يراجع GLEIF الهوية، وتعرض UN Comtrade البلدان، ويسرد Google Places الأنشطة التجارية.')}
            </p>
            <div className="mt-4">
              <GlobalSupplierResearch
                organizationId={orgId}
                canCreateSupplier={Boolean(orgId)&&!isPreview&&canEdit}
                existingSupplierCodes={s.suppliers.map(row=>row.code??'')}
                onPrepareSupplier={prepareSupplier}
              />
            </div>
          </details>
        </div>
      )}

      {orgLoading||loading?(
        <div className="nfii-panel p-10 text-[13px] text-content-soft" role="status">
          {tx('Loading organization operations…','جارٍ تحميل عمليات المؤسسة…')}
        </div>
      ):focus==='procurement' && procurementTab==='overview'?(
        <ProcurementHome
          snapshot={s}
          isPreview={isPreview}
          canEdit={canEdit}
          onNavigate={selectProcurementTab}
          onNavigateStatus={(tab,status)=>{
            selectProcurementTab(tab)
            setRecordStatus(status)
          }}
        />
      ):focus==='procurement' && procurementTab==='discover'?null:
        focus==='reserves'&&reserveView==='command'?null:(
        <>
          {focus==='logistics' && <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {kpis.map(card=><div className="nfii-kpi" key={card.title}>
              <p className="nfii-label">{card.title}</p>
              <p className="mt-2 text-[24px] font-medium tabular-nums text-content">
                {card.value} {card.unit&&<span className="text-[11px] font-normal text-content-soft">{card.unit}</span>}
              </p>
            </div>)}
          </div>}

          {focus==='procurement' && <ProcurementStageHeading tab={procurementTab}/>}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
            <section className="nfii-panel min-w-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <div>
                  <h2 className="text-[14px] font-semibold text-content">
                    {tx('Operational register','السجل التشغيلي')}
                  </h2>
                  <p className="mt-1 text-[11px] text-content-soft">
                    {tx('Tenant-specific records and their actual review states.',
                      'سجلات المؤسسة وحالات مراجعتها الفعلية.')}
                  </p>
                </div>
                <button className="nfii-button nfii-button-secondary"
                  type="button" onClick={()=>setReload(v=>v+1)}>
                  <RefreshCw className="h-3.5 w-3.5"/>{tx('Refresh','تحديث')}
                </button>
              </div>

              {focus!=='procurement'&&<div className="flex flex-wrap gap-1.5 border-b border-line p-3">
                {conf.collections.map(key=>(
                  <button key={key} type="button"
                    onClick={()=>{
                      setActiveView(key)
                      if(focus==='reserves'){
                        if(key==='warehouses')setFormKind('warehouse')
                        if(key==='lots')setFormKind('lot')
                        if(key==='releases')setFormKind('release')
                      }
                      setFormOpen(false)
                    }}
                    aria-pressed={activeView===key}
                    className={'rounded-full border px-3 py-2 text-[11px] '+
                      (activeView===key
                        ?'border-line-accent bg-muted text-content-accent'
                        :'border-line bg-muted text-content-soft hover:border-line-accent')}>
                    {tx(...COLLECTION_LABEL[key])}
                    <span className="ms-2 font-mono text-[10px] text-content-soft">
                      {s[key].length}
                    </span>
                  </button>
                ))}
              </div>}

              {focus==='procurement'&&(
                <div className="flex flex-wrap items-center gap-2 border-b border-line bg-muted/20 px-4 py-3">
                  <label className="min-w-[170px] flex-1">
                    <span className="sr-only">{tx('Search current records','بحث في السجلات الحالية')}</span>
                    <input type="search" value={recordSearch}
                      onChange={event=>setRecordSearch(event.target.value)}
                      className="nfii-input" maxLength={100}
                      placeholder={tx('Search this register…','ابحث في هذا السجل…')}/>
                  </label>
                  <label>
                    <span className="sr-only">{tx('Filter by status','تصفية حسب الحالة')}</span>
                    <select className="nfii-input" value={recordStatus}
                      onChange={event=>setRecordStatus(event.target.value)}>
                      <option value="all">{tx('All statuses','كل الحالات')}</option>
                      {['pending','approved','rejected'].map(status=>(
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <span className="text-[11px] tabular-nums text-content-soft">
                    {visibleRows.length} / {s[activeView].length}
                  </span>
                </div>
              )}

              {visibleRows.length===0?(
                <div className="p-4">
                  <div className="nfii-empty">
                    {s[activeView].length>0
                      ?tx('No records match the selected filters.','لا توجد سجلات تطابق عوامل التصفية.')
                      :tx('No accessible records in this section. Create an authorized entry to begin.',
                            'لا توجد سجلات متاحة في هذا القسم؛ أنشئ إدخالاً مصرحاً به للبدء.')}
                  </div>
                </div>
              ):(
                <div className="max-h-[700px] overflow-auto">
                  <table className="nfii-table">
                    <thead><tr>
                      <th>{tx('Reference / linked data','المرجع / البيانات المرتبطة')}</th>
                      <th>{tx('State','الحالة')}</th>
                      <th>{tx('Action','الإجراء')}</th>
                    </tr></thead>
                    <tbody>
                      {visibleRows.map(row=>(
                        <tr key={row.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              {focus==='procurement'&&['suppliers','contracts','purchaseOrders','approvals'].includes(activeView)?
  <button type="button"
    className="text-left font-medium text-sage-700 underline underline-offset-2 hover:text-content"
    onClick={()=>openProcurementRecord(activeView as ProcurementRecordView,row.id)}>
    {getLabel(row)}
  </button>:
  <strong className="font-medium text-content">{getLabel(row)}</strong>}
                              {activeView==='events'&&<span className="text-[10px] text-content-accent">
                                {row.action}
                              </span>}
                            </div>
                            <RecordDetails row={row} snapshot={s} view={activeView} ar={ar}/>
                            {activeView==='approvals'&&row.submitted_by===user?.id&&
                              <span className="mt-1 text-[10px] text-content-soft">
                                {tx('Submitted by you · independent review required',
                                  'مُرسل بواسطتك · مراجعة مستقلة مطلوبة')}
                              </span>}
                          </td>
                          <td><Status status={row.status??row.action}/></td>
                          <td>
                            <div className="flex max-w-[175px] flex-wrap gap-1.5">
                              {focus==='procurement'&&['suppliers','contracts','purchaseOrders','approvals'].includes(activeView)&&
  <button type="button" onClick={()=>openProcurementRecord(activeView as ProcurementRecordView,row.id)}
    className="rounded-full border border-line-accent px-2.5 py-1 text-[10px] font-medium text-sage-700">
    {tx('Details','تفاصيل')} <ArrowUpRight className="inline h-3 w-3"/>
  </button>}
{actionsFor(activeView,row)}
                              {activeView==='events'&&<span className="text-[10px] text-content-soft">
                                {date(row.created_at)}
                              </span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <aside className="min-w-0 space-y-4">
              {focus==='procurement'&&selectedProcurementRecord&&selectedRow&&
                <ProcurementRecordPanel
                  key={selectedProcurementRecord.view+':'+selectedProcurementRecord.id}
                  view={selectedProcurementRecord.view}
                  record={selectedRow} snapshot={s} today={today}
                  isPreview={isPreview} canEdit={canEdit} canApprove={canApprove}
                  busy={busy} currentUserId={user?.id??null}
                  onClose={()=>setSelectedProcurementRecord(null)}
                  onOpen={openProcurementRecord}
                  onCreateContract={supplier=>startLinkedRecord('contract',supplier)}
                  onCreateOrder={contract=>startLinkedRecord('purchase_order',contract)}
                  onOpenApproval={(approval,decision)=>{
                    if(approval.status==='pending'&&canApprove&&!isPreview&&
                      approval.submitted_by!==user?.id&&
                      (decision==='reject'||approvalReadiness(s,approval,today).ready))
                      openAction('approval',approval,decision)
                  }}
                  onGoToLogistics={()=>router.push('/dashboard/logistics')}
                />}

              {(focus!=='procurement'||procurementTab!=='approvals')&&
              <section id="nfii-create-record" className="nfii-panel overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                    <Plus className="h-3.5 w-3.5 text-content-accent"/>
                    {focus==='procurement'
                      ?formKind==='supplier'
                        ?tx('Register supplier','تسجيل مورد')
                        :formKind==='contract'
                          ?tx('Create supplier contract','إنشاء عقد مورد')
                          :tx('Create purchase order','إنشاء أمر شراء')
                      :tx('New operational record','سجل تشغيلي جديد')}
                  </h2>
                  <button type="button" className="nfii-button nfii-button-secondary"
                    disabled={isPreview||!canCreate||missingProcurementParent}
                    onClick={()=>setFormOpen(v=>!v)}
                    aria-expanded={formOpen}>
                    {formOpen?tx('Close','إغلاق'):
                      focus==='procurement'?tx('Create new','إنشاء جديد'):
                        tx('Open form','فتح النموذج')}
                  </button>
                </div>
                <div className="p-4">
                  <p className="mb-3 text-[11px] leading-relaxed text-content-soft">
                    {isPreview?tx('No accessible live organization register; changes and approvals are disabled.',
                      'لا يوجد سجل مؤسسة فعلي متاح؛ التغييرات والموافقات معطلة.'):focus==='procurement'
                      ?formKind==='supplier'
                        ?tx('Check the legal name and country. Supplier approval must be independent.',
                            'تحقق من الاسم القانوني والدولة. يجب أن تكون الموافقة مستقلة.')
                        :formKind==='contract'
                          ?tx('Select an approved supplier and define commodity, quantity, price per tonne and dates.',
                              'اختر المورد المعتمد وحدد السلعة والكمية والسعر للطن والتواريخ.')
                          :tx('Select an approved contract and specify the purchase order quantity.',
                              'اختر عقداً معتمداً وحدد كمية أمر الشراء.')

                      :focus==='logistics'
                        ?tx('Shipments must reference an approved purchase order. Dispatch and delivery require documentation.',
                          'يجب أن ترتبط الشحنات بأمر شراء معتمد، وأن يوثق الإرسال والاستلام.')
                        :tx('Approve warehouses, register received lots against delivered shipments, then request reserve releases.',
                          'اعتمد المستودعات وسجل الدفعات من الشحنات المستلمة ثم اطلب صرف المخزون.')}
                  </p>
                  {focus==='procurement'&&missingProcurementParent&&(
                    <div className="mb-3 rounded-lg border border-warning-line bg-warning-soft p-3 text-[11px] leading-relaxed text-content">
                      <p className="font-medium">
                        {formKind==='contract'
                          ?tx('An approved supplier is required before creating a contract.',
                              'يلزم مورد معتمد قبل إنشاء عقد.')
                          :tx('An approved, currently valid contract is required before creating an order.',
                              'يلزم عقد ساري ومعتمد قبل إنشاء أمر شراء.')}
                      </p>
                      <button type="button"
                        onClick={()=>selectProcurementTab(formKind==='contract'?'suppliers':'contracts')}
                        className="mt-2 inline-flex items-center gap-1 font-medium text-sage-700 underline">
                        {formKind==='contract'?tx('View suppliers','عرض الموردين'):
                          tx('View contracts','عرض العقود')}
                        <ArrowUpRight className="h-3 w-3"/>
                      </button>
                    </div>
                  )}
                  {focus==='procurement'&&!isPreview&&!canCreate&&(
                    <p className="mb-3 text-[11px] text-warning-strong">
                      {tx('Your account does not have permission to create records in this organization.',
                        'حسابك لا يملك صلاحية إنشاء سجلات في هذه المؤسسة.')}
                    </p>
                  )}
                  {formOpen&&!isPreview&&(
                    <form className="space-y-3" onSubmit={e=>void submitCreate(e)}>
                      {focus!=='procurement' && <label className="block space-y-1">
                        <span className="nfii-label">{tx('Record type','نوع السجل')}</span>
                        <select className="nfii-input" value={formKind}
                          onChange={e=>{
                            setFormKind(e.target.value as NfiiOperationKind)
                            setFormValues({})
                          }}>
                          {conf.kinds.map(kind=><option key={kind} value={kind}>
                            {tx(...COLLECTION_LABEL[COLLECTION[kind]])}
                          </option>)}
                        </select>
                      </label>}
                      {OPERATION_FIELDS[formKind].map(field=>(
                        <label key={field.key} className="block space-y-1.5">
                          <span className="nfii-label">{tx(field.en,field.ar)}</span>
                          {fieldInput(field)}
                        </label>
                      ))}
                      {!canCreate&&<p className="text-[11px] text-warning-strong">
                        {tx('Your account cannot submit this record type.',
                          'حسابك لا يملك صلاحية إرسال هذا النوع من السجلات.')}
                      </p>}
                      <button type="submit" className="nfii-button w-full" disabled={busy||!canCreate}>
                        <Check className="h-4 w-4"/>
                        {tx('Save for independent review','حفظ للمراجعة المستقلة')}
                      </button>
                    </form>
                  )}
                </div>
              </section>}

              {(focus!=='procurement'||procurementTab==='approvals')&&
              <section className="nfii-panel p-4">
                <h3 className="flex items-center gap-2 text-[12px] font-semibold">
                  <ClipboardCheck className="h-4 w-4 text-content-accent"/>
                  {tx('Approval inbox','صندوق الموافقات')}
                </h3>
                <p className="mt-1 text-[11px] text-content-soft">
                  {isPreview?tx('No accessible organization register; no approvals can be inferred.',
                    'لا يمكن استنتاج موافقات دون سجل مؤسسة متاح.'):tx('Proposals are inactive until independently approved.',
                    'لا تصبح الطلبات فعالة حتى تتم الموافقة عليها بشكل مستقل.')}
                </p>
                <div className="mt-3 space-y-2">
                  {scopedApprovals.slice(0,6).map(row=>(
                    <div className="nfii-subpanel flex flex-wrap items-center justify-between gap-2 p-2.5"
                      key={row.id}>
                      <div className="min-w-0">
                        <p className="text-[11px] text-content">{row.target_type?.replaceAll('_',' ')}</p>
                        <button type="button"
                          onClick={()=>focus==='procurement'?
                            openProcurementRecord('approvals',row.id):setActiveView('approvals')}
                          className="mt-1 text-left text-[11px] font-medium text-sage-700 underline">
                          {approvalTarget(s,row)?procurementRecordLabel(approvalTarget(s,row)!.record):
                            row.target_id?.slice(0,8)??row.id.slice(0,8)}
                          <ArrowUpRight className="ms-1 inline h-3 w-3"/>
                        </button>
                      </div>
                      {canApprove&&row.submitted_by!==user?.id
                        ?<button type="button" className="nfii-button nfii-button-secondary"
                          onClick={()=>focus==='procurement'?
                            openProcurementRecord('approvals',row.id):setActiveView('approvals')}>
                          {tx('Review','مراجعة')} <ArrowUpRight className="h-3.5 w-3.5"/>
                        </button>
                        :<span className="text-[10px] text-content-soft">
                          {tx('Independent review','مراجعة مستقلة')}
                        </span>}
                    </div>
                  ))}
                  {scopedApprovals.length===0&&<p className="nfii-empty">
                    {tx('No pending approval requests.','لا توجد طلبات موافقة معلقة.')}
                  </p>}
                </div>
              </section>}

              {focus!=='procurement'&&<section className="nfii-panel p-4">
                <h3 className="text-[12px] font-semibold">{tx('Data integrity','سلامة البيانات')}</h3>
                <p className="mt-2 text-[11px] leading-relaxed text-content-soft">
                  {tx(
                    'Operational inventory is tracked separately from the independently reviewed Food Balance. No real purchase, bank payment, carrier instruction or warehouse actuator is executed by this software.',
                    'يُتتبع المخزون التشغيلي بمعزل عن ميزان الغذاء المُراجع. لا ينفذ هذا البرنامج شراءً أو دفعاً مصرفياً أو أمراً لشركة شحن أو معدات مستودع.'
                  )}
                </p>
              </section>}
            </aside>
          </div>

          {focus!=='procurement'&&<section className="nfii-panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="flex items-center gap-2 text-[12px] font-semibold">
                <FileCheck2 className="h-4 w-4 text-content-accent"/>
                {tx('Immutable operation events','سجل الأحداث غير القابل للتعديل')}
              </h2>
              <span className="nfii-label">{tx('Database audit','تدقيق قاعدة البيانات')}</span>
            </div>
            <div className="grid gap-1.5 p-3 sm:grid-cols-2 xl:grid-cols-4">
              {s.events.slice(0,8).map(row=><div key={row.id}
                className="nfii-subpanel p-2.5 text-[11px] text-content-soft">
                <span className="font-medium text-content-accent">{row.action}</span>
                <span className="mx-2">·</span>{row.entity_type}
                <p className="mt-1 text-[10px] text-content-soft">{date(row.created_at)}</p>
              </div>)}
              {s.events.length===0&&<p className="nfii-empty sm:col-span-2 xl:col-span-4">
                {tx('No operational events recorded yet.','لم تُسجل أحداث تشغيلية بعد.')}
              </p>}
            </div>
          </section>}
        </>
      )}

      {pendingAction&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/65 p-4"
        role="presentation">
        <div role="dialog" aria-modal="true"
          aria-label={tx('Confirm a documented state change','تأكيد تغيير موثق في الحالة')}
          className="w-full max-w-lg rounded-md border border-line bg-card p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-content">
              {tx('Confirm workflow decision','تأكيد قرار سير العمل')}
            </h2>
            <button type="button" onClick={()=>setPendingAction(null)}
              aria-label={tx('Close','إغلاق')}
              className="rounded border border-line p-1.5 text-content">
              <X className="h-4 w-4"/>
            </button>
          </div>
          <p className="mt-3 text-[12px] text-content-soft">
            <strong className="text-content">{pendingAction.title}</strong>
            <span className="mx-2 text-content-soft">/</span>
            <Status status={pendingAction.action}/>
          </p>
          <p className="mt-2 text-[11px] text-content-soft">
            {tx('This action changes a real database record and creates an immutable event. An independent approval is mandatory where required.',
              'يغير هذا الإجراء سجلاً فعلياً ويضيف حدث تدقيق غير قابل للتعديل، مع اشتراط الموافقة المستقلة عند اللزوم.')}
          </p>
          <label className="mt-4 block space-y-1.5">
            <span className="nfii-label">{tx('Supporting note / reference (required)','ملاحظة أو مرجع داعم (إلزامي)')}</span>
            <textarea className="nfii-input min-h-[110px]" minLength={8}
              value={actionNote} maxLength={2000}
              onChange={e=>setActionNote(e.target.value)}
              placeholder={tx('Source document, quantity verification or reason…',
                'مستند المصدر أو التحقق من الكمية أو السبب…')}/>
          </label>
          {error&&<p role="alert" className="mt-3 text-[11px] text-critical">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="nfii-button nfii-button-secondary"
              onClick={()=>setPendingAction(null)}>{tx('Cancel','إلغاء')}</button>
            <button type="button" className="nfii-button"
              disabled={busy||actionNote.trim().length<8}
              onClick={()=>void submitAction()}>
              {busy?tx('Recording…','جارٍ التسجيل…'):tx('Confirm & audit','تأكيد وتدقيق')}
            </button>
          </div>
        </div>
      </div>}
    </div>
  </main>
}
