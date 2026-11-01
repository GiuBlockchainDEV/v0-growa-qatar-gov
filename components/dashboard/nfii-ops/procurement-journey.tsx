'use client'

import {
  ArrowRight, CheckCircle2, ClipboardCheck, FileSearch, FileText,
  ListChecks, PackageCheck, Search, ShieldCheck, Users,
} from 'lucide-react'
import {useI18n} from '@/lib/i18n'
import type {OperationsSnapshot} from '@/lib/nfii/operations-types'

export type ProcurementTab = 'overview' | 'discover' | 'suppliers' |
  'contracts' | 'orders' | 'approvals'

type ProcurementStep = {
  id:ProcurementTab
  en:string
  ar:string
  detailEn:string
  detailAr:string
  icon:typeof Users
}
const WORKFLOW:readonly ProcurementStep[]=[
  {id:'discover',en:'Find suppliers',ar:'البحث عن موردين',
    detailEn:'Choose a crop and inspect registry-backed organizations',
    detailAr:'اختر المحصول واستعرض المنظمات المسجلة في الأدلة',
    icon:Search},
  {id:'suppliers',en:'Qualify suppliers',ar:'تأهيل الموردين',
    detailEn:'Check legal identity, submit and review supplier records',
    detailAr:'تحقق من الهوية القانونية وأرسل السجلات للمراجعة',
    icon:Users},
  {id:'contracts',en:'Manage contracts',ar:'إدارة العقود',
    detailEn:'Link an approved supplier to a commodity and agreed terms',
    detailAr:'اربط المورد المعتمد بالسلعة والشروط المتفق عليها',
    icon:FileText},
  {id:'orders',en:'Purchase orders',ar:'أوامر الشراء',
    detailEn:'Create orders only against approved contracts',
    detailAr:'أنشئ أوامر شراء على العقود المعتمدة فقط',
    icon:PackageCheck},
  {id:'approvals',en:'Review approvals',ar:'مراجعة الموافقات',
    detailEn:'Independent review before a record becomes usable',
    detailAr:'مراجعة مستقلة قبل تفعيل أي سجل',
    icon:ClipboardCheck},
]

export function procurementTabCollection(tab:ProcurementTab){
  switch(tab){
    case 'suppliers':return 'suppliers'
    case 'contracts':return 'contracts'
    case 'orders':return 'purchaseOrders'
    case 'approvals':return 'approvals'
    default:return null
  }
}
export function procurementTabKind(tab:ProcurementTab){
  switch(tab){
    case 'suppliers':return 'supplier'
    case 'contracts':return 'contract'
    case 'orders':return 'purchase_order'
    default:return null
  }
}

type Counts=Record<'approvedSuppliers'|'pendingSuppliers'|'approvedContracts'|
  'pendingContracts'|'approvedOrders'|'pendingOrders'|'pendingApprovals',number>
export function procurementCounts(snapshot:OperationsSnapshot):Counts {
  const count=(key:'suppliers'|'contracts'|'purchaseOrders',status:string)=>
    snapshot[key].filter(r=>r.status===status).length
  return {
    approvedSuppliers:count('suppliers','approved'),
    pendingSuppliers:count('suppliers','pending'),
    approvedContracts:count('contracts','approved'),
    pendingContracts:count('contracts','pending'),
    approvedOrders:count('purchaseOrders','approved'),
    pendingOrders:count('purchaseOrders','pending'),
    pendingApprovals:snapshot.approvals.filter(r=>r.status==='pending' &&
      ['supplier','contract','purchase_order'].includes(r.target_type??'')).length,
  }
}

