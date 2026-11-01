import type { AgentType } from '@/lib/ai/agents/types'
import type { FoodBalanceResult } from '@/lib/food-security/balance'
import {
  calculateFoodScenario, type FoodScenarioAdjustments, type FoodScenarioImpact,
} from '@/lib/food-security/scenario'
import { linkCommodityOperations, type CommoditySupplyLinks } from './commodity-links'
import type { OperationsSnapshot } from './operations-types'

export type AgentStepState = 'complete' | 'review' | 'needs_data'
export type AgentRisk = 'critical' | 'high' | 'attention' | 'stable' | 'unknown'

export interface AgentStep {
  id: string
  agent: AgentType
  areaEn: string
  areaAr: string
  titleEn: string
  titleAr: string
  findingEn: string
  findingAr: string
  state: AgentStepState
  evidence: string[]
}

export interface AgentProposal {
  id: string
  priority: 'high' | 'normal' | 'evidence'
  titleEn: string
  titleAr: string
  whyEn: string
  whyAr: string
  requiresHumanApproval: true
}

export interface CommodityAgentSimulation {
  simulated: true
  sourceMode: FoodBalanceResult['sourceMode']
  commodityId: string
  risk: AgentRisk
  scenario: FoodScenarioImpact
  links: CommoditySupplyLinks
  steps: AgentStep[]
  proposals: AgentProposal[]
  humanGate: 'approval_required'
  caveats: string[]
}

const number=(n:number|null|undefined,precision=1):string=>
  n===null||n===undefined||!Number.isFinite(n)?'—':
    n.toLocaleString('en-US',{maximumFractionDigits:precision})

export function agentRisk(balance:FoodBalanceResult,scenario:FoodScenarioImpact):AgentRisk {
  if (scenario.status!=='complete'||balance.status!=='complete')return 'unknown'
  if ((scenario.totals.scenarioDeficitTonnes??0)>0 ||
      (scenario.totals.scenarioCoverageDays??Infinity)<7)return 'critical'
  if ((scenario.totals.scenarioCoverageDays??Infinity)<14)return 'high'
  if ((scenario.totals.scenarioCoverageDays??Infinity)<30)return 'attention'
  return 'stable'
}

/**
 * Deterministic, read-only simulation of EXISTING NFII agent roles.
 * Not an AI API call, not mission execution, not persisted, not a procurement
 * instruction, and never a government-certified risk assessment.
 *
 * Neither operational shipment quantities nor reserve lots are merged into the
 * food-balance model because the sources may describe the very same stock.
 */
