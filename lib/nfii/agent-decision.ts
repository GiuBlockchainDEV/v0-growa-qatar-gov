import type { CommodityAgentSimulation } from './agent-operational-simulation'

export type AgentDecisionPriority = 'blocked' | 'urgent' | 'high' | 'attention' | 'monitor'

export interface AgentDecisionOption {
  id: string
  en: string
  ar: string
}

/**
 * One executive verdict for one commodity and the chosen scenario.
 * This is deterministic decision support, NOT an autonomous agent decision
 * and NEVER an authorization to purchase, reroute or release stock.
 */
export interface AgentFinalRecommendation {
  code: 'request_evidence' | 'investigate_shortage' | 'protect_buffer' | 'review_replenishment' | 'continue_monitoring'
  priority: AgentDecisionPriority
  headlineEn: string
  headlineAr: string
  reasonEn: string
  reasonAr: string
  nextStepEn: string
  nextStepAr: string
  ownerEn: string
  ownerAr: string
  /** Deficit to investigate, not an automatic procurement quantity. */
  gapForReviewTonnes: number | null
  coverageDays: number | null
  scenarioDeficitTonnes: number | null
  scenarioChangeTonnes: number | null
  secondaryEn: string[]
  secondaryAr: string[]
  options: AgentDecisionOption[]
  requiredHumanApproval: true
  executionStatus: 'not_executed'
  evidenceSource: 'illustrative' | 'organization'
}

