import type {OperationsRow,OperationsSnapshot} from './operations-types'
import {resolveCommodity} from '@/lib/platform/commodity-catalog'

/**
 * Read-only reserve analytics over authorized organization records.
 * Quantities are NOT national stock, replenishment forecasts or a
 * historical inventory series. Executed releases are already reflected
 * in lot.released_tonnes; never subtract them a second time.
 */
export interface ReserveLotView{
  id:string;reference:string;warehouseId:string|null;warehouse:string
  commodityCode:string|null;commodityName:string
  shipmentRef:string|null;status:string;expiryDate:string|null
  daysToExpiry:number|null;receivedTonnes:number|null;releasedTonnes:number|null
  onHandTonnes:number|null;approvedCommitmentTonnes:number
  pendingRequestedTonnes:number;uncommittedTonnes:number;eligible:boolean
  issues:string[]
}
export interface ReserveGroup{
  id:string;name:string;onHandTonnes:number;committedTonnes:number
  uncommittedTonnes:number;expiring30Tonnes:number;lotCount:number
}
export interface ReserveBucket{
  key:'due_7'|'due_30'|'due_90'|'later'
  fromDay:number;throughDay:number|null;onHandTonnes:number;lotCount:number
}
export interface ReservePortfolio{
  asOfDate:string;warehouses:number;totalLotRecords:number;eligibleLots:number
  onHandTonnes:number;committedTonnes:number;uncommittedTonnes:number
  expiring30Tonnes:number;expiredRecordedTonnes:number
  excludedRecordedTonnes:number;pendingReleaseRequests:number
  pendingReleaseTonnes:number;pendingApprovals:number
  unverifiedLots:number;overcommittedLots:number
  lots:ReserveLotView[];commodities:ReserveGroup[];warehouseGroups:ReserveGroup[]
  expiryBuckets:ReserveBucket[];truncated:string[];partial:boolean
}
export interface VerifiedReserveDemand{
  commodityCode:string;consumptionTonnes:number;days:number
  sourceRefs:string[];periodStart:string;periodEnd:string
}
export type ReserveSeverity='critical'|'high'|'attention'|'info'
export type ReserveAction='lots'|'releases'|'warehouses'|'approvals'|'procurement'|'sources'
export interface ReserveFinding{
  id:string;severity:ReserveSeverity;check:'integrity'|'expiry'|'commitments'|'coverage'|'governance'
  title:string;explanation:string;nextStep:string
  evidence:string[];action:ReserveAction;commodityCode:string|null
}
export interface ReserveAgentReport{
  generatedAt:string;asOfDate:string;decision:string;decisionReason:string
  checks:{id:string;title:string;findingCount:number}[]
  findings:ReserveFinding[]
  coveredCommodities:number;uncoveredCommodities:number
  coverage:{commodityCode:string;commodityName:string;days:number|null
    dailyDemand:number|null;uncommittedTonnes:number;sourceRefs:string[]}[]
  partial:boolean
}
const round=(n:number)=>Math.round((n+Number.EPSILON)*1000)/1000
const qty=(v:unknown):number|null=>{
  if(v===null||v===undefined||v==='')return null
  if(typeof v!=='number'&&typeof v!=='string')return null
  const n=Number(v)
  return Number.isFinite(n)&&n>=0&&n<=1e12?n:null
}
const iso=(value:unknown):string|null=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null
  const stamp=Date.parse(value+'T00:00:00Z')
  return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value?value:null
}
const daysApart=(today:string,later:string)=>
  Math.round((Date.parse(later+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000)
const lookup=<T extends OperationsRow>(rows:T[])=>new Map(rows.map(row=>[row.id,row]))
const sum=(rows:ReserveLotView[],key:'onHandTonnes'|'approvedCommitmentTonnes'|'uncommittedTonnes')=>
  round(rows.reduce((n,row)=>n+(row.eligible?(row[key]??0):0),0))

function buildGroups(lots:ReserveLotView[],key:'warehouseId'|'commodityCode'):ReserveGroup[]{
  const groups=new Map<string,ReserveLotView[]>()
  for(const lot of lots.filter(l=>l.eligible)){
    const id=lot[key]??'unclassified'
    groups.set(id,[...(groups.get(id)??[]),lot])
  }
  return [...groups].map(([id,rows])=>({
    id,name:key==='warehouseId'?rows[0].warehouse:rows[0].commodityName,
    onHandTonnes:sum(rows,'onHandTonnes'),
    committedTonnes:sum(rows,'approvedCommitmentTonnes'),
    uncommittedTonnes:sum(rows,'uncommittedTonnes'),
    expiring30Tonnes:round(rows.filter(row=>row.daysToExpiry!==null&&row.daysToExpiry<=30)
      .reduce((n,row)=>n+(row.onHandTonnes??0),0)),
    lotCount:rows.length,
  })).sort((a,b)=>b.onHandTonnes-a.onHandTonnes||a.name.localeCompare(b.name))
}

/** This is a loaded-ledger snapshot, never an inference of national stocks. */
export function buildReservePortfolio(
  snapshot:OperationsSnapshot,asOfDate:string,truncated:readonly string[]=[],
):ReservePortfolio{
  if(!iso(asOfDate))throw Error('Invalid as-of date')
  const warehouses=lookup(snapshot.warehouses)
  const shipments=lookup(snapshot.shipments)
  const orders=lookup(snapshot.purchaseOrders)
  const contracts=lookup(snapshot.contracts)
  const releasesByLot=new Map<string,OperationsRow[]>()
  for(const release of snapshot.releases){
    if(!release.lot_id)continue
    releasesByLot.set(release.lot_id,[...(releasesByLot.get(release.lot_id)??[]),release])
  }
  let expiredRecordedTonnes=0,excludedRecordedTonnes=0,overcommittedLots=0
  const lots:ReserveLotView[]=snapshot.lots.map(lot=>{
    const issues:string[]=[]
    const warehouse=lot.warehouse_id?warehouses.get(lot.warehouse_id):null
    const shipment=lot.shipment_id?shipments.get(lot.shipment_id):null
    const order=shipment?.purchase_order_id?orders.get(shipment.purchase_order_id):null
    const contract=order?.contract_id?contracts.get(order.contract_id):null
    const linkedCode=contract?.commodity_code?.trim().toLowerCase()||null
    const directCode=lot.commodity_code?.trim().toLowerCase()||null
    const code=directCode??linkedCode
    const name=code?(resolveCommodity(code)?.name??code):'Unclassified'
    const received=qty(lot.received_tonnes)
    const released=qty(lot.released_tonnes)
    const remaining=received!==null&&released!==null&&released<=received?
      round(received-released):null
    const expiry=iso(lot.expiry_date)
    const left=expiry?daysApart(asOfDate,expiry):null
    if(lot.status!=='approved')issues.push('Lot not independently approved')
    if(!warehouse||warehouse.status!=='approved')issues.push('Approved warehouse evidence missing')
    if(!shipment||shipment.status!=='delivered')issues.push('Delivered shipment evidence missing')
    if(!code)issues.push('Commodity identification missing')
    if(directCode&&linkedCode&&directCode!==linkedCode)
      issues.push('Commodity differs from linked purchase contract')
    if(remaining===null)issues.push('Received / released quantity missing or inconsistent')
    if(left===null)issues.push('Valid expiry date missing')
    else if(left<0)issues.push('Lot expired')
    const releaseRows=releasesByLot.get(lot.id)??[]
    let committed=0,pending=0
    for(const release of releaseRows){
      if(release.status!=='approved'&&release.status!=='pending')continue
      const amount=qty(release.quantity_tonnes)
      if(amount===null){issues.push('Release request has an invalid quantity');continue}
      if(release.status==='approved')committed+=amount
      else pending+=amount
    }
    committed=round(committed);pending=round(pending)
    if(remaining!==null&&committed>remaining+0.00001){
      issues.push('Approved release commitments exceed on-hand quantity')
      overcommittedLots++
    }
    const eligible=issues.length===0
    if(lot.status==='approved'&&remaining!==null&&!eligible){
      excludedRecordedTonnes+=remaining
      if(left!==null&&left<0)expiredRecordedTonnes+=remaining
    }
    return {
      id:lot.id,reference:lot.lot_ref??lot.id.slice(0,8),
      warehouseId:lot.warehouse_id??null,
      warehouse:warehouse?.name??warehouse?.code??'Warehouse not verified',
      commodityCode:code,commodityName:name,
      shipmentRef:shipment?.shipment_ref??null,status:lot.status??'unknown',
      expiryDate:expiry,daysToExpiry:left,receivedTonnes:received,
      releasedTonnes:released,onHandTonnes:remaining,
      approvedCommitmentTonnes:committed,pendingRequestedTonnes:pending,
      uncommittedTonnes:eligible&&remaining!==null?round(remaining-committed):0,
      eligible,issues,
    }
  }).sort((a,b)=>(a.daysToExpiry??999999)-(b.daysToExpiry??999999))
  const valid=lots.filter(lot=>lot.eligible)
  const expiryBuckets:ReserveBucket[]=[
    {key:'due_7',fromDay:0,throughDay:7,onHandTonnes:0,lotCount:0},
    {key:'due_30',fromDay:8,throughDay:30,onHandTonnes:0,lotCount:0},
    {key:'due_90',fromDay:31,throughDay:90,onHandTonnes:0,lotCount:0},
    {key:'later',fromDay:91,throughDay:null,onHandTonnes:0,lotCount:0},
  ]
  for(const lot of valid){
    const days=lot.daysToExpiry!
    const bucket=expiryBuckets.find(b=>days>=b.fromDay&&
      (b.throughDay===null||days<=b.throughDay))
    if(bucket){bucket.onHandTonnes=round(bucket.onHandTonnes+(lot.onHandTonnes??0));bucket.lotCount++}
  }
  const pending=snapshot.releases.filter(r=>r.status==='pending')
  return {
    asOfDate,warehouses:snapshot.warehouses.filter(w=>w.status==='approved').length,
    totalLotRecords:lots.length,eligibleLots:valid.length,
    onHandTonnes:sum(lots,'onHandTonnes'),
    committedTonnes:sum(lots,'approvedCommitmentTonnes'),
    uncommittedTonnes:sum(lots,'uncommittedTonnes'),
    expiring30Tonnes:round(valid.filter(l=>l.daysToExpiry!==null&&l.daysToExpiry<=30)
      .reduce((n,l)=>n+(l.onHandTonnes??0),0)),
    expiredRecordedTonnes:round(expiredRecordedTonnes),
    excludedRecordedTonnes:round(excludedRecordedTonnes),
    pendingReleaseRequests:pending.length,
    pendingReleaseTonnes:round(pending.reduce((n,r)=>n+(qty(r.quantity_tonnes)??0),0)),
    pendingApprovals:snapshot.approvals.filter(a=>a.status==='pending'&&
      ['warehouse','lot','release'].includes(a.target_type??'')).length,
    unverifiedLots:lots.filter(l=>!l.eligible).length,
    overcommittedLots,
    lots,commodities:buildGroups(lots,'commodityCode'),
    warehouseGroups:buildGroups(lots,'warehouseId'),
    expiryBuckets,truncated:[...truncated],partial:truncated.length>0,
  }
}
const severityOrder:Record<ReserveSeverity,number>={critical:0,high:1,attention:2,info:3}
const finding=(f:ReserveFinding)=>f
/**
 * Four deterministic read-only checks. This is a decision-support agent,
 * not an LLM, external order placement, or human approval substitute.
 * Verified consumption is optional and must come from a reviewed live source.
 */
export function runReserveAgent(
  portfolio:ReservePortfolio,demands:readonly VerifiedReserveDemand[],
  generatedAt:string,
):ReserveAgentReport{
  const findings:ReserveFinding[]=[]
  const add=(f:ReserveFinding)=>findings.push(finding(f))
  for(const lot of portfolio.lots){
    if(!lot.eligible){
      const unapproved=lot.status!=='approved'
      if(unapproved)continue // Pending lots are expected workflow states.
      add({id:'integrity:'+lot.id,severity:lot.issues.some(x=>
        /exceed|expired|inconsistent|differs/.test(x))?'critical':'high',
        check:'integrity',title:'Lot requires reconciliation: '+lot.reference,
        explanation:lot.issues.join('; '),
        nextStep:'Inspect warehouse, shipment, expiry and release evidence before treating this lot as usable reserve.',
        evidence:[lot.reference,lot.warehouse,lot.shipmentRef??'No delivered shipment reference'],
        action:'lots',commodityCode:lot.commodityCode})
    }
    if(lot.eligible&&lot.daysToExpiry!==null&&lot.onHandTonnes!==null&&lot.onHandTonnes>0){
      if(lot.daysToExpiry<=30){
        add({id:'fefo:'+lot.id,
          severity:lot.daysToExpiry<=7?'high':'attention',check:'expiry',
          title:'FEFO priority: '+lot.reference,
          explanation:lot.onHandTonnes+' t in '+lot.warehouse+' expire in '+
            lot.daysToExpiry+' days ('+lot.expiryDate+').',
          nextStep:'Review first-expiry-first-out allocation; request independent release approval before movement.',
          evidence:['Lot '+lot.reference,'Expiry '+lot.expiryDate,
            'Available '+lot.uncommittedTonnes+' t after approved commitments'],
          action:'lots',commodityCode:lot.commodityCode})
      }
      if(lot.pendingRequestedTonnes+lot.approvedCommitmentTonnes>lot.onHandTonnes+0.00001){
        add({id:'release:'+lot.id,severity:'high',check:'commitments',
          title:'Pending requests may exceed stock: '+lot.reference,
          explanation:'Approved commitments ('+lot.approvedCommitmentTonnes+
            ' t) plus pending requests ('+lot.pendingRequestedTonnes+
            ' t) exceed the '+lot.onHandTonnes+' t lot balance.',
          nextStep:'Review requests and available lot balance before any independent approval.',
          evidence:['Approved commitments '+lot.approvedCommitmentTonnes+' t',
            'Pending requests '+lot.pendingRequestedTonnes+' t'],
          action:'releases',commodityCode:lot.commodityCode})
      }
    }
  }
  if(!portfolio.totalLotRecords){
    add({id:'missing-lots',severity:'high',check:'integrity',
      title:'No registered reserve lots',
      explanation:'No operational lot records were returned for this organization. This is not evidence that physical reserves are zero.',
      nextStep:'Verify warehouse and inventory integrations or register the first documented batch.',
      evidence:['Organization ledger has 0 loaded lot rows'],action:'lots',commodityCode:null})
  }
  if(portfolio.partial){
    add({id:'partial-ledger',severity:'high',check:'integrity',
      title:'Reserve ledger is truncated',
      explanation:'At least one source exceeded the API row limit: '+portfolio.truncated.join(', ')+'. Totals are partial.',
      nextStep:'Use a paginated, complete inventory extraction before decisions on national or total portfolio coverage.',
      evidence:portfolio.truncated.map(x=>'Truncated '+x),
      action:'sources',commodityCode:null})
  }
  if(portfolio.pendingApprovals>0){
    add({id:'pending-approvals',severity:'attention',check:'governance',
      title:portfolio.pendingApprovals+' reserve approvals awaiting review',
      explanation:'Warehouse, lot or reserve-release approval records are pending in this organization.',
      nextStep:'Route these records to an independent authorized reviewer; the agent must not approve them.',
      evidence:['Pending approvals '+portfolio.pendingApprovals],
      action:'approvals',commodityCode:null})
  }
  const demandMap=new Map(demands.filter(d=>Number.isFinite(d.consumptionTonnes)&&
    d.consumptionTonnes>=0&&Number.isInteger(d.days)&&d.days>0&&d.days<=180)
    .map(d=>[d.commodityCode,d]))
  const coverage:ReserveAgentReport['coverage']=[]
  for(const commodity of portfolio.commodities){
    const demand=demandMap.get(commodity.id)
    const perDay=demand&&demand.consumptionTonnes>0?
      demand.consumptionTonnes/demand.days:null
    const days=perDay!==null?
      Math.round(commodity.uncommittedTonnes/perDay*10)/10:null
    coverage.push({commodityCode:commodity.id,commodityName:commodity.name,
      days,dailyDemand:perDay===null?null:round(perDay),
      uncommittedTonnes:commodity.uncommittedTonnes,sourceRefs:demand?.sourceRefs??[]})
    if(days!==null&&days<30){
      add({id:'coverage:'+commodity.id,
        severity:days<7?'critical':days<14?'high':'attention',
        check:'coverage',title:'Reserve coverage: '+commodity.name,
        explanation:'Uncommitted stock '+commodity.uncommittedTonnes+
          ' t / reviewed '+demand!.days+'-day mean demand '+round(perDay!)+
          ' t/day = '+days+' days of RESERVE cover.',
        nextStep:'Review replenishment options with procurement, lead times and FEFO. This is not a purchase instruction.',
        evidence:['Reviewed consumption period '+demand!.periodStart+' to '+demand!.periodEnd,
          'Verified source references: '+demand!.sourceRefs.length],
        action:'procurement',commodityCode:commodity.id})
    }
    if(days===null){
      add({id:'demand:'+commodity.id,severity:'info',check:'coverage',
        title:'Coverage not assessed: '+commodity.name,
        explanation:'No strictly reviewed, positive consumption baseline is available. Stock tonnage cannot be converted into defensible coverage days.',
        nextStep:'Review complete 30-day consumption and source coverage for this commodity.',
        evidence:['Uncommitted lots '+commodity.uncommittedTonnes+' t'],
        action:'sources',commodityCode:commodity.id})
    }
  }
  const checks=[
    {id:'integrity',title:'Lot integrity & traceability',findingCount:findings.filter(f=>f.check==='integrity').length},
    {id:'expiry',title:'Expiry and FEFO',findingCount:findings.filter(f=>f.check==='expiry').length},
    {id:'commitments',title:'Release capacity',findingCount:findings.filter(f=>f.check==='commitments').length},
    {id:'coverage',title:'Consumption-backed coverage',findingCount:findings.filter(f=>f.check==='coverage').length},
    {id:'governance',title:'Approval governance',findingCount:findings.filter(f=>f.check==='governance').length},
  ]
  findings.sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]||a.id.localeCompare(b.id))
  const critical=portfolio.lots.filter(l=>l.status==='approved'&&!l.eligible).length
  const expiry=portfolio.lots.filter(l=>l.eligible&&(l.daysToExpiry??999)>-1&&
    (l.daysToExpiry??999)<=7&&l.onHandTonnes!==null&&l.onHandTonnes>0).length
  const shortage=coverage.filter(c=>c.days!==null&&c.days<14).length
  const decision=critical>0?'Reconcile excluded or invalid lots before reserve release':
    shortage>0?'Escalate low reserve coverage for procurement review':
    expiry>0?'Prioritize FEFO allocation of short-dated lots':
    !portfolio.totalLotRecords?'Verify reserve inventory data availability':
    coverage.some(c=>c.days===null)?'Obtain verified consumption for a coverage decision':
    'No rule-based critical exception in the assessed records'
  const decisionReason=critical>0?critical+' approved lots have exclusion or traceability issues.':
    shortage>0?shortage+' commodities have less than 14 days of reviewed reserve coverage.':
    expiry>0?expiry+' usable lots expire within seven days.':
    !portfolio.totalLotRecords?'No usable lot inventory was supplied.':
    coverage.some(c=>c.days===null)?'Verified consumption coverage is incomplete for some commodities.':
    'No critical rule threshold was met; this is NOT a safety guarantee.'
  return {generatedAt,asOfDate:portfolio.asOfDate,decision,decisionReason,checks,
    findings,coveredCommodities:coverage.filter(c=>c.days!==null).length,
    uncoveredCommodities:coverage.filter(c=>c.days===null).length,
    coverage,partial:portfolio.partial}
}