export function ProcurementJourney({
  tab,onTabChange,snapshot,
}:{
  tab:ProcurementTab
  onTabChange:(tab:ProcurementTab)=>void
  snapshot:OperationsSnapshot
}){
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const counts=procurementCounts(snapshot)
  const badgeCount:Record<ProcurementTab,number|null>={
    overview:null,discover:null,
    suppliers:snapshot.suppliers.length,
    contracts:snapshot.contracts.length,
    orders:snapshot.purchaseOrders.length,
    approvals:counts.pendingApprovals,
  }
  const tabs:[ProcurementTab,string,string,typeof Users][]=[
    ['overview','Overview','Panoramica',ListChecks],
    ['discover','Find suppliers','البحث عن موردين',Search],
    ['suppliers','Suppliers','الموردون',Users],
    ['contracts','Contracts','العقود',FileText],
    ['orders','Orders','الطلبات',PackageCheck],
    ['approvals','Approvals','الموافقات',ClipboardCheck],
  ]
  return <nav className="nfii-panel p-2 md:p-3"
    aria-label={tx('Procurement workflow navigation','التنقل في مراحل المشتريات')}>
    <div className="flex flex-wrap items-center gap-1.5">
      {tabs.map(([id,en,arabic,Icon])=><button
        type="button" key={id}
        onClick={()=>onTabChange(id)}
        aria-current={tab===id?'step':undefined}
        aria-pressed={tab===id}
        className={'inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors '+
          (tab===id?'border-ink bg-ink text-white':
            'border-line bg-card text-content hover:border-line-accent hover:bg-muted')}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true"/>
        {tx(en,id==='overview'?'نظرة عامة':arabic)}
        {badgeCount[id]!==null&&
          <span className={'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums '+
            (tab===id?'bg-white/20 text-white':'bg-muted text-content-soft')}>
            {badgeCount[id]}
          </span>}
      </button>)}
    </div>
  </nav>
}