function fmt(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' :
    value.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

export function buildAgentFinalRecommendation(
  result: CommodityAgentSimulation,
): AgentFinalRecommendation {
  const illustrative = result.sourceMode === 'demo'
  const {scenario, links} = result
  const impact = scenario.totals
  const deficit = impact.scenarioDeficitTonnes
  const coverage = impact.scenarioCoverageDays
  const missing = scenario.status !== 'complete'
  const context = {
    gapForReviewTonnes: deficit !== null && deficit > 0 ? deficit : null,
    coverageDays: coverage,
    scenarioDeficitTonnes: deficit,
    scenarioChangeTonnes: impact.changeInBalanceTonnes,
    secondaryEn: [] as string[],
    secondaryAr: [] as string[],
    options: [] as AgentDecisionOption[],
    requiredHumanApproval: true as const,
    executionStatus: 'not_executed' as const,
    evidenceSource: (illustrative ? 'illustrative' : 'organization') as 'illustrative' | 'organization',
  }

  if (links.delayedShipments > 0) {
    context.secondaryEn.push('Confirm status of ' + links.delayedShipments + ' delayed shipment(s) with the carrier.')
    context.secondaryAr.push('تحقق من حالة ' + links.delayedShipments + ' شحنات متأخرة مع الناقل.')
  }
  if (links.pendingApprovals > 0) {
    context.secondaryEn.push(links.pendingApprovals + ' related record(s) await independent review.')
    context.secondaryAr.push('تنتظر ' + links.pendingApprovals + ' سجلات مرتبطة مراجعة مستقلة.')
  }

  if (missing) {
    return {
      ...context,
      code: 'request_evidence',
      priority: 'blocked',
      headlineEn: 'Do not authorize a supply action yet',
      headlineAr: 'لا تعتمد أي إجراء للإمداد حالياً',
      reasonEn: 'There is no complete opening-stock and food-flow baseline. Missing data cannot be treated as zero stock or a confirmed shortage.',
      reasonAr: 'لا تتوفر بيانات مكتملة للمخزون الافتتاحي وتدفقات الغذاء. نقص البيانات لا يعني انعدام المخزون أو وجود عجز مؤكد.',
      nextStepEn: 'Ask the Data Quality team to validate opening stock, production, imports, consumption and losses before reassessing.',
      nextStepAr: 'اطلب من فريق جودة البيانات مراجعة المخزون الافتتاحي والإنتاج والواردات والاستهلاك والفاقد قبل إعادة التقييم.',
      ownerEn: 'Data Quality owner and source reviewer',
      ownerAr: 'مسؤول جودة البيانات ومراجع المصادر',
      options: [
        {id:'source',en:'Request missing source records',ar:'طلب بيانات المصادر الناقصة'},
        {id:'recheck',en:'Recalculate after independent review',ar:'إعادة الحساب بعد المراجعة المستقلة'},
      ],
    }
  }

  if (deficit !== null && deficit > 0) {
    return {
      ...context,
      code: 'investigate_shortage',
      priority: 'urgent',
      headlineEn: 'Investigate a potential supply gap of ' + fmt(deficit) + ' tonnes',
      headlineAr: 'تحقق من فجوة إمدادات محتملة قدرها ' + fmt(deficit) + ' طن',
      reasonEn: 'Under the selected shocks, projected net food balance is ' +
        fmt(impact.scenarioProjectedBalanceTonnes) + ' t and the modeled deficit is ' +
        fmt(deficit) + ' t. This is a scenario exposure, not a purchase order.',
      reasonAr: 'وفق الصدمات المختارة، يصل الرصيد الغذائي الصافي المتوقع إلى ' +
        fmt(impact.scenarioProjectedBalanceTonnes) + ' طن والعجز الافتراضي إلى ' +
        fmt(deficit) + ' طن. هذا تقدير للمخاطر وليس أمر شراء.',
      nextStepEn: 'Have Procurement compare verified supplier capacity and ETA, while Reserves checks eligible lots. Submit a documented response for human approval.',
      nextStepAr: 'يقارن فريق المشتريات قدرة الموردين ومواعيد التسليم الموثقة، ويتحقق فريق الاحتياطيات من الدفعات المؤهلة. ثم يُرفع اقتراح موثق للموافقة البشرية.',
      ownerEn: 'Procurement lead + independent authorization',
      ownerAr: 'مسؤول المشتريات + موافقة مستقلة',
      options: [
        {id:'procurement',en:'Verify contract and supplier alternatives',ar:'التحقق من بدائل العقود والموردين'},
        {id:'logistics',en:'Check existing shipment arrivals and delays',ar:'فحص وصول الشحنات والتأخير'},
        {id:'reserves',en:'Assess usable reserves without double-counting',ar:'تقييم المخزون المتاح دون ازدواجية'},
      ],
    }
  }

  if (coverage !== null && coverage < 14) {
    return {
      ...context,
      code: 'protect_buffer',
      priority: 'high',
      headlineEn: 'Accelerate a replenishment review',
      headlineAr: 'تسريع مراجعة إعادة التوريد',
      reasonEn: 'There is no period-end deficit, but stock coverage falls to ' +
        fmt(coverage) + ' days under this scenario. This threshold is a product heuristic.',
      reasonAr: 'لا يظهر عجز بنهاية الفترة، لكن تغطية المخزون تنخفض إلى ' +
        fmt(coverage) + ' أيام. هذا الحد استرشادي في النظام.',
      nextStepEn: 'Verify lead times, planned arrivals and available reserve buffers before choosing a replenishment quantity.',
      nextStepAr: 'تحقق من أوقات التوريد والوصول المتوقع واحتياطي المخزون قبل تحديد أي كمية لإعادة التوريد.',
      ownerEn: 'Supply planning and Procurement lead',
      ownerAr: 'تخطيط الإمدادات ومسؤول المشتريات',
      options: [
        {id:'eta',en:'Validate arriving shipments',ar:'التحقق من الشحنات القادمة'},
        {id:'buffer',en:'Review minimum stock policy',ar:'مراجعة سياسة الحد الأدنى للمخزون'},
      ],
    }
  }

  if (coverage !== null && coverage < 30) {
    return {
      ...context,
      code: 'review_replenishment',
      priority: 'attention',
      headlineEn: 'Review the replenishment window before stock declines',
      headlineAr: 'مراجعة موعد إعادة التوريد قبل انخفاض المخزون',
      reasonEn: 'Scenario coverage is ' + fmt(coverage) +
        ' days, below the illustrative 30-day watch threshold, without a modeled deficit.',
      reasonAr: 'تبلغ التغطية في السيناريو ' + fmt(coverage) +
        ' أيام، دون حد المراقبة الإرشادي البالغ 30 يوماً، ولا يوجد عجز متوقع.',
      nextStepEn: 'Confirm whether existing orders cover lead time; monitor verified stock and avoid duplicate purchasing.',
      nextStepAr: 'تحقق من أن الطلبات الحالية تغطي فترة التوريد، وراقب المخزون الموثق وتجنب ازدواجية الشراء.',
      ownerEn: 'Supply planning owner',
      ownerAr: 'مسؤول تخطيط الإمدادات',
      options: [
        {id:'orders',en:'Review approved purchase orders',ar:'مراجعة أوامر الشراء المعتمدة'},
        {id:'monitor',en:'Monitor stock and demand changes',ar:'مراقبة تغير المخزون والطلب'},
      ],
    }
  }

  return {
    ...context,
    code: 'continue_monitoring',
    priority: 'monitor',
    headlineEn: 'Maintain supply monitoring; no additional purchase proposed',
    headlineAr: 'استمرار مراقبة الإمدادات؛ لا يُقترح شراء إضافي',
    reasonEn: 'Under the selected assumptions there is no period-end deficit and stock coverage is ' +
      fmt(coverage) + ' days. This is not confirmation of national food security.',
    reasonAr: 'لا يوجد عجز بنهاية الفترة وفق الافتراضات المختارة، وتبلغ التغطية ' +
      fmt(coverage) + ' يوماً. لا يمثل ذلك تأكيداً للأمن الغذائي الوطني.',
    nextStepEn: 'Continue validating source freshness and watching supplier and shipment exceptions.',
    nextStepAr: 'استمر في التحقق من حداثة المصادر ومراقبة استثناءات الموردين والشحنات.',
    ownerEn: 'Watchtower analyst and source reviewer',
    ownerAr: 'محلل المراقبة ومراجع المصادر',
    options: [
      {id:'monitor',en:'Track updated demand and availability',ar:'متابعة الطلب والتوافر'},
      {id:'exceptions',en:'Check shipment and approval exceptions',ar:'فحص استثناءات الشحن والموافقات'},
    ],
  }
}
