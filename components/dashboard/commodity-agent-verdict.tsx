'use client'

import { AlertCircle, ArrowRight, CheckCircle2, ClipboardList, ShieldCheck } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { AgentFinalRecommendation } from '@/lib/nfii/agent-decision'

function fmt(value:number|null):string {
  return value === null ? '—' : value.toLocaleString('en-US',{maximumFractionDigits:1})
}

/** A visible executive decision, NOT a transaction or real AI authorization. */
export function CommodityAgentVerdict({
  recommendation,workflowComplete,humanChoice,
}:{
  recommendation:AgentFinalRecommendation
  workflowComplete:boolean
  humanChoice:'approve'|'reject'|null
}){
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const urgency:Record<AgentFinalRecommendation['priority'],{en:string;ar:string;className:string}>={
    blocked:{en:'Blocked: evidence required',ar:'متوقف: الأدلة مطلوبة',
      className:'border-warning-line bg-warning-soft text-warning-strong'},
    urgent:{en:'Urgent: investigate supply gap',ar:'عاجل: التحقق من فجوة الإمدادات',
      className:'border-warning-line bg-warning-soft text-critical'},
    high:{en:'High: protect stock buffer',ar:'مرتفع: حماية المخزون',
      className:'border-warning-line bg-warning-soft text-warning-strong'},
    attention:{en:'Attention: review timing',ar:'تنبيه: مراجعة التوقيت',
      className:'border-line bg-muted text-content'},
    monitor:{en:'Monitor: no shortage action',ar:'مراقبة: لا حاجة لإجراء عجز',
      className:'border-line-accent bg-cream-100 text-sage-700'},
  }
  const badge=urgency[recommendation.priority]
  const isIllustrative=recommendation.evidenceSource==='illustrative'
  const reviewStatus=humanChoice==='approve'?
    tx('Local approval rehearsed. No actual authorization.',
      'تمت محاكاة الموافقة محلياً. لا يوجد تفويض فعلي.') :
    humanChoice==='reject'?
      tx('Local rejection rehearsed. No database change.',
        'تمت محاكاة الرفض محلياً. لا يوجد تعديل في قاعدة البيانات.') :
      tx('Pending independent human review. No action executed.',
        'في انتظار مراجعة بشرية مستقلة. لم يُنفذ أي إجراء.')

  return <section className="rounded-xl border border-line-strong bg-card p-4 md:p-5"
    aria-label={tx('Final agent recommendation','التوصية النهائية للوكلاء')}
    aria-live="polite">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream-100">
          <ClipboardList className="h-4 w-4 text-sage-700" aria-hidden="true"/>
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-sage-700">
            {tx('FINAL AGENT RECOMMENDATION','التوصية النهائية للوكلاء')}
          </p>
          <p className="mt-0.5 text-[11px] text-content-soft">
            {workflowComplete?
              tx('Rule-based analysis complete; authorization is separate',
                'اكتمل التحليل القائم على القواعد؛ التفويض منفصل') :
              tx('Calculated from the selected scenario; activity playback is optional',
                'محسوبة من السيناريو المختار؛ عرض خطوات العمل اختياري')}
          </p>
        </div>
      </div>
      <span className={'inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold '+badge.className}>
        {tx(badge.en,badge.ar)}
      </span>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,.65fr)]">
      <div>
        <p className="text-[11px] text-content-soft">
          {tx('What the agents recommend','ماذا يوصي الوكلاء')}
        </p>
        <h3 className="mt-1 text-[22px] font-medium leading-tight text-content">
          {tx(recommendation.headlineEn,recommendation.headlineAr)}
        </h3>
        <p className="mt-3 text-[13px] leading-relaxed text-content">
          {tx(recommendation.reasonEn,recommendation.reasonAr)}
        </p>
        <div className="mt-4 rounded-lg border border-line bg-background p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-content-soft">
            {tx('Next recommended step','الخطوة التالية المقترحة')}
          </p>
          <p className="mt-1 text-[13px] font-medium leading-relaxed text-content">
            {tx(recommendation.nextStepEn,recommendation.nextStepAr)}
          </p>
          <p className="mt-2 text-[11px] text-content-soft">
            <strong>{tx('Responsible reviewer: ','مسؤول المراجعة: ')}</strong>
            {tx(recommendation.ownerEn,recommendation.ownerAr)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border border-line bg-background p-3">
          <p className="text-[11px] text-content-soft">
            {tx('Potential gap to investigate','الفجوة المحتملة للتحقق')}
          </p>
          <p className="mt-1 text-[25px] font-medium tabular-nums text-content">
            {fmt(recommendation.gapForReviewTonnes)}
            <span className="ms-1 text-[12px] text-content-soft">t</span>
          </p>
          <p className="mt-1 text-[10px] text-content-soft">
            {tx('Not an approved purchase quantity','ليست كمية شراء معتمدة')}
          </p>
          <div className="my-3 h-px bg-line"/>
          <p className="text-[11px] text-content-soft">
            {tx('Remaining coverage after shock','التغطية المتبقية بعد الصدمة')}
          </p>
          <p className="mt-1 text-[21px] font-medium tabular-nums text-content">
            {fmt(recommendation.coverageDays)}
            <span className="ms-1 text-[12px] text-content-soft">{tx('days','يوم')}</span>
          </p>
          <p className="mt-2 text-[11px] text-content-soft">
            {tx('Change vs. baseline','التغير مقارنة بالأساس')}: 
            <strong className="ms-1 tabular-nums text-content">
              {fmt(recommendation.scenarioChangeTonnes)} t
            </strong>
          </p>
        </div>
        <div className="rounded-lg border border-line bg-card p-3">
          <div className="flex items-center gap-2 text-[12px] font-medium text-content">
            <ShieldCheck className="h-4 w-4 text-sage-700" aria-hidden="true"/>
            {tx('Approval and execution status','حالة الاعتماد والتنفيذ')}
          </div>
          <div className="mt-2 flex items-start gap-2 text-[11px] text-content-soft">
            {humanChoice?<CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage-700"/>:
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-strong"/>}
            <span>{reviewStatus}</span>
          </div>
          <p className="mt-2 border-t border-line pt-2 text-[11px] font-medium text-content">
            {tx('Purchase orders created: 0 · Reserves released: 0',
              'أوامر الشراء المنشأة: 0 · المخزون المصروف: 0')}
          </p>
          <p className="mt-1 text-[10px] text-content-soft">
            {isIllustrative?
              tx('Illustrative Qatar inputs, not verified market records.',
                'مدخلات قطر توضيحية وليست سجلات سوق موثقة.') :
              tx('Organization inputs; result is still only a simulation.',
                'مدخلات المؤسسة؛ النتيجة لا تزال محاكاة فقط.')}
          </p>
        </div>
      </div>
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div>
        <p className="text-[12px] font-medium text-content">
          {tx('Options to verify before acting','خيارات يجب التحقق منها قبل التنفيذ')}
        </p>
        <ol className="mt-2 space-y-2">
          {recommendation.options.map((option,index)=>(
            <li key={option.id} className="flex items-start gap-2 rounded-lg border border-line bg-background p-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream-100 text-[11px] font-semibold text-sage-700">
                {index+1}
              </span>
              <span className="text-[12px] leading-relaxed text-content">
                {tx(option.en,option.ar)}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <p className="text-[12px] font-medium text-content">
          {tx('Additional issues to check','مسائل إضافية للتحقق')}
        </p>
        {recommendation.secondaryEn.length?(
          <ul className="mt-2 space-y-2">
            {recommendation.secondaryEn.map((item,index)=>(
              <li key={item} className="flex items-start gap-2 rounded-lg border border-line p-2.5 text-[12px] text-content">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage-700" aria-hidden="true"/>
                {ar?recommendation.secondaryAr[index]:item}
              </li>
            ))}
          </ul>
        ):<p className="mt-2 rounded-lg border border-line bg-background p-3 text-[12px] text-content-soft">
          {tx('No additional exceptions in the currently linked records.',
            'لا توجد استثناءات إضافية في السجلات المرتبطة حالياً.')}
        </p>}
      </div>
    </div>
  </section>
}
