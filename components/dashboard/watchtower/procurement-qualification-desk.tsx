'use client'
import {useState} from 'react'
import Link from 'next/link'
import {Check,FileCheck2,RefreshCw,ShieldCheck,XCircle} from 'lucide-react'
import type {Candidate} from '@/lib/watchtower/sourcing-autopilot'
import styles from './procurement-mission.module.css'
type Supplier={id:string;name:string;country_code:string;status:string;code:string}
type Contract={id:string;supplier_id:string;status:string;contract_ref:string;commodity_code:string}
type Approval={id:string;target_id:string;target_type:string;status:string}
type Ledger={dataSource?:string;snapshot?:{suppliers?:Supplier[];contracts?:Contract[];approvals?:Approval[]}}
const message=(v:unknown,fallback:string)=>v&&typeof v==='object'&&'error'in v&&
 typeof v.error==='string'?v.error:fallback
const money=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:2})+' QAR'
export function ProcurementQualificationDesk({
 candidates,commodity,organizationId,requiredTonnes,onLifecycleChange,
}:{
 candidates:readonly Candidate[];commodity:string;organizationId:string
 requiredTonnes:number|null;onLifecycleChange:()=>void
}){
 const leads=candidates.filter(x=>!x.approved)
 const [candidateId,setCandidateId]=useState(leads[0]?.id??'')
 const chosen=leads.find(x=>x.id===candidateId)??leads[0]
 const [legalName,setLegalName]=useState('')
 const [companyCode,setCompanyCode]=useState('')
 const [price,setPrice]=useState('')
 const [contractRef,setContractRef]=useState('')
 const [validFrom,setValidFrom]=useState('')
 const [validTo,setValidTo]=useState('')
 const [quotedTonnes,setQuotedTonnes]=useState('')
 const [note,setNote]=useState('')
 const [confirmed,setConfirmed]=useState(false)
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
 const [supplierId,setSupplierId]=useState('')
 const [contractId,setContractId]=useState('')
 const [snapshot,setSnapshot]=useState<Ledger['snapshot']|null>(null)
 const selectedSupplier=snapshot?.suppliers?.find(x=>x.id===supplierId)
 const selectedContract=snapshot?.contracts?.find(x=>x.id===contractId)
 const supplierApproval=snapshot?.approvals?.find(x=>x.target_type==='supplier'&&
  x.target_id===supplierId&&x.status==='pending')
 const contractApproval=snapshot?.approvals?.find(x=>x.target_type==='contract'&&
  x.target_id===contractId&&x.status==='pending')
 const create=async(kind:'supplier'|'contract',data:Record<string,string|number>)=>{
  setBusy(true);setNotice('Submitting '+kind+' to independent approval…')
  try{
   const response=await fetch('/api/nfii/operations',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({organizationId,kind,data}),
   })
   const raw:unknown=await response.json()
   if(!response.ok)throw Error(message(raw,'Record creation denied'))
   const operation=(raw as {operation?:unknown}).operation
   const id=typeof operation==='object'&&operation!==null&&'id'in operation&&
    typeof operation.id==='string'?operation.id:''
   if(kind==='supplier')setSupplierId(id)
   else setContractId(id)
   setNotice('Record submitted as PENDING. Independent review required.')
   await refresh()
  }catch(e){setNotice(e instanceof Error?e.message:'Record unavailable')}
  finally{setBusy(false)}
 }
 const refresh=async()=>{
  try{
   const response=await fetch('/api/nfii/operations?'+new URLSearchParams({
    organizationId,
   }),{cache:'no-store'})
   const raw:unknown=await response.json()
   if(!response.ok)throw Error(message(raw,'Register unavailable'))
   const ledger=raw as Ledger
   if(!ledger.snapshot)throw Error('No verified organization register returned')
   // This route can supply an illustrative baseline when the register is empty.
   // Do not treat seed records as real approvals.
   setSnapshot(ledger.snapshot)
   setNotice('Organization register refreshed; continue only with verified approvals.')
  }catch(e){setNotice(e instanceof Error?e.message:'Register unavailable')}
 }
 const review=async(approvalId:string,decision:'approve'|'reject')=>{
  if(note.trim().length<8){setNotice('Review justification must contain at least 8 characters.');return}
  setBusy(true)
  try{
   const response=await fetch('/api/nfii/operations/action',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({organizationId,kind:'approval',id:approvalId,action:decision,
     note:note.trim()}),
   })
   const raw:unknown=await response.json()
   if(!response.ok)throw Error(message(raw,'Independent authorization required'))
   setNotice('Reviewer decision recorded: '+decision+'.')
   await refresh()
   onLifecycleChange()
  }catch(e){setNotice(e instanceof Error?e.message:'Review unavailable')}
  finally{setBusy(false)}
 }
 if(!leads.length)return <div className={styles.summary}>
  <strong>New supplier onboarding</strong><p>No unqualified leads in the selected research results.</p>
 </div>
 return <section className={styles.qualificationDesk}>
  <div className={styles.heading}>
   <span>PROCUREMENT EXECUTION / VENDOR-TO-ORDER</span>
   <h4>From discovered prospect to legally approved purchase order</h4>
   <p>These steps create actual pending supplier and contract records.
    Procurement approval is independent, with a documented reason and organizational permissions.
    No quotation or legal identity is invented.</p>
  </div>
  <div className={styles.qualificationSteps}>
   {['01 · Verify vendor','02 · Supplier approval','03 · Record firm quotation',
    '04 · Contract approval','05 · Refresh orders','06 · Final PO approval']
    .map(x=><span key={x}>{x}</span>)}
  </div>
  <label>Documented supplier candidate
   <select value={chosen?.id??''} onChange={e=>{
    setCandidateId(e.target.value);setSupplierId('');setContractId('')
    setLegalName('');setCompanyCode('');setConfirmed(false)
   }}>
    {leads.map(x=><option key={x.id} value={x.id}>{x.name} · {x.country}</option>)}
   </select>
  </label>
  {chosen&&<div className={styles.summary}>
   <strong>{chosen.name} · {chosen.countryName}</strong>
   <p>{chosen.evidence}</p><p>Listed organization is NOT a verified legal seller.
    Confirm the actual contracting party, entity registration, export permission and ownership.</p>
   {chosen.sourceUrl&&<a href={chosen.sourceUrl} target="_blank" rel="noreferrer">
    Review original evidence</a>}
  </div>}
  <div className={styles.qualificationGrid}>
   <label>Verified legal entity name
    <input value={legalName} onChange={e=>setLegalName(e.target.value)}
     placeholder="Enter name from registration evidence" disabled={Boolean(supplierId)}/>
   </label>
   <label>Verified company / supplier code
    <input value={companyCode} onChange={e=>setCompanyCode(e.target.value)}
     placeholder="Unique internal vendor code" disabled={Boolean(supplierId)}/>
   </label>
  </div>
  <label className={styles.confirmBox}><input type="checkbox" checked={confirmed}
   onChange={e=>setConfirmed(e.target.checked)} disabled={Boolean(supplierId)}/>
   I verified the legal entity and confirm this is not merely a search listing.</label>
  <button type="button" className={styles.primary} disabled={busy||Boolean(supplierId)||
    !chosen||legalName.trim().length<3||companyCode.trim().length<3||!confirmed}
    onClick={()=>void create('supplier',{
     name:legalName.trim(),code:companyCode.trim(),countryCode:chosen!.country,
    })}><ShieldCheck size={14}/> Create supplier · Pending approval</button>
  {supplierId&&<div className={styles.status}>
   Supplier request: {supplierId} · {selectedSupplier?.status??'Pending / refresh required'}
  </div>}
  {supplierId&&<button className={styles.secondary} onClick={()=>void refresh()}
   type="button" disabled={busy}><RefreshCw size={13}/> Refresh verified register</button>}
  {(supplierApproval||contractApproval)&&<label>Independent review justification (8+ characters)
   <textarea rows={2} value={note} onChange={e=>setNote(e.target.value)}
    placeholder="Verify documents, commercial terms and approval basis"/>
  </label>}
  {supplierApproval&&<div className={styles.gate}>
   <div><strong>Independent supplier review</strong><p>A proposer cannot approve their own supplier.</p></div>
   <button className={styles.primary} disabled={busy} onClick={()=>void review(supplierApproval.id,'approve')}>
    <Check size={13}/> Approve verified supplier</button>
   <button className={styles.reject} disabled={busy} onClick={()=>void review(supplierApproval.id,'reject')}>
    <XCircle size={13}/> Reject</button>
  </div>}
  {selectedSupplier?.status==='approved'&&!contractId&&<div className={styles.contractForm}>
   <div className={styles.heading}><span>FIRM QUOTATION REQUIRED</span>
    <h4>Create draft commercial contract</h4>
    <p>Use a supplier-issued quote, not historical import unit values.
     Validation and independent approval are mandatory before ordering.</p></div>
   <div className={styles.qualificationGrid}>
    <label>Contract reference<input value={contractRef}
     onChange={e=>setContractRef(e.target.value)}/></label>
    <label>Verified quantity (tonnes)<input type="number" min=".1"
     value={quotedTonnes} onChange={e=>setQuotedTonnes(e.target.value)}
     placeholder={requiredTonnes===null?'Actual quoted capacity':String(requiredTonnes)}/></label>
    <label>Quoted unit price (QAR / tonne)<input type="number" min=".01"
     value={price} onChange={e=>setPrice(e.target.value)}/></label>
    <label>Valid from<input type="date" value={validFrom}
     onChange={e=>setValidFrom(e.target.value)}/></label>
    <label>Valid to<input type="date" value={validTo}
     onChange={e=>setValidTo(e.target.value)}/></label>
   </div>
   <p>Goods value: {Number(price)>0&&Number(quotedTonnes)>0?
    money(Number(price)*Number(quotedTonnes)):'Cannot calculate without actual quotation'}</p>
   <button type="button" className={styles.primary} disabled={busy||
    contractRef.trim().length<3||Number(quotedTonnes)<=0||Number(price)<=0||
    !validFrom||!validTo||validTo<validFrom}
    onClick={()=>void create('contract',{
     supplierId,contractRef:contractRef.trim(),commodityCode:commodity,
     contractedTonnes:Number(quotedTonnes),priceQarPerTonne:Number(price),
     validFrom,validTo,
    })}><FileCheck2 size={14}/> Create contract · Pending approval</button>
  </div>}
  {contractId&&<div className={styles.status}>
   Contract: {contractId} · {selectedContract?.status??'Pending / refresh required'}
  </div>}
  {contractApproval&&<div className={styles.gate}>
   <div><strong>Independent commercial contract review</strong><p>
    Validate signed terms, cargo quality, export restrictions, committed volume and price.</p></div>
   <button className={styles.primary} disabled={busy} type="button"
    onClick={()=>void review(contractApproval.id,'approve')}>
    <Check size={13}/> Approve verified contract</button>
   <button className={styles.reject} disabled={busy} type="button"
    onClick={()=>void review(contractApproval.id,'reject')}>
    <XCircle size={13}/> Reject</button>
  </div>}
  {selectedContract?.status==='approved'&&<div className={styles.summary}>
   <strong>Contract approved, ready for purchase-order research refresh</strong>
   <p>Run the sourcing agents again. Approved contractual capacity will
    appear among eligible purchase order options.</p>
   <button className={styles.primary} type="button" onClick={onLifecycleChange}>
    <RefreshCw size={13}/> Refresh sourcing and prepare order
   </button>
  </div>}
  {notice&&<p className={styles.status} role="status">{notice}</p>}
  <Link href="/dashboard/procurement">Open central procurement approval queue</Link>
 </section>
}