export function ProcurementHome({
  snapshot,isPreview,canEdit,onNavigate,onNavigateStatus,
}:{
  snapshot:OperationsSnapshot
  isPreview:boolean
  canEdit:boolean
  onNavigate:(tab:ProcurementTab)=>void
  onNavigateStatus?:(tab:ProcurementTab,status:string)=>void
}){
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const counts=procurementCounts(snapshot)
  const progress:Record<string,string>={
    suppliers:String(counts.approvedSuppliers),
    contracts:String(counts.approvedContracts),
    orders:String(counts.approvedOrders),
    approvals:String(counts.pendingApprovals),
  }
  const next:ProcurementTab=counts.pendingApprovals>0?'approvals':
    counts.approvedSuppliers===0?'discover':
    counts.approvedContracts===0?'contracts':
    counts.approvedOrders===0?'orders':'overview'
  const nextTitle=next==='approvals'
    ?tx('Pending reviews need attention','المراجعات المعلقة تحتاج إلى اهتمام')
    :next==='discover'
      ?tx('Start by finding a suitable supplier','ابدأ بالبحث عن مورد مناسب')
      :next==='contracts'
        ?tx('Use an approved supplier to create a contract','أنشئ عقداً مع مورد معتمد')
        :next==='orders'
          ?tx('Turn an approved contract into a purchase order','حوّل عقداً معتمداً إلى أمر شراء')
          :tx('Continue monitoring your sourcing pipeline','استمر في متابعة سلسلة التوريد')

  return <div className="space-y-4">
    <section className="nfii-panel p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[720px]">
          <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-sage-700">
            {tx('PROCUREMENT AT A GLANCE','نظرة على المشتريات')}
          </p>
          <h2 className="mt-2 text-[22px] font-medium leading-snug text-content">
            {tx('From supplier discovery to approved purchase','من اكتشاف المورد إلى الشراء المعتمد')}
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-content-soft">
            {tx('Follow each stage in order. Research results are leads, not approved vendors; contracts and purchase orders require an approved parent record.',
              'اتبع المراحل بالترتيب. نتائج البحث مرشحون وليست موردين معتمدين؛ تتطلب العقود وأوامر الشراء سجلات معتمدة قبلها.')}
          </p>
        </div>
        <button type="button" onClick={()=>onNavigate('discover')}
          className="nfii-button inline-flex items-center gap-2">
          <Search className="h-4 w-4"/>
          {tx('Find suppliers','البحث عن موردين')}
          <ArrowRight className="h-3.5 w-3.5"/>
        </button>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          {en:'Approved suppliers',ar:'موردون معتمدون',
            n:counts.approvedSuppliers,target:'suppliers' as ProcurementTab,status:'approved'},
          {en:'Approved contracts',ar:'عقود معتمدة',
            n:counts.approvedContracts,target:'contracts' as ProcurementTab,status:'approved'},
          {en:'Approved orders',ar:'أوامر شراء معتمدة',
            n:counts.approvedOrders,target:'orders' as ProcurementTab,status:'approved'},
          {en:'Pending decisions',ar:'قرارات معلقة',
            n:counts.pendingApprovals,target:'approvals' as ProcurementTab,status:'pending'},
        ].map(kpi=>(
          <button type="button" key={kpi.en}
            onClick={()=>onNavigateStatus?onNavigateStatus(kpi.target,kpi.status):onNavigate(kpi.target)}
            className="group rounded-lg border border-line bg-background p-3 text-left hover:border-line-accent hover:bg-cream-100/30">
            <p className="text-[11px] text-content-soft">{tx(kpi.en,kpi.ar)}</p>
            <p className="mt-2 text-[26px] font-medium tabular-nums text-content">
              {kpi.n}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-sage-700">
              {tx('Open records','عرض السجلات')}<ArrowRight className="h-3 w-3"/>
            </span>
          </button>
        ))}
      </div>
    </section>

    <section className="nfii-panel p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[16px] font-medium text-content">
            {tx('Your procurement journey','مسار المشتريات')}
          </h3>
          <p className="mt-1 text-[11px] text-content-soft">
            {tx('Choose a stage to see only the tools and records relevant to that task.',
              'اختر مرحلة لتعرض الأدوات والسجلات المرتبطة بها فقط.')}
          </p>
        </div>
        <span className="rounded-full border border-line bg-muted px-2.5 py-1 text-[10px] text-content-soft">
          {isPreview?tx('SOURCE UNAVAILABLE','المصدر غير متاح'):
            tx('LIVE ORGANIZATION','مؤسسة فعلية')}
        </span>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {WORKFLOW.map((step,index)=>{
          const Icon=step.icon
          const count=progress[step.id]
          return <button type="button" key={step.id} onClick={()=>onNavigate(step.id)}
            className="group flex min-h-[166px] flex-col rounded-lg border border-line bg-background p-3 text-start transition-colors hover:border-line-accent hover:bg-cream-100/40">
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream-100 text-sage-700">
                <Icon className="h-4 w-4" aria-hidden="true"/>
              </span>
              <span className="text-[11px] font-semibold tabular-nums text-content-soft">
                {index+1}/5
              </span>
            </div>
            <h4 className="mt-3 text-[12px] font-semibold text-content">
              {tx(step.en,step.ar)}
              {count!==undefined&&
                <span className="ms-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-content-soft">
                  {count}
                </span>}
            </h4>
            <p className="mt-1 text-[11px] leading-relaxed text-content-soft">
              {tx(step.detailEn,step.detailAr)}
            </p>
            <ArrowRight className="mt-auto h-4 w-4 self-end text-sage-700 group-hover:translate-x-1" aria-hidden="true"/>
          </button>
        })}
      </div>
    </section>

    <section className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,.8fr)]">
      <div className="nfii-panel p-4 md:p-5">
        <h3 className="flex items-center gap-2 text-[14px] font-medium text-content">
          <FileSearch className="h-4 w-4 text-sage-700"/>
          {tx('Suggested next step','الخطوة المقترحة')}
        </h3>
        <p className="mt-2 text-[16px] font-medium text-content">{nextTitle}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-content-soft">
          {isPreview
            ?tx('No authorized live register is available. Select an organization with access to create actual records.',
                'لا يتوفر سجل فعلي مصرح به. اختر مؤسسة يمكن الوصول إليها لإنشاء السجلات.')
            :!canEdit
              ?tx('This organization can be viewed. Writing new supplier, contract or order records requires supply.edit permission.',
                  'يمكن عرض بيانات هذه المؤسسة. يتطلب إنشاء السجلات صلاحية تعديل التوريد.')
              :tx('Open the relevant stage, review the requirements, and submit a record for independent approval.',
                  'افتح المرحلة المناسبة وتحقق من المتطلبات وأرسل السجل للمراجعة المستقلة.')}
        </p>
        {next!=='overview'&&<button type="button"
          onClick={()=>onNavigate(next)}
          className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-line-accent bg-cream-100 px-4 py-2 text-[12px] font-medium text-sage-700">
          {tx('Go to this step','الانتقال إلى هذه الخطوة')}
          <ArrowRight className="h-3.5 w-3.5"/>
        </button>}
      </div>
      <div className="nfii-panel p-4 md:p-5">
        <h3 className="flex items-center gap-2 text-[14px] font-medium text-content">
          <ShieldCheck className="h-4 w-4 text-sage-700"/>
          {tx('What counts as approved?','متى يكون السجل معتمداً؟')}
        </h3>
        <p className="mt-2 text-[12px] leading-relaxed text-content-soft">
          {tx('A name found through GLEIF or Google is only a prospect. A supplier can be used in a contract only after its record passes independent NFII approval. Contract approval is required before issuing an order.',
            'الاسم الموجود عبر GLEIF أو Google مجرد مرشح. لا يُستخدم المورد في عقد إلا بعد مراجعة واعتماد مستقلين. كما يتطلب أمر الشراء عقداً معتمداً.')}
        </p>
        <p className="mt-3 flex items-center gap-2 text-[11px] text-sage-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true"/>
          {tx('Human review remains mandatory','المراجعة البشرية إلزامية')}
        </p>
      </div>
    </section>
  </div>
}

