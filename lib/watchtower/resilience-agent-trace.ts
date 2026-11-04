/**
 * Read-only, deterministic agent-workflow rehearsal for organization supply resilience.
 * A trace is created ONLY when the user clicks Run. No LLM, paid provider,
 * supplier lookup, route optimisation, tender or purchase is executed.
 *
 * Every step exposes the source-backed numbers it inspects and the checks it
 * cannot perform from the FoodPosture snapshot. Never substitute simulation
 * outputs for supplier qualification or approval.
 */
import type {FoodPosture,FoodPostureCommodity} from './food-posture'
import {buildResilienceDecisionQueue} from './resilience-queue'
export type StageState='verified'|'attention'|'blocked'|'gate'
export type StageId='scope'|'evidence'|'production'|'imports'|'balance'|'coverage'|
  'importExposure'|'suppliers'|'logistics'|'options'|'governance'
export interface AgentTraceStage{
  id:StageId
  agent:string
  agentAr:string
  title:string
  titleAr:string
  state:StageState
  operation:string
  operationAr:string
  finding:string
  findingAr:string
  input:string[]
  output:string[]
  handoff:string
  handoffAr:string
}
export interface ResilienceAgentTrace{
  organizationId:string
  commodityId:string
  commodityName:string
  commodityNameAr:string
  horizonDays:number
  fromDate:string
  toDate:string
  snapshotAt:string
  steps:AgentTraceStage[]
  verdict:{
    priority:'P0'|'P1'|'P2'|'EVIDENCE'|'MONITOR'
    title:string
    titleAr:string
    rationale:string
    rationaleAr:string
    nextAction:string
    nextActionAr:string
    approvalRequired:true
  }
}
const number=(n:number|null|undefined,unit='')=>
  n===null||n===undefined||!Number.isFinite(n)?'Not available':
    n.toLocaleString('en-US',{maximumFractionDigits:1})+unit
