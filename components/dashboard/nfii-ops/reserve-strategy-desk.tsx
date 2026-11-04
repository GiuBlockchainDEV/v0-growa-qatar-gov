'use client'
import {useMemo,useState} from 'react'
import {ArrowRight,Bot,CheckCircle2,ClipboardCheck,
 Database,ShieldAlert,ShieldCheck,TrendingDown,Warehouse,
 CalendarClock,RefreshCw} from 'lucide-react'
import type {ReserveAgentReport,ReservePortfolio} from '@/lib/nfii/reserves-intelligence'
import {planFefoRelease,planReserveCoverage,type ReserveCoverageTarget} from '@/lib/nfii/reserve-planning'
import styles from './reserve-strategy-desk.module.css'
type Register='warehouses'|'lots'|'releases'|'approvals'
type Props={
 portfolio:ReservePortfolio;report:ReserveAgentReport|null;busy:boolean;error:string|null
 onRun:()=>void;onRefresh:()=>void;onOpenRegister:(x:Register)=>void
}
const fmt=(n:number|null|undefined,digits=1)=>
 n===null||n===undefined||!Number.isFinite(n)?'N/A':
 n.toLocaleString('en-US',{maximumFractionDigits:digits})
const percent=(numerator:number,denominator:number)=>
 denominator>0?Math.min(100,Math.max(0,numerator/denominator*100)):0
