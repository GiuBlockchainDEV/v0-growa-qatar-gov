'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertTriangle, ArrowUpRight, ChevronLeft, ExternalLink, Globe2, Layers, Maximize2, Minimize2, Pause, Plane, Play, Radio, RefreshCw, Search, Ship, Wheat, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import type { FoodPosture } from '@/lib/watchtower/food-posture'
import type {ProductionRiskSnapshot,ProductionRiskZone,ProductionDriver} from '@/lib/watchtower/production-risk'
import { CHOKEPOINTS, QATAR, REFRESH_SECONDS, freshAsset, mergeAssets, separationKm, type MapAlert, type MapLayers, type TrackingAsset, type TrackingSnapshot } from '@/lib/watchtower/global-tracking'
import {TRACKED_CHOKEPOINTS,type ChokepointId,type DataTrackingSnapshot,type ChokepointReport} from '@/lib/watchtower/data-tracking-net'
import type {AISRoute,HistoryOverlay} from '@/lib/watchtower/data-tracking-history'
import {GCC_PORTS,type GccHubId,type GccRadarSnapshot} from '@/lib/watchtower/myshiptracking-gcc'
import type { GlobalTrackingMapProps } from './global-tracking-map'
import {mergeTrackingUpdate,mergeFlightItineraries,type RouteLookupResponse} from '@/lib/watchtower/tracking-merge'
import styles from './global-watchtower.module.css'
const Map = dynamic<GlobalTrackingMapProps>(() => import('./global-tracking-map').then(m => m.GlobalTrackingMap), { ssr: false, loading: () => <div className={styles.map} aria-busy="true" /> })
const REGIONS = {
  global: { name: 'Global', lat: 22, lon: 35, zoom: 2, box: [-85, -180, 85, 180] },
  gulf: { name: 'Gulf & Red Sea', lat: 24, lon: 47, zoom: 4, box: [10, 30, 36, 63] },
  europe: { name: 'Europe', lat: 50, lon: 12, zoom: 4, box: [35, -18, 72, 45] },
  asia: { name: 'Asia', lat: 25, lon: 103, zoom: 3, box: [-12, 45, 75, 180] },
  africa: { name: 'Africa', lat: 2, lon: 22, zoom: 3, box: [-36, -20, 38, 53] },
  americas: { name: 'Americas', lat: 15, lon: -80, zoom: 3, box: [-60, -180, 80, -30] },
} as const
type Region = keyof typeof REGIONS
const count = (n: number | null) => n === null ? 'N/A' : n.toLocaleString('en-US')
function utc(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not provided'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value + ' (date only)'
  return new Date(value).toLocaleString('en-GB', { timeZone: 'UTC', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' UTC'
}
function age(value: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000))
  return seconds < 60 ? seconds + 's ago' : seconds < 3600 ? Math.floor(seconds / 60) + 'm ago' : Math.floor(seconds / 3600) + 'h ago'
}
export function GlobalWatchtower() {
  const { locale } = useI18n(), { organization } = useOrganization()
  const ar = locale === 'ar', tx = (en: string, arabic: string) => ar ? arabic : en
  const root = useRef<HTMLDivElement>(null), pausedRef = useRef(false)
  const [snapshot, setSnapshot] = useState<TrackingSnapshot | null>(null), [posture, setPosture] = useState<FoodPosture | null>(null)
  const [productionRisk,setProductionRisk]=useState<ProductionRiskSnapshot|null>(null)
  const [productionError,setProductionError]=useState('')
  const [maritimeFeed,setMaritimeFeed]=useState<DataTrackingSnapshot|null>(null)
  const [maritimeError,setMaritimeError]=useState('')
  const [aisHistory,setAISHistory]=useState<AISRoute[]>([])
  const [aisHistoryStatus,setAISHistoryStatus]=useState('')
  const [gccRadar,setGccRadar]=useState<GccRadarSnapshot|null>(null)
  const [gccRadarError,setGccRadarError]=useState('')
  const [selectedGccHub,setSelectedGccHub]=useState<'all'|GccHubId>('all')
  const [selectedChokepoint,setSelectedChokepoint]=useState<'all'|ChokepointId>('all')
  const [error, setError] = useState(''), [foodError, setFoodError] = useState('')
  const [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0), [paused, setPaused] = useState(false), [now, setNow] = useState(Date.now)
  const [mobile, setMobile] = useState(false), [filtersOpen, setFiltersOpen] = useState(true), [alertsOpen, setAlertsOpen] = useState(true), [fullscreen, setFullscreen] = useState(false)
  const [query, setQuery] = useState(''), [region, setRegion] = useState<Region>('global'), [cargoOnly, setCargoOnly] = useState(true)
  const [commodity, setCommodity] = useState('all'), [alertKind, setAlertKind] = useState('all'), [productionKind,setProductionKind] = useState<'all'|ProductionDriver>('all'), [highOnly, setHighOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null), [sourceId, setSourceId] = useState<string | null>(null)
  const [focus, setFocus] = useState<GlobalTrackingMapProps['focus']>(null)
  const [layers, setLayers] = useState<MapLayers>({ aircraft: true, vessels: true, risks: true, production: true, gateways: true, trails: true, projections: true })
  const orgId = organization?.id ?? null, food = posture?.organizationId === orgId ? posture : null
  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 800px)')
    const resize = () => { setMobile(media.matches); if (media.matches) { setFiltersOpen(false); setAlertsOpen(false) } }
    const screen = () => setFullscreen(document.fullscreenElement === root.current)
    resize(); media.addEventListener('change', resize); document.addEventListener('fullscreenchange', screen)
    const clock = setInterval(() => setNow(Date.now()), 15000)
    return () => { clearInterval(clock); media.removeEventListener('change', resize); document.removeEventListener('fullscreenchange', screen) }
  }, [])
  useEffect(() => {
    let active=true,running=false
    const controller=new AbortController()
    const request=async(stage:'quick'|'full')=>{
      const response=await fetch('/api/watchtower/tracking?stage='+stage,{
        cache:'no-store',
        signal:AbortSignal.any([controller.signal,AbortSignal.timeout(stage==='quick'?11500:28000)]),
      })
      const body=await response.json() as TrackingSnapshot & {error?:string}
      if(!response.ok)throw Error(body.error??'Tracking request failed')
      if(!Array.isArray(body.assets)||!Array.isArray(body.alerts)||!Array.isArray(body.sources))
        throw Error('Unexpected tracking response')
      if(active){
        setSnapshot(previous=>mergeTrackingUpdate(previous,body,stage))
        setNow(Date.now())
        setError('')
      }
      return body
    }
    const enrich=async()=>{
      try{
        const response=await fetch('/api/watchtower/routes',{
          cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12500)]),
        })
        if(!response.ok)return
        const result=await response.json() as RouteLookupResponse
        if(active&&result&&typeof result.routes==='object')
          setSnapshot(previous=>mergeFlightItineraries(previous,result))
      }catch{ /* never delay or hide aircraft because an itinerary provider failed */ }
    }
    const load=async()=>{
      if(running||document.hidden||!active)return
      running=true;setBusy(true)
      // Fast plane positions, full hazard/maritime feed and route enrichment
      // run independently. None blocks another category from rendering.
      const quick=request('quick')
      const full=request('full')
      try{
        await quick
        if(active){setBusy(false);void enrich()}
      }catch(reason){
        if(active&&!controller.signal.aborted)
          setError(reason instanceof Error?reason.message:'Aircraft feed unavailable')
      }
      // Full feed may still be working. It never blocks the first plane render.
      try{await full}catch(reason){
        if(active&&!controller.signal.aborted)
          setError(reason instanceof Error?reason.message:'Supplemental tracking unavailable')
      }
      running=false
      if(active)setBusy(false)
    }
    void load()
    const timer=setInterval(()=>{if(!pausedRef.current)void load()},REFRESH_SECONDS*1000)
    const visible=()=>{if(!document.hidden&&!pausedRef.current)void load()}
    document.addEventListener('visibilitychange',visible)
    return()=>{
      active=false;controller.abort();clearInterval(timer)
      document.removeEventListener('visibilitychange',visible)
    }
  }, [refresh])
  // Separate feed: risk geometry does not block aircraft positions or AIS.
  // A source failure stays visible, never silently interpreted as safety.
  useEffect(()=>{
    let active=true
    const controller=new AbortController()
    const load=async()=>{
      if(document.hidden||!active)return
      try{
        const response=await fetch('/api/watchtower/production-risks',{
          cache:'no-store',
          signal:AbortSignal.any([controller.signal,AbortSignal.timeout(27000)]),
        })
        if(!response.ok)throw Error('Agricultural risk feed unavailable')
        const data=await response.json() as ProductionRiskSnapshot
        if(!Array.isArray(data.zones))throw Error('Invalid geographic risk response')
        if(active){setProductionRisk(data);setProductionError('')}
      }catch{
        if(active&&!controller.signal.aborted)
          setProductionError('Production risk areas temporarily unavailable. This does not mean no risk.')
      }
    }
    void load()
    const interval=setInterval(()=>{if(!pausedRef.current)void load()},20*60000)
    return()=>{active=false;controller.abort();clearInterval(interval)}
  },[refresh])
  // Public data-tracking.net AIS chokepoints refresh separately from aircraft,
  // advisories and licensed VesselFinder. Do not fake unsupported coverage.
  useEffect(()=>{
    let active=true
    const controller=new AbortController()
    const load=async()=>{
      if(!active||document.hidden||pausedRef.current)return
      try{
        const response=await fetch('/api/watchtower/chokepoints',{
          cache:'no-store',
          signal:AbortSignal.any([controller.signal,AbortSignal.timeout(27000)]),
        })
        if(!response.ok)throw Error('Chokepoint AIS feed unavailable')
        const body=await response.json() as DataTrackingSnapshot
        if(!Array.isArray(body.assets)||!Array.isArray(body.chokepoints)||
          body.source!=='hormuz.data-tracking.net')throw Error('Invalid chokepoint AIS response')
        if(active){setMaritimeFeed(body);setMaritimeError('')}
      }catch{
        if(active&&!controller.signal.aborted)
          setMaritimeError('data-tracking.net AIS temporarily unavailable; last received snapshots may be stale.')
      }
    }
    void load()
    const timer=setInterval(()=>{void load()},25*60000)
    const visible=()=>{if(!document.hidden)void load()}
    document.addEventListener('visibilitychange',visible)
    return()=>{active=false;controller.abort();clearInterval(timer)
      document.removeEventListener('visibilitychange',visible)}
  },[refresh])
  // Optional licensed GCC marine radar: no provider calls until an
  // authorized organization explicitly enables this in server env.
  // Browser polls every 5 minutes while visible, without a background daemon.
  useEffect(()=>{
    if(!orgId){setGccRadar(null);return}
    let running=false,active=true
    const controller=new AbortController()
    const load=async()=>{
      if(running||!active||document.hidden||pausedRef.current)return
      running=true
      try{
        const response=await fetch('/api/watchtower/gcc-radar?'+
          new URLSearchParams({organizationId:orgId}),{
          cache:'no-store',
          signal:AbortSignal.any([controller.signal,AbortSignal.timeout(28000)]),
        })
        if(!response.ok)throw Error('Licensed GCC radar request unavailable')
        const body=await response.json() as GccRadarSnapshot
        if(!Array.isArray(body.assets)||!Array.isArray(body.hubs)||
           body.source!=='MyShipTracking API')throw Error('Invalid GCC radar result')
        if(active){setGccRadar(body);setGccRadarError('')}
      }catch{
        if(active&&!controller.signal.aborted)
          setGccRadarError('GCC radar unavailable; existing AIS observations remain visible.')
      }finally{running=false}
    }
    void load()
    const timer=setInterval(()=>void load(),300000)
    const visible=()=>{if(!document.hidden)void load()}
    document.addEventListener('visibilitychange',visible)
    return()=>{active=false;controller.abort();clearInterval(timer)
      document.removeEventListener('visibilitychange',visible)}
  },[orgId,refresh])
  useEffect(() => {
    setPosture(null); setFoodError(''); setCommodity('all')
    if (!orgId) return
    const controller = new AbortController()
    let running = false
    const load = async () => {
      if (running || document.hidden || controller.signal.aborted) return
      running = true
      try {
        const response = await fetch('/api/watchtower/food-security?' + new URLSearchParams({ organizationId: orgId, days: '30' }), {
          cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(28000)]),
        })
        const body = await response.json() as FoodPosture & { error?: string }
        if (!response.ok) throw Error(body.error ?? 'Food ledger unavailable')
        if (body.organizationId !== orgId || body.scope !== 'organization' || body.sourceMode !== 'live') throw Error('Food ledger scope mismatch')
        if (!controller.signal.aborted) { setPosture(body); setFoodError('') }
      } catch (reason) { if (!controller.signal.aborted) setFoodError(reason instanceof Error ? reason.message : 'Food ledger unavailable') }
      finally { running = false }
    }
    void load()
    const timer = setInterval(() => { if (!pausedRef.current) void load() }, 120000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [orgId, refresh])
  const foodAlerts = useMemo<MapAlert[]>(() => (food?.commodities ?? []).filter(c => ['critical', 'high', 'attention'].includes(c.band)).map(c => ({
    id: 'food:' + c.commodityId, kind: 'food', title: (ar ? c.nameAr : c.name) + ': ' + c.reason.replaceAll('_', ' '),
    severity: c.band === 'attention' ? 'attention' : 'high', lat: QATAR.lat, lon: QATAR.lon,
    observedAt: c.latestReviewedAt, source: 'Organization food ledger',
    sourceUrl: '/dashboard?' + new URLSearchParams({ module: 'commodities', commodityId: c.commodityId, organizationId: food!.organizationId }),
    detail: '30-day organization outlook. Coverage: ' + (c.coverageDays === null ? 'unknown' : c.coverageDays.toFixed(1) + ' days') +
      '. Projected deficit: ' + (c.deficitTonnes === null ? 'unknown' : c.deficitTonnes.toFixed(1) + ' tonnes') + '. Not national totals.',
    locationBasis: 'Organization-level signal anchored to Qatar for navigation, NOT a geolocated incident.',
  })), [food, ar])
  const allAlerts = useMemo(() => [...foodAlerts, ...(snapshot?.alerts ?? [])], [foodAlerts, snapshot])
  const inside = useCallback((p: { lat: number; lon: number }) => {
    const [south, west, north, east] = REGIONS[region].box
    return p.lat >= south && p.lat <= north && p.lon >= west && p.lon <= east
  }, [region])
  const allAssets=useMemo(()=>{
    // Keep explicit capacity for maritime observations; otherwise the latest
    // 2,000 aircraft fixes can crowd out 30-minute AIS cargo positions.
    const incoming=[...(snapshot?.assets??[]),...(maritimeFeed?.assets??[]),...(gccRadar?.assets??[])]
    const vessels=mergeAssets(incoming.filter(asset=>asset.kind==='vessel')).slice(0,700)
    const aircraft=mergeAssets(incoming.filter(asset=>asset.kind==='aircraft')).slice(0,1300)
    return [...aircraft,...vessels]
  },[snapshot,maritimeFeed,gccRadar])
  const assets = useMemo(() => allAssets.filter(a =>
    inside(a)&&
    (selectedChokepoint==='all'||a.kind==='aircraft'||a.chokepointId===selectedChokepoint||Boolean(a.hubId))&&
    (selectedGccHub==='all'||a.kind==='aircraft'||a.hubId===selectedGccHub)&&
    (!cargoOnly || a.cargo !== 'unverified') &&
    (!query || (a.label + ' ' + a.id + ' ' + (a.destination ?? '')).toLowerCase().includes(query.toLowerCase())),
    ), [allAssets, inside, selectedChokepoint, selectedGccHub, cargoOnly, query])
  const alerts = useMemo(() => allAlerts.filter(a => inside(a) && (alertKind === 'all' || a.kind === alertKind) &&
    (!highOnly || a.severity === 'high') && (commodity === 'all' || a.kind !== 'food' || a.id === 'food:' + commodity) &&
    (!query || (a.title + ' ' + a.source).toLowerCase().includes(query.toLowerCase()))), [allAlerts, inside, alertKind, highOnly, commodity, query])
  // Internal organization risk metrics remain on the map and KPI cards, but
  // must not clutter the public Food Security & Risk alert inbox.
  const riskZones=useMemo<ProductionRiskZone[]>(()=>(
    productionRisk?.zones??[]).filter(zone=>
      inside(zone.center)&&
      (productionKind==='all'||zone.driver===productionKind)&&
      (!highOnly||zone.severity==='high')&&
      (!query||(zone.name+' '+zone.country+' '+zone.driver+' '+zone.eventTitles.join(' ')).toLowerCase().includes(query.toLowerCase())),
    ),[productionRisk,inside,productionKind,highOnly,query])
  const externalRiskAlerts = useMemo(
    () => alerts.filter(alert => alert.source !== 'Organization food ledger'),
    [alerts],
  )
  const selectedAsset = allAssets.find(a => a.id === selectedId), selectedAlert = allAlerts.find(a => a.id === selectedId)
  const selectedProductionZone=(productionRisk?.zones??[]).find(zone=>zone.id===selectedId)
  // Load a bounded selection of real 7-day AIS tracks separately from ship
  // positions. A failed trace request must never hide a vessel icon.
  useEffect(()=>{
    if(!maritimeFeed?.assets.length)return
    const controller=new AbortController()
    const load=async()=>{
      try{
        const response=await fetch('/api/watchtower/chokepoint-tracks',{
          cache:'no-store',
          signal:AbortSignal.any([controller.signal,AbortSignal.timeout(26000)]),
        })
        if(!response.ok)throw Error('AIS history unavailable')
        const data=await response.json() as HistoryOverlay
        if(!Array.isArray(data.routes))throw Error('AIS history schema invalid')
        if(!controller.signal.aborted){
          setAISHistory(previous=>{
            const byId=new globalThis.Map(previous.map(route=>[route.id,route]))
            for(const route of data.routes)if(route.status==='observed')byId.set(route.id,route)
            return [...byId.values()].slice(-80)
          })
          setAISHistoryStatus(data.observed+' observed tracks / '+data.checked+' ships checked')
        }
      }catch{
        if(!controller.signal.aborted)
          setAISHistoryStatus('AIS track history unavailable; positions can still be shown.')
      }
    }
    void load()
    return()=>controller.abort()
  },[maritimeFeed?.generatedAt])
  useEffect(()=>{
    const asset=allAssets.find(a=>a.id===selectedId)
    if(!asset||asset.kind!=='vessel'||!asset.chokepointId)return
    // Keep a narrowed primitive across the async closure for strict TS checks.
    const chokepoint:ChokepointId=asset.chokepointId
    const controller=new AbortController()
    const load=async()=>{
      try{
        const response=await fetch('/api/watchtower/chokepoint-tracks?'+
          new URLSearchParams({mmsi:asset.id.slice(4),chokepoint}),{
          cache:'no-store',
          signal:AbortSignal.any([controller.signal,AbortSignal.timeout(9000)]),
        })
        if(!response.ok)return
        const route=await response.json() as AISRoute
        if(!controller.signal.aborted&&route.status==='observed')
          setAISHistory(previous=>[...previous.filter(r=>r.id!==route.id),route].slice(-80))
      }catch{ /* selected ship remains visible even if its trace fails */ }
    }
    void load()
    return()=>controller.abort()
  },[selectedId,allAssets])

  const itineraryCount=assets.filter(a=>a.itinerary?.origin&&a.itinerary?.destination).length
  const mapReadyItineraryCount=assets.filter(a=>a.itinerary?.origin?.lat!=null&&
    a.itinerary.destination?.lat!=null&&
    (a.kind==='aircraft'||Boolean(a.itinerary.modelSeaLegs))).length
  const selectedSource = snapshot?.sources.find(s => s.id === sourceId)
  const chokepointReport=(id:ChokepointId):ChokepointReport|undefined=>
    maritimeFeed?.chokepoints.find(point=>point.id===id)
  const chooseChokepoint=(id:ChokepointId)=>{
    const area=TRACKED_CHOKEPOINTS.find(point=>point.id===id)
    if(!area)return
    setRegion('global')
    setSelectedChokepoint(id)
    setFocus({lat:area.lat,lon:area.lon,zoom:6,token:Date.now()})
    if(mobile){setFiltersOpen(false);setAlertsOpen(false)}
  }
  const recentCount = allAssets.filter(a => freshAsset(a, now)).length
  const staleSnapshot = Boolean(snapshot && now - Date.parse(snapshot.generatedAt) > 180000)
  const staleFood = Boolean(food && now - Date.parse(food.generatedAt) > 300000)
  const airSource = snapshot?.sources.find(s => s.id === 'adsb'), seaSource = snapshot?.sources.find(s => s.id === 'ais')
  const known = (state: string | undefined) => state === 'partial' || state === 'available' || state === 'stale'
  const riskReadable = Boolean(snapshot?.sources.some(s => ['gdacs', 'easa', 'hormuz'].includes(s.id) && known(s.state)))
  const select = useCallback((id: string) => { setSelectedId(id); setSourceId(null); setAlertsOpen(true); if (mobile) setFiltersOpen(false) }, [mobile])
  const choose = (item: TrackingAsset | MapAlert) => { select(item.id); setFocus({ lat: item.lat, lon: item.lon, zoom: 5, token: Date.now() }) }
  const setView = (key: Region) => { setRegion(key); setFocus({ ...REGIONS[key], token: Date.now() }) }
  const toggleFull = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.current?.requestFullscreen() }
    catch { setError('Fullscreen is unavailable in this browser. The map still fills the Watchtower workspace.') }
  }
  const nearby = selectedAsset ? allAlerts.filter(a => a.kind === 'hazard' && separationKm(a, selectedAsset) <= 350).slice(0, 3) : []
  const nearGateway = selectedAsset ? [...CHOKEPOINTS].sort((a, b) => separationKm(a, selectedAsset) - separationKm(b, selectedAsset))[0] : null
  return <div id="watchtower-map" ref={root} className={styles.shell} dir={ar ? 'rtl' : 'ltr'}>
    <Map assets={assets} historyAssets={allAssets} alerts={alerts} riskZones={riskZones} chokepoints={maritimeFeed?.chokepoints??[]} aisRoutes={aisHistory} layers={layers} selectedId={selectedId} onSelect={select} onChokepointClick={chooseChokepoint} focus={focus} now={now} />
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <div><div className={styles.eyebrow}>NFII / GLOBAL OPERATING PICTURE</div>
          <h1>{tx('Food Security Watchtower', '\u0628\u0631\u062c \u0645\u0631\u0627\u0642\u0628\u0629 \u0627\u0644\u0623\u0645\u0646 \u0627\u0644\u063a\u0630\u0627\u0626\u064a')}</h1>
          <p className={styles.subtitle}>Air & maritime observations / Risk intelligence</p></div>
        <div className={styles.actions}>
          <span className={styles.badge} data-state={paused || staleSnapshot || !recentCount ? 'offline' : 'recent'}><i />{paused ? 'PAUSED' : staleSnapshot ? 'STALE' : recentCount ? 'RECENT / 60s' : 'NO RECENT TRACKS'}</span>
          <button className={styles.iconButton} aria-label="Toggle map filters" aria-pressed={filtersOpen} onClick={() => { setFiltersOpen(!filtersOpen); if (mobile) setAlertsOpen(false) }}><Layers size={15} /></button>
          <button className={styles.iconButton} aria-label="Toggle alert panel" aria-pressed={alertsOpen} onClick={() => { setAlertsOpen(!alertsOpen); if (mobile) setFiltersOpen(false) }}><AlertTriangle size={15} /></button>
          <button className={styles.iconButton} aria-label={paused ? 'Resume automatic updates' : 'Pause automatic updates'} onClick={() => setPaused(!paused)}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
          <button className={styles.iconButton} aria-label="Refresh observations" disabled={busy} onClick={() => setRefresh(v => v + 1)}><RefreshCw size={14} className={busy ? 'animate-spin' : ''} /></button>
          <button className={styles.iconButton} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={() => void toggleFull()}>{fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
        </div>
      </div>
      <div className={styles.stats}>{[
        { label: 'Aircraft observations', value: known(airSource?.state) ? assets.filter(a => a.kind === 'aircraft').length : null, note: cargoOnly ? 'Freight-operator candidates / sampled' : 'Six airframe samples / not all traffic', icon: Plane },
        { label: 'Cargo vessel observations', value: (known(seaSource?.state)||Boolean(maritimeFeed?.chokepoints.some(point=>point.state==='partial'||point.state==='stale'))) ? assets.filter(a => a.kind === 'vessel').length : null, note: gccRadar?.configured ? 'GCC MyShipTracking + public AIS' : maritimeFeed ? 'data-tracking.net Hormuz/Bab · AIS sample' : seaSource?.state === 'unconfigured' ? 'Waiting for public AIS / licensed AIS unavailable' : 'AIS coverage / not global totals', icon: Ship },
        { label: 'Mapped risk reports', value: riskReadable ? externalRiskAlerts.length : null, note: 'External hazard and advisory reports', icon: AlertTriangle },
        { label: 'Food-security signals', value: food && food.assessedCount > 0 ? foodAlerts.length : null, note: staleFood ? 'Stale organization snapshot' : foodError ? 'Organization ledger unavailable' : food ? food.assessedCount + ' commodities assessed / organization' : 'Organization ledger not loaded', icon: Wheat },
      ].map(item => <div key={item.label} className={styles.stat}><label>{item.label}</label><strong>{count(item.value)}</strong><item.icon size={21} /><small>{item.note}</small></div>)}</div>
    </header>
    {error && <div className={styles.statusError} role="alert">{error}</div>}
    <aside className={`${styles.panel} ${styles.filters} ${filtersOpen ? '' : styles.hidePanel}`} aria-label="Map filters">
      <div className={styles.panelTitle}><span>MAP LAYERS & FILTERS</span><button className={styles.iconButton} aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X size={12} /></button></div>
      <label className={styles.label} htmlFor="watchtower-search"><Search size={11} className="inline" /> Search observations</label>
      <input id="watchtower-search" className={styles.input} value={query} maxLength={100} placeholder="Callsign, vessel, MMSI, alert..." onChange={e => setQuery(e.target.value)} />
      {query && <div className={styles.searchMatches}>{assets.slice(0, 6).map(asset => <button key={asset.id} onClick={() => choose(asset)}>{asset.kind === 'aircraft' ? 'AIR' : 'SEA'} / {asset.label}</button>)}</div>}
      <label className={styles.label} htmlFor="watchtower-region">Geographic view</label>
      <select id="watchtower-region" className={styles.input} value={region} onChange={e => setView(e.target.value as Region)}>{Object.entries(REGIONS).map(([key, value]) => <option key={key} value={key}>{value.name}</option>)}</select>
      <div className="mt-2 flex gap-2"><button className={styles.smallButton} onClick={() => setView('global')}><Globe2 size={12} />Global</button><button className={styles.smallButton} onClick={() => { setView('gulf'); setFocus({ ...QATAR, zoom: 6, token: Date.now() }) }}>Qatar</button></div>
      <label className={styles.label} htmlFor="watchtower-gcc-hub">
        GCC ship radar · MyShipTracking
      </label>
      <select id="watchtower-gcc-hub" className={styles.input}
        value={selectedGccHub}
        onChange={e=>{
          const hub=e.target.value as 'all'|GccHubId
          setSelectedGccHub(hub)
          if(hub!=='all'){
            const area=GCC_PORTS.find(x=>x.id===hub)
            if(area){
              setRegion('global');setSelectedChokepoint('all')
              setFocus({lat:area.lat,lon:area.lon,zoom:8,token:Date.now()})
            }
          }
        }}>
        <option value="all">All GCC monitored ports</option>
        {GCC_PORTS.map(h=><option key={h.id} value={h.id}>{h.label}</option>)}
      </select>
      <p className={styles.hint}>
        {gccRadar?.configured?
          <>{gccRadar.moving} moving cargo-type vessels · {gccRadar.withRoutes} modeled route pairs.
            Last checked {utc(gccRadar.generatedAt)}. 5-minute browser polling;
            locations and voyage names depend on licensed terrestrial AIS.</>:
          <>Optional licensed MyShipTracking API not configured for this organization.
            Existing public AIS feeds remain in use.</>}
        {gccRadar?.creditsCharged!=null?' Credits last scan: '+gccRadar.creditsCharged+'.':''}
        {gccRadarError?' '+gccRadarError:''}
      </p>
      <hr className={styles.divider} />
      <label className={styles.label} htmlFor="watchtower-chokepoint">
        Cargo ships · maritime chokepoints
      </label>
      <select id="watchtower-chokepoint" className={styles.input}
        value={selectedChokepoint}
        onChange={e=>{
          const next=e.target.value as 'all'|ChokepointId
          if(next==='all'){setSelectedChokepoint('all');setView('global')}
          else chooseChokepoint(next)
        }}>
        <option value="all">All monitored chokepoints</option>
        {TRACKED_CHOKEPOINTS.map(point=><option key={point.id} value={point.id}>
          {point.label}{point.feed?'':' · feed unavailable'}
        </option>)}
      </select>
      <div className={styles.chokepointList}>
        {TRACKED_CHOKEPOINTS.map(point=>{
          const report=chokepointReport(point.id)
          const status=report?.state??(point.feed?'unavailable':'not_covered')
          return <button key={point.id} type="button" className={styles.chokepointItem}
            aria-pressed={selectedChokepoint===point.id}
            onClick={()=>chooseChokepoint(point.id)}>
            <span className={styles.chokepointName}>{point.label}</span>
            <span data-state={status} className={styles.chokepointState}>
              {status==='not_covered'?'NO FEED':status==='stale'?'STALE':
                status==='unavailable'?'OFFLINE':'AIS DATA'}
            </span>
            <small>
              {report?.vesselCount===null||report?.vesselCount===undefined?'N/A':report.vesselCount}
              {' '}cargo-like AIS · {report?.crossings24h??'N/A'} all-vessel 24h crossings
            </small>
          </button>
        })}
      </div>
      <p className={styles.hint}>
        Source: <a href="https://hormuz.data-tracking.net/api-docs" target="_blank"
          rel="noopener noreferrer">data-tracking.net (CC BY 4.0)</a>.
        {' '}AIS observations update around every 30 minutes, not continuously.
        Cargo vessel type does not establish food on board.
        {maritimeError?' '+maritimeError:''}
        {' '}{aisHistoryStatus}
      </p>
      <hr className={styles.divider} />
      {([
        ['aircraft', Plane, 'Aircraft'], ['vessels', Ship, 'Cargo vessels'], ['risks', AlertTriangle, 'Risk reports'], ['production', Wheat, 'Food production exposure zones'], ['gateways', Globe2, 'Strategic chokepoints'], ['trails', Activity, 'Origin / recorded past'], ['projections', Activity, 'Destination / estimated future'],
      ] as const).map(([key, Icon, title]) => <button key={key} className={styles.toggle} aria-pressed={layers[key]} onClick={() => setLayers(current => ({ ...current, [key]: !current[key] }))}><span><Icon size={13} />{title}</span><i className={styles.switch} /></button>)}
      <hr className={styles.divider} />
      <button className={styles.toggle} aria-pressed={cargoOnly} onClick={() => setCargoOnly(!cargoOnly)}><span>Freight operators only</span><i className={styles.switch} /></button>
      <label className={styles.label} htmlFor="watchtower-alert-type">Alert category</label>
      <select id="watchtower-alert-type" className={styles.input} value={alertKind} onChange={e => setAlertKind(e.target.value)}><option value="all">All categories</option><option value="food">Food security</option><option value="hazard">Weather & natural hazards</option><option value="aviation">Aviation advisories</option><option value="maritime">Maritime incident reports</option></select>
      <button className={styles.toggle} aria-pressed={highOnly} onClick={() => setHighOnly(!highOnly)}><span>High signals only</span><i className={styles.switch} /></button>
      <label className={styles.label} htmlFor="watchtower-production-risk">Production risk driver</label>
      <select id="watchtower-production-risk" className={styles.input} value={productionKind}
        onChange={e=>setProductionKind(e.target.value as 'all'|ProductionDriver)}>
        <option value="all">All production hazards</option>
        <option value="drought">Drought</option><option value="flood">Flood</option>
        <option value="storm">Cyclones / storms</option><option value="wildfire">Wildfire</option>
        <option value="volcano">Volcanic ash</option><option value="earthquake">Infrastructure exposure</option>
      </select>
      <p className={styles.hint}>
        <strong>{riskZones.length}</strong> screening zones from reported GDACS events.
        Regional polygons indicate administrative exposure only, NOT proven crop losses.
        {productionRisk?.status==='unavailable'?' GDACS unavailable.':''}
        {productionError?' '+productionError:''}
      </p>

      <label className={styles.label} htmlFor="watchtower-commodity">Food commodity</label>
      <select id="watchtower-commodity" className={styles.input} value={commodity} disabled={!food} onChange={e => setCommodity(e.target.value)}><option value="all">All commodities</option>{food?.commodities.map(c => <option key={c.commodityId} value={c.commodityId}>{ar ? c.nameAr : c.name}</option>)}</select>
      <p className={styles.hint}>
        <strong>{itineraryCount}</strong> {tx('vehicles have provider-reported origin and destination,',
          'وسائل نقل لديها نقطة انطلاق ووصول من المزود،')}
        {' '}<strong>{mapReadyItineraryCount}</strong> {tx('have enough geocoded evidence for a reference itinerary on the map.',
          'لديها أدلة مكانية كافية لرسم مسار مرجعي.')}
        {' '}{tx('Reference itineraries are not actual flown/sailed tracks; only solid observed tracks prove movement.',
          'المسارات المرجعية ليست مسارات طيران أو إبحار مؤكدة؛ فقط الرصد الفعلي يدل على الحركة.')}
      </p>
    </aside>
    <div className={styles.feedDock} aria-label="Tracking source status">
      {snapshot?.sources.map(source => <button key={source.id} className={styles.feedPill} data-state={source.state} onClick={() => { setSourceId(source.id); setSelectedId(null); setAlertsOpen(true); if (mobile) setFiltersOpen(false) }}><i />{source.name}: {source.state}</button>)}
      {gccRadar?.configured&&<span className={styles.feedPill} data-state={gccRadar.status}><i />GCC radar: {gccRadar.status} · 5m</span>}
      {maritimeFeed?.chokepoints.filter(c=>c.id==='hormuz'||c.id==='bab_el_mandeb').map(area=>
        <button key={area.id} type="button" className={styles.feedPill} data-state={area.state}
          onClick={()=>chooseChokepoint(area.id)}><i />AIS {area.label}: {area.state}</button>)}
    </div>
    <aside className={`${styles.panel} ${styles.alertPanel} ${alertsOpen ? '' : styles.hidePanel}`} aria-label="Alerts and selected observation">
      <div className={styles.panelTitle}><span>{selectedSource ? 'SOURCE STATUS' : selectedProductionZone ? 'PRODUCTION RISK EXPOSURE' : selectedId ? 'OBSERVATION DETAILS' : 'FOOD SECURITY & RISK'}</span><button className={styles.iconButton} aria-label={selectedId || sourceId ? 'Back to alerts' : 'Close alert panel'} onClick={() => { if (selectedId || sourceId) { setSelectedId(null); setSourceId(null) } else setAlertsOpen(false) }}>{selectedId || sourceId ? <ChevronLeft size={12} /> : <X size={12} />}</button></div>
      <div className={styles.scroll}>
        {selectedSource ? <div className={styles.details}><Radio size={24} /><h2>{selectedSource.name}</h2><span className={styles.severity}>{selectedSource.state}</span><p className="mt-3">{selectedSource.detail}</p><div className={styles.detailGrid}><div><span>Last checked</span><strong>{utc(selectedSource.checkedAt)}</strong></div><div><span>Latest observation</span><strong>{utc(selectedSource.latestObservationAt)}</strong></div></div><a href={selectedSource.url} target="_blank" rel="noopener noreferrer">Provider documentation <ExternalLink size={11} className="inline" /></a><p className={styles.notice}>Unavailable coverage means unknown traffic or risk, not zero. Refreshing the screen does not make an old observation live.</p></div>
        : selectedProductionZone ? <div className={styles.details}>
          <div className={styles.riskZoneHeading}>
            <span className={styles.severity} data-level={selectedProductionZone.severity==='high'?'high':'attention'}>
              {selectedProductionZone.severity==='high'?'HIGH EXPOSURE':'ELEVATED EXPOSURE'}
            </span>
            <h2>{selectedProductionZone.name}</h2>
            <p>{selectedProductionZone.country??'Regional location unresolved'} ·
              {' '}{selectedProductionZone.driver.toUpperCase()}</p>
          </div>
          <div className={styles.detailGrid}>
            <div><span>Last event report</span><strong>{utc(selectedProductionZone.observedAt)}</strong></div>
            <div><span>Source evidence</span><strong>{selectedProductionZone.evidenceCount} GDACS report(s)</strong></div>
            <div><span>Area basis</span><strong>{selectedProductionZone.boundaryBasis==='esri_admin1_screening'?
              'Administrative region':'Approximate point radius'}</strong></div>
            <div><span>Price increase measured</span><strong>Not available</strong></div>
          </div>
          <h3 className={styles.riskSubtitle}>Possible production exposure</h3>
          <p>{selectedProductionZone.productionExposure}</p>
          <h3 className={styles.riskSubtitle}>Potential cost transmission</h3>
          <p>{selectedProductionZone.costChannels}</p>
          <p className={styles.notice}>{selectedProductionZone.scopeNote} Crop production volume,
            affected cultivated hectares and price impact have not been verified.
            This is a screening warning, not a loss estimate or financial forecast.</p>
          <a target="_blank" rel="noopener noreferrer" href={selectedProductionZone.sourceUrl}>
            View GDACS event report <ExternalLink size={12} className="inline"/>
          </a>
          <p className={styles.hint}>Only events identified by the current sources are mapped.
            A missing polygon is not proof that agricultural production is safe.</p>
        </div>
        : selectedAsset ? <div className={styles.details}>
          {selectedAsset.kind === 'aircraft' ? <Plane size={25} /> : <Ship size={25} />}<h2>{selectedAsset.label}</h2>
          <span className={styles.severity}>{freshAsset(selectedAsset, now) ? 'RECENT OBSERVATION' : 'STALE POSITION'}</span>
          <div className={styles.detailGrid}>{[
            ['Identifier', selectedAsset.id.split(':')[1]], ['Last observed', age(selectedAsset.observedAt, now)], ['Type', selectedAsset.type || 'Unknown'],
            ['Speed', selectedAsset.speedKnots === null ? 'Unknown' : selectedAsset.speedKnots.toFixed(1) + ' kn'],
            ['Heading', selectedAsset.heading === null ? 'Unknown' : selectedAsset.heading.toFixed(0) + ' deg'],
            [selectedAsset.kind === 'aircraft' ? 'Altitude' : 'AIS destination', selectedAsset.kind === 'aircraft' ? (selectedAsset.altitudeFt === null ? 'Unknown' : selectedAsset.altitudeFt.toLocaleString() + ' ft') : selectedAsset.destination ?? 'Not reported'],
          ].map(([title, value]) => <div key={title}><span>{title}</span><strong>{value}</strong></div>)}</div>
          <p>{selectedAsset.lat.toFixed(4)}, {selectedAsset.lon.toFixed(4)} / {utc(selectedAsset.observedAt)}</p>
          <div className={styles.routeDetail}>
            <h3>Origin → Destination</h3>
            {selectedAsset.itinerary ? <>
              <div className={styles.detailGrid}>
                <div><span>Departure / last reported port</span>
                  <strong>{selectedAsset.itinerary.origin?.name??'Unavailable'}</strong>
                  <small>{selectedAsset.itinerary.origin?.code??'No verified code'}</small>
                </div>
                <div><span>Reported destination</span>
                  <strong>{selectedAsset.itinerary.destination?.name??'Unavailable'}</strong>
                  <small>{selectedAsset.itinerary.destination?.code??'No verified code'}</small>
                </div>
                <div><span>Departure time</span><strong>{utc(selectedAsset.itinerary.departureAt)}</strong></div>
                <div><span>Estimated arrival</span><strong>{utc(selectedAsset.itinerary.etaAt)}</strong></div>
              </div>
              <p className={styles.notice}>
                {selectedAsset.itinerary.confidence === 'lookup_plausible'?'Plausible callsign route lookup':
                  selectedAsset.itinerary.confidence === 'lookup_unverified'?'Unverified callsign lookup':'Crew-reported AIS / last-port data'}.
                {' '}{selectedAsset.itinerary.description}
              </p>
              <p>Map: dotted green = origin to latest position <strong>(reference, not proven travel)</strong>;
                dashed amber = latest position to destination <strong>(reference, not confirmed planned routing)</strong>.
                Solid green appears only for actual observed fixes.
                {selectedAsset.kind==='vessel'&&!selectedAsset.itinerary.modelSeaLegs?
                  ' A navigable maritime line is unavailable without resolved ports and an ocean-network geometry.':''}
              </p>
              <a href={selectedAsset.itinerary.sourceUrl} target="_blank" rel="noopener noreferrer">
                Itinerary source <ExternalLink size={11} className="inline"/>
              </a>
            </> : <p>Origin and destination are not returned by the connected tracking sources
              for this vehicle. The aircraft callsign / vessel identifier alone does not establish a journey.</p>}
          </div>
          <div className={styles.routeDetail}>
            <h3>Observed track</h3>
            <p>The solid green line contains only real position updates collected while this page has been open. Origin-to-position and position-to-destination routes are shown as labelled references when provider data is available. No short heading guides or artificial forward projections are drawn.</p>
          </div>
          {selectedAsset.hubId&&<div className={styles.routeDetail}>
            <h3>GCC port radar · MyShipTracking</h3>
            <p>{GCC_PORTS.find(h=>h.id===selectedAsset.hubId)?.label}</p>
            <p>Real terrestrial AIS fix: {utc(selectedAsset.observedAt)}. Port names are source-reported; maritime reference lines are modeled, not verified sailed routes.</p>
          </div>}
          {selectedAsset.chokepointId&&<div className={styles.routeDetail}>
            <h3>Maritime chokepoint observation</h3>
            <p>{TRACKED_CHOKEPOINTS.find(point=>point.id===selectedAsset.chokepointId)?.label}</p>
            <p><strong>{selectedAsset.observationBasis==='position_report'?
              'Ship-specific AIS position timestamp':'Source snapshot timestamp only'}</strong></p>
            <p>Reported {utc(selectedAsset.observedAt)} · {age(selectedAsset.observedAt,now)}.</p>
            <p>History: {aisHistory.find(route=>route.id===selectedAsset.id)?.points??'Not loaded'}
              {' '}real AIS fixes mapped over the last 7 days. Missing tracks are not invented.</p>
            <p>Provider: data-tracking.net, CC BY 4.0. AIS positions may be delayed,
              missing or distorted. Transit and destination are not confirmed cargo shipments.</p>
            <a href={TRACKED_CHOKEPOINTS.find(point=>point.id===selectedAsset.chokepointId)?.pageUrl??'https://hormuz.data-tracking.net/'}
              target="_blank" rel="noopener noreferrer">Open source tracking <ExternalLink size={11} className="inline" /></a>
          </div>}
          <p className={styles.notice}>{selectedAsset.cargo === 'ais_cargo_class' ? 'AIS class identifies a cargo vessel.' : selectedAsset.cargo === 'operator_inferred' ? 'Freight-operator callsign heuristic, not a verified cargo manifest.' : 'Aircraft type alone does not confirm a cargo flight.'} Food cargo, supplier and purchase-order linkage are unverified.</p>
          {nearGateway && separationKm(selectedAsset, nearGateway) < 600 && <p>Reference proximity: {nearGateway.label}, approximately {Math.round(separationKm(selectedAsset, nearGateway))} km. Not evidence of crossing or disruption.</p>}
          {nearby.map(alert => <button key={alert.id} className={styles.alert} onClick={() => choose(alert)}><strong>{alert.title}</strong><p>Reported point within 350 km. Proximity only, not confirmed impact.</p></button>)}
          <a href={selectedAsset.sourceUrl} target="_blank" rel="noopener noreferrer">{selectedAsset.source} <ExternalLink size={11} className="inline" /></a>
        </div> : selectedAlert ? <div className={styles.details}>
          <span className={styles.severity} data-level={selectedAlert.severity}>{selectedAlert.severity}</span><h2>{selectedAlert.title}</h2><p>{selectedAlert.detail}</p>
          <div className={styles.detailGrid}><div><span>Source</span><strong>{selectedAlert.source}</strong></div><div><span>Reported / reviewed</span><strong>{utc(selectedAlert.observedAt)}</strong></div></div>
          <p className={styles.notice}>{selectedAlert.locationBasis}</p>
          <a href={selectedAlert.sourceUrl} target={selectedAlert.sourceUrl.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer">Review source evidence <ArrowUpRight size={12} className="inline" /></a>
          <p className={styles.hint}>Operational impact requires a matching supplier, commodity and shipment. No disruption probability or automatic rerouting is asserted.</p>
          <Link className={styles.smallButton} href="/dashboard/logistics">Compare logistics <ArrowUpRight size={12} /></Link>
        </div> : selectedId ? <p className={styles.empty}>This observation is no longer in the current feed. Return to alerts or search for another asset.</p> : <>
          <p className={styles.hint}>Source-backed aviation, maritime and natural-hazard reports. Organization food ledger records are excluded from this alert list. Reports do not confirm disruption to food shipments.</p>
          {(staleSnapshot || paused) && <p className={styles.notice}>{paused ? 'Automatic updates paused. Positions will age.' : 'Tracking snapshot is stale. Source availability may have changed.'}</p>}
          <div className="mt-3">{externalRiskAlerts.map(alert => <button key={alert.id} className={styles.alert} onClick={() => choose(alert)}><div className={styles.alertHead}><span className={styles.severity} data-level={alert.severity}>{alert.severity}</span><small>{alert.source}</small></div><strong>{alert.title}</strong><p>{alert.kind === 'food' ? 'Organization-level signal' : alert.kind === 'aviation' ? 'Advisory / not a verified closure' : alert.kind === 'maritime' ? 'Regional report / position approximate' : 'Reported hazard / impact unverified'}</p></button>)}</div>
          {!externalRiskAlerts.length && <p className={styles.empty}>{busy ? 'Loading source-backed observations...' : 'No matching mapped reports in this response. Missing feeds are not evidence that a corridor is safe.'}</p>}
        </>}
      </div>
    </aside>
    <div className={styles.legend}><span><Plane size={12} color="var(--growa-sage)" />Aircraft</span><span><Ship size={12} color="var(--growa-ink-600)" />Cargo vessel</span><span><AlertTriangle size={12} color="var(--warning-strong)" />Reported risk</span><span><i className={styles.productionRiskSwatch} />Production risk areas ({layers.production?riskZones.length:0})</span><span><i className={styles.routePastLine} />Observed</span><span><i className={styles.routeOriginLine} />From origin (reference)</span><span><i className={styles.routeFutureLine} />To destination (reference)</span></div>
    <footer className={styles.footer}><span>{busy ? 'UPDATING SOURCES' : snapshot ? 'SNAPSHOT ' + utc(snapshot.generatedAt) : 'CONNECTING TO SOURCES'} / {paused ? 'PAUSED' : 'AUTO 60s'}</span><span>ESRI POLITICAL MAP · ADSB.lol / ODbL 1.0 · data-tracking.net / CC BY 4.0 · No simulated traffic</span></footer>
  </div>
}
