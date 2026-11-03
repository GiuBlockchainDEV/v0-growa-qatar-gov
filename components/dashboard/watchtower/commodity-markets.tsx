'use client'

import {useEffect,useMemo,useState} from 'react'
import {Activity,ArrowDownRight,ArrowUpRight,BarChart3,Check,ChevronDown,ExternalLink,
  Globe2,Grid2X2,Info,LineChart,RefreshCw,Search,Star,TrendingUp,Wheat} from 'lucide-react'
import {useI18n} from '@/lib/i18n'
import {COMMODITY_CATALOG,type CommodityMarketsSnapshot,type MarketGroup,
  type MarketPoint} from '@/lib/watchtower/commodity-markets'
import styles from './commodity-markets.module.css'

type Currency='USD'|'QAR'
type Horizon=6|12|24|36|60
type Filter=MarketGroup|'all'|'watchlist'
type Order='name'|'mom'|'yoy'
const WATCHLIST_KEY='growa_watchtower_commodity_watchlist'
const INITIAL_FAVORITES=['wheat','corn','rice','soybeans']
const HORIZONS:readonly {months:Horizon;label:string}[]=[
  {months:6,label:'6M'},{months:12,label:'1Y'},
  {months:24,label:'2Y'},{months:36,label:'3Y'},{months:60,label:'5Y'},
]
const number=(value:number,locale:string,digits=2)=>
  new Intl.NumberFormat(locale,{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value)
const signed=(n:number|null,locale:string,decimals=2)=>
  n===null?'N/A':(n>0?'+':'')+number(n,locale,decimals)+'%'
function monthLabel(date:string,locale:string){
  if(!date)return 'N/A'
  return new Date(date+'T00:00:00Z').toLocaleDateString(locale,{month:'short',year:'numeric',timeZone:'UTC'})
}
function positiveColor(n:number|null){
  return n===null?styles.neutral:n>=0?styles.positive:styles.negative
}
function price(numberUsd:number,currency:Currency,rate:number,locale:string){
  return number(numberUsd*(currency==='QAR'?rate:1),locale,2)
}
const MONTHLY_SOURCE='Published monthly average, not a live exchange quote'
// Movement direction is not a food security severity or a trading recommendation.
const movement=(value:number|null):'up-strong'|'up'|'down-strong'|'down'|'flat'|'missing'=>
  value===null?'missing':value>5?'up-strong':value>0?'up':
  value< -5?'down-strong':value<0?'down':'flat'

function MiniTrend({points,positive}:{points:readonly MarketPoint[];positive:boolean}){
  const series=points.slice(-13)
  if(series.length<2)return <span className={styles.emptyTrend}>N/A</span>
  const values=series.map(p=>p.priceUsdTonne)
  const lo=Math.min(...values),hi=Math.max(...values),span=hi-lo||1
  const coords=values.map((v,i)=>[3+(i/(values.length-1))*88,28-(v-lo)/span*24] as const)
  const d=coords.map(([x,y],i)=>(i===0?'M':'L')+x.toFixed(1)+','+y.toFixed(1)).join(' ')
  return <svg viewBox="0 0 94 32" width="94" height="32" role="img"
    aria-label={'Historical 12-month '+(positive?'rising':'falling')+' price series'}>
    <path d={d} fill="none" stroke={positive?'#6C8952':'#B4533B'} strokeWidth="2.3"
      strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
}

function PriceHistoryChart({points,currency,rate,locale}:{
  points:readonly MarketPoint[];currency:Currency;rate:number;locale:string
}){
  const [hover,setHover]=useState<number|null>(null)
  if(points.length<2){
    return <div className={styles.emptyChart}>Historical observations unavailable.</div>
  }
  const W=960,H=320,padL=62,padR=23,padT=24,padB=42
  const factor=currency==='QAR'?rate:1
  const values=points.map(p=>p.priceUsdTonne*factor)
  const low=Math.min(...values),high=Math.max(...values)
  const span=Math.max(1,(high-low)*1.16)
  const yMin=Math.max(0,low-span*0.08),yMax=high+span*0.08
  const plotW=W-padL-padR,plotH=H-padT-padB
  const mapped=points.map((p,i)=>({
    x:padL+i/Math.max(1,points.length-1)*plotW,
    y:padT+(yMax-values[i])/(yMax-yMin)*plotH,
    price:values[i],date:p.date,
  }))
  const line=mapped.map((v,i)=>(i?'L':'M')+v.x.toFixed(2)+' '+v.y.toFixed(2)).join(' ')
  const area=line+' L '+mapped[mapped.length-1].x+' '+(H-padB)+
    ' L '+mapped[0].x+' '+(H-padB)+' Z'
  const active=hover===null?mapped[mapped.length-1]:mapped[hover]??mapped[mapped.length-1]
  const labelX=Math.min(W-152,Math.max(padL+6,active.x-67))
  const ticks=Array.from({length:5},(_,i)=>yMin+(yMax-yMin)*i/4)
  const xTicks=[0,1,2,3,4].map(i=>Math.round(i*(mapped.length-1)/4))
  return <div className={styles.chartContainer}>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img"
      aria-label={`Monthly commodity benchmark history ${currency} per metric ton`}
      onMouseLeave={()=>setHover(null)}>
      <defs>
        <linearGradient id="watchtower-market-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#6C8952" stopOpacity=".23"/>
          <stop offset="100%" stopColor="#6C8952" stopOpacity=".015"/>
        </linearGradient>
      </defs>
      {ticks.map((tick,i)=>{
        const y=padT+(4-i)*plotH/4
        return <g key={i}>
          <line x1={padL} y1={y} x2={W-padR} y2={y} stroke="#E3E8E0" strokeWidth="1"
            strokeDasharray={i===0?'':'3 5'}/>
          <text x={padL-12} y={y+4} textAnchor="end" fontSize="11" fill="#5C635A">
            {new Intl.NumberFormat(locale,{notation:'compact',maximumFractionDigits:1}).format(tick)}
          </text>
        </g>
      })}
      {xTicks.map((j,i)=><text key={i} x={mapped[j].x} y={H-12}
        textAnchor={i===0?'start':i===4?'end':'middle'} fontSize="11" fill="#5C635A">
        {monthLabel(points[j].date,locale)}
      </text>)}
      <path d={area} fill="url(#watchtower-market-area)"/>
      <path d={line} fill="none" stroke="#6C8952" strokeWidth="3"
        strokeLinejoin="round" strokeLinecap="round"/>
      <line x1={active.x} x2={active.x} y1={padT} y2={H-padB} stroke="#6C8952"
        strokeDasharray="5 5" strokeOpacity=".45" strokeWidth="1.4"/>
      <circle cx={active.x} cy={active.y} r="5.5" fill="#6C8952" stroke="#FFFFFF" strokeWidth="2.5"/>
      <g transform={`translate(${labelX},${Math.max(10,active.y-76)})`}>
        <rect width="146" height="55" rx="9" fill="#18291B"/>
        <text x="12" y="20" fontSize="11" fill="#EEF4C9">
          {monthLabel(active.date,locale)}
        </text>
        <text x="12" y="41" fontSize="15" fontWeight="600" fill="#FFFFFF">
          {number(active.price,locale,2)} {currency}/t
        </text>
      </g>
      {mapped.map((v,i)=><rect key={i}
        x={v.x-plotW/Math.max(points.length-1,1)/2}
        y={padT} width={Math.max(3,plotW/points.length)}
        height={plotH} fill="transparent"
        onMouseEnter={()=>setHover(i)}
        onFocus={()=>setHover(i)}
        onBlur={()=>setHover(null)}
        aria-label={monthLabel(v.date,locale)+': '+number(v.price,locale,2)+' '+currency+'/t'}
        tabIndex={i===mapped.length-1?0:-1}
      />)}
    </svg>
  </div>
}

const GROUPS:readonly {id:Filter;en:string;ar:string}[]=[
  {id:'all',en:'All markets',ar:'كل الأسواق'},
  {id:'grains',en:'Grains',ar:'الحبوب'},
  {id:'oils',en:'Edible oils',ar:'الزيوت'},
  {id:'protein',en:'Meat & protein',ar:'اللحوم والبروتين'},
  {id:'softs',en:'Soft commodities',ar:'السلع اللينة'},
  {id:'produce',en:'Fresh produce',ar:'المنتجات الطازجة'},
  {id:'watchlist',en:'My watchlist',ar:'قائمة المتابعة'},
]
const GROUP_LABEL:Record<MarketGroup,{en:string;ar:string}>={
  grains:{en:'Grains',ar:'الحبوب'},
  oils:{en:'Edible oils',ar:'الزيوت'},
  protein:{en:'Meat & protein',ar:'اللحوم والبروتين'},
  softs:{en:'Softs',ar:'السلع اللينة'},
  produce:{en:'Produce',ar:'منتجات طازجة'},
}

export function CommodityMarkets(){
  const {locale}=useI18n()
  const ar=locale==='ar',language=ar?'ar-QA':'en-US'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const [marketData,setMarketData]=useState<CommodityMarketsSnapshot|null>(null)
  const [loading,setLoading]=useState(true),[error,setError]=useState('')
  const [refresh,setRefresh]=useState(0)
  const [currency,setCurrency]=useState<Currency>('USD')
  const [selectedId,setSelectedId]=useState('wheat')
  const [horizon,setHorizon]=useState<Horizon>(12)
  const [category,setCategory]=useState<Filter>('all')
  const [order,setOrder]=useState<Order>('mom')
  const [search,setSearch]=useState('')
  const [favorites,setFavorites]=useState<string[]>(INITIAL_FAVORITES)
  const [tonnes,setTonnes]=useState('1000')
  useEffect(()=>{
    try{
      const raw=window.localStorage.getItem(WATCHLIST_KEY)
      if(!raw)return
      const parsed=JSON.parse(raw) as unknown
      if(Array.isArray(parsed))setFavorites(parsed.filter((id):id is string=>
        typeof id==='string'&&COMMODITY_CATALOG.some(d=>d.id===id)).slice(0,30))
    }catch{ /* local watchlist preference is optional */ }
  },[])
  useEffect(()=>{
    const controller=new AbortController()
    setLoading(true);setError('')
    const load=async()=>{
      try{
        const response=await fetch('/api/watchtower/commodity-markets',{
          cache:'no-store',
          signal:AbortSignal.any([controller.signal,AbortSignal.timeout(28000)]),
        })
        const data=await response.json() as CommodityMarketsSnapshot&{error?:string}
        if(!response.ok)throw Error(data.error??'Commodity feed unavailable')
        if(!Array.isArray(data.instruments)||data.frequency!=='monthly')throw Error('Invalid commodity data')
        if(!controller.signal.aborted){setMarketData(data);setLoading(false)}
      }catch(e){
        if(!controller.signal.aborted){setLoading(false);setError(e instanceof Error?e.message:'Data unavailable')}
      }
    }
    void load()
    return()=>controller.abort()
  },[refresh])
  const items=marketData?.instruments??[]
  const selected=items.find(x=>x.id===selectedId)??items[0]
  const rate=marketData?.usdQar??3.64
  const entries=useMemo(()=>{
    const filtered=items.filter(item=>{
      if(category==='watchlist'&&!favorites.includes(item.id))return false
      if(category!=='watchlist'&&category!=='all'&&item.group!==category)return false
      if(search&&!((item.label+' '+item.labelAr+' '+item.benchmark+' '+item.seriesId)
        .toLowerCase().includes(search.toLowerCase())))return false
      return true
    })
    return filtered.sort((a,b)=>
      order==='name'?a.label.localeCompare(b.label):
      (b[order==='yoy'?'change12mPct':'change1mPct']??-Infinity)-
      (a[order==='yoy'?'change12mPct':'change1mPct']??-Infinity))
  },[items,category,favorites,search,order])
  const changeable=items.filter(x=>x.change1mPct!==null)
  const gainers=changeable.filter(x=>x.change1mPct!>0).length
  const decliners=changeable.filter(x=>x.change1mPct!<0).length
  const biggest=changeable.slice().sort((a,b)=>
    Math.abs(b.change1mPct??0)-Math.abs(a.change1mPct??0))[0]
  const movers=changeable.slice().sort((a,b)=>
    Math.abs(b.change1mPct??0)-Math.abs(a.change1mPct??0)).slice(0,3)
  const flat=changeable.length-gainers-decliners
  const meanMonthlyMove=changeable.length
    ?changeable.reduce((sum,item)=>sum+Math.abs(item.change1mPct??0),0)/changeable.length:null
  const volatile=items.filter(x=>x.volatility12mPct!==null)
    .sort((a,b)=>(b.volatility12mPct??0)-(a.volatility12mPct??0))[0]
  const selectedSeries=selected?.points.slice(-horizon)??[]
  const purchaseTonnes=Number(tonnes)
  const validTonnes=Number.isFinite(purchaseTonnes)&&purchaseTonnes>0&&purchaseTonnes<=10000000
  const priceMoM=selected?.change1mPct
  const previousPrice=selected&&priceMoM!==null&&priceMoM!==undefined?
    selected.latestQarTonne/(1+priceMoM/100):null
  const costDelta=validTonnes&&selected&&previousPrice!==null?
    (selected.latestQarTonne-previousPrice)*purchaseTonnes:null
  const toggleFavorite=(id:string)=>{
    setFavorites(prev=>{
      const next=prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]
      try{window.localStorage.setItem(WATCHLIST_KEY,JSON.stringify(next))}catch{}
      return next
    })
  }
  return <div className={styles.shell} dir={ar?'rtl':'ltr'}>
    <header className={styles.header}>
      <div className={styles.heading}>
        <div className={styles.eyebrow}><Globe2 size={13}/>{tx('NFII / GLOBAL PRICE INTELLIGENCE','الاستخبارات العالمية لأسعار السلع')}</div>
        <h1>{tx('Commodity Markets','أسواق السلع الغذائية')}</h1>
        <p>{tx('World agricultural benchmarks, trends and procurement exposure',
          'مؤشرات الأسعار الزراعية العالمية والاتجاهات وتكاليف المشتريات')}</p>
      </div>
      <div className={styles.headerActions}>
        <span className={styles.periodBadge}><span className={styles.periodDot}/>
          {tx('PUBLISHED MONTHLY','بيانات شهرية منشورة')}</span>
        <div className={styles.currencySwitch} aria-label="Display currency">
          {(['USD','QAR'] as const).map(c=><button key={c} type="button"
            className={currency===c?styles.currencyActive:''}
            aria-pressed={currency===c} onClick={()=>setCurrency(c)}>{c}</button>)}
        </div>
        <button type="button" className={styles.refresh} onClick={()=>setRefresh(v=>v+1)}
          disabled={loading}><RefreshCw size={15} className={loading?'animate-spin':''}/>
          {tx('Refresh','تحديث')}</button>
      </div>
    </header>
    <div className={styles.marketNotice}><Info size={15}/><span className={styles.eyebrow}>{MONTHLY_SOURCE}</span>
      <span>{tx('Global IMF reference averages published monthly via FRED. Not live futures prices, exchange quotes or supplier offers. Prices are not updated every second.',
        'متوسطات شهرية مرجعية من صندوق النقد الدولي عبر FRED، وليست أسعار العقود الآجلة المباشرة أو عروض الموردين.')}</span>
    </div>
    {error&&<div className={styles.error} role="alert">{error}
      <button type="button" onClick={()=>setRefresh(v=>v+1)}>{tx('Retry','إعادة المحاولة')}</button>
    </div>}
    <section className={styles.tickerStrip} aria-label={tx('Commodity price ticker','شريط أسعار السلع')}>
      {loading&&!items.length?Array.from({length:7},(_,i)=><div key={i} className={styles.tickerSkeleton}/>)
        :items.slice(0,10).map(item=><button key={item.id} type="button"
          onClick={()=>setSelectedId(item.id)} className={styles.tickerItem}
          data-active={selected?.id===item.id}>
          <span className={styles.tickerLabel}>{ar?item.labelAr:item.label}</span>
          <strong>{price(item.latestUsdTonne,currency,rate,language)}</strong>
          <span className={styles.tickerMovement}>
            <span data-movement={movement(item.change1mPct)}>{signed(item.change1mPct,language)}</span>
            <MiniTrend points={item.points} positive={(item.change12mPct??0)>=0}/>
          </span>
        </button>)}
      {!loading&&items.length===0&&<p className={styles.missingData}>
        {tx('No verified market data returned. Prices are intentionally not simulated.',
          'لا تتوفر أسعار موثوقة حالياً. لا توجد أسعار افتراضية.')}</p>}
    </section>
    <section className={styles.pulsePanel} aria-label={tx('Commodity market pulse','نبض أسواق السلع')}>
      <div className={styles.pulseTop}>
        <div>
          <span className={styles.pulseEyebrow}><Activity size={13}/>
            {tx('GLOBAL MARKET INTELLIGENCE','استخبارات الأسواق العالمية')}</span>
          <h2>{tx('Commodity market pulse','نبض أسواق السلع')}</h2>
          <p>{tx('Published benchmark movements and price exposure in one view.',
            'حركة المؤشرات المرجعية المنشورة وانكشاف الأسعار في عرض واحد.')}</p>
        </div>
        <span className={styles.pulsePeriod}><span className={styles.pulseStatusDot}/>
          {marketData?.latestObservationMonth
            ?monthLabel(marketData.latestObservationMonth,language)
            :tx('Awaiting published data','بانتظار البيانات المنشورة')}
          {' · '}{tx('MONTHLY','شهري')}</span>
      </div>
      <div className={styles.pulseMetrics}>
        <div className={styles.pulseMetric}>
          <span>{tx('Verified benchmarks','المؤشرات المؤكدة')}</span>
          <strong>{marketData?marketData.available:'—'}<small> / {marketData?.tracked??COMMODITY_CATALOG.length}</small></strong>
          <p>{tx('IMF series available','سلاسل صندوق النقد المتاحة')}</p>
        </div>
        <div className={styles.pulseMetric}>
          <span>{tx('Monthly direction','الاتجاه الشهري')}</span>
          <strong className={styles.pulseBreadth}><span>{marketData?gainers:'—'} <ArrowUpRight size={15}/></span>
            <i>/</i><span>{marketData?decliners:'—'} <ArrowDownRight size={15}/></span></strong>
          <p>{tx('Higher / lower · '+flat+' unchanged','ارتفاع / انخفاض · '+flat+' بدون تغير')}</p>
        </div>
        <div className={styles.pulseMetric}>
          <span>{tx('Average absolute move','متوسط التغير المطلق')}</span>
          <strong>{meanMonthlyMove===null?'—':number(meanMonthlyMove,language,1)+'%'}</strong>
          <p>{tx('Across available MoM observations','للقيم الشهرية المتاحة')}</p>
        </div>
        <div className={styles.pulseMetric}>
          <span>{tx('Highest observed volatility','أعلى تقلب مرصود')}</span>
          <strong>{volatile?number(volatile.volatility12mPct!,language,1)+'%':'—'}</strong>
          <p>{volatile?(ar?volatile.labelAr:volatile.label):
            tx('Requires 6+ monthly pairs','يتطلب ست مقارنات شهرية')}</p>
        </div>
      </div>
      <div className={styles.pulseBottom}>
        <div className={styles.pulseMoverHeading}>
          <span><TrendingUp size={14}/>{tx('Largest monthly price movements','أكبر تحركات الأسعار الشهرية')}</span>
          <small>{tx('Absolute change · not a trading signal','تغير مطلق · ليس توصية تداول')}</small>
        </div>
        <div className={styles.moversGrid}>
          {movers.length?movers.map((item,index)=>
            <button key={item.id} type="button" className={styles.moverCard}
              onClick={()=>setSelectedId(item.id)}
              data-active={selected?.id===item.id}>
              <span className={styles.moverRank}>{String(index+1).padStart(2,'0')}</span>
              <span className={styles.moverName}>
                <strong>{ar?item.labelAr:item.label}</strong>
                <small>{monthLabel(item.latestDate,language)}</small>
              </span>
              <span className={styles.moverMove} data-movement={movement(item.change1mPct)}>
                {item.change1mPct!==null&&item.change1mPct>=0?<ArrowUpRight size={15}/>:<ArrowDownRight size={15}/>}
                {signed(item.change1mPct,language,1)}
              </span>
            </button>):
            <span className={styles.pulseEmpty}>{tx('No comparable monthly movements available.',
              'لا توجد تغيرات شهرية قابلة للمقارنة.')}</span>}
        </div>
        <p className={styles.pulseDisclaimer}>
          <Info size={12}/>{tx('Prices rising or falling do not establish food security risk. Monthly observations, not live quotes.',
            'ارتفاع الأسعار أو انخفاضها لا يثبت مخاطر الأمن الغذائي. بيانات شهرية وليست أسعاراً فورية.')}
        </p>
      </div>
    </section>
    {marketData&&marketData.status!=='available'&&<p className={styles.feedStatus} role="status">
      {tx('Partial market coverage: some source series are currently unavailable.',
        'التغطية جزئية: بعض السلاسل غير متاحة حالياً.')} {marketData.available}/{marketData.tracked}
    </p>}
    <div className={styles.mainGrid}>
      <section className={styles.heroPanel}>
        <div className={styles.panelHeader}>
          <div><span className={styles.eyebrow}>{tx('MARKET DETAIL','تفاصيل السوق')}</span>
            <h2>{selected?(ar?selected.labelAr:selected.label):tx('Select a commodity','اختر سلعة')}</h2>
            <p>{selected?.benchmark??tx('Verified price series only','الأسعار الموثقة فقط')}</p></div>
          <div className={styles.seriesSource}><span>{selected?.seriesId??'N/A'}</span>
            <span>{selected?monthLabel(selected.latestDate,language):'—'}</span></div>
        </div>
        <div className={styles.priceRow}>
          <div className={styles.currentPrice}>{selected?price(selected.latestUsdTonne,currency,rate,language):'—'}
            <span>{currency}{tx(' / metric tonne',' / طن متري')}</span>
          </div>
          {selected&&<div className={styles.changePill+' '+positiveColor(selected.change1mPct)}>
            {selected.change1mPct!==null&&selected.change1mPct>=0?<ArrowUpRight size={17}/>:<ArrowDownRight size={17}/>}
            {signed(selected.change1mPct,language)} {tx('vs previous month','مقارنة بالشهر السابق')}
          </div>}
        </div>
        <div className={styles.chartToolbar}>
          <span>{tx('Monthly historical prices','الأسعار الشهرية التاريخية')}</span>
          <div className={styles.horizons}>{HORIZONS.map(range=><button key={range.months}
            type="button" aria-pressed={horizon===range.months}
            className={horizon===range.months?styles.horizonActive:''}
            onClick={()=>setHorizon(range.months)}>{range.label}</button>)}</div>
        </div>
        {selected?<PriceHistoryChart key={selected.id} points={selectedSeries} currency={currency}
          rate={rate} locale={language}/>:<div className={styles.emptyChart}>
            {loading?tx('Loading verified benchmarks…','جاري تحميل الأسعار الموثقة…'):
              tx('No historical prices available.','لا توجد أسعار تاريخية متاحة.')}
          </div>}
        <div className={styles.chartFoot}>
          <span><span className={styles.lineSample}/>{tx('Published monthly price','السعر الشهري المنشور')}</span>
          <span>{tx('Not intraday · last period:','ليس لحظياً · آخر فترة:')}
            {' '}{selected?monthLabel(selected.latestDate,language):'—'}</span>
        </div>
      </section>
      <aside className={styles.detailsPanel}>
        <div className={styles.panelHeader}><div><span className={styles.eyebrow}>
          {tx('BENCHMARK ANALYTICS','تحليل السعر المرجعي')}</span><h2>{tx('Market statistics','إحصائيات السوق')}</h2></div>
          <BarChart3 size={18}/></div>
        <div className={styles.statRows}>
          {[
            [tx('Change · 1 month','التغير · شهر'),selected?.change1mPct,signed(selected?.change1mPct??null,language)],
            [tx('Change · 3 months','التغير · 3 أشهر'),selected?.change3mPct,signed(selected?.change3mPct??null,language)],
            [tx('Change · 12 months','التغير · 12 شهر'),selected?.change12mPct,signed(selected?.change12mPct??null,language)],
          ].map(([label,n,value])=><div key={String(label)} className={styles.statRow}><span>{label}</span>
            <strong className={positiveColor(typeof n==='number'?n:null)}>{value}</strong></div>)}
          <div className={styles.statRow}><span>{tx('12M low','أدنى سعر خلال 12 شهر')}</span>
            <strong>{selected&&selected.low12mUsdTonne!==null
              ?price(selected.low12mUsdTonne,currency,rate,language):'N/A'}</strong></div>
          <div className={styles.statRow}><span>{tx('12M high','أعلى سعر خلال 12 شهر')}</span>
            <strong>{selected&&selected.high12mUsdTonne!==null
              ?price(selected.high12mUsdTonne,currency,rate,language):'N/A'}</strong></div>
          <div className={styles.statRow}><span>{tx('Monthly volatility · 12M','التذبذب الشهري · 12 شهر')}</span>
            <strong>{selected&&selected.volatility12mPct!==null
              ?number(selected.volatility12mPct,language,1)+'%':'N/A'}</strong></div>
        </div>
        <div className={styles.sourceBox}>
          <div className={styles.sourceLabel}><Info size={14}/>{tx('SOURCE & FREQUENCY','المصدر والتواتر')}</div>
          <p>{tx('IMF Primary Commodity Prices, distributed by FRED. Published monthly; not an exchange feed.',
            'أسعار السلع الأساسية لصندوق النقد الدولي عبر FRED. بيانات شهرية وليست تداولات مباشرة.')}</p>
          {selected&&<a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">
            {tx('Open original series','فتح السلسلة الأصلية')} <ExternalLink size={12}/></a>}
          <small>{tx('FX conversion: 1 USD = 3.64 QAR (QCB parity). All values use USD/t or QAR/t for comparison.',
            'التحويل: الدولار = 3.64 ريال وفق سعر الصرف الرسمي. الأسعار لكل طن متري.')}</small>
        </div>
      </aside>
    </div>
    <section className={styles.matrixPanel} aria-label={tx('Commodity price change matrix','مصفوفة تغير أسعار السلع')}>
      <div className={styles.matrixHeading}>
        <div><span className={styles.eyebrow}><Grid2X2 size={13}/>
          {tx('COMPARATIVE INTELLIGENCE','تحليل المقارنة')}</span>
          <h2>{tx('Price movement matrix','مصفوفة تحركات الأسعار')}</h2>
          <p>{tx('Compare published price changes across monthly horizons. Shades show direction and magnitude, not food insecurity severity.',
            'مقارنة تغيرات الأسعار المنشورة عبر فترات مختلفة. الألوان تمثل الاتجاه والحجم لا شدة انعدام الأمن الغذائي.')}</p>
        </div>
        <div className={styles.matrixLegend}>
          <span><i data-movement="up"/>{tx('Price increase','ارتفاع السعر')}</span>
          <span><i data-movement="down"/>{tx('Price decrease','انخفاض السعر')}</span>
          <span><i data-movement="missing"/>{tx('Unavailable','غير متاح')}</span>
        </div>
      </div>
      <div className={styles.matrixScroll}>
        <table className={styles.matrixTable}>
          <thead><tr><th>{tx('Benchmark','السلعة المرجعية')}</th>
            <th>{tx('1 month','شهر')}</th><th>{tx('3 months','3 أشهر')}</th>
            <th>{tx('12 months','12 شهراً')}</th>
            <th>{tx('Monthly volatility','التقلب الشهري')}</th></tr></thead>
          <tbody>
            {entries.map(item=><tr key={item.id} data-active={selected?.id===item.id}>
              <th scope="row"><button type="button" onClick={()=>setSelectedId(item.id)}>
                <strong>{ar?item.labelAr:item.label}</strong>
                <small>{item.seriesId} · {monthLabel(item.latestDate,language)}</small>
              </button></th>
              {([item.change1mPct,item.change3mPct,item.change12mPct] as const).map((value,i)=>
                <td key={i}><span className={styles.matrixCell} data-movement={movement(value)}>
                  {signed(value,language,1)}</span></td>)}
              <td><span className={styles.matrixVolatility}>
                {item.volatility12mPct===null?'—':number(item.volatility12mPct,language,1)+'%'}
              </span></td>
            </tr>)}
          </tbody>
        </table>
        {entries.length===0&&<div className={styles.matrixEmpty}>
          {loading?tx('Retrieving published benchmarks…','جلب المؤشرات المنشورة…'):
            tx('No verified series matches these market filters.','لا توجد سلاسل موثوقة تطابق عوامل التصفية.')}
        </div>}
      </div>
      <div className={styles.matrixFoot}><Info size={12}/>
        {tx('MoM, 3M and YoY are calculated against exact published months. No daily or weekly changes are inferred.',
          'تُحسب التغيرات بحسب أشهر النشر الفعلية. لا يتم تقدير التغيرات اليومية أو الأسبوعية.')}
      </div>
    </section>
    <div className={styles.bottomGrid}>
      <section className={styles.tablePanel}>
        <div className={styles.tableHeading}>
          <div><span className={styles.eyebrow}>{tx('GLOBAL BENCHMARK WATCHLIST','قائمة مراقبة الأسعار العالمية')}</span>
            <h2>{tx('Market overview','نظرة عامة على الأسواق')}</h2>
            <p>{tx('Select a commodity to inspect its historical price.',
              'اختر سلعة لعرض حركة الأسعار التاريخية.')}</p></div>
          <span className={styles.periodBadge}>{tx('MoM · monthly change','التغير الشهري')}</span>
        </div>
        <div className={styles.tableControls}>
          <div className={styles.groupTabs}>{GROUPS.map(group=><button key={group.id}
            type="button" aria-pressed={category===group.id}
            className={category===group.id?styles.groupActive:''}
            onClick={()=>setCategory(group.id)}>{ar?group.ar:group.en}</button>)}</div>
          <div className={styles.searchSort}>
            <label className={styles.searchWrap}><Search size={14}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} maxLength={90}
                placeholder={tx('Search commodity…','ابحث عن سلعة…')}
                aria-label={tx('Search commodities','البحث عن السلع')}/></label>
            <label className={styles.sortWrap}><span>{tx('Sort','ترتيب')}</span><ChevronDown size={12}/>
              <select value={order} onChange={e=>setOrder(e.target.value as Order)}
                aria-label="Sort commodities"><option value="mom">{tx('Monthly change','التغير الشهري')}</option>
                <option value="yoy">{tx('Annual change','التغير السنوي')}</option>
                <option value="name">{tx('Name','الاسم')}</option></select></label>
          </div>
        </div>
        <div className={styles.tableScroll}><table className={styles.table}>
          <thead><tr>
            <th aria-label="Watchlist"></th><th>{tx('Commodity','السلعة')}</th>
            <th>{tx('Published period','فترة السعر')}</th>
            <th className={styles.numeric}>{currency}/t</th>
            <th className={styles.numeric}>MoM</th><th className={styles.numeric}>YoY</th>
            <th>{tx('12M trend','اتجاه 12 شهر')}</th>
          </tr></thead>
          <tbody>{entries.map(item=><tr key={item.id} data-active={selected?.id===item.id}>
            <td><button type="button" className={styles.starButton}
              onClick={()=>toggleFavorite(item.id)} aria-label={favorites.includes(item.id)?
                'Remove '+item.label+' from watchlist':'Add '+item.label+' to watchlist'}
              aria-pressed={favorites.includes(item.id)}>
              <Star size={16} fill={favorites.includes(item.id)?'#C9A227':'none'}
                color={favorites.includes(item.id)?'#C9A227':'#8C9388'}/></button></td>
            <td><button type="button" className={styles.instrumentButton}
              onClick={()=>setSelectedId(item.id)}>
              <strong>{ar?item.labelAr:item.label}</strong>
              <small>{ar?GROUP_LABEL[item.group].ar:GROUP_LABEL[item.group].en}
                {' · '}{item.seriesId}</small></button></td>
            <td><span className={styles.dateText}>{monthLabel(item.latestDate,language)}</span>
              {item.stale&&<small className={styles.stale}>{tx('Outdated','قديم')}</small>}</td>
            <td className={styles.numeric}><strong>{price(item.latestUsdTonne,currency,rate,language)}</strong></td>
            <td className={styles.numeric}><span className={positiveColor(item.change1mPct)}>
              {signed(item.change1mPct,language)}</span></td>
            <td className={styles.numeric}><span className={positiveColor(item.change12mPct)}>
              {signed(item.change12mPct,language)}</span></td>
            <td><MiniTrend points={item.points} positive={(item.change12mPct??0)>=0}/></td>
          </tr>)}</tbody>
        </table>{!entries.length&&<p className={styles.noMatches}>
          {loading?tx('Loading data…','جاري تحميل البيانات…'):
            tx('No verified commodities match these filters.','لا توجد سلع مطابقة للفلاتر.')}</p>}
        </div>
      </section>
      <aside className={styles.sideColumn}>
        <section className={styles.budgetPanel}>
          <div className={styles.panelHeader}><div><span className={styles.eyebrow}>
            {tx('PROCUREMENT EXPOSURE','تأثير التوريد')}</span>
            <h2>{tx('Cost sensitivity','حساسية تكلفة الشراء')}</h2></div><Wheat size={18}/></div>
          <p className={styles.budgetIntro}>{tx('Indicative effect of the latest published monthly benchmark movement on a hypothetical order.',
            'تأثير التغير الشهري للسعر المرجعي على كمية شراء افتراضية.')}</p>
          <label className={styles.inputLabel} htmlFor="commodity-market-tonnes">{tx('Purchase quantity · metric tonnes','كمية الشراء · طن متري')}</label>
          <input id="commodity-market-tonnes" className={styles.tonneInput}
            value={tonnes} type="number" min="0.01" max="10000000" step="1"
            onChange={e=>setTonnes(e.target.value)}/>
          <div className={styles.budgetResult}><span>{tx('Illustrative benchmark value','القيمة المرجعية التقديرية')}</span>
            <strong>{validTonnes&&selected?number(selected.latestQarTonne*purchaseTonnes,language,0)+' QAR':'N/A'}</strong></div>
          <div className={styles.budgetResult}><span>{tx('Change vs previous month','الفرق عن الشهر السابق')}</span>
            <strong className={positiveColor(costDelta)}>{costDelta===null?'N/A':
              (costDelta>0?'+':'')+number(costDelta,language,0)+' QAR'}</strong></div>
          {!validTonnes&&<p className={styles.stale}>{tx('Enter a positive quantity up to 10 million tonnes.',
            'أدخل كمية موجبة ضمن النطاق المتاح.')}</p>}
          <p className={styles.budgetFoot}>{tx('Benchmark-only scenario, NOT your actual purchase cost. Excludes freight, insurance, tariffs, quality, handling and supplier margins.',
            'حساب مرجعي وليس تكلفة شراء فعلية. لا يشمل الشحن والتأمين والرسوم وهوامش الموردين.')}</p>
        </section>
        <section className={styles.footPanel}>
          <h3>{tx('Data integrity','موثوقية البيانات')}</h3>
          <p><Check size={14}/>{tx('Real published observations only','بيانات منشورة فعلية فقط')}</p>
          <p><Check size={14}/>{tx('Correct units converted to metric tonnes','توحيد وحدات القياس للطن المتري')}</p>
          <p><Check size={14}/>{tx('Missing quotes displayed as unavailable','البيانات المفقودة تظهر غير متاحة')}</p>
          <a href="https://fred.stlouisfed.org/" target="_blank" rel="noopener noreferrer">
            {tx('FRED / IMF benchmark sources','مصادر الأسعار المرجعية')} <ExternalLink size={12}/></a>
          <a href="https://www.qcb.gov.qa/en/Pages/MonetaryPolicyTools.aspx" target="_blank" rel="noopener noreferrer">
            {tx('Qatar Central Bank currency parity','سعر الصرف لدى مصرف قطر المركزي')} <ExternalLink size={12}/></a>
        </section>
      </aside>
    </div>
    <footer className={styles.footer}><span>{tx('IMF via FRED · Published monthly commodity benchmarks · Not an exchange trading terminal',
      'صندوق النقد الدولي عبر FRED · بيانات شهرية مرجعية وليست منصة تداول')}</span>
      <span>{tx('Latest source month:','آخر شهر متاح:')}
        {' '}{marketData?.latestObservationMonth?monthLabel(marketData.latestObservationMonth,language):'N/A'}</span></footer>
  </div>
}