export function ProcurementStageHeading({
  tab,
}:{
  tab:ProcurementTab
}){
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const label:Record<ProcurementTab,[string,string,string,string]>={
    overview:['Overview','نظرة عامة','Your sourcing workflow in one place','مسار التوريد في مكان واحد'],
    discover:['Find potential suppliers','البحث عن موردين محتملين',
      'Start with a crop and documented organization-product records. Then check legal identity and import markets.',
      'ابدأ بالمحصول والمنظمات المدرجة في سجلات المنتجات، ثم تحقق من الهوية وأسواق الاستيراد.'],
    suppliers:['Supplier register','سجل الموردين',
      'Register and independently approve a legal supplier before using it in a contract.',
      'سجل المورد القانوني واعتمده بشكل مستقل قبل إنشاء عقد.'],
    contracts:['Supplier contracts','عقود الموردين',
      'Only approved suppliers can be linked to contracts.',
      'لا يُربط بالعقد إلا المورد المعتمد.'],
    orders:['Purchase orders','أوامر الشراء',
      'Create purchase commitments against approved and currently valid contracts.',
      'أنشئ أوامر شراء على عقود سارية ومعتمدة.'],
    approvals:['Independent approvals','الموافقات المستقلة',
      'See pending supplier, contract and purchase-order decisions.',
      'تابع قرارات الموردين والعقود وأوامر الشراء المعلقة.'],
  }
  const [en,arabic,enSubtitle,arSubtitle]=label[tab]
  return <div className="mb-3">
    <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-sage-700">
      {tx('PROCUREMENT WORKSPACE','مساحة المشتريات')}
    </p>
    <h2 className="mt-1 text-[18px] font-medium text-content">{tx(en,arabic)}</h2>
    <p className="mt-1 text-[12px] leading-relaxed text-content-soft">
      {tx(enSubtitle,arSubtitle)}
    </p>
  </div>
}