function stage(id:StageId,agent:string,agentAr:string,title:string,titleAr:string,
  state:StageState,operation:string,operationAr:string,finding:string,findingAr:string,
  input:string[],output:string[],handoff:string,handoffAr:string):AgentTraceStage{
  return {id,agent,agentAr,title,titleAr,state,operation,operationAr,
    finding,findingAr,input,output,handoff,handoffAr}
}
function verdict(row:FoodPostureCommodity,priority:'P0'|'P1'|'P2'|'EVIDENCE'|'MONITOR'){
  if(priority==='EVIDENCE')return {
    priority,title:'Source verification required',titleAr:'يلزم التحقق من المصادر',
    rationale:'Missing reviewed evidence prevents a defensible shortage or purchasing assessment.',
    rationaleAr:'نقص الأدلة المُراجعة يمنع تقييم العجز أو الشراء بشكل موثوق.',
    nextAction:'Collect and independently review missing production, import, inventory or demand records before procurement screening.',
    nextActionAr:'جمع سجلات الإنتاج والواردات والمخزون والطلب الناقصة والتحقق منها قبل تقييم المشتريات.',
    approvalRequired:true as const,
  }
  if(priority==='P0')return {
    priority,title:'Investigate confirmed-input projected deficit',titleAr:'التحقيق في العجز المتوقع بناءً على المدخلات المؤكدة',
    rationale:'The reviewed period-end balance is negative: '+number(row.deficitTonnes,' t')+
      ' projected gap. This is an analysis trigger, not a purchase authorization.',
    rationaleAr:'يشير رصيد نهاية الفترة المُراجع إلى عجز متوقع، وهو مؤشر للمراجعة لا تفويض للشراء.',
    nextAction:'Validate the gap; request verified supplier offers, freight timelines and landed-cost comparisons, then submit a human approval case.',
    nextActionAr:'تأكيد العجز وطلب عروض الموردين الموثقة ووقت الشحن والتكلفة النهائية ثم رفع الحالة للموافقة البشرية.',
    approvalRequired:true as const,
  }
  if(priority==='P1')return {
    priority,title:'Review replenishment and reserve buffers',titleAr:'مراجعة إعادة التوريد والمخزون الاحتياطي',
    rationale:'Reviewed period-end stock coverage of '+number(row.coverageDays,' days')+
      ' crossed a provisional short-coverage threshold.',
    rationaleAr:'تجاوزت تغطية المخزون المُراجعة عتبة أولية لانخفاض التغطية.',
    nextAction:'Check replenishment lead times, reserve allocation and validated alternatives before any procurement request.',
    nextActionAr:'التحقق من مهلة التوريد وتوزيع الاحتياطي والبدائل المعتمدة قبل طلب الشراء.',
    approvalRequired:true as const,
  }
  if(priority==='P2')return {
    priority,title:'Review the projected buffer',titleAr:'مراجعة هامش التغطية المتوقع',
    rationale:'Reviewed period-end coverage of '+number(row.coverageDays,' days')+
      ' is within the provisional 14–29-day monitoring band.',
    rationaleAr:'تقع تغطية نهاية الفترة المُراجعة ضمن نطاق المراقبة الأولي.',
    nextAction:'Verify next deliveries, buffer policy and updated consumption before considering replenishment.',
    nextActionAr:'التحقق من الشحنات القادمة وسياسة الاحتياطي والاستهلاك المحدث قبل دراسة إعادة التوريد.',
    approvalRequired:true as const,
  }
  return {
    priority,title:'Continue reviewed monitoring',titleAr:'استمرار المراقبة بالبيانات المُراجعة',
    rationale:'No provisional 7/14/30-day screening trigger in this reviewed period. This is not proof of national food security.',
    rationaleAr:'لم تتحقق عتبات الفحص الأولية في الفترة المُراجعة، ولا يعني ذلك ضمان الأمن الغذائي الوطني.',
    nextAction:'Maintain source reviews and watch for changes in demand, imports, production or opening stock.',
    nextActionAr:'الاستمرار في مراجعة مصادر الطلب والواردات والإنتاج والمخزون.',
    approvalRequired:true as const,
  }
}
export function simulateResilienceAgentTrace(posture:FoodPosture,commodityId:string):ResilienceAgentTrace{
  if(posture.scope!=='organization'||posture.sourceMode!=='live')
    throw Error('Agent simulation requires live organization-scoped food posture')
  const row=posture.commodities.find(x=>x.commodityId===commodityId)
  if(!row)throw Error('Commodity is not included in the authorized organization snapshot')
  const queue=buildResilienceDecisionQueue(posture)
  const action=[...queue.procurementReview,...queue.evidenceReview]
    .find(x=>x.commodityId===commodityId)
  const priority=action?.priority??'MONITOR'
  const complete=row.status==='complete'&&row.band!=='unknown'
  const hasProduction=row.domesticProductionTonnes!==null
  const hasImports=row.confirmedImportsTonnes!==null
  const hasBalance=complete&&row.projectedBalanceTonnes!==null
  const hasCoverage=complete&&row.coverageDays!==null
  const refs=row.evidenceSourceRefs.length
  const sourceTypes=row.missingCoverage.length?
    row.missingCoverage.join(', '):'No missing coverage flags'
  const inputs=['Organization: '+posture.organizationId,
    'Horizon: '+posture.days+' days ('+posture.fromDate+' to '+posture.toDate+')']
  const steps:AgentTraceStage[]=[
    stage('scope','Scope controller','مراقب النطاق','Validate the analysis boundary','التحقق من نطاق التحليل',
      'verified','Check tenant, approved source mode and selected horizon.',
      'فحص المؤسسة ونمط المصدر وفترة التقييم.',
      'Authorized organization snapshot selected; no cross-tenant or national aggregation.',
      'تم تحديد بيانات المؤسسة دون جمع وطني أو بيانات مؤسسات أخرى.',
      inputs,['Scope = organization / live','Snapshot = '+posture.generatedAt],
      'Send authorized commodity snapshot to evidence auditor.',
      'إرسال بيانات السلعة إلى مدقق الأدلة.'),
    stage('evidence','Evidence auditor','مدقق الأدلة','Audit source completeness','تدقيق اكتمال المصادر',
      complete&&refs>0?'verified':'blocked',
      'Inspect balance status, reviewed references and missing coverage.',
      'فحص حالة الميزان والمراجع المُراجعة والتغطية الناقصة.',
      complete?'Balance status is complete. Evidence reference count: '+refs+'.':
        'Incomplete reviewed inputs; shortage and procurement inference are restricted.',
      complete?'حالة الميزان مكتملة؛ عدد مراجع الأدلة: '+refs+'.':
        'المدخلات المُراجعة غير مكتملة؛ لا يمكن استنتاج العجز أو الشراء.',
      ['Commodity: '+row.name,'Status: '+row.status,'Reviewed refs: '+refs],
      [sourceTypes,'Last review: '+(row.latestReviewedAt??'Not available')],
      complete?'Forward verified fields; keep unverified supplier data separate.':
        'Keep unavailable calculations blocked; request source review.',
      complete?'تمرير الحقول المراجعة وفصل معلومات الموردين غير المؤكدة.':
        'إيقاف الحسابات غير المتاحة وطلب مراجعة المصادر.'),
    stage('production','Production specialist','مختص الإنتاج','Evaluate domestic production','تقييم الإنتاج المحلي',
      complete&&hasProduction?'verified':'blocked',
      'Read verified domestic production contribution for this period.',
      'قراءة مساهمة الإنتاج المحلي المُراجعة خلال الفترة.',
      complete&&hasProduction?'Reviewed contribution: '+number(row.domesticProductionTonnes,' t')+'.':
        'Domestic production cannot be validated from this snapshot.',
      complete&&hasProduction?'مساهمة الإنتاج المحلي المُراجعة: '+number(row.domesticProductionTonnes,' طن')+'.':
        'لا يمكن التحقق من الإنتاج المحلي من البيانات الحالية.',
      ['Period: '+posture.fromDate+' → '+posture.toDate],
      ['Domestic production: '+(complete?number(row.domesticProductionTonnes,' t'):'Not verified')],
      'Pass observed domestic inflows, without projecting additional yield.',
      'تمرير الإنتاج المسجل دون افتراض إنتاج إضافي.'),
    stage('imports','Import analyst','محلل الواردات','Evaluate confirmed imports','تقييم الواردات المؤكدة',
      complete&&hasImports?'verified':'blocked',
      'Review the imports already counted in the organization balance.',
      'مراجعة الواردات المسجلة ضمن ميزان المؤسسة.',
      complete&&hasImports?'Confirmed import contribution: '+number(row.confirmedImportsTonnes,' t')+'.':
        'Confirmed import contribution is unavailable; no shipments are assumed.',
      complete&&hasImports?'مساهمة الواردات المؤكدة: '+number(row.confirmedImportsTonnes,' طن')+'.':
        'لا تتوفر مساهمة الواردات المؤكدة؛ لا نفترض شحنات.',
      ['Supply source: reviewed organization balance'],
      ['Confirmed imports: '+(complete?number(row.confirmedImportsTonnes,' t'):'Not verified')],
      'Forward reviewed inflows to period-end balance validator.',
      'تمرير التدفقات المُراجعة إلى مدقق ميزان نهاية الفترة.'),
    stage('balance','Balance model','نموذج الموازنة','Validate projected supply balance','التحقق من ميزان الإمداد المتوقع',
      !hasBalance?'blocked':(row.projectedBalanceTonnes??0)<0?'attention':'verified',
      'Inspect the upstream calculated period-end production + imports + stock - consumption balance. Do not recompute missing terms.',
      'فحص رصيد نهاية الفترة المحسوب مسبقاً دون اختراع العناصر الناقصة.',
      hasBalance?((row.projectedBalanceTonnes??0)<0?'Projected deficit detected: ':'Projected balance: ')+
        number(row.projectedBalanceTonnes,' t')+'.':'Balance is incomplete; deficit cannot be classified.',
      hasBalance?'تم فحص رصيد نهاية الفترة المُراجع.':'الميزان غير مكتمل ولا يمكن تصنيف العجز.',
      ['Review status: '+row.status],
      ['Period-end balance: '+(hasBalance?number(row.projectedBalanceTonnes,' t'):'Unavailable'),
        'Projected deficit: '+(hasBalance?number(row.deficitTonnes,' t'):'Unavailable')],
      'Send measured period-end balance to coverage screening.',
      'تمرير الميزان إلى فحص تغطية المخزون.'),
    stage('coverage','Reserve analyst','محلل الاحتياطي','Screen inventory coverage','فحص تغطية المخزون',
      !hasCoverage?'blocked':row.coverageDays!<14?'attention':row.coverageDays!<30?'attention':'verified',
      'Compare upstream projected period-end coverage with provisional 7/14/30-day thresholds.',
      'مقارنة تغطية نهاية الفترة مع عتبات 7/14/30 يوماً الأولية.',
      hasCoverage?'Coverage: '+number(row.coverageDays,' days')+
        '. Screen band: '+row.band+'.':'Coverage cannot be determined without a validated consumption baseline.',
      hasCoverage?'تم تحديد نطاق التغطية المتوقع: '+number(row.coverageDays,' يوم')+'.':
        'لا يمكن تحديد التغطية دون خط أساس مُراجع للاستهلاك.',
      ['Provisional thresholds: <7 / 7–13 / 14–29 / >=30 days'],
      ['Projected period-end coverage: '+(hasCoverage?number(row.coverageDays,' days'):'Unavailable')],
      'Forward assessed buffer exposure to procurement triage.',
      'تمرير تقييم الاحتياطي إلى فحص المشتريات.'),
    stage('importExposure','Supply dependency analyst','محلل التعرض للتوريد','Measure import inflow exposure','قياس تعرض التدفقات للواردات',
      !complete||row.importShareOfInflowsPercent===null?'blocked':
        row.importShareOfInflowsPercent>70?'attention':'verified',
      'Compute the reported share of imports within planned inflows. This is not national import dependence.',
      'فحص حصة الواردات ضمن التدفقات المخططة وليس الاعتماد الوطني.',
      complete&&row.importShareOfInflowsPercent!==null?
        'Import share of planned inflows: '+number(row.importShareOfInflowsPercent,'%')+'.':
        'Import inflow share unavailable; geographic concentration is not inferred.',
      complete&&row.importShareOfInflowsPercent!==null?
        'حصة الواردات من التدفقات المخططة: '+number(row.importShareOfInflowsPercent,'%')+'.':
        'حصة الواردات غير متاحة، ولا يمكن تقدير تركّز المصدر.',
      ['Domestic production: '+(complete?number(row.domesticProductionTonnes,' t'):'Not verified'),
        'Imports: '+(complete?number(row.confirmedImportsTonnes,' t'):'Not verified')],
      ['Import share: '+(complete?number(row.importShareOfInflowsPercent,'%'):'Unavailable')],
      'Request supplier qualification and route evidence before costing.',
      'طلب بيانات تأهيل الموردين والمسارات قبل حساب التكلفة.'),
    stage('suppliers','Supplier qualification agent','وكيل تأهيل الموردين','Assess supplier eligibility','تقييم أهلية الموردين',
      'blocked','A qualified supplier must be verified for commodity, capacity, quality, certificates and contracts.',
      'يجب التحقق من المورد والقدرة والجودة والشهادات والعقود.',
      'Not executed: no verified supplier quotes or qualification dossier are included in this posture snapshot.',
      'لم يُنفذ: لا تتوفر عروض موثقة أو ملفات تأهيل ضمن البيانات.',
      ['Required: qualified seller, product origin, certificates, available quantity'],
      ['Supplier shortlist: NOT VERIFIED','Offers: NOT AVAILABLE','No supplier selected'],
      'Open procurement discovery separately; human qualification remains required.',
      'فتح البحث عن الموردين بشكل منفصل مع اشتراط التحقق البشري.'),
    stage('logistics','Route & cost agent','وكيل المسارات والتكلفة','Check logistics and landed cost','فحص اللوجستيات والتكلفة النهائية',
      'blocked','Compare supported sea, air and land routes only with real ETAs, freight terms, customs and origin quotes.',
      'مقارنة المسارات عند توفر الوقت والتكلفة والجمارك وعروض المنشأ.',
      'Not executed: the balance snapshot contains no validated route, freight quote, arrival ETA or landed-cost evidence.',
      'لم يُنفذ: لا تتوفر مسارات أو رسوم شحن أو مواعيد وصول أو تكاليف موثقة.',
      ['Required: route, ETA, freight cost, Incoterms, customs, supplier price'],
      ['Route ranking: NOT CALCULATED','Landed cost: NOT CALCULATED','No invented transport risk score'],
      'Return evidence gaps before the strategy agent compares procurement options.',
      'إرجاع فجوات البيانات قبل مقارنة خيارات الشراء.'),
    stage('options','Procurement strategy agent','وكيل استراتيجية المشتريات','Compare response pathways','مقارنة خيارات الاستجابة',
      priority==='EVIDENCE'?'blocked':priority==='MONITOR'?'verified':'attention',
      'Match verified screening priority with a conditional response pathway. Do not calculate a vendor ranking without quotes.',
      'ربط مستوى الأولوية بخيارات مشروطة دون ترتيب الموردين بلا عروض.',
      priority==='EVIDENCE'?'Hold procurement proposals until underlying balances are reviewed.':
        priority==='P0'?'Investigate deficit and request supplier, freight and buffer alternatives.':
        priority==='P1'?'Review reserve releases, replenishment timing and qualified alternative supply.':
        priority==='P2'?'Review available buffers and monitor next deliveries.':
        'No screening threshold crossed; continue evidence-backed monitoring.',
      priority==='EVIDENCE'?'إيقاف مقترحات الشراء حتى مراجعة الموازين.':
        priority==='P0'?'التحقيق في العجز وطلب بدائل الموردين والشحن والاحتياطي.':
        priority==='P1'?'مراجعة الاحتياطي وإعادة التوريد والبدائل المعتمدة.':
        priority==='P2'?'مراجعة هامش التغطية ومواعيد وصول الشحنات.':
        'لا توجد عتبة فحص متحققة؛ استمرار المراقبة.',
      ['Priority: '+priority,'Missing commercial inputs: supplier quotes / transit / landed costs'],
      ['Review pathway: '+priority,'Purchase order: NOT CREATED'],
      'Send conditional recommendation to a human reviewer.',
      'إرسال التوصية المشروطة إلى المراجع البشري.'),
    stage('governance','Governance & approval agent','وكيل الحوكمة والاعتماد',
      'Human authorization gate','بوابة الاعتماد البشري',
      'gate','Check source traceability, unresolved gaps and approval requirements before any action.',
      'فحص قابلية تتبع المصادر والفجوات والموافقة قبل أي إجراء.',
      'Rehearsal complete. Human decision is required. No external AI, procurement order or database write occurred.',
      'اكتملت المحاكاة. القرار البشري مطلوب ولم يُنفذ شراء أو كتابة بيانات.',
      ['Scope: '+posture.organizationId,'Horizon: '+posture.days+' days',
        'Evidence refs: '+refs],
      ['Approval: PENDING','Procurement action: NONE','External providers called: NONE'],
      'Hand off to organization procurement and approved governance workflow.',
      'التسليم إلى إجراءات المشتريات والحوكمة المعتمدة.'),
  ]
  return {
    organizationId:posture.organizationId,commodityId:row.commodityId,
    commodityName:row.name,commodityNameAr:row.nameAr,
    horizonDays:posture.days,fromDate:posture.fromDate,toDate:posture.toDate,
    snapshotAt:posture.generatedAt,steps,verdict:verdict(row,priority),
  }
}