export function ReserveStrategyDesk({portfolio,report,busy,error,onRun,onRefresh,onOpenRegister}:Props){
 const [targetDays,setTargetDays]=useState<ReserveCoverageTarget>(30)
 const [commodityCode,setCommodityCode]=useState<string>('')
 const [quantity,setQuantity]=useState('10')
 const [activeTab,setActiveTab]=useState<'priorities'|'coverage'|'fefo'>('priorities')
 const coverage=useMemo(()=>planReserveCoverage(report?.coverage??[],targetDays),
  [report,targetDays])
 const selected=portfolio.commodities.some(c=>c.id===commodityCode)?
  commodityCode:(portfolio.commodities[0]?.id??'')
 const qty=quantity.trim()===''?Number.NaN:Number(quantity)
 const allocation=useMemo(()=>planFefoRelease(portfolio.lots,selected,qty),
  [portfolio.lots,selected,qty])
 const expiring7=portfolio.expiryBuckets.find(b=>b.key==='due_7')?.onHandTonnes??0
 const expiryPercent=percent(portfolio.expiring30Tonnes,portfolio.onHandTonnes)
 const verifiedPercent=portfolio.totalLotRecords?portfolio.eligibleLots/portfolio.totalLotRecords*100:null
 const headline=portfolio.partial?'Incomplete ledger · reconcile before planning':
  portfolio.totalLotRecords===0?'Inventory data needed before decisions':
  portfolio.overcommittedLots>0?'Overcommitted lots require immediate review':
  expiring7>0?'Short-dated stock needs a FEFO allocation review':
  portfolio.unverifiedLots>0?'Reserve records require evidence checks':
  portfolio.pendingReleaseRequests>0?'Outstanding releases need independent review':
  'Reserve positions available for operational screening'
 const quickActions=[
  {name:'Expiry priority',value:fmt(portfolio.expiring30Tonnes)+' t',
   note:fmt(expiryPercent,0)+'% of eligible stock expires within 30 days',
   active:portfolio.expiring30Tonnes>0,tab:'fefo' as const},
  {name:'Inventory exceptions',value:fmt(portfolio.unverifiedLots)+' lots',
   note:portfolio.overcommittedLots+' overcommitted · '+fmt(portfolio.excludedRecordedTonnes)+' t excluded',
   active:portfolio.unverifiedLots>0,tab:'priorities' as const},
  {name:'Approvals & releases',value:portfolio.pendingApprovals+' reviews',
   note:portfolio.pendingReleaseRequests+' pending release requests',
   active:portfolio.pendingApprovals+portfolio.pendingReleaseRequests>0,tab:'priorities' as const},
 ]
 const priorities=[
  ...(portfolio.partial?[{id:'partial',name:'Incomplete register',
    description:'The organization ledger is truncated. Portfolio totals may be understated.',
    action:'lots' as Register}]:[]),
  ...(portfolio.overcommittedLots>0?[{id:'overcommit',name:portfolio.overcommittedLots+' overcommitted lots',
    description:'Approved commitments exceed available on-hand stock. Reconcile before approving further releases.',
    action:'releases' as Register}]:[]),
  ...(portfolio.expiring30Tonnes>0?[{id:'expiry',name:fmt(portfolio.expiring30Tonnes)+' t short-dated inventory',
    description:'Review FEFO allocation across eligible lots expiring within 30 days. No release is authorized by this view.',
    action:'lots' as Register}]:[]),
  ...(portfolio.unverifiedLots>0?[{id:'invalid',name:portfolio.unverifiedLots+' excluded or pending lots',
    description:'These records cannot contribute to usable reserve coverage until evidence is approved.',
    action:'lots' as Register}]:[]),
  ...(portfolio.pendingReleaseRequests>0?[{id:'release',name:portfolio.pendingReleaseRequests+' pending release requests',
    description:'Independent review required. Pending requests are not approved inventory commitments.',
    action:'releases' as Register}]:[]),
  ...(portfolio.pendingApprovals>0?[{id:'approvals',name:portfolio.pendingApprovals+' approval decisions waiting',
    description:'Review source documents and segregation of duties before authorization.',
    action:'approvals' as Register}]:[]),
 ]
 return <section className={styles.desk} aria-label="Reserve operations intelligence">
  <div className={styles.hero}>
   <div className={styles.heroGlow}/>
   <div className={styles.heroTop}>
    <div className={styles.heroCopy}>
     <p className={styles.eyebrow}><Warehouse size={15}/> GROWA · NATIONAL FOOD RESILIENCE / RESERVES</p>
     <h2>Strategic Reserves <span>Control Tower</span></h2>
     <p>Inventory readiness, FEFO release planning, demand-backed coverage and authorized operational handoffs in one decision workspace.</p>
     <div className={styles.heroActions}>
      <button type="button" onClick={onRefresh}><RefreshCw size={14}/> Refresh ledger</button>
      <button type="button" onClick={()=>onOpenRegister('lots')}>
       <ArrowRight size={14}/> Open lot register</button>
     </div>
     <div className={styles.statusPills}>
      <span><CheckCircle2 size={12}/> {portfolio.eligibleLots} usable approved lots</span>
      <span><Database size={12}/> {portfolio.warehouses} approved warehouses</span>
      <span data-warning={portfolio.partial?'true':undefined}>{portfolio.partial?'PARTIAL LEDGER':'ORGANIZATION LEDGER'}</span>
      <span>AS OF {portfolio.asOfDate}</span>
     </div>
    </div>
    <div className={styles.headlineCard}>
     <span>TOP OPERATIONAL PRIORITY</span>
     <strong>{headline}</strong>
     <p>{portfolio.partial?'Do not use partial totals as complete inventory.':
      'All indicators are based on approved, attributable organization lot records.'}</p>
    </div>
   </div>
   <div className={styles.heroKpis}>
    {[
     {label:'ELIGIBLE ON-HAND',value:portfolio.onHandTonnes,note:'After executed releases',unit:'t'},
     {label:'AVAILABLE TO PLAN',value:portfolio.uncommittedTonnes,note:'After approved commitments',unit:'t'},
     {label:'APPROVED COMMITMENTS',value:portfolio.committedTonnes,note:'Not yet executed',unit:'t'},
     {label:'EXPIRES IN 30 DAYS',value:portfolio.expiring30Tonnes,note:'Included in on-hand',unit:'t'},
    ].map(x=><div key={x.label} className={styles.metric}>
     <small>{x.label}</small>
     <strong>{portfolio.totalLotRecords?fmt(x.value):'N/A'} <em>{x.unit}</em></strong>
     <p>{x.note}</p>
    </div>)}
   </div>
  </div>

  <div className={styles.overviewGrid}>
   <div className={styles.positionCard}>
    <div className={styles.sectionTitle}><span><ShieldCheck size={16}/> INVENTORY POSITION</span>
     <strong>{verifiedPercent===null?'N/A':fmt(verifiedPercent,0)+'%'} <small>eligible lots</small></strong>
    </div>
    <h3>How much is actually available?</h3>
    <div className={styles.positionBar} role="img" aria-label="Eligible reserve tonnage allocated versus uncommitted">
     <i style={{width:percent(portfolio.uncommittedTonnes,portfolio.onHandTonnes)+'%'}}/>
     <b style={{width:percent(portfolio.committedTonnes,portfolio.onHandTonnes)+'%'}}/>
    </div>
    <div className={styles.legend}>
     <span><i data-role="free"/> Uncommitted {fmt(portfolio.uncommittedTonnes)} t</span>
     <span><i data-role="committed"/> Committed {fmt(portfolio.committedTonnes)} t</span>
    </div>
    <div className={styles.positionFacts}>
     <span>Recorded excluded: <strong>{fmt(portfolio.excludedRecordedTonnes)} t</strong></span>
     <span>Expired recorded: <strong>{fmt(portfolio.expiredRecordedTonnes)} t</strong></span>
     <span>Lots eligible: <strong>{portfolio.eligibleLots}/{portfolio.totalLotRecords}</strong></span>
    </div>
    <p>Excluded tonnes are not included in eligible totals. Physical sensor counts and other organizations are not inferred.</p>
   </div>
   <div className={styles.actionCard}>
    <div className={styles.sectionTitle}><span><ShieldAlert size={16}/> WATCHLIST / TRIAGE</span>
     <small>{quickActions.filter(x=>x.active).length} active signals</small></div>
    <h3>Where to focus first</h3>
    <div className={styles.actionRows}>{quickActions.map(item=><button key={item.name}
     type="button" onClick={()=>setActiveTab(item.tab)}>
     <div><strong>{item.name}</strong><small>{item.note}</small></div>
     <span>{item.value}</span><ArrowRight size={14}/>
    </button>)}</div>
   </div>
  </div>

  <div className={styles.workbench}>
   <div className={styles.workbenchHeader}>
    <div><p className={styles.sectionLabel}><Bot size={15}/> RESERVE DECISION WORKBENCH</p>
     <h3>From recorded inventory to an actionable plan</h3>
     <p>Evidence-based screening, with no automatic purchase orders or physical releases.</p></div>
    <button type="button" className={styles.runButton} onClick={onRun} disabled={busy}>
     {busy?<RefreshCw size={15} className="animate-spin"/>:<Bot size={15}/>}
     {busy?'Checking reviewed consumption…':report?'Refresh reserve analysis':'Run reserve intelligence'}
    </button>
   </div>
   {error&&<div role="alert" className={styles.analysisError}>{error}</div>}
   <div className={styles.tabList} role="tablist" aria-label="Reserve planning views">
    {[
     {id:'priorities' as const,title:'Action queue',icon:ClipboardCheck},
     {id:'coverage' as const,title:'Replenishment planner',icon:TrendingDown},
     {id:'fefo' as const,title:'FEFO allocation studio',icon:CalendarClock},
    ].map(tab=>{const Icon=tab.icon;return <button key={tab.id} role="tab"
     aria-selected={activeTab===tab.id} type="button" onClick={()=>setActiveTab(tab.id)}>
     <Icon size={15}/>{tab.title}</button>})}
   </div>

   {activeTab==='priorities'&&<div className={styles.tabBody} role="tabpanel">
    <div className={styles.tabIntro}><div><h4>Priority actions & exceptions</h4>
     <p>Linked to operational registers. Priorities do not change approval status.</p></div>
     <span>{priorities.length} ledger-derived items</span></div>
    {priorities.length?<div className={styles.priorityGrid}>
     {priorities.map((item,index)=><div className={styles.priorityItem} key={item.id}>
      <span className={styles.priorityIndex}>{String(index+1).padStart(2,'0')}</span>
      <div><strong>{item.name}</strong><p>{item.description}</p></div>
      <button type="button" onClick={()=>onOpenRegister(item.action)}>
       Open records <ArrowRight size={13}/></button>
     </div>)}</div>:<div className={styles.empty}>
      <CheckCircle2 size={22}/><strong>No ledger exception currently flagged</strong>
      <p>This does not imply a complete national reserve assessment. Run the demand-backed analysis for coverage.</p>
     </div>}
    {report&&<div className={styles.analysisSummary}>
     <strong>{report.decision}</strong><p>{report.decisionReason}</p>
     <small>{report.findings.length} agent findings · {report.coveredCommodities} commodities with verified reserve cover · human review required</small>
    </div>}
   </div>}

   {activeTab==='coverage'&&<div className={styles.tabBody} role="tabpanel">
    <div className={styles.tabIntro}><div><h4>Demand-backed replenishment planner</h4>
     <p>Compare uncommitted reserve tonnes with a chosen planning horizon. These are not national policy thresholds.</p></div>
     <label className={styles.targetControl}>Planning horizon
      <select value={targetDays} onChange={event=>setTargetDays(Number(event.target.value) as ReserveCoverageTarget)}>
       {[14,30,60,90].map(v=><option key={v} value={v}>{v} days</option>)}
      </select>
     </label></div>
    {!report?<div className={styles.empty}><Database size={22}/>
     <strong>Run reserve intelligence to load verified consumption</strong>
     <p>Coverage and replenishment quantities are withheld until organization demand records pass the reviewed-source checks.</p>
    </div>:<>
     <div className={styles.coverageRows}>
      {coverage.map(row=><div className={styles.coverageRow} key={row.commodityCode}>
       <div><strong>{row.commodityName}</strong>
        <small>{row.sourceRefs} reviewed references · {fmt(row.uncommittedTonnes)} t uncommitted</small></div>
       <div><span>Reserve cover</span><strong>{fmt(row.coverageDays)} days</strong></div>
       <div><span>Planning requirement</span><strong>{fmt(row.targetReserveTonnes)} t</strong></div>
       <div><span>Suggested replenishment</span>
        <strong data-alert={row.status==='below_target'?true:undefined}>
         {fmt(row.suggestedReplenishmentTonnes)} t</strong></div>
       <div className={styles.rowBar}><i style={{
        width:row.coverageDays!==null?
         Math.min(100,row.coverageDays/targetDays*100)+'%':'0%',
       }}/></div>
      </div>)}
     </div>
     {!coverage.length&&<div className={styles.empty}>No eligible commodity coverage records to evaluate.</div>}
     <p className={styles.note}>Suggested replenishment is a planning gap, not a purchase quantity or order. Supplier capability, lead time, grade, spoilage, imports and national targets require separate verification.</p>
    </>}
   </div>}

   {activeTab==='fefo'&&<div className={styles.tabBody} role="tabpanel">
    <div className={styles.tabIntro}><div><h4>First-expiry-first-out allocation</h4>
     <p>Plan a draft picking sequence across eligible lots without reducing stock or approving a release.</p></div>
     <span>READ-ONLY PLAN</span></div>
    <div className={styles.fefoInputs}>
     <label>Commodity
      <select value={selected} onChange={e=>setCommodityCode(e.target.value)}>
       {portfolio.commodities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select></label>
     <label>Requested release · tonnes
      <input type="number" min="0" max="1000000000" step=".001" value={quantity}
       onChange={e=>setQuantity(e.target.value)}/></label>
     <div><span>Available for this commodity</span>
      <strong>{portfolio.commodities.find(x=>x.id===selected)?
       fmt(portfolio.commodities.find(x=>x.id===selected)!.uncommittedTonnes)+' t':'N/A'}</strong></div>
    </div>
    {!selected?<div className={styles.empty}>No approved and eligible lot is registered for FEFO allocation.</div>:
     !allocation.valid?<div className={styles.empty}>Enter a valid non-negative requested quantity.</div>:<>
      <div className={styles.fefoTotals}>
       <div><small>REQUESTED</small><strong>{fmt(allocation.requestedTonnes)} t</strong></div>
       <div><small>DRAFT ALLOCATED</small><strong>{fmt(allocation.allocatedTonnes)} t</strong></div>
       <div><small>UNCOVERED</small><strong data-alert={allocation.shortfallTonnes>0?true:undefined}>{fmt(allocation.shortfallTonnes)} t</strong></div>
      </div>
      <div className={styles.allocationList}>
       {allocation.allocations.map((lot,i)=><div key={lot.lotId}>
        <span>{String(i+1).padStart(2,'0')}</span><div>
         <strong>{lot.lotRef}</strong><small>{lot.warehouse} · expires {lot.expiryDate} ({lot.daysToExpiry}d)</small>
         {lot.pendingRequestedTonnes>0&&<small>{fmt(lot.pendingRequestedTonnes)} t pending requests, NOT deducted from approved availability</small>}
        </div><strong>{fmt(lot.tonnes)} t</strong>
       </div>)}
       {!allocation.allocations.length&&<p>No usable lot can be allocated for the request.</p>}
      </div>
      <p className={styles.note}>Commitments already subtracted from available tonnes; pending requests are separately disclosed, never silently double-counted. A real release still requires independent approval and a documented warehouse operation.</p>
      <button type="button" className={styles.registerButton}
       onClick={()=>onOpenRegister('releases')}>
       Open release requests <ArrowRight size={14}/></button>
     </>}
   </div>}
  </div>
 </section>
}