export function simulateCommodityAgents(input:{
  commodityId:string
  balance:FoodBalanceResult
  operations:OperationsSnapshot
  today:string
  shocks:FoodScenarioAdjustments
}):CommodityAgentSimulation {
  const {commodityId,balance,operations,today,shocks}=input
  if(commodityId!==balance.commodityId)throw new Error('Commodity and balance do not match')
  const scenario=calculateFoodScenario(balance,shocks)
  const links=linkCommodityOperations(commodityId,operations,today)
  const risk=agentRisk(balance,scenario)
  const ready=scenario.status==='complete'
  const illustrative=balance.sourceMode==='demo'
  const sourceLabel=illustrative?'synthetic Qatar example':'organization-reviewed input'
  const flowRefs=balance.evidence.sourceRefs.slice(0,4)
  const mainEvidence=flowRefs.length?flowRefs:['No usable food balance source']
  const state=(isReady:boolean):AgentStepState=>isReady?'complete':'needs_data'
  const steps:AgentStep[]=[]
  const add=(step:AgentStep)=>steps.push(step)

  add({
    id:'orchestrate',agent:'orchestrator',areaEn:'Coordination',areaAr:'التنسيق',
    titleEn:'Assign the commodity response team',titleAr:'تعيين فريق الاستجابة للسلعة',
    findingEn:'Organize quality, food balance, agriculture, sourcing, logistics, reserves and reporting for '+
      commodityId+' over '+balance.days+' days. No tools or transactions are executed.',
    findingAr:'تنسيق جودة البيانات والميزان الغذائي والإنتاج والتوريد والنقل والمخزون والتقارير لمدة '+
      balance.days+' يوماً. لا تُنفّذ معاملات أو أدوات حية.',
    state:'complete',evidence:['Commodity: '+commodityId,'Horizon: '+balance.fromDate+' → '+balance.toDate],
  })

  add({
    id:'quality',agent:'data_quality_agent',areaEn:'Source validation',areaAr:'التحقق من المصادر',
    titleEn:ready?'Check the input balance':'Flag incomplete commodity evidence',
    titleAr:ready?'فحص مدخلات الميزان':'الإبلاغ عن نقص الأدلة',
    findingEn:ready
      ? 'Stock and four flow categories are present. Source type: '+sourceLabel+
        '. Completeness does not independently certify accuracy.'
      : 'Do not assess shortage or procurement quantities: opening stock or the necessary flow declarations are incomplete.',
    findingAr:ready
      ? 'يتوفر المخزون وتدفقات الإنتاج والواردات والاستهلاك والفاقد. اكتمال المدخلات لا يعني اعتماد صحتها.'
      : 'لا يمكن تقدير العجز أو المشتريات بسبب نقص المخزون الافتتاحي أو تدفقات البيانات.',
    state:ready?(illustrative?'review':'complete'):'needs_data',
    evidence:[...mainEvidence,...balance.evidence.missingCoverage.map(x=>'Missing: '+x)],
  })

  add({
    id:'food',agent:'food_security_analyst',areaEn:'Food security',areaAr:'الأمن الغذائي',
    titleEn:'Calculate supply and demand',titleAr:'حساب العرض والطلب',
    findingEn:ready
      ? 'Starting stock '+number(balance.totals.openingStockTonnes)+' t; demand '+
        number(balance.totals.consumptionTonnes)+' t; scenario closing stock '+
        number(scenario.totals.scenarioClosingStockTonnes)+' t; deficit '+
        number(scenario.totals.scenarioDeficitTonnes)+' t.'
      : 'Cannot establish a complete commodity balance. Missing evidence is not zero supply.',
    findingAr:ready
      ? 'المخزون الافتتاحي '+number(balance.totals.openingStockTonnes)+' طن؛ الطلب '+
        number(balance.totals.consumptionTonnes)+' طن؛ مخزون السيناريو النهائي '+
        number(scenario.totals.scenarioClosingStockTonnes)+' طن؛ العجز '+
        number(scenario.totals.scenarioDeficitTonnes)+' طن.'
      : 'الميزان الغذائي غير مكتمل. غياب الأدلة لا يعني انعدام الإمدادات.',
    state:state(ready),evidence:mainEvidence,
  })

  add({
    id:'agronomy',agent:'agronomy_analyst',areaEn:'Local production',areaAr:'الإنتاج المحلي',
    titleEn:'Assess the domestic-production contribution',
    titleAr:'تقييم مساهمة الإنتاج المحلي',
    findingEn:ready
      ? 'Domestic supply baseline '+number(balance.totals.domesticProductionTonnes)+
        ' t. Under the selected shock, estimated contribution '+number(
          (balance.totals.domesticProductionTonnes??0)*
          (1-shocks.productionReductionPercent/100))+
        ' t. Farm-level crop and satellite evidence is not connected to this assessment.'
      : 'Production contribution unknown. Farm-level validation is still required.',
    findingAr:ready
      ? 'الإنتاج المحلي الأساسي '+number(balance.totals.domesticProductionTonnes)+
        ' طن. بعد الصدمة المفترضة '+number((balance.totals.domesticProductionTonnes??0)*
          (1-shocks.productionReductionPercent/100))+
        ' طن. لم تُربط أدلة المحاصيل والأقمار الصناعية بهذا التحليل.'
      : 'مساهمة الإنتاج غير معروفة ويلزم التحقق من بيانات المزارع.',
    state:ready?'review':'needs_data',
    evidence:['Domestic production flow','Farm/satellite data not integrated'],
  })

  const approvedContracts=links.contracts.filter(c=>c.status==='approved')
  const supplierSummary=links.suppliers.slice(0,3).map(s=>s.name??s.code??s.id).join('; ')
  add({
    id:'procurement',agent:'supply_analyst',areaEn:'Procurement',areaAr:'المشتريات',
    titleEn:'Review supplier and contract options',titleAr:'مراجعة الموردين والعقود',
    findingEn:links.contracts.length
      ? approvedContracts.length+' approved of '+links.contracts.length+
        ' commodity contracts, representing '+number(links.approvedContractTonnes)+
        ' t contracted. Suppliers: '+(supplierSummary||'unavailable')+
        '. Contract tonnage is NOT additional usable stock.'
      : 'No matching supplier contract records. Request supplier evidence before suggesting sourcing.',
    findingAr:links.contracts.length
      ? 'العقود المعتمدة '+approvedContracts.length+' من '+links.contracts.length+
        ' بإجمالي '+number(links.approvedContractTonnes)+
        ' طن متعاقد عليه. لا تُضاف الكميات المتعاقد عليها إلى المخزون الفعلي.'
      : 'لا توجد عقود مرتبطة بالسلعة. يُطلب إثبات الموردين قبل اقتراح التوريد.',
    state:links.contracts.length?'review':'needs_data',
    evidence:links.contracts.length?links.contracts.slice(0,3).map(c=>c.contract_ref??c.id):
      ['No matching procurement contracts'],
  })

  const delay=links.shipments.filter(s=>s.status==='delayed')
  add({
    id:'logistics',agent:'supply_analyst',areaEn:'Logistics',areaAr:'اللوجستيات',
    titleEn:'Inspect the shipment pipeline',titleAr:'فحص خط الشحن',
    findingEn:links.shipments.length
      ? links.activeShipments+' active/planned shipments; '+delay.length+
        ' delayed; '+number(links.deliveredTonnes)+
        ' t marked delivered. Tracking states are administrative, not verified carrier feeds.'
      : 'No shipments linked to this commodity. Port or carrier ETAs cannot be inferred.',
    findingAr:links.shipments.length
      ? links.activeShipments+' شحنات نشطة أو مخططة؛ '+delay.length+
        ' متأخرة؛ '+number(links.deliveredTonnes)+
        ' طن مسجلة كمستلمة. الحالات إدارية وليست تأكيدات الناقل.'
      : 'لا توجد شحنات مرتبطة؛ لا يمكن استنتاج مواعيد وصول موثقة.',
    state:links.shipments.length?(delay.length?'review':'complete'):'needs_data',
    evidence:links.shipments.length?links.shipments.slice(0,3).map(s=>s.shipment_ref??s.id):
      ['Carrier/port telemetry not connected'],
  })

  add({
    id:'reserves',agent:'compliance_analyst',areaEn:'Strategic reserves',areaAr:'الاحتياطيات الاستراتيجية',
    titleEn:'Check usable lots and release constraints',
    titleAr:'فحص الدفعات المتاحة وضوابط الصرف',
    findingEn:links.lots.length
      ? links.lots.length+' linked lots; '+number(links.usableReserveTonnes)+
        ' t physically recorded after executed releases; '+number(links.committedReleaseTonnes)+
        ' t approved but unexecuted; '+number(links.availableReserveTonnes)+
        ' t uncommitted. These lots are not added to the food balance.'
      : 'No linked reserve batches. Reserve release options remain unverified.',
    findingAr:links.lots.length
      ? links.lots.length+' دفعات مرتبطة؛ '+number(links.usableReserveTonnes)+
        ' طن بعد الصرف المنفذ؛ '+number(links.committedReleaseTonnes)+
        ' طن مخصصة ولم تُصرف؛ '+number(links.availableReserveTonnes)+
        ' طن غير مخصصة. لا تُضاف هذه الكميات إلى الميزان الغذائي.'
      : 'لا توجد دفعات مخزون مرتبطة ولا يمكن إثبات جاهزية الصرف.',
    state:links.lots.length?'review':'needs_data',
    evidence:links.lots.length?links.lots.slice(0,3).map(l=>l.lot_ref??l.id):
      ['No approved and usable reserve lots'],
  })

  add({
    id:'weather',agent:'weather_analyst',areaEn:'Climate exposure',areaAr:'المخاطر المناخية',
    titleEn:'Check whether weather evidence is linked',
    titleAr:'التحقق من ارتباط أدلة الطقس',
    findingEn:'No commodity-specific meteorological or farm event feed is connected to this case. The production shock is a user assumption, not a weather prediction.',
    findingAr:'لا توجد بيانات طقس أو أحداث مزارع مرتبطة بهذه السلعة. صدمة الإنتاج افتراض أدخله المستخدم وليست توقعاً جوياً.',
    state:'needs_data',evidence:['Weather source: not connected','Production shock: '+shocks.productionReductionPercent+'%'],
  })

  const deficit=scenario.totals.scenarioDeficitTonnes
  const cover=scenario.totals.scenarioCoverageDays
  add({
    id:'watchtower',agent:'watchtower_analyst',areaEn:'Stress testing',areaAr:'اختبار الضغط',
    titleEn:'Compare baseline with the disruption',titleAr:'مقارنة الأساس مع الاضطراب',
    findingEn:ready
      ? 'Scenario risk '+risk+'. Gap '+number(deficit)+' t; coverage '+
        number(cover)+' days; balance change '+
        number(scenario.totals.changeInBalanceTonnes)+
        ' t. Risk bands are product heuristics, not official Qatar policy.'
      : 'No valid scenario impact; do not infer safety from unassessed source data.',
    findingAr:ready
      ? 'مستوى الخطر '+risk+'؛ العجز '+number(deficit)+' طن؛ التغطية '+
        number(cover)+' يوم؛ تغير الرصيد '+
        number(scenario.totals.changeInBalanceTonnes)+
        ' طن. حدود المخاطر إرشادية وليست سياسة حكومية.'
      : 'لا يمكن حساب أثر السيناريو، ولا يُستنتج الأمان من غياب البيانات.',
    state:ready?(risk==='critical'||risk==='high'?'review':'complete'):'needs_data',
    evidence:mainEvidence,
  })

  const proposals:AgentProposal[]=[]
  if(!ready)proposals.push({
    id:'collect',priority:'evidence',requiresHumanApproval:true,
    titleEn:'Request missing evidence before decisions',titleAr:'طلب الأدلة الناقصة قبل القرار',
    whyEn:'Opening stock and complete demand/supply declarations are required.',
    whyAr:'يلزم إثبات المخزون الافتتاحي وتدفقات العرض والطلب.',
  })
  else {
    if ((deficit??0)>0)proposals.push({
      id:'deficit',priority:'high',requiresHumanApproval:true,
      titleEn:'Investigate the '+number(deficit)+' t simulated shortage',
      titleAr:'التحقيق في عجز افتراضي قدره '+number(deficit)+' طن',
      whyEn:'Compare eligible suppliers and shipment windows; do not create an order automatically.',
      whyAr:'مقارنة الموردين ومواعيد الشحن دون إنشاء أمر شراء تلقائياً.',
    })
    else if(cover!==null&&cover<30)proposals.push({
      id:'buffer',priority:cover<14?'high':'normal',requiresHumanApproval:true,
      titleEn:'Review the food buffer and replenishment window',
      titleAr:'مراجعة احتياطي الغذاء ووقت إعادة التزويد',
      whyEn:'Scenario stock coverage is '+number(cover)+' days; actual shipment timing needs verification.',
      whyAr:'تغطية المخزون في السيناريو '+number(cover)+' يوم؛ يجب التحقق من مواعيد الشحن.',
    })
  }
  if(links.delayedShipments>0)proposals.push({
    id:'delay',priority:'normal',requiresHumanApproval:true,
    titleEn:'Verify '+links.delayedShipments+' delayed shipment(s)',
    titleAr:'التحقق من الشحنات المتأخرة: '+links.delayedShipments,
    whyEn:'Confirm carrier updates and delivery evidence before any rerouting.',
    whyAr:'التحقق من الناقل وإثبات التسليم قبل تغيير المسار.',
  })
  if(links.lots.length>0 && (deficit??0)>0)proposals.push({
    id:'reserve',priority:'normal',requiresHumanApproval:true,
    titleEn:'Review eligible reserve lots without double counting',
    titleAr:'فحص دفعات المخزون المؤهلة دون ازدواجية',
    whyEn:'Recorded uncommitted lots '+number(links.availableReserveTonnes)+
      ' t; physical verification and independent authorization are required.',
    whyAr:'دفعات غير مخصصة '+number(links.availableReserveTonnes)+
      ' طن؛ يلزم إثبات المخزون والموافقة المستقلة.',
  })
  if(proposals.length===0)proposals.push({
    id:'monitor',priority:'normal',requiresHumanApproval:true,
    titleEn:'Continue monitoring and source validation',
    titleAr:'استمرار المراقبة والتحقق من المصادر',
    whyEn:'No shortage signal under the selected assumptions; this is not a national all-clear.',
    whyAr:'لا يظهر عجز وفق الافتراضات المختارة، وهذا لا يعني سلامة الإمدادات الوطنية.',
  })

  add({
    id:'report',agent:'reporting_agent',areaEn:'Integrated brief',areaAr:'التقرير المتكامل',
    titleEn:'Compile the draft decision brief',titleAr:'تجميع مسودة القرار',
    findingEn:proposals.length+' proposed follow-up item(s). All require human verification and remain within this browser simulation.',
    findingAr:'عدد الإجراءات المقترحة '+proposals.length+'. جميعها تتطلب مراجعة بشرية وتبقى ضمن محاكاة المتصفح.',
    state:'review',evidence:proposals.map(p=>p.titleEn),
  })
  return {
    simulated:true,sourceMode:balance.sourceMode,commodityId,risk,scenario,links,
    steps,proposals,humanGate:'approval_required',
    caveats:[
      'Rule-based agent playback only. Does not invoke an LLM or run the actual mission orchestration service.',
      'Operational sources and commodity balance are not reconciled; do not add shipment or lot tonnes to food balance.',
      illustrative?'All source figures are synthetic Qatar examples; not official or independently verified.':
        'Inputs are organization-scoped; verify provenance and freshness independently.',
      'Human decision shown in this page is a local rehearsal, never a database approval.',
    ],
  }
}
